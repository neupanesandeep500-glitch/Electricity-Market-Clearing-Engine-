import React, { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { QrCode, Copy, Check, ExternalLink, X, Download, Smartphone } from 'lucide-react';

interface QRCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  formUrl: string;
}

export const QRCodeModal: React.FC<QRCodeModalProps> = ({ isOpen, onClose, formUrl }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [copied, setCopied] = useState(false);

  // Close on Escape key press
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Generate QR Code
  useEffect(() => {
    if (isOpen && canvasRef.current && formUrl) {
      QRCode.toCanvas(canvasRef.current, formUrl, {
        width: 210,
        margin: 1.5,
        color: {
          dark: '#0D1B4B',
          light: '#FFFFFF',
        },
      });
    }
  }, [isOpen, formUrl]);

  if (!isOpen) return null;

  const handleCopy = () => {
    if (!formUrl) return;
    navigator.clipboard.writeText(formUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleDownloadQR = () => {
    if (!canvasRef.current) return;
    const link = document.createElement('a');
    link.download = 'market_form_qr_code.png';
    link.href = canvasRef.current.toDataURL('image/png');
    link.click();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden my-auto max-h-[94vh] flex flex-col">
        {/* Sticky visible header with prominent close cross sign */}
        <div className="sticky top-0 z-20 shrink-0 bg-gradient-to-r from-[#0D1B4B] via-[#1A237E] to-[#1565C0] px-5 py-4 text-white flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/10 rounded-xl shrink-0">
              <QrCode className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-white leading-tight">Google Form Intake QR</h3>
              <p className="text-[11px] text-white/80">Scan or copy link to submit bids</p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close dialog"
            title="Close dialog (Esc)"
            className="p-2 text-white hover:text-amber-300 hover:bg-white/20 rounded-xl transition-all cursor-pointer bg-white/10 shrink-0 active:scale-95"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content properly framed inside window */}
        <div className="p-5 overflow-y-auto flex flex-col items-center text-center space-y-3.5">
          {/* QR Code Container */}
          <div className="p-3 bg-slate-50 border border-slate-200/90 rounded-2xl shadow-inner inline-flex items-center justify-center">
            <canvas ref={canvasRef} className="rounded-xl shadow-2xs" />
          </div>

          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-600">
            <Smartphone className="w-4 h-4 text-indigo-600 shrink-0" />
            <span>Scan with mobile camera to open bidding form</span>
          </div>

          {/* Action Buttons: Note that raw URL string is removed per request; user can only copy or open */}
          <div className="grid grid-cols-3 gap-2 w-full pt-1">
            <button
              onClick={handleCopy}
              className={`flex items-center justify-center gap-1 px-2.5 py-2.5 text-xs font-bold rounded-xl border transition-all cursor-pointer shadow-2xs ${
                copied
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-300 font-extrabold'
                  : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200 hover:border-slate-300'
              }`}
              title="Copy the Google Form link to clipboard"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-slate-600" />}
              <span>{copied ? 'Copied!' : 'Copy Link'}</span>
            </button>

            <button
              onClick={handleDownloadQR}
              className="flex items-center justify-center gap-1 px-2.5 py-2.5 text-xs font-bold rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 hover:border-slate-300 transition-all cursor-pointer shadow-2xs"
              title="Download QR code image for printing or projection"
            >
              <Download className="w-3.5 h-3.5 text-slate-600" />
              <span>Save QR</span>
            </button>

            <a
              href={formUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-1 px-2.5 py-2.5 text-xs font-bold rounded-xl bg-indigo-900 hover:bg-indigo-800 text-white transition-all shadow-xs"
              title="Open Google Form in a new tab"
            >
              <ExternalLink className="w-3.5 h-3.5 text-indigo-200" />
              <span>Open Form</span>
            </a>
          </div>

          {/* Participant Instructions - Perfectly sized & framed within viewport */}
          <div className="w-full bg-indigo-50/80 border border-indigo-200/90 rounded-2xl p-3.5 text-left text-xs text-indigo-950 space-y-1.5 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="font-extrabold text-indigo-950 text-xs flex items-center gap-1.5">
                <span>📌</span> Participant Bidding Guidelines:
              </span>
              <span className="text-[10px] uppercase font-mono font-bold bg-indigo-200/70 text-indigo-900 px-2 py-0.5 rounded-full">
                Step-by-Step
              </span>
            </div>
            <ul className="space-y-1 text-slate-700 text-[11px] leading-relaxed pl-1">
              <li className="flex items-start gap-1.5">
                <span className="font-bold text-indigo-700">1.</span>
                <span>Select role: <strong>Buyer</strong> (Demand drawl) or <strong>Seller</strong> (Generator supply).</span>
              </li>
              <li className="flex items-start gap-1.5">
                <span className="font-bold text-indigo-700">2.</span>
                <span>Choose your <strong>Participant ID</strong> and confirm your registered <strong>Email</strong>.</span>
              </li>
              <li className="flex items-start gap-1.5">
                <span className="font-bold text-indigo-700">3.</span>
                <span>Specify Power (<strong>MW</strong>) &amp; Rate (<strong>NRs/kWh</strong>) across 15-min intervals (<strong>T1–T4</strong>).</span>
              </li>
              <li className="flex items-start gap-1.5">
                <span className="font-bold text-indigo-700">4.</span>
                <span>Click submit on the form; market clearing engine locks and balances dispatch automatically.</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};
