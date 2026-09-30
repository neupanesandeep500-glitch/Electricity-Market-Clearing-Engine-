import React, { useState } from 'react';
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
  verifySmtpConnection,
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
  const [showSmtpConfig, setShowSmtpConfig] = useState(false);
  const [senderEmail, setSenderEmail] = useState('');
  const [appPassword, setAppPassword] = useState('');
  const [resendApiKey, setResendApiKey] = useState(() => localStorage.getItem('nepal_market_resend_api_key') || '');
  const [isVerifyingSmtp, setIsVerifyingSmtp] = useState(false);
  const [smtpVerifyResult, setSmtpVerifyResult] = useState<{ success: boolean; message: string } | null>(null);

  const handleSaveResendKey = (val: string) => {
    setResendApiKey(val);
    localStorage.setItem('nepal_market_resend_api_key', val.trim());
  };

  // Inline email editing state
  const [editingName, setEditingName] = useState<string | null>(null);
  const [tempEmail, setTempEmail] = useState('');

  // Per-row sending state
  const [sendingRowName, setSendingRowName] = useState<string | null>(null);

  const isCalculated = hasComputed && participantSummaries.length > 0;
  const clearedCount = isCalculated ? Object.values(results).filter((r) => r && r.status === 'Cleared').length : 0;
  const withEmailCount = isCalculated ? participantSummaries.filter((p) => p.email && p.email.includes('@')).length : 0;
  const withoutEmailCount = isCalculated ? participantSummaries.length - withEmailCount : 0;

  // Handle verify SMTP connection
  const handleTestSmtp = async () => {
    setIsVerifyingSmtp(true);
    setSmtpVerifyResult(null);
    try {
      const creds = senderEmail && appPassword ? { sender: senderEmail, password: appPassword } : undefined;
      const res = await verifySmtpConnection(creds);
      if (res.success) {
        setSmtpVerifyResult({
          success: true,
          message: res.message || 'SMTP connection verified successfully!',
        });
      } else {
        setSmtpVerifyResult({
          success: false,
          message: res.error || 'SMTP verification failed. Check credentials or network connectivity.',
        });
      }
    } catch (err: any) {
      setSmtpVerifyResult({
        success: false,
        message: err.message || String(err),
      });
    } finally {
      setIsVerifyingSmtp(false);
    }
  };

  // Start editing a participant's email
  const startEditEmail = (p: ParticipantSummaryItem) => {
    setEditingName(p.name);
    setTempEmail(p.email || '');
  };

  // Save participant email edit
  const saveEmailEdit = (name: string) => {
    if (onUpdateParticipantEmail) {
      onUpdateParticipantEmail(name, tempEmail.trim());
    } else {
      // Direct local mutate if callback omitted
      const item = participantSummaries.find((p) => p.name === name);
      if (item) item.email = tempEmail.trim();
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
      const creds = senderEmail && appPassword ? { sender: senderEmail, password: appPassword } : undefined;
      const httpApi = resendApiKey ? { resendApiKey } : undefined;
      const res = await sendSingleNotification(
        {
          to: p.email,
          subject: email.subject,
          html: email.html,
          text: email.text,
        },
        creds,
        httpApi
      );

      if (res.success) {
        setStatusType('success');
        setStatusMessage(`Notification successfully sent to ${p.name} (${p.email})!`);
        // Update log
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
        if (res.isRenderSmtpBlocked) {
          setStatusMessage(
            `Render Free Plan blocks outbound SMTP (ports 465/587). Click the red "Web Gmail" button next to ${p.name} to send directly in 1 click via your browser!`
          );
        } else {
          setStatusMessage(`Delivery notice for ${p.name}: ${res.error}. Click "Web Gmail" to send directly.`);
        }
      }
    } catch (err: any) {
      setStatusType('error');
      setStatusMessage(`Notice for ${p.name}: ${err.message || String(err)}. Click "Web Gmail" to send in 1 click.`);
    } finally {
      setSendingRowName(null);
    }
  };

  // Batch notification dispatch
  const handleSendBatch = async (dryRun = false) => {
    if (!hasComputed) {
      alert('Please run the market clearing computation in the Compute tab first.');
      return;
    }

    setIsSending(true);
    setStatusType('info');
    setStatusMessage(dryRun ? 'Running dry-run simulation...' : 'Dispatching notifications via SMTP...');

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
      const smtpCredentials = senderEmail && appPassword ? { sender: senderEmail, password: appPassword } : undefined;
      const resultLogs = await sendBatchNotifications(jobs, dryRun, smtpCredentials, (progress) => {
        setStatusMessage(
          `Dispatching live notifications (${progress.current}/${progress.total}): ${progress.name}...`
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
        setStatusMessage(`Batch completed: ${sentCount} sent, ${failedCount} failed. Check audit log for details or use "Open in Mail App".`);
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
    const headers = ['Name', 'Role', 'Email', 'Status', 'Attempts', 'Awarded MW', 'Amount NRs', 'Error', 'Sent At'];
    const rows = logs.map((l) => [
      `"${l.name}"`,
      l.role,
      `"${l.email}"`,
      l.status,
      l.attempts,
      l.awarded_mw.toFixed(3),
      l.amount_nrs.toFixed(2),
      `"${l.error || ''}"`,
      l.sent_at || '',
    ]);

    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `email_send_log_${new Date().toISOString().slice(0, 10)}.csv`;
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
            <h2 className="text-base font-bold text-slate-900">
              Real-Time Pricing &amp; Confirmation Engine
            </h2>
            <p className="text-xs text-slate-500">
              Sends automated HTML confirmation emails with nodal price clearing results, awarded MW, and settlement amounts
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => setShowSmtpConfig(!showSmtpConfig)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 transition-colors shadow-2xs cursor-pointer"
            >
              <span>⚙ {showSmtpConfig ? 'Hide SMTP Config' : 'Custom SMTP / App Password'}</span>
            </button>

            <button
              onClick={() => handleSendBatch(true)}
              disabled={isSending || !hasComputed}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 transition-colors shadow-2xs disabled:opacity-50 cursor-pointer"
            >
              <Play className="w-3.5 h-3.5 text-indigo-600" />
              <span>Dry Run Test</span>
            </button>

            <button
              onClick={() => handleSendBatch(false)}
              disabled={isSending || !hasComputed}
              className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white transition-colors shadow-xs disabled:opacity-50 cursor-pointer"
            >
              {isSending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              <span>{isSending ? 'Sending...' : 'Send All Confirmations'}</span>
            </button>
          </div>
        </div>

        {/* Custom SMTP Configuration Drawer */}
        {showSmtpConfig && (
          <div className="mb-4 p-4 bg-indigo-50/50 border border-indigo-100 rounded-xl space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <span className="font-bold text-xs text-indigo-950 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-indigo-600" />
                <span>SMTP Dispatch Credentials (Gmail App Password)</span>
              </span>
              <span className="text-[11px] text-slate-500">
                Generate at: <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noopener noreferrer" className="text-indigo-600 underline font-semibold">Google Account &gt; Security &gt; App Passwords</a>
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="text-[11px] font-semibold text-slate-700 block mb-1">Sender Email ID</label>
                <input
                  type="email"
                  value={senderEmail}
                  onChange={(e) => setSenderEmail(e.target.value)}
                  placeholder="e.g. neupanesandeep500@gmail.com"
                  className="w-full p-2 bg-white border border-slate-200 rounded-lg outline-none font-mono text-xs focus:border-indigo-600"
                />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-slate-700 block mb-1">16-Character Google App Password</label>
                <input
                  type="password"
                  value={appPassword}
                  onChange={(e) => setAppPassword(e.target.value)}
                  placeholder="16-character password (e.g. kroetysmnrlvzomr)"
                  className="w-full p-2 bg-white border border-slate-200 rounded-lg outline-none font-mono text-xs focus:border-indigo-600"
                />
              </div>
            </div>

            {/* Cloud Deployment Notice for Render Free Plan */}
            <div className="p-3 bg-amber-50/90 border border-amber-200/90 rounded-xl text-slate-700 text-xs space-y-1.5">
              <span className="font-bold text-amber-900 flex items-center gap-1.5">
                <span>💡 Render Free Plan Deployment Notice</span>
              </span>
              <p className="text-[11px] text-slate-600 leading-relaxed">
                Render's free tier blocks outbound SMTP ports 25, 465, and 587. Two zero-block options are available:
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                <div className="p-2 bg-white border border-amber-200 rounded-lg">
                  <strong className="text-rose-700 block mb-0.5">1-Click Web Gmail:</strong>
                  Click the red <strong>Web Gmail</strong> button on any participant's row to send directly from your browser tab in 1 click!
                </div>
                <div className="p-2 bg-white border border-amber-200 rounded-lg">
                  <strong className="text-indigo-800 block mb-0.5">Automated HTTP API:</strong>
                  Enter a free <a href="https://resend.com" target="_blank" rel="noopener noreferrer" className="underline font-bold text-indigo-700">Resend API key</a> below to send automated headless emails over HTTPS Port 443!
                </div>
              </div>
              <div className="pt-1">
                <label className="text-[11px] font-semibold text-slate-700 block mb-0.5">
                  Optional: Resend API Key (re_...) for automated HTTPS sending
                </label>
                <input
                  type="password"
                  value={resendApiKey}
                  onChange={(e) => handleSaveResendKey(e.target.value)}
                  placeholder="e.g. re_123456789..."
                  className="w-full p-2 bg-white border border-slate-200 rounded-lg outline-none font-mono text-xs focus:border-indigo-600"
                />
              </div>
            </div>

            <div className="flex items-center gap-3 pt-1">
              <button
                type="button"
                onClick={handleTestSmtp}
                disabled={isVerifyingSmtp}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 text-white font-semibold text-xs hover:bg-indigo-700 disabled:opacity-50 cursor-pointer shadow-2xs"
              >
                {isVerifyingSmtp ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="w-3.5 h-3.5" />
                )}
                <span>{isVerifyingSmtp ? 'Testing Connection...' : 'Test SMTP Connection'}</span>
              </button>

              {smtpVerifyResult && (
                <div
                  className={`text-xs font-medium flex items-center gap-1.5 ${
                    smtpVerifyResult.success ? 'text-emerald-700 font-bold' : 'text-rose-600'
                  }`}
                >
                  {smtpVerifyResult.success ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-rose-600" />
                  )}
                  <span>{smtpVerifyResult.message}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Status Message */}
        {statusMessage && (
          <div
            className={`p-3 rounded-xl border text-xs font-medium mb-4 flex items-center justify-between ${
              statusType === 'success'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                : statusType === 'error'
                ? 'bg-rose-50 border-rose-200 text-rose-900'
                : 'bg-slate-50 border-slate-200 text-slate-800'
            }`}
          >
            <div className="flex items-center gap-2">
              {statusType === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : statusType === 'error' ? (
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              ) : (
                <Loader2 className="w-4 h-4 text-indigo-600 shrink-0 animate-spin" />
              )}
              <span>{statusMessage}</span>
            </div>
            <button
              onClick={() => setStatusMessage(null)}
              className="text-xs font-bold underline opacity-70 hover:opacity-100 cursor-pointer"
            >
              Dismiss
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
                  const gmailWebLink = generateGmailWebLink(p.email || '', emailObj.subject, emailObj.text);

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
                            className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-semibold text-indigo-700 hover:text-indigo-900 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors cursor-pointer"
                            title="Preview formatted HTML notification"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Preview</span>
                          </button>

                          {/* Direct Send (API) */}
                          <button
                            onClick={() => handleSendSingle(p)}
                            disabled={sendingRowName === p.name || !hasComputed}
                            className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-semibold text-emerald-700 hover:text-emerald-900 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors cursor-pointer disabled:opacity-40"
                            title="Send confirmation email directly via server"
                          >
                            {sendingRowName === p.name ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Send className="w-3.5 h-3.5" />
                            )}
                            <span>Send</span>
                          </button>

                          {/* 1-Click Web Gmail (100% Guaranteed on Render) */}
                          <a
                            href={gmailWebLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold text-rose-700 hover:text-rose-900 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition-colors cursor-pointer shadow-2xs"
                            title="Open directly in Gmail Webmail with pre-filled obligation details (Works 100% on Render Free & Paid)"
                          >
                            <Mail className="w-3.5 h-3.5 text-rose-600" />
                            <span>Web Gmail</span>
                          </a>

                          {/* Open Mail App */}
                          <a
                            href={mailtoLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                            title="Open in your default mail app (Outlook, Apple Mail, etc.)"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                            <span>Mail App</span>
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
