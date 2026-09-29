import React, { useState } from 'react';
import { ParticipantSummaryItem, RawBidOfferRecord, SlotClearingResult } from '../types';
import {
  collectParticipantSlotData,
  buildParticipantEmail,
  sendSingleNotification,
  generateMailtoLink,
} from '../services/emailService';
import { X, Copy, Check, Download, Send, Mail, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';

interface EmailPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  participant: ParticipantSummaryItem | null;
  buyers: RawBidOfferRecord[];
  sellers: RawBidOfferRecord[];
  results: Record<number, SlotClearingResult>;
  nSlots: number;
  sessionLabel: string;
}

export const EmailPreviewModal: React.FC<EmailPreviewModalProps> = ({
  isOpen,
  onClose,
  participant,
  buyers,
  sellers,
  results,
  nSlots,
  sessionLabel,
}) => {
  const [copiedHtml, setCopiedHtml] = useState(false);
  const [copiedText, setCopiedText] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [sendResult, setSendResult] = useState<{ success: boolean; message: string } | null>(null);

  if (!isOpen || !participant) return null;

  const slotData = collectParticipantSlotData(
    participant.name,
    participant.role,
    buyers,
    sellers,
    results,
    nSlots
  );

  const clearedCount = Object.values(results).filter((r) => r && r.status === 'Cleared').length;

  const { subject, html, text } = buildParticipantEmail(
    participant.name,
    participant.role,
    slotData,
    sessionLabel,
    clearedCount,
    nSlots
  );

  const handleCopyHTML = () => {
    navigator.clipboard.writeText(html);
    setCopiedHtml(true);
    setTimeout(() => setCopiedHtml(false), 2000);
  };

  const handleCopyText = () => {
    navigator.clipboard.writeText(text);
    setCopiedText(true);
    setTimeout(() => setCopiedText(false), 2000);
  };

  const handleDownloadHTML = () => {
    const blob = new Blob([html], { type: 'text/html;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `market_settlement_${participant.name.replace(/\s+/g, '_')}.html`;
    link.click();
  };

  const handleSendDirect = async () => {
    if (!participant.email || !participant.email.includes('@')) {
      setSendResult({
        success: false,
        message: 'No valid recipient email address found for this participant.',
      });
      return;
    }

    setIsSending(true);
    setSendResult(null);

    try {
      const res = await sendSingleNotification({
        to: participant.email,
        subject,
        html,
        text,
      });

      if (res.success) {
        setSendResult({
          success: true,
          message: `Confirmation email dispatched successfully to ${participant.email}!`,
        });
      } else {
        setSendResult({
          success: false,
          message: `Dispatch failed: ${res.error || 'Server error'}. You can also use "Open in Mail Client".`,
        });
      }
    } catch (err: any) {
      setSendResult({
        success: false,
        message: `Dispatch error: ${err.message || String(err)}. You can use "Open in Mail Client".`,
      });
    } finally {
      setIsSending(false);
    }
  };

  const mailtoHref = generateMailtoLink(participant.email || '', subject, text);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl max-h-[92vh] bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden">
        {/* Modal Top Bar */}
        <div className="bg-[#1A237E] px-6 py-4 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-amber-400 font-bold text-xs uppercase tracking-wider">
                Transaction Confirmation Preview
              </span>
              <span className="text-white/40">·</span>
              <span className="text-xs font-mono text-emerald-300">
                {participant.email || 'No email attached'}
              </span>
            </div>
            <h3 className="text-base font-bold truncate max-w-lg mt-0.5">{subject}</h3>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Open in Mail Client */}
            <a
              href={mailtoHref}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors border border-white/20"
              title="Open in default desktop or web mail client (Gmail, Outlook, etc.)"
            >
              <Mail className="w-3.5 h-3.5 text-amber-300" />
              <span>Open in Mail Client</span>
            </a>

            {/* Direct Send */}
            <button
              onClick={handleSendDirect}
              disabled={isSending || !participant.email}
              className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition-colors shadow-sm disabled:opacity-50 cursor-pointer"
            >
              {isSending ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Send className="w-3.5 h-3.5" />
              )}
              <span>{isSending ? 'Sending...' : 'Send Email'}</span>
            </button>

            {/* Copy Actions */}
            <button
              onClick={handleCopyHTML}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors border border-white/20"
            >
              {copiedHtml ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedHtml ? 'HTML Copied' : 'Copy HTML'}</span>
            </button>

            <button
              onClick={handleCopyText}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors border border-white/20"
            >
              {copiedText ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedText ? 'Text Copied' : 'Copy Text'}</span>
            </button>

            <button
              onClick={handleDownloadHTML}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors border border-white/20"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-colors ml-1 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Send status feedback notice */}
        {sendResult && (
          <div
            className={`px-6 py-2.5 text-xs font-medium flex items-center justify-between border-b ${
              sendResult.success
                ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
                : 'bg-amber-50 text-amber-900 border-amber-200'
            }`}
          >
            <div className="flex items-center gap-2">
              {sendResult.success ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
              )}
              <span>{sendResult.message}</span>
            </div>
            <button
              onClick={() => setSendResult(null)}
              className="text-xs font-bold underline opacity-70 hover:opacity-100"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Modal Content - Rendered Email */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-[#EEF2F7]">
          <div
            className="max-w-[720px] mx-auto bg-white rounded-xl shadow-md border border-slate-200 overflow-hidden"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        </div>
      </div>
    </div>
  );
};
