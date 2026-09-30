import React, { useState, useEffect } from 'react';
import {
  ParticipantSummaryItem,
  RawBidOfferRecord,
  SlotClearingResult,
  EmailLogEntry,
} from '../types';
import {
  collectParticipantSlotData,
  buildParticipantEmail,
  sendBatchNotifications,
  sendSingleNotification,
  verifyEmailProvider,
  getEmailConfig,
  saveEmailConfig,
  EmailProviderConfig,
  GOOGLE_APPS_SCRIPT_TEMPLATE,
  generateMailtoLink,
  generateGmailWebLink,
} from '../services/emailService';
import {
  Mail,
  Send,
  Play,
  CheckCircle2,
  AlertCircle,
  Download,
  Eye,
  Edit2,
  Check,
  X,
  ExternalLink,
  ShieldCheck,
  RefreshCw,
  Loader2,
  Cpu,
  Copy,
  Code,
  Zap,
} from 'lucide-react';

interface EmailNotificationsTabProps {
  participantSummaries: ParticipantSummaryItem[];
  buyers: RawBidOfferRecord[];
  sellers: RawBidOfferRecord[];
  results: Record<number, SlotClearingResult>;
  nSlots: number;
  sessionLabel: string;
  hasComputed?: boolean;
  onPreviewEmail: (participant: ParticipantSummaryItem) => void;
  onRunCompute?: () => void;
  onUpdateParticipantEmail?: (participantName: string, newEmail: string) => void;
}

export const EmailNotificationsTab: React.FC<EmailNotificationsTabProps> = ({
  participantSummaries,
  buyers,
  sellers,
  results,
  nSlots,
  sessionLabel,
  hasComputed = false,
  onPreviewEmail,
  onRunCompute,
  onUpdateParticipantEmail,
}) => {
  const [logs, setLogs] = useState<EmailLogEntry[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [statusType, setStatusType] = useState<'success' | 'error' | 'info'>('info');
  const [showConfig, setShowConfig] = useState(false);
  
  // Email provider configuration
  const [emailConfig, setEmailConfig] = useState<EmailProviderConfig>(() => getEmailConfig());
  const [isVerifying, setIsVerifying] = useState(false);
  const [verifyResult, setVerifyResult] = useState<{ success: boolean; message: string } | null>(null);
  const [hasCopiedScript, setHasCopiedScript] = useState(false);

  // Inline email editing state
  const [editingName, setEditingName] = useState<string | null>(null);
  const [tempEmail, setTempEmail] = useState('');

  // Per-row sending state
  const [sendingRowName, setSendingRowName] = useState<string | null>(null);

  const isCalculated = hasComputed && participantSummaries.length > 0;
  const clearedCount = isCalculated ? Object.values(results).filter((r) => r && r.status === 'Cleared').length : 0;
  const withEmailCount = isCalculated ? participantSummaries.filter((p) => p.email && p.email.includes('@')).length : 0;
  const withoutEmailCount = isCalculated ? participantSummaries.length - withEmailCount : 0;

  // Persist email configuration changes
  const updateConfig = (updates: Partial<EmailProviderConfig>) => {
    setEmailConfig((prev) => {
      const next = { ...prev, ...updates };
      saveEmailConfig(next);
      return next;
    });
    setVerifyResult(null);
  };

  // Test provider connection
  const handleTestConnection = async () => {
    setIsVerifying(true);
    setVerifyResult(null);
    try {
      const res = await verifyEmailProvider(emailConfig);
      if (res.success) {
        setVerifyResult({
          success: true,
          message: res.message || 'Provider connection verified successfully!',
        });
      } else {
        setVerifyResult({
          success: false,
          message: res.error || 'Verification failed. Please check configuration settings.',
        });
      }
    } catch (err: any) {
      setVerifyResult({
        success: false,
        message: err.message || String(err),
      });
    } finally {
      setIsVerifying(false);
    }
  };

  // Copy Google Apps Script code to clipboard
  const handleCopyScript = () => {
    navigator.clipboard.writeText(GOOGLE_APPS_SCRIPT_TEMPLATE);
    setHasCopiedScript(true);
    setTimeout(() => setHasCopiedScript(false), 2500);
  };

  // Start editing a participant's email
  const startEditEmail = (p: ParticipantSummaryItem) => {
    setEditingName(p.name);
    setTempEmail(p.email || '');
  };

  // Save participant email edit
  const saveEmailEdit = (name: string) => {
    const trimmed = tempEmail.trim();
    if (onUpdateParticipantEmail) {
      onUpdateParticipantEmail(name, trimmed);
    } else {
      const item = participantSummaries.find((p) => p.name === name);
      if (item) item.email = trimmed;
    }
    setEditingName(null);
  };

  // Send email to a single participant
  const handleSendSingle = async (p: ParticipantSummaryItem) => {
    if (!p.email || !p.email.includes('@')) {
      alert(`Please enter a valid email address for ${p.name} first.`);
      startEditEmail(p);
      return;
    }

    setSendingRowName(p.name);
    const slotData = collectParticipantSlotData(
      p.name,
      p.role,
      buyers,
      sellers,
      results,
      nSlots
    );
    const email = buildParticipantEmail(
      p.name,
      p.role,
      slotData,
      sessionLabel,
      clearedCount,
      nSlots
    );

    try {
      const res = await sendSingleNotification({
        to: p.email,
        subject: email.subject,
        html: email.html,
        text: email.text,
      });

      if (res.success) {
        setStatusType('success');
        setStatusMessage(`Notification successfully sent to ${p.name} (${p.email})!`);
        setLogs((prev) => [
          {
            name: p.name,
            role: p.role,
            email: p.email,
            status: 'sent',
            attempts: 1,
            awarded_mw: p.actual_dispatch_drawl_mw,
            amount_nrs: p.total_settlement_nrs,
            sent_at: new Date().toISOString(),
          },
          ...prev.filter((l) => l.name !== p.name),
        ]);
      } else {
        setStatusType('error');
        setStatusMessage(
          `Automatic delivery to ${p.name} failed: ${res.error || 'Unknown email provider error'}. ` +
          `Use "Web Gmail" to send the notification manually.`
        );
      }
    } catch (err: any) {
      setStatusType('error');
      setStatusMessage(
        `Automatic delivery to ${p.name} failed: ${err?.message || String(err)}. ` +
        `Use "Web Gmail" to send the notification manually.`
      );
    } finally {
      setSendingRowName(null);
    }
  };

  // Automated Batch Notification Dispatch for ALL Participants
  const handleSendBatch = async (dryRun = false) => {
    if (!hasComputed) {
      alert('Please run the market clearing computation in the Compute tab first.');
      return;
    }

    setIsSending(true);
    setStatusType('info');
    setStatusMessage(dryRun ? 'Running dry-run simulation...' : 'Starting automated dispatch to all participants...');

    const jobs = participantSummaries.map((p) => {
      const slotData = collectParticipantSlotData(
        p.name,
        p.role,
        buyers,
        sellers,
        results,
        nSlots
      );
      const email = buildParticipantEmail(
        p.name,
        p.role,
        slotData,
        sessionLabel,
        clearedCount,
        nSlots
      );

      return {
        name: p.name,
        email: p.email,
        role: p.role,
        subject: email.subject,
        html: email.html,
        text: email.text,
        awarded_mw: p.actual_dispatch_drawl_mw,
        amount_nrs: p.total_settlement_nrs,
      };
    });

    try {
      const resultLogs = await sendBatchNotifications(jobs, dryRun, undefined, (progress) => {
        setStatusMessage(
          `Dispatching notifications (${progress.current}/${progress.total}): ${progress.name}...`
        );
      });

      setLogs(resultLogs);
      const sentCount = resultLogs.filter((l) => l.status === 'sent').length;
      const failedCount = resultLogs.filter((l) => l.status === 'failed').length;
      const dryCount = resultLogs.filter((l) => l.status === 'dry_run').length;

      if (dryRun) {
        setStatusType('success');
        setStatusMessage(`Dry-run completed: ${dryCount} message(s) previewed successfully.`);
      } else if (failedCount > 0) {
        setStatusType('error');
        setStatusMessage(`Batch completed: ${sentCount} sent, ${failedCount} failed. Check audit log for details.`);
      } else {
        setStatusType('success');
        setStatusMessage(`Batch dispatch completed: All ${sentCount} participant notifications sent successfully!`);
      }
    } catch (err: any) {
      setStatusType('error');
      setStatusMessage(`Error during batch notification: ${err.message || String(err)}`);
    } finally {
      setIsSending(false);
    }
  };

  const exportEmailLogCSV = () => {
    if (logs.length === 0) return;
    const header = ['Participant', 'Role', 'Email', 'Status', 'Attempts', 'Awarded_MW', 'Amount_NRs', 'Timestamp', 'Error'];
    const rows = logs.map((l) => [
      `"${l.name.replace(/"/g, '""')}"`,
      l.role,
      `"${l.email}"`,
      l.status,
      l.attempts,
      l.awarded_mw.toFixed(3),
      l.amount_nrs.toFixed(2),
      `"${l.sent_at}"`,
      `"${(l.error || '').replace(/"/g, '""')}"`,
    ]);

    const csvContent = [header.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `market_email_dispatch_log_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
  };

  return (
    <div className="space-y-6">
      {/* Notice if not computed */}
      {!hasComputed && (
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-indigo-200 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xs">
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-xl bg-indigo-600 text-white shadow-sm shrink-0">
              <Mail className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-slate-900">
                Market Equilibrium Not Yet Computed
              </h3>
              <p className="text-xs text-slate-600 mt-0.5">
                Participant transaction confirmation emails require computed nodal Market Clearing Prices and awarded dispatch obligations.
              </p>
            </div>
          </div>
          {onRunCompute && (
            <button
              onClick={onRunCompute}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-sm transition-all active:scale-95 cursor-pointer shrink-0"
            >
              <Cpu className="w-4 h-4 text-amber-300" />
              <span>Compute Market First</span>
            </button>
          )}
        </div>
      )}

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
            Total Recipients
          </span>
          <div className="text-2xl font-extrabold font-mono text-indigo-950">
            {participantSummaries.length}
          </div>
          <p className="text-xs text-slate-500 mt-1">Sellers + Buyers from Form</p>
        </div>

        <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
            Valid Emails
          </span>
          <div className="text-2xl font-extrabold font-mono text-emerald-700">
            {withEmailCount}
          </div>
          <p className="text-xs text-slate-500 mt-1">Ready for transaction updates</p>
        </div>

        <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
            Missing Email
          </span>
          <div className="text-2xl font-extrabold font-mono text-amber-600">
            {withoutEmailCount}
          </div>
          <p className="text-xs text-slate-500 mt-1">Can be added via inline edit</p>
        </div>

        <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
            Dispatched In Session
          </span>
          <div className="text-2xl font-extrabold font-mono text-blue-700">
            {logs.filter((l) => l.status === 'sent' || l.status === 'dry_run').length}
          </div>
          <p className="text-xs text-slate-500 mt-1">Recorded in dispatch log</p>
        </div>
      </div>

      {/* Control Card */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-slate-900">
                Automated Participant Email Dispatcher
              </h2>
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                emailConfig.provider === 'google_script'
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                  : emailConfig.provider === 'brevo'
                  ? 'bg-blue-50 text-blue-800 border-blue-200'
                  : emailConfig.provider === 'resend'
                  ? 'bg-purple-50 text-purple-800 border-purple-200'
                  : 'bg-amber-50 text-amber-800 border-amber-200'
              }`}>
                <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
                <span>
                  {emailConfig.provider === 'google_script'
                    ? 'Google Apps Script Relay (HTTPS)'
                    : emailConfig.provider === 'brevo'
                    ? 'Brevo API (HTTPS)'
                    : emailConfig.provider === 'resend'
                    ? 'Resend API (HTTPS)'
                    : 'Direct Gmail SMTP'}
                </span>
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Dispatches automated confirmation notifications with cleared prices, awarded MW, and settlement amounts to all participants.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => setShowConfig(!showConfig)}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 transition-colors shadow-2xs cursor-pointer"
            >
              <span>⚙ {showConfig ? 'Hide Email Settings' : 'Email Provider Settings'}</span>
            </button>

            <button
              onClick={() => handleSendBatch(true)}
              disabled={isSending || !hasComputed}
              className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 transition-colors shadow-2xs disabled:opacity-50 cursor-pointer"
            >
              <Play className="w-3.5 h-3.5 text-indigo-600" />
              <span>Dry Run Preview</span>
            </button>

            <button
              onClick={() => handleSendBatch(false)}
              disabled={isSending || !hasComputed}
              className="flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white transition-all shadow-sm active:scale-95 disabled:opacity-50 cursor-pointer"
            >
              {isSending ? <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-300" /> : <Zap className="w-3.5 h-3.5 text-amber-300 fill-amber-300" />}
              <span>{isSending ? 'Dispatching to All...' : 'Dispatch All Notifications'}</span>
            </button>
          </div>
        </div>

        {/* Multi-Provider Configuration Drawer */}
        {showConfig && (
          <div className="mb-5 p-4.5 bg-slate-50/80 border border-slate-200 rounded-2xl space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200/80 pb-3">
              <div>
                <span className="font-bold text-xs text-slate-900 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-indigo-600" />
                  <span>Outbound Email Provider Setup (Cloud &amp; Render Compatible)</span>
                </span>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Render Free Plan blocks raw SMTP (ports 465/587). Use <strong>Google Apps Script</strong>, <strong>Brevo API</strong>, or <strong>Resend API</strong> for HTTPS Port 443 delivery.
                </p>
              </div>

              {/* Provider Selector Tabs */}
              <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200 shadow-2xs">
                <button
                  type="button"
                  onClick={() => updateConfig({ provider: 'google_script' })}
                  className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                    emailConfig.provider === 'google_script'
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Google Script (Free)
                </button>
                <button
                  type="button"
                  onClick={() => updateConfig({ provider: 'brevo' })}
                  className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                    emailConfig.provider === 'brevo'
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Brevo API
                </button>
                <button
                  type="button"
                  onClick={() => updateConfig({ provider: 'resend' })}
                  className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                    emailConfig.provider === 'resend'
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Resend API
                </button>
                <button
                  type="button"
                  onClick={() => updateConfig({ provider: 'smtp' })}
                  className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                    emailConfig.provider === 'smtp'
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Direct SMTP
                </button>
              </div>
            </div>

            {/* Google Apps Script Option */}
            {emailConfig.provider === 'google_script' && (
              <div className="space-y-3">
                <div className="bg-white p-3.5 rounded-xl border border-emerald-200/90 shadow-2xs space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-emerald-950 flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <span>Google Apps Script Free Gmail Relay (Recommended for Render)</span>
                    </span>
                    <button
                      type="button"
                      onClick={handleCopyScript}
                      className="flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-bold rounded-lg bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-300 transition-colors cursor-pointer"
                    >
                      {hasCopiedScript ? <Check className="w-3.5 h-3.5 text-emerald-700" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{hasCopiedScript ? 'Script Copied!' : 'Copy Apps Script Code'}</span>
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-600 leading-relaxed">
                    Sends directly from your Gmail account (<strong>{emailConfig.senderEmail}</strong>) via Google's cloud over HTTPS port 443 with zero port blocking, zero spam filters, and zero monthly fees!
                  </p>
                  <div>
                    <label className="text-[11px] font-bold text-slate-700 block mb-1">
                      Google Apps Script Web App Deployment URL
                    </label>
                    <input
                      type="url"
                      value={emailConfig.googleAppsScriptUrl || ''}
                      onChange={(e) => updateConfig({ googleAppsScriptUrl: e.target.value })}
                      placeholder="https://script.google.com/macros/s/.../exec"
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono text-xs focus:bg-white focus:border-indigo-600 outline-none"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Brevo API Option */}
            {emailConfig.provider === 'brevo' && (
              <div className="space-y-3">
                <div className="bg-white p-3.5 rounded-xl border border-blue-200/90 shadow-2xs space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-blue-950 flex items-center gap-1.5">
                      <Zap className="w-4 h-4 text-blue-600" />
                      <span>Brevo HTTP REST API (300 Free Emails Every Day)</span>
                    </span>
                    <a
                      href="https://app.brevo.com/settings/keys/api"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[11px] font-bold text-blue-700 hover:underline flex items-center gap-1"
                    >
                      <span>Get Free API Key</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                  <p className="text-[11px] text-slate-600 leading-relaxed">
                    Sends transactional emails over HTTPS port 443. Works 100% reliably on Render free and paid instances without any port blocks.
                  </p>
                  <div>
                    <label className="text-[11px] font-bold text-slate-700 block mb-1">
                      Brevo API Key (starts with xkeysib-...)
                    </label>
                    <input
                      type="password"
                      value={emailConfig.brevoApiKey || ''}
                      onChange={(e) => updateConfig({ brevoApiKey: e.target.value })}
                      placeholder="xkeysib-..."
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono text-xs focus:bg-white focus:border-indigo-600 outline-none"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Resend API Option */}
            {emailConfig.provider === 'resend' && (
              <div className="space-y-3">
                <div className="bg-white p-3.5 rounded-xl border border-purple-200/90 shadow-2xs space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-purple-950 flex items-center gap-1.5">
                      <Zap className="w-4 h-4 text-purple-600" />
                      <span>Resend HTTP REST API (100 Free Emails / Day)</span>
                    </span>
                    <a
                      href="https://resend.com/api-keys"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[11px] font-bold text-purple-700 hover:underline flex items-center gap-1"
                    >
                      <span>Get Resend Key</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-slate-700 block mb-1">
                      Resend API Key (re_...)
                    </label>
                    <input
                      type="password"
                      value={emailConfig.resendApiKey || ''}
                      onChange={(e) => updateConfig({ resendApiKey: e.target.value })}
                      placeholder="re_..."
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono text-xs focus:bg-white focus:border-indigo-600 outline-none"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Direct Gmail SMTP Option */}
            {emailConfig.provider === 'smtp' && (
              <div className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
                  <div>
                    <label className="text-[11px] font-bold text-slate-700 block mb-1">Sender Email</label>
                    <input
                      type="email"
                      value={emailConfig.senderEmail || ''}
                      onChange={(e) => updateConfig({ senderEmail: e.target.value })}
                      placeholder="neupanesandeep500@gmail.com"
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono text-xs focus:bg-white focus:border-indigo-600 outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-slate-700 block mb-1">16-Char Google App Password</label>
                    <input
                      type="password"
                      value={emailConfig.appPassword || ''}
                      onChange={(e) => updateConfig({ appPassword: e.target.value })}
                      placeholder="kroetysmnrlvzomr"
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono text-xs focus:bg-white focus:border-indigo-600 outline-none"
                    />
                  </div>
                  <div className="sm:col-span-2 text-[11px] text-amber-700 bg-amber-50 p-2 rounded-lg border border-amber-200">
                    ⚠ Note: Render free tier blocks outbound SMTP ports 465/587. Direct SMTP requires Render paid tier or local hosting.
                  </div>
                </div>
              </div>
            )}

            {/* Connection Test & Feedback */}
            <div className="flex items-center gap-3 pt-1">
              <button
                type="button"
                onClick={handleTestConnection}
                disabled={isVerifying}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 text-white font-bold text-xs hover:bg-slate-800 disabled:opacity-50 cursor-pointer shadow-xs"
              >
                {isVerifying ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="w-3.5 h-3.5" />
                )}
                <span>{isVerifying ? 'Verifying Provider...' : 'Test & Verify Provider Connection'}</span>
              </button>

              {verifyResult && (
                <div
                  className={`text-xs font-semibold flex items-center gap-1.5 p-2 rounded-xl ${
                    verifyResult.success ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-800 border border-rose-200'
                  }`}
                >
                  {verifyResult.success ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  )}
                  <span>{verifyResult.message}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Status Message Banner */}
        {statusMessage && (
          <div
            className={`p-3 rounded-xl border text-xs font-semibold mb-4 flex items-center justify-between ${
              statusType === 'success'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-950'
                : statusType === 'error'
                ? 'bg-rose-50 border-rose-200 text-rose-950'
                : 'bg-indigo-50 border-indigo-200 text-indigo-950'
            }`}
          >
            <div className="flex items-center gap-2">
              {statusType === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : statusType === 'error' ? (
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              ) : (
                <Loader2 className="w-4 h-4 text-indigo-600 animate-spin shrink-0" />
              )}
              <span>{statusMessage}</span>
            </div>
            <button
              onClick={() => setStatusMessage(null)}
              className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Recipients Table */}
        <div className="overflow-x-auto border border-slate-100 rounded-xl mb-6">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-[#1A237E] text-white font-semibold">
                <th className="p-3">Participant</th>
                <th className="p-3 text-center">Role</th>
                <th className="p-3">Email Address</th>
                <th className="p-3 text-right">Awarded (MW)</th>
                <th className="p-3 text-right">Settlement (NRs)</th>
                <th className="p-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {participantSummaries.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-400">
                    No participants found. Make sure participant bids/offers are loaded.
                  </td>
                </tr>
              ) : (
                participantSummaries.map((p, idx) => {
                  const hasEmail = Boolean(p.email && p.email.includes('@'));
                  const slotData = collectParticipantSlotData(
                    p.name,
                    p.role,
                    buyers,
                    sellers,
                    results,
                    nSlots
                  );
                  const emailObj = buildParticipantEmail(
                    p.name,
                    p.role,
                    slotData,
                    sessionLabel,
                    clearedCount,
                    nSlots
                  );
                  const mailtoLink = generateMailtoLink(p.email || '', emailObj.subject, emailObj.text);
                  const gmailWebLink = generateGmailWebLink(
                    p.email || '',
                    emailObj.subject,
                    emailObj.text
                  );

                  return (
                    <tr key={idx} className="hover:bg-slate-50 transition-colors">
                      <td className="p-3 font-semibold text-slate-800">{p.name}</td>
                      <td className="p-3 text-center">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            p.role === 'buyer' ? 'bg-blue-100 text-blue-800' : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {p.role === 'buyer' ? 'Buyer' : 'Seller'}
                        </span>
                      </td>
                      <td className="p-3">
                        {editingName === p.name ? (
                          <div className="flex items-center gap-1">
                            <input
                              type="email"
                              value={tempEmail}
                              onChange={(e) => setTempEmail(e.target.value)}
                              placeholder="Enter email address"
                              className="p-1 px-2 text-xs border border-indigo-300 rounded font-mono w-56 focus:outline-indigo-600 bg-white"
                              autoFocus
                            />
                            <button
                              onClick={() => saveEmailEdit(p.name)}
                              className="p-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded cursor-pointer"
                              title="Save Email"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => setEditingName(null)}
                              className="p-1 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded cursor-pointer"
                              title="Cancel"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 group">
                            {hasEmail ? (
                              <span className="font-mono text-slate-800 font-medium">
                                {p.email}
                              </span>
                            ) : (
                              <span className="text-amber-600 italic font-sans text-[11px] flex items-center gap-1">
                                <AlertCircle className="w-3 h-3 text-amber-500" />
                                <span>No Email Provided</span>
                              </span>
                            )}
                            <button
                              onClick={() => startEditEmail(p)}
                              className="opacity-40 group-hover:opacity-100 p-0.5 hover:text-indigo-600 transition-opacity cursor-pointer"
                              title="Edit recipient email"
                            >
                              <Edit2 className="w-3 h-3" />
                            </button>
                          </div>
                        )}
                      </td>
                      <td className="p-3 text-right font-mono font-bold text-slate-900">
                        {p.actual_dispatch_drawl_mw.toFixed(3)} MW
                      </td>
                      <td className="p-3 text-right font-mono font-extrabold text-emerald-700">
                        NRs {p.total_settlement_nrs.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="p-3 text-center">
                        <div className="inline-flex items-center gap-1.5 flex-wrap justify-center">
                          {/* Preview Email */}
                          <button
                            onClick={() => onPreviewEmail(p)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-indigo-700 hover:text-indigo-900 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors cursor-pointer"
                            title="Preview formatted HTML notification"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Preview</span>
                          </button>

                          {/* Direct Send (API) */}
                          <button
                            onClick={() => handleSendSingle(p)}
                            disabled={sendingRowName === p.name || !hasComputed}
                            className="inline-flex items-center gap-1.5 px-3 py-1 text-[11px] font-bold text-emerald-800 bg-emerald-100/80 hover:bg-emerald-200 border border-emerald-300 rounded-lg transition-colors cursor-pointer disabled:opacity-40 shadow-2xs"
                            title="Send confirmation email directly via configured provider"
                          >
                            {sendingRowName === p.name ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Send className="w-3.5 h-3.5" />
                            )}
                            <span>Send Notification</span>
                          </button>

                          {/* Open Gmail Web */}
                          <a
                            href={gmailWebLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold text-white bg-red-600 hover:bg-red-700 border border-red-700 rounded-lg transition-colors shadow-2xs"
                            title="Open Gmail in a new tab with recipient, subject and message pre-filled"
                          >
                            <ExternalLink className="w-3 h-3" />
                            <span>Web Gmail</span>
                          </a>

                          {/* Open Mail App */}
                          <a
                            href={mailtoLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-semibold text-slate-500 hover:text-slate-800 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors"
                            title="Open in your default mail app (Outlook, Apple Mail, etc.)"
                          >
                            <ExternalLink className="w-3 h-3" />
                            <span>Mail Client</span>
                          </a>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Send Logs Section */}
        {logs.length > 0 && (
          <div className="pt-4 border-t border-slate-100">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-slate-900">Dispatch Audit Log</h3>
              <button
                onClick={exportEmailLogCSV}
                className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 transition-colors shadow-2xs cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export Log CSV</span>
              </button>
            </div>

            <div className="overflow-x-auto border border-slate-100 rounded-xl">
              <table className="w-full text-left text-xs font-mono">
                <thead>
                  <tr className="bg-slate-100 text-slate-700 font-semibold font-sans">
                    <th className="p-2.5">Participant</th>
                    <th className="p-2.5">Email</th>
                    <th className="p-2.5 text-center">Status</th>
                    <th className="p-2.5 text-right">Awarded (MW)</th>
                    <th className="p-2.5 text-right">Amount (NRs)</th>
                    <th className="p-2.5">Message / Error</th>
                    <th className="p-2.5">Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {logs.map((log, i) => (
                    <tr key={i} className="hover:bg-slate-50">
                      <td className="p-2.5 font-sans font-medium text-slate-800">{log.name}</td>
                      <td className="p-2.5 text-slate-600">{log.email || '—'}</td>
                      <td className="p-2.5 text-center font-sans">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            log.status === 'sent'
                              ? 'bg-emerald-100 text-emerald-800'
                              : log.status === 'dry_run'
                              ? 'bg-indigo-100 text-indigo-800'
                              : log.status === 'no_email'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {log.status === 'sent'
                            ? '✅ Sent'
                            : log.status === 'dry_run'
                            ? '🧪 Dry Run'
                            : log.status === 'no_email'
                            ? '⚠ No Email'
                            : '❌ Failed'}
                        </span>
                      </td>
                      <td className="p-2.5 text-right font-bold text-slate-900">{log.awarded_mw.toFixed(3)}</td>
                      <td className="p-2.5 text-right font-bold text-emerald-700">
                        {log.amount_nrs.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="p-2.5 text-slate-500 text-[11px] font-sans truncate max-w-xs">
                        {log.error || (log.status === 'sent' ? 'Delivered to SMTP host' : '—')}
                      </td>
                      <td className="p-2.5 text-slate-400 text-[11px] font-sans">
                        {log.sent_at ? new Date(log.sent_at).toLocaleTimeString() : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
