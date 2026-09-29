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
} from '../services/emailService';
import { Mail, Send, Play, CheckCircle2, AlertCircle, Download, Eye, Clock } from 'lucide-react';

interface EmailNotificationsTabProps {
  participantSummaries: ParticipantSummaryItem[];
  buyers: RawBidOfferRecord[];
  sellers: RawBidOfferRecord[];
  results: Record<number, SlotClearingResult>;
  nSlots: number;
  sessionLabel: string;
  onPreviewEmail: (participant: ParticipantSummaryItem) => void;
}

export const EmailNotificationsTab: React.FC<EmailNotificationsTabProps> = ({
  participantSummaries,
  buyers,
  sellers,
  results,
  nSlots,
  sessionLabel,
  onPreviewEmail,
}) => {
  const [logs, setLogs] = useState<EmailLogEntry[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [showSmtpConfig, setShowSmtpConfig] = useState(false);
  const [senderEmail, setSenderEmail] = useState('');
  const [appPassword, setAppPassword] = useState('');

  const clearedCount = Object.values(results).filter((r) => r && r.status === 'Cleared').length;
  const withEmailCount = participantSummaries.filter((p) => p.email && p.email.includes('@')).length;
  const withoutEmailCount = participantSummaries.length - withEmailCount;

  const handleSendBatch = async (dryRun = false) => {
    setIsSending(true);
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
      const resultLogs = await sendBatchNotifications(jobs, dryRun, smtpCredentials);
      setLogs(resultLogs);
      const sentCount = resultLogs.filter((l) => l.status === 'sent').length;
      const dryCount = resultLogs.filter((l) => l.status === 'dry_run').length;
      setStatusMessage(
        dryRun
          ? `✅ Dry-run completed: ${dryCount} message(s) previewed successfully.`
          : `✅ Batch dispatch completed: ${sentCount} sent.`
      );
    } catch (err: any) {
      setStatusMessage(`❌ Error during batch notification: ${err.message || String(err)}`);
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
          <p className="text-xs text-slate-500 mt-1">Requires manual distribution</p>
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
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 transition-colors shadow-2xs"
            >
              <span>⚙ {showSmtpConfig ? 'Hide SMTP Config' : 'Custom SMTP / App Password'}</span>
            </button>

            <button
              onClick={() => handleSendBatch(true)}
              disabled={isSending}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 transition-colors shadow-2xs disabled:opacity-50"
            >
              <Play className="w-3.5 h-3.5 text-indigo-600" />
              <span>Dry Run Test</span>
            </button>

            <button
              onClick={() => handleSendBatch(false)}
              disabled={isSending}
              className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white transition-colors shadow-xs disabled:opacity-50"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{isSending ? 'Sending...' : 'Send All Confirmations'}</span>
            </button>
          </div>
        </div>

        {showSmtpConfig && (
          <div className="mb-4 p-4 bg-indigo-50/50 border border-indigo-100 rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-bold text-xs text-indigo-950">
                Optional: Custom Dispatcher Credentials (or configured in server .env)
              </span>
              <span className="text-[10px] text-slate-500">Google App Password (16 characters)</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="text-[11px] font-semibold text-slate-700 block mb-1">Sender Email ID</label>
                <input
                  type="email"
                  value={senderEmail}
                  onChange={(e) => setSenderEmail(e.target.value)}
                  placeholder="e.g. sender@gmail.com"
                  className="w-full p-2 bg-white border border-slate-200 rounded-lg outline-none font-mono text-xs focus:border-indigo-600"
                />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-slate-700 block mb-1">App Password</label>
                <input
                  type="password"
                  value={appPassword}
                  onChange={(e) => setAppPassword(e.target.value)}
                  placeholder="16-character Google App Password"
                  className="w-full p-2 bg-white border border-slate-200 rounded-lg outline-none font-mono text-xs focus:border-indigo-600"
                />
              </div>
            </div>
          </div>
        )}

        {statusMessage && (
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs font-medium text-slate-800 mb-4 flex items-center justify-between">
            <span>{statusMessage}</span>
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
                <th className="p-3 text-center">Preview</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {participantSummaries.map((p, idx) => (
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
                  <td className="p-3 font-mono text-slate-600">
                    {p.email && p.email.includes('@') ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                        <span>Registered Notification Channel</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-500">
                        <AlertCircle className="w-3 h-3 text-amber-500" />
                        <span>No Notification Channel</span>
                      </span>
                    )}
                  </td>
                  <td className="p-3 text-right font-mono font-bold text-slate-900">
                    {p.actual_dispatch_drawl_mw.toFixed(3)} MW
                  </td>
                  <td className="p-3 text-right font-mono font-extrabold text-emerald-700">
                    NRs {p.total_settlement_nrs.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="p-3 text-center">
                    <button
                      onClick={() => onPreviewEmail(p)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-indigo-700 hover:text-indigo-900 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Preview Email</span>
                    </button>
                  </td>
                </tr>
              ))}
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
                className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 transition-colors shadow-2xs"
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
                    <th className="p-2.5">Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {logs.map((log, i) => (
                    <tr key={i} className="hover:bg-slate-50">
                      <td className="p-2.5 font-sans font-medium text-slate-800">{log.name}</td>
                      <td className="p-2.5 text-slate-500">{log.email || '—'}</td>
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
