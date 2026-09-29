import React, { useState } from 'react';
import { ParticipantSummaryItem, RawBidOfferRecord, SlotClearingResult } from '../types';
import { collectParticipantSlotData, buildParticipantEmail } from '../services/emailService';
import { X, Copy, Check, Download, ExternalLink, Send } from 'lucide-react';

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
  const [copied, setCopied] = useState(false);

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
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadHTML = () => {
    const blob = new Blob([html], { type: 'text/html;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `market_settlement_email_${participant.name.replace(/\s+/g, '_')}.html`;
    link.click();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl max-h-[92vh] bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden">
        {/* Modal Top Bar */}
        <div className="bg-[#1A237E] px-6 py-4 text-white flex items-center justify-between shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-amber-400 font-bold text-xs uppercase tracking-wider">
                Transaction Confirmation Preview
              </span>
              <span className="text-white/40">·</span>
              <span className="text-xs text-white/80">{participant.email || 'No email attached'}</span>
            </div>
            <h3 className="text-base font-bold truncate max-w-lg mt-0.5">{subject}</h3>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyHTML}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors border border-white/20"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'HTML Copied' : 'Copy HTML'}</span>
            </button>
            <button
              onClick={handleDownloadHTML}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors border border-white/20"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download .html</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-colors ml-2"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

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
