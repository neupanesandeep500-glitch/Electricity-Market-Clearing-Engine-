import React, { useState } from 'react';
import { GoogleSheetConfig } from '../types';
import { Settings, Save, RefreshCw, UploadCloud, X, FileText, Database, Users } from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: GoogleSheetConfig;
  onSaveConfig: (newConfig: GoogleSheetConfig) => void;
  onLoadDemoData: () => void;
  onUploadCSV: (csvText: string) => void;
  onOpenUserManagement?: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  config,
  onSaveConfig,
  onLoadDemoData,
  onUploadCSV,
  onOpenUserManagement,
}) => {
  const [sheetId, setSheetId] = useState(config.sheetId);
  const [sheetName, setSheetName] = useState(config.sheetName);
  const [googleFormUrl, setGoogleFormUrl] = useState(config.googleFormUrl);
  const [autoSync, setAutoSync] = useState(config.autoSync);
  const [syncIntervalSec, setSyncIntervalSec] = useState(config.syncIntervalSec);
  const [pastedCSV, setPastedCSV] = useState('');

  if (!isOpen) return null;

  const handleSave = () => {
    onSaveConfig({
      sheetId: sheetId.trim(),
      sheetName: sheetName.trim(),
      googleFormUrl: googleFormUrl.trim(),
      autoSync,
      syncIntervalSec,
    });
    onClose();
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        if (text) {
          onUploadCSV(text);
          onClose();
        }
      };
      reader.readAsText(file);
    }
  };

  const handleApplyPastedCSV = () => {
    if (pastedCSV.trim()) {
      onUploadCSV(pastedCSV);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl max-h-[90vh] bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-[#1A237E] px-6 py-4 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-white/10 rounded-xl">
              <Settings className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <h3 className="text-base font-bold">Data Source &amp; Simulation Settings</h3>
              <p className="text-xs text-white/70">Connect Google Sheets, Forms, or Local Files</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-6 text-xs">
          {/* 1. Google Sheets Parameters */}
          <div className="space-y-3">
            <h4 className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
              <span>📊 Google Sheets Live Feed</span>
            </h4>
            <div className="space-y-2">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Google Sheet ID or Full Spreadsheet URL
                </label>
                <input
                  type="text"
                  value={sheetId}
                  onChange={(e) => setSheetId(e.target.value)}
                  placeholder="e.g. 17xtp2EWVr8HhWVp9R9137AauNQv0V6DV5RPPdTEZ5Tg"
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg font-mono text-xs focus:bg-white focus:border-indigo-600 outline-none"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Responses Tab Name
                </label>
                <input
                  type="text"
                  value={sheetName}
                  onChange={(e) => setSheetName(e.target.value)}
                  placeholder="e.g. Form Responses 1"
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:bg-white focus:border-indigo-600 outline-none"
                />
              </div>
            </div>
          </div>

          {/* 2. Google Form URL for QR Code */}
          <div className="space-y-3 pt-4 border-t border-slate-100">
            <h4 className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
              <span>📱 Google Form Onboarding URL</span>
            </h4>
            <div>
              <label className="font-semibold text-slate-700 block mb-1">
                Google Form Link (Target for QR Code scanning)
              </label>
              <input
                type="text"
                value={googleFormUrl}
                onChange={(e) => setGoogleFormUrl(e.target.value)}
                placeholder="https://docs.google.com/forms/d/e/.../viewform"
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg font-mono text-xs focus:bg-white focus:border-indigo-600 outline-none"
              />
            </div>
          </div>

          {/* 3. Auto Syncing */}
          <div className="space-y-3 pt-4 border-t border-slate-100">
            <div className="flex items-center justify-between">
              <div>
                <span className="font-bold text-slate-900 block text-sm">Real-time Auto-Syncing</span>
                <span className="text-slate-500">Periodically polls Google Sheets for new form submissions</span>
              </div>
              <input
                type="checkbox"
                checked={autoSync}
                onChange={(e) => setAutoSync(e.target.checked)}
                className="w-4 h-4 accent-indigo-600 rounded cursor-pointer"
              />
            </div>

            {autoSync && (
              <div className="flex items-center gap-3 pt-1">
                <span className="text-slate-700 font-semibold">Polling interval:</span>
                <select
                  value={syncIntervalSec}
                  onChange={(e) => setSyncIntervalSec(Number(e.target.value))}
                  className="p-1.5 border border-slate-200 rounded-lg bg-white"
                >
                  <option value={10}>Every 10 seconds</option>
                  <option value={20}>Every 20 seconds</option>
                  <option value={30}>Every 30 seconds</option>
                  <option value={60}>Every 60 seconds</option>
                </select>
              </div>
            )}
          </div>

          {/* 4. Alternate Sources: Upload / Demo Data */}
          <div className="space-y-3 pt-4 border-t border-slate-100">
            <h4 className="font-bold text-slate-900 text-sm">Alternative Data Sources</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => {
                  onLoadDemoData();
                  onClose();
                }}
                className="flex items-center justify-center gap-2 p-3 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 rounded-xl font-bold transition-colors"
              >
                <Database className="w-4 h-4 text-amber-600" />
                <span>Load Nepal Demo Data</span>
              </button>

              <label className="flex items-center justify-center gap-2 p-3 bg-slate-50 hover:bg-slate-100 text-slate-800 border border-slate-200 rounded-xl font-bold cursor-pointer transition-colors">
                <UploadCloud className="w-4 h-4 text-slate-600" />
                <span>Upload CSV File</span>
                <input type="file" accept=".csv" onChange={handleFileUpload} className="hidden" />
              </label>
            </div>
          </div>

          {/* 5. User & Inbuilt Accounts Administration (Admin Portal) */}
          {onOpenUserManagement && (
            <div className="space-y-3 pt-4 border-t border-slate-100">
              <div className="p-3.5 bg-gradient-to-r from-indigo-50/70 via-slate-50 to-amber-50/50 border border-indigo-100 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h4 className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                    <Users className="w-4 h-4 text-indigo-700" />
                    <span>Admin User Accounts &amp; Jeevan Inbuilt Account</span>
                  </h4>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Enable/Disable, edit email and password, or delete the Jeevan account and manage all participant logins.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenUserManagement();
                  }}
                  className="px-3 py-1.5 bg-indigo-900 hover:bg-indigo-800 text-white rounded-lg font-bold text-xs shadow-xs transition-colors shrink-0 flex items-center gap-1.5 cursor-pointer"
                >
                  <Users className="w-3.5 h-3.5 text-amber-400" />
                  <span>Open Account Manager</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-slate-50 px-6 py-4 border-t border-slate-200 flex items-center justify-between shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleSave}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs transition-colors"
          >
            <Save className="w-3.5 h-3.5" />
            <span>Save &amp; Sync</span>
          </button>
        </div>
      </div>
    </div>
  );
};
