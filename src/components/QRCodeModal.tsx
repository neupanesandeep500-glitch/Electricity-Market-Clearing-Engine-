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

  useEffect(() => {
    if (isOpen && canvasRef.current && formUrl) {
      QRCode.toCanvas(canvasRef.current, formUrl, {
        width: 260,
        margin: 2,
        color: {
          dark: '#1A237E',
          light: '#FFFFFF',
        },
      });
    }
  }, [isOpen, formUrl]);

  if (!isOpen) return null;

  const handleCopy = () => {
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-[#0D1B4B] via-[#1A237E] to-[#1565C0] px-6 py-5 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/10 rounded-xl">
              <QrCode className="w-6 h-6 text-amber-400" />
            </div>
            <div>
              <h3 className="text-lg font-bold">Google Form QR Code</h3>
              <p className="text-xs text-white/75">Participant Submission & Data Entry Portal</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 flex flex-col items-center text-center">
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl shadow-inner mb-4">
            <canvas ref={canvasRef} className="rounded-xl mx-auto shadow-xs" />
          </div>

          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 mb-2">
            <Smartphone className="w-4 h-4 text-indigo-600" />
            <span>Scan with any mobile camera to open Google Form</span>
          </div>

          <div className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 mb-5 text-left">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
              Connected Form URL
            </span>
            <div className="text-xs font-mono text-slate-700 truncate select-all">
              {formUrl}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 w-full mb-6">
            <button
              onClick={handleCopy}
              className="flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 transition-colors shadow-2xs"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied Link!' : 'Copy Link'}</span>
            </button>

            <button
              onClick={handleDownloadQR}
              className="flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 transition-colors shadow-2xs"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download QR</span>
            </button>

            <a
              href={formUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white transition-colors shadow-xs"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Open Form</span>
            </a>
          </div>

          {/* Guidelines */}
          <div className="w-full bg-indigo-50/70 border border-indigo-100 rounded-xl p-3 text-left text-xs text-indigo-950">
            <p className="font-semibold text-indigo-900 mb-1">📌 Participant Instructions:</p>
            <ul className="list-disc pl-4 space-y-1 text-indigo-900/80">
              <li>Select your role: <strong>Buyer</strong> (Demand) or <strong>Seller</strong> (Supply).</li>
              <li>Provide your Participant ID and valid Email for transaction settlement.</li>
              <li>Enter Price (NRs/kWh) and Quantity (MW) for 15-min time slots (T1–T4).</li>
              <li>Clearing algorithm runs automatically when you submit.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};
