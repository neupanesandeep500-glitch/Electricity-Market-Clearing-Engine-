import React from 'react';
import {
  QrCode,
  RefreshCw,
  Download,
  Settings,
  CheckCircle2,
  AlertCircle,
  Users,
  LogOut,
  ShieldCheck,
  UserCheck,
} from 'lucide-react';
import { UserAccount } from '../types';
import { NetworkClock } from './NetworkClock';

interface HeaderProps {
  onOpenQR: () => void;
  onOpenSettings: () => void;
  onOpenUserManagement: () => void;
  onSync: () => void;
  onDownloadStandalone: () => void;
  onLogout: () => void;
  currentUser: UserAccount;
  isSyncing: boolean;
  lastSyncTime: Date | null;
  sheetId: string;
  sourceType: 'google-sheets' | 'demo' | 'csv-upload';
  error: string | null;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenQR,
  onOpenSettings,
  onOpenUserManagement,
  onSync,
  onDownloadStandalone,
  onLogout,
  currentUser,
  isSyncing,
  lastSyncTime,
  error,
}) => {
  const isAdmin = currentUser.role === 'ADMIN';

  return (
    <header className="sticky top-0 z-40 bg-gradient-to-r from-[#0D1B4B] via-[#1A237E] to-[#1565C0] text-white shadow-lg border-b border-indigo-900/50">
      {/* Top Utility Bar with Connected Network Clock at Top-Right */}
      <div className="border-b border-white/10 bg-black/25 px-4 sm:px-6 lg:px-8 py-1.5 flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
          <span className="flex h-2 w-2 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <span className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider hidden sm:inline">
            National Grid Dispatch &amp; Energy Market Console
          </span>
          <span className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider sm:hidden">
            Market Console
          </span>
        </div>

        {/* Top-Right Network Clock */}
        <div className="ml-auto">
          <NetworkClock />
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
        {/* Brand & Wordmark Zone */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shadow-md shadow-amber-500/20 shrink-0">
            <span className="text-xl">⚡</span>
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-base sm:text-lg font-extrabold tracking-tight text-white leading-tight">
                Electricity Market Clearing Engine
              </h1>
              <span className="hidden sm:inline-block text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-white/15 text-indigo-100 border border-white/20">
                Production V5.0
              </span>
              {/* Active Role Badge */}
              <span
                className={`inline-flex items-center gap-1 text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                  isAdmin
                    ? 'bg-amber-400/20 text-amber-300 border-amber-400/30'
                    : 'bg-blue-400/20 text-blue-200 border-blue-400/30'
                }`}
              >
                {isAdmin ? <ShieldCheck className="w-3 h-3 text-amber-400" /> : <UserCheck className="w-3 h-3 text-blue-300" />}
                <span>{currentUser.role}</span>
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs text-white/75 mt-0.5 flex-wrap">
              <span className="flex items-center gap-1 font-medium">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-emerald-300">System Connected</span>
              </span>
              {lastSyncTime && (
                <>
                  <span className="hidden lg:inline text-white/40">·</span>
                  <span className="hidden lg:inline text-white/60">
                    Updated {lastSyncTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto pb-1 md:pb-0 justify-between md:justify-end">
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={onOpenQR}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 transition-colors shadow-sm active:scale-95"
              title="Scan Form QR Code to submit bids"
            >
              <QrCode className="w-4 h-4" />
              <span>Participant QR</span>
            </button>

            <button
              onClick={onSync}
              disabled={isSyncing}
              className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold rounded-lg bg-white/15 hover:bg-white/25 border border-white/25 text-white transition-colors disabled:opacity-50 active:scale-95 cursor-pointer"
              title="Refresh latest data"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>{isSyncing ? 'Refreshing...' : 'Refresh'}</span>
            </button>

            <button
              onClick={onDownloadStandalone}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-white/15 hover:bg-white/25 border border-white/25 text-white transition-colors active:scale-95 cursor-pointer"
              title="Download full standalone HTML application"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Export</span> HTML
            </button>
          </div>

          <div className="flex items-center gap-1 shrink-0 border-l border-white/20 pl-2">
            {/* User Management (ADMIN Only) */}
            {isAdmin && (
              <button
                onClick={onOpenUserManagement}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg bg-amber-400/25 hover:bg-amber-400/35 text-amber-200 border border-amber-400/40 transition-colors shadow-xs cursor-pointer"
                title="Admin Section: Manage user accounts & inbuilt Jeevan account"
              >
                <Users className="w-3.5 h-3.5 text-amber-400" />
                <span className="inline">Admin Accounts</span>
              </button>
            )}

            {/* Settings (ADMIN Only: Users cannot edit config) */}
            {isAdmin && (
              <button
                onClick={onOpenSettings}
                className="p-1.5 text-white/80 hover:text-white hover:bg-white/15 rounded-lg border border-transparent hover:border-white/20 transition-colors"
                title="Configure Google Sheet & Form parameters (Admin Only)"
              >
                <Settings className="w-4 h-4" />
              </button>
            )}

            {/* User Profile / Logout */}
            <div className="flex items-center gap-1.5 pl-1">
              <span className="hidden xl:inline text-[11px] text-white/80 font-medium truncate max-w-[130px]">
                {currentUser.name}
              </span>
              <button
                onClick={onLogout}
                className="p-1.5 text-white/70 hover:text-rose-300 hover:bg-rose-500/20 rounded-lg transition-colors"
                title={`Logged in as ${currentUser.email} (${currentUser.role}). Click to Logout`}
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-rose-950/80 border-t border-rose-800 px-4 py-1.5 text-xs text-rose-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            onClick={onSync}
            className="underline font-semibold text-white hover:text-rose-100 text-[11px] ml-4 shrink-0"
          >
            Retry
          </button>
        </div>
      )}
    </header>
  );
};
