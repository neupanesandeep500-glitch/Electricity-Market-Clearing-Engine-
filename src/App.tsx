/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  RawBidOfferRecord,
  SlotClearingResult,
  DiagnosticsData,
  SettlementRecord,
  ParticipantSummaryItem,
  GoogleSheetConfig,
} from './types';
import {
  parseResponses,
  runAllSlots,
  createSettlementRegister,
  createParticipantSummary,
  DEFAULT_FALLBACK_SLOTS,
} from './engine/clearingEngine';
import { generateDemoCSV } from './engine/demoData';
import { fetchSheetCSV, DEFAULT_SHEET_ID, DEFAULT_SHEET_NAME, DEFAULT_GOOGLE_FORM_URL } from './services/googleSheets';
import { generateStandaloneHTML } from './engine/standaloneHtmlGenerator';

import { Header } from './components/Header';
import { KpiCards } from './components/KpiCards';
import { OverviewTab } from './components/OverviewTab';
import { SupplyDemandChart } from './components/SupplyDemandChart';
import { SettlementTab } from './components/SettlementTab';
import { ParticipantsTab } from './components/ParticipantsTab';
import { EmailNotificationsTab } from './components/EmailNotificationsTab';
import { DiagnosticsTab } from './components/DiagnosticsTab';
import { ComputeTab } from './components/ComputeTab';
import { QRCodeModal } from './components/QRCodeModal';
import { SettingsModal } from './components/SettingsModal';
import { EmailPreviewModal } from './components/EmailPreviewModal';
import { LoginModal } from './components/LoginModal';
import { UserManagementModal } from './components/UserManagementModal';
import { getCurrentUser, logoutUser } from './services/authService';
import { generateMarketReportPDF } from './services/pdfReportService';
import { UserAccount } from './types';

import {
  LayoutDashboard,
  TrendingUp,
  CreditCard,
  Users,
  MailCheck,
  ShieldAlert,
  Cpu,
  Download,
  QrCode,
  FileCode,
  ExternalLink,
  FileText,
} from 'lucide-react';

const NEM_PERSISTENT_STORAGE_KEY = 'nem_market_full_state_v3';
const NEM_PARTICIPANT_EMAILS_KEY = 'nem_participant_email_overrides_v2';

function getStoredParticipantEmails(): Record<string, string> {
  try {
    const raw = localStorage.getItem(NEM_PARTICIPANT_EMAILS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveParticipantEmailOverride(name: string, email: string): void {
  try {
    const map = getStoredParticipantEmails();
    map[name] = email;
    localStorage.setItem(NEM_PARTICIPANT_EMAILS_KEY, JSON.stringify(map));
  } catch {
    // ignore
  }
}

function getStoredMarketState() {
  try {
    const raw = localStorage.getItem(NEM_PERSISTENT_STORAGE_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch {
    // ignore
  }
  return null;
}

export function App() {
  const savedState = useRef(getStoredMarketState()).current;

  // Configuration
  const [config, setConfig] = useState<GoogleSheetConfig>(() => ({
    sheetId: savedState?.config?.sheetId || DEFAULT_SHEET_ID,
    sheetName: savedState?.config?.sheetName || DEFAULT_SHEET_NAME,
    googleFormUrl: savedState?.config?.googleFormUrl || DEFAULT_GOOGLE_FORM_URL,
    autoSync: savedState?.config?.autoSync !== undefined ? savedState.config.autoSync : true,
    syncIntervalSec: savedState?.config?.syncIntervalSec || 30,
  }));

  // Data & Engine State (Restored from persistent localStorage across long inactivity)
  const [buyers, setBuyers] = useState<RawBidOfferRecord[]>(() => savedState?.buyers || []);
  const [sellers, setSellers] = useState<RawBidOfferRecord[]>(() => savedState?.sellers || []);
  const [nSlots, setNSlots] = useState<number>(() => savedState?.nSlots || DEFAULT_FALLBACK_SLOTS);
  const [results, setResults] = useState<Record<number, SlotClearingResult>>(() => savedState?.results || {});
  const [hasComputed, setHasComputed] = useState<boolean>(() => savedState?.hasComputed || false);
  const [diagnostics, setDiagnostics] = useState<DiagnosticsData>(() => savedState?.diagnostics || {
    rows_seen: 0,
    rows_skipped_no_role: 0,
    values_dropped_nan: 0,
    values_dropped_nonpos: 0,
    values_dropped_outlier: 0,
    records_kept: 0,
    timestamp_col_found: false,
    unique_buyers: 0,
    unique_sellers: 0,
    missing_email_buyers: 0,
    missing_email_sellers: 0,
    incomplete_buyers: 0,
    incomplete_sellers: 0,
    duplicate_buyer_rows: 0,
    duplicate_seller_rows: 0,
  });
  const [settlementRecords, setSettlementRecords] = useState<SettlementRecord[]>(() => savedState?.settlementRecords || []);
  const [participantSummaries, setParticipantSummaries] = useState<ParticipantSummaryItem[]>(() => savedState?.participantSummaries || []);

  // Navigation & UI State
  const [activeTab, setActiveTab] = useState<
    'overview' | 'compute' | 'curves' | 'settlement' | 'participants' | 'emails' | 'diagnostics'
  >('compute');
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(() => savedState?.lastSyncTime ? new Date(savedState.lastSyncTime) : null);
  const [sourceType, setSourceType] = useState<'google-sheets' | 'demo' | 'csv-upload'>(() => savedState?.sourceType || 'google-sheets');
  const [error, setError] = useState<string | null>(null);

  // Modals & Auth
  const [isBidsTakingActive, setIsBidsTakingActive] = useState<boolean>(() => savedState?.isBidsTakingActive !== undefined ? savedState.isBidsTakingActive : true);
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(getCurrentUser());
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [isUserManagementModalOpen, setIsUserManagementModalOpen] = useState(false);
  const [isQRModalOpen, setIsQRModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [previewParticipant, setPreviewParticipant] = useState<ParticipantSummaryItem | null>(null);

  const sessionLabel = useRef(`Market Session ${new Date().toLocaleDateString()}`).current;

  // Stable refs to prevent race conditions or background sync wiping computed results
  const hasComputedRef = useRef(hasComputed);
  hasComputedRef.current = hasComputed;
  const isBidsTakingActiveRef = useRef(isBidsTakingActive);
  isBidsTakingActiveRef.current = isBidsTakingActive;

  // Helper to persist full market state across long browser gaps
  const persistState = useCallback((partial?: any) => {
    try {
      const fullSnapshot = {
        buyers,
        sellers,
        nSlots,
        results,
        hasComputed: hasComputedRef.current,
        diagnostics,
        settlementRecords,
        participantSummaries,
        isBidsTakingActive: isBidsTakingActiveRef.current,
        lastSyncTime: new Date().toISOString(),
        sourceType,
        config,
        ...partial,
      };
      localStorage.setItem(NEM_PERSISTENT_STORAGE_KEY, JSON.stringify(fullSnapshot));
    } catch (e) {
      console.warn('Failed to save market snapshot to localStorage', e);
    }
  }, [buyers, sellers, nSlots, results, diagnostics, settlementRecords, participantSummaries, sourceType, config]);

  // Handle Logout
  const handleLogout = () => {
    logoutUser();
    setCurrentUser(null);
  };

  // Update a participant's email in memory and state, and persist across long gaps
  const handleUpdateParticipantEmail = useCallback((participantName: string, newEmail: string) => {
    saveParticipantEmailOverride(participantName, newEmail);

    setParticipantSummaries((prev) => {
      const updated = prev.map((p) => (p.name === participantName ? { ...p, email: newEmail } : p));
      persistState({ participantSummaries: updated });
      return updated;
    });

    setSettlementRecords((prev) => {
      const updated = prev.map((r) => (r.participant === participantName ? { ...r, email: newEmail } : r));
      return updated;
    });
  }, [persistState]);

  // Process raw CSV intake data
  const processCSVData = useCallback(
    (csvText: string, source: 'google-sheets' | 'demo' | 'csv-upload', isExplicitReset = false) => {
      try {
        const { buyers: parsedBuyers, sellers: parsedSellers, diagnostics: diag, n_slots } = parseResponses(csvText);

        // Apply saved participant email overrides so custom email corrections are never lost!
        const emailOverrides = getStoredParticipantEmails();
        const mergedBuyers = parsedBuyers.map((b) => emailOverrides[b.name] ? { ...b, email: emailOverrides[b.name] } : b);
        const mergedSellers = parsedSellers.map((s) => emailOverrides[s.name] ? { ...s, email: emailOverrides[s.name] } : s);

        setBuyers(mergedBuyers);
        setSellers(mergedSellers);
        setNSlots(n_slots || 4);
        setDiagnostics(diag);
        setSourceType(source);
        const now = new Date();
        setLastSyncTime(now);

        // CRITICAL: If results have already been computed or bids are locked,
        // DO NOT wipe the computed market equilibrium unless this was an explicit user reset!
        if (!hasComputedRef.current || isExplicitReset) {
          setResults({});
          setSettlementRecords([]);
          setParticipantSummaries([]);
          setHasComputed(false);
          hasComputedRef.current = false;
        }

        setError(null);

        // Save snapshot to localStorage
        try {
          const snapshot = {
            buyers: mergedBuyers,
            sellers: mergedSellers,
            nSlots: n_slots || 4,
            diagnostics: diag,
            sourceType: source,
            lastSyncTime: now.toISOString(),
            isBidsTakingActive: isBidsTakingActiveRef.current,
            hasComputed: hasComputedRef.current,
          };
          localStorage.setItem(NEM_PERSISTENT_STORAGE_KEY, JSON.stringify(snapshot));
        } catch {
          // ignore
        }
      } catch (err: any) {
        console.error('Failed to parse intake responses:', err);
        if (!hasComputedRef.current || isExplicitReset) {
          // Keep existing data if already populated rather than dropping to empty
          setError(`Intake Notice: ${err.message || String(err)}`);
        }
      }
    },
    []
  );

  // Fetch from Google Sheet with automatic retry and cold-start protection
  const handleSync = useCallback(
    async (isAuto = false, isExplicitReset = false) => {
      if (isAuto) {
        if (hasComputedRef.current || !isBidsTakingActiveRef.current) {
          return;
        }
      }

      setIsSyncing(true);
      setError(null);
      try {
        const { csv } = await fetchSheetCSV({
          sheetId: config.sheetId,
          sheetName: config.sheetName,
        });

        processCSVData(csv, 'google-sheets', isExplicitReset);
      } catch (err: any) {
        console.warn('Google Sheet fetch error:', err.message);
        // CRITICAL: Never wipe previously loaded or computed results on network or cold start timeout!
        if (!hasComputedRef.current && buyers.length === 0 && sellers.length === 0) {
          setError(`Notice: Could not load data from Google Sheet (${err.message}). If deploying on Render, the cloud server may be spinning up.`);
        } else {
          console.log('[Sync] Preserved existing session data during temporary sync interruption.');
        }
      } finally {
        setIsSyncing(false);
      }
    },
    [config.sheetId, config.sheetName, processCSVData, buyers.length, sellers.length]
  );

  // Explicitly run computation to simulate market clearing results
  // Turns off bids taking and auto-refreshing to the sheet to keep results and visualization stable
  const handleCompute = useCallback(() => {
    if (buyers.length === 0 && sellers.length === 0) {
      setError('Cannot execute computation: No valid bids or offers found in sheet. All market clearing values are currently --.');
      return;
    }

    try {
      const clearingResults = runAllSlots(buyers, sellers, nSlots);
      const settlements = createSettlementRegister(clearingResults, nSlots);
      const summaries = createParticipantSummary(buyers, sellers, clearingResults);

      setResults(clearingResults);
      setSettlementRecords(settlements);
      setParticipantSummaries(summaries);
      setHasComputed(true);
      hasComputedRef.current = true;

      // Lock bids taking and turn off auto-refresh to sheet so results and visualization remain 100% stable
      setIsBidsTakingActive(false);
      isBidsTakingActiveRef.current = false;
      setConfig((prev) => ({ ...prev, autoSync: false }));
      setError(null);

      // Persist computed market state to localStorage for instant restoration after long gap
      persistState({
        results: clearingResults,
        settlementRecords: settlements,
        participantSummaries: summaries,
        hasComputed: true,
        isBidsTakingActive: false,
      });
    } catch (err: any) {
      console.error('Computation error:', err);
      setError(`Computation Error: ${err.message || String(err)}`);
    }
  }, [buyers, sellers, nSlots, persistState]);

  // Lock / Unlock Bids Intake Toggle
  const handleToggleLockBids = useCallback(() => {
    if (isBidsTakingActive) {
      // Lock bids
      setIsBidsTakingActive(false);
      isBidsTakingActiveRef.current = false;
      setConfig((prev) => ({ ...prev, autoSync: false }));
      persistState({ isBidsTakingActive: false });
    } else {
      // Re-open bids
      setIsBidsTakingActive(true);
      isBidsTakingActiveRef.current = true;
      setHasComputed(false);
      hasComputedRef.current = false;
      setResults({});
      setSettlementRecords([]);
      setParticipantSummaries([]);
      localStorage.removeItem(NEM_PERSISTENT_STORAGE_KEY);
      setConfig((prev) => ({ ...prev, autoSync: true }));
      handleSync(false, true);
    }
  }, [isBidsTakingActive, handleSync, persistState]);

  // Re-open Bids Taking & Sheet Sync
  const handleReopenBidsTaking = useCallback(() => {
    setIsBidsTakingActive(true);
    isBidsTakingActiveRef.current = true;
    setHasComputed(false);
    hasComputedRef.current = false;
    setResults({});
    setSettlementRecords([]);
    setParticipantSummaries([]);
    localStorage.removeItem(NEM_PERSISTENT_STORAGE_KEY);
    setConfig((prev) => ({ ...prev, autoSync: true }));
    handleSync(false, true);
  }, [handleSync]);

  // Initial load - ONLY executes once on component mount
  const initialLoadExecuted = useRef(false);
  useEffect(() => {
    if (!initialLoadExecuted.current) {
      initialLoadExecuted.current = true;
      // If we don't have existing computed results or bids, perform initial sync
      if (!hasComputedRef.current && buyers.length === 0 && sellers.length === 0) {
        handleSync(true);
      }
    }
  }, [handleSync, buyers.length, sellers.length]);

  // Keep-alive loop: Pings /api/health every 4 minutes while app is open
  // Guarantees Render container never sleeps while the user is using the app!
  useEffect(() => {
    const keepAliveTimer = setInterval(() => {
      fetch('/api/health').catch(() => {});
    }, 4 * 60 * 1000);
    return () => clearInterval(keepAliveTimer);
  }, []);

  // Polling Interval: Auto-sync during intake before computation.
  // Once computation is done OR bids are locked, NEVER auto-refresh so users can analyze data undisturbed!
  useEffect(() => {
    if (!config.autoSync || config.syncIntervalSec <= 0) return;
    if (hasComputed || !isBidsTakingActive) return;

    const timer = setInterval(() => {
      // Extra guard using current refs
      if (!hasComputedRef.current && isBidsTakingActiveRef.current) {
        handleSync(true);
      }
    }, config.syncIntervalSec * 1000);

    return () => clearInterval(timer);
  }, [config.autoSync, config.syncIntervalSec, handleSync, hasComputed, isBidsTakingActive]);

  // Download Standalone HTML
  const handleDownloadStandalone = () => {
    const html = generateStandaloneHTML(config.sheetId, config.sheetName, config.googleFormUrl);
    const blob = new Blob([html], { type: 'text/html;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `nepal_electricity_market_standalone_${new Date().toISOString().slice(0, 10)}.html`;
    link.click();
  };

  const uniqueBuyerCount = new Set(buyers.map((b) => b.name)).size;
  const uniqueSellerCount = new Set(sellers.map((s) => s.name)).size;

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col selection:bg-indigo-100 selection:text-indigo-900">
      {/* Top Bar Header */}
      <Header
        onOpenQR={() => setIsQRModalOpen(true)}
        onOpenSettings={() => setIsSettingsModalOpen(true)}
        onOpenUserManagement={() => setIsUserManagementModalOpen(true)}
        onSync={() => handleSync(false)}
        onDownloadStandalone={handleDownloadStandalone}
        onLogout={handleLogout}
        currentUser={currentUser || { id: 'guest', email: 'guest@system.local', name: 'Guest User', role: 'USERS', createdAt: '' }}
        isSyncing={isSyncing}
        lastSyncTime={lastSyncTime}
        sheetId={config.sheetId}
        sourceType={sourceType}
        error={error}
      />

      {/* Main Viewport Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-4 space-y-5">
        {/* 1. APPLICATION MAIN TABS NAVIGATION (Positioned at the Top) */}
        <div className="sticky top-[58px] sm:top-[64px] z-30 bg-[#F8FAFC]/95 backdrop-blur-md pt-1 pb-3 border-b border-slate-200/80">
          <nav className="flex items-center gap-1.5 p-1.5 bg-slate-200/90 rounded-2xl overflow-x-auto shadow-xs border border-slate-300/60">
            <button
              onClick={() => setActiveTab('compute')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                activeTab === 'compute'
                  ? 'bg-gradient-to-r from-indigo-950 to-blue-900 text-white shadow-sm ring-1 ring-white/20'
                  : 'text-slate-700 hover:text-slate-950 hover:bg-white/60'
              }`}
            >
              <Cpu className={`w-4 h-4 ${activeTab === 'compute' ? 'text-amber-400' : 'text-slate-600'}`} />
              <span>Compute Engine</span>
            </button>

            <button
              onClick={() => setActiveTab('overview')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                activeTab === 'overview'
                  ? 'bg-white text-indigo-950 shadow-sm ring-1 ring-slate-200 font-extrabold'
                  : 'text-slate-700 hover:text-slate-950 hover:bg-white/60'
              }`}
            >
              <LayoutDashboard className="w-4 h-4" />
              <span>Market Overview</span>
            </button>

            <button
              onClick={() => setActiveTab('curves')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                activeTab === 'curves'
                  ? 'bg-white text-indigo-950 shadow-sm ring-1 ring-slate-200 font-extrabold'
                  : 'text-slate-700 hover:text-slate-950 hover:bg-white/60'
              }`}
            >
              <TrendingUp className="w-4 h-4" />
              <span>Supply &amp; Demand Curves</span>
            </button>

            <button
              onClick={() => setActiveTab('settlement')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                activeTab === 'settlement'
                  ? 'bg-white text-indigo-950 shadow-sm ring-1 ring-slate-200 font-extrabold'
                  : 'text-slate-700 hover:text-slate-950 hover:bg-white/60'
              }`}
            >
              <CreditCard className="w-4 h-4" />
              <span>Settlement Register</span>
            </button>

            <button
              onClick={() => setActiveTab('participants')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                activeTab === 'participants'
                  ? 'bg-white text-indigo-950 shadow-sm ring-1 ring-slate-200 font-extrabold'
                  : 'text-slate-700 hover:text-slate-950 hover:bg-white/60'
              }`}
            >
              <Users className="w-4 h-4" />
              <span>
                Participants ({hasComputed ? participantSummaries.length : uniqueBuyerCount + uniqueSellerCount})
              </span>
            </button>

            <button
              onClick={() => setActiveTab('emails')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                activeTab === 'emails'
                  ? 'bg-white text-indigo-950 shadow-sm ring-1 ring-slate-200 font-extrabold'
                  : 'text-slate-700 hover:text-slate-950 hover:bg-white/60'
              }`}
            >
              <MailCheck className="w-4 h-4" />
              <span>Email Confirmations</span>
            </button>

            <button
              onClick={() => setActiveTab('diagnostics')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                activeTab === 'diagnostics'
                  ? 'bg-white text-indigo-950 shadow-sm ring-1 ring-slate-200 font-extrabold'
                  : 'text-slate-700 hover:text-slate-950 hover:bg-white/60'
              }`}
            >
              <ShieldAlert className="w-4 h-4" />
              <span>Quality Diagnostics</span>
            </button>
          </nav>
        </div>

        {/* 2. CLOSED AUCTION & BIDS TAKING STATUS BAR */}
        <section
          className={`border rounded-2xl p-4 sm:p-5 shadow-xs transition-colors flex flex-col md:flex-row items-start md:items-center justify-between gap-4 ${
            hasComputed
              ? 'bg-gradient-to-r from-emerald-50/60 via-slate-50 to-indigo-50/40 border-emerald-200/80'
              : 'bg-gradient-to-r from-white via-indigo-50/50 to-white border-indigo-100/90'
          }`}
        >
          <div className="flex items-center gap-3.5">
            <div
              className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 shadow-sm font-bold ${
                hasComputed ? 'bg-emerald-900 text-white' : 'bg-indigo-900 text-white'
              }`}
            >
              {hasComputed ? <Cpu className="w-6 h-6 text-emerald-400" /> : <Cpu className="w-6 h-6 text-amber-400" />}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span
                  className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full uppercase tracking-wider ${
                    hasComputed
                      ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                      : 'bg-indigo-100 text-indigo-800 border border-indigo-200'
                  }`}
                >
                  {hasComputed ? '🔒 Bids Taking Closed · Sheet Sync Off' : '🟢 Bids Taking Open · Sheet Sync Active'}
                </span>
                <span className="text-slate-300">·</span>
                <span className="text-xs text-slate-600 font-medium">
                  {buyers.length === 0 && sellers.length === 0
                    ? 'No valid bids or offers in sheet'
                    : hasComputed
                    ? `${participantSummaries.length} Participants Cleared · Market Results Locked for Visualization`
                    : `${buyers.length} Buyer Bids & ${sellers.length} Seller Offers Loaded (Closed Auction)`}
                </span>
              </div>
              <h2 className="text-sm sm:text-base font-extrabold text-slate-900 leading-tight mt-1">
                {buyers.length === 0 && sellers.length === 0
                  ? 'Sheet Empty: Awaiting participant bid submissions via Google Form'
                  : hasComputed
                  ? 'Market Clearing Solved: Auto-refresh disabled to keep charts, heatmaps, and results stable'
                  : 'Closed Auction Intake Active: Submit bids, then click Compute Market to solve clearing'}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto shrink-0 flex-wrap">
            {!hasComputed ? (
              <>
                <button
                  onClick={handleToggleLockBids}
                  className={`flex-1 md:flex-none flex items-center justify-center gap-1.5 px-3.5 py-2.5 text-xs font-bold rounded-xl transition-colors shadow-2xs cursor-pointer border ${
                    !isBidsTakingActive
                      ? 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                  }`}
                  title={isBidsTakingActive ? 'Lock intake to freeze incoming bids and stop auto-refresh' : 'Unlock to resume bids intake'}
                >
                  <span>{!isBidsTakingActive ? '🔒 Bids Locked (Click to Unlock)' : '🔓 Lock Bids (Stop Refresh)'}</span>
                </button>

                <button
                  onClick={() => {
                    setActiveTab('compute');
                    handleCompute();
                  }}
                  disabled={buyers.length === 0 && sellers.length === 0}
                  className="flex-1 md:flex-none flex items-center justify-center gap-1.5 px-5 py-2.5 text-xs font-bold rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 transition-colors shadow-sm cursor-pointer disabled:opacity-50"
                >
                  <Cpu className="w-4 h-4" />
                  <span>Compute Market (Lock Bids)</span>
                </button>
              </>
            ) : (
              <div className="flex items-center gap-2 flex-wrap w-full md:w-auto">
                <button
                  onClick={() =>
                    generateMarketReportPDF({
                      results,
                      settlements: settlementRecords,
                      participantSummaries,
                      nSlots,
                      sessionLabel,
                      totalBuyers: buyers.length,
                      totalSellers: sellers.length,
                    })
                  }
                  className="flex-1 md:flex-none flex items-center justify-center gap-1.5 px-4 py-2.5 text-xs font-bold rounded-xl bg-rose-600 hover:bg-rose-500 text-white transition-all shadow-sm cursor-pointer active:scale-95"
                  title="Download complete market clearing and settlement report as PDF in 1 click"
                >
                  <FileText className="w-4 h-4" />
                  <span>Download PDF Report</span>
                </button>

                <button
                  onClick={handleReopenBidsTaking}
                  className="flex-1 md:flex-none flex items-center justify-center gap-1.5 px-4 py-2.5 text-xs font-bold rounded-xl bg-indigo-900 hover:bg-indigo-800 text-white transition-colors shadow-sm cursor-pointer"
                  title="Re-open intake and re-enable Google Sheet sync"
                >
                  <span>Re-open Bids Taking &amp; Sheet Sync</span>
                </button>
              </div>
            )}
          </div>
        </section>

        {/* 3. MARKET KPIS (Positioned only after Main Tabs and Status Bar) */}
        <KpiCards
          results={results}
          nSlots={nSlots}
          totalBuyers={buyers.length}
          totalSellers={sellers.length}
          hasComputed={hasComputed}
        />

        {/* 4. ACTIVE TAB VIEW CONTAINER */}
        <div className="pb-10">
          {activeTab === 'compute' && (
            <ComputeTab
              buyers={buyers}
              sellers={sellers}
              nSlots={nSlots}
              results={results}
              settlementRecords={settlementRecords}
              participantSummaries={participantSummaries}
              diagnostics={diagnostics}
              sessionLabel={sessionLabel}
              hasComputed={hasComputed}
              onRecompute={handleCompute}
              onViewOverview={() => setActiveTab('overview')}
              onViewSettlement={() => setActiveTab('settlement')}
              onViewCurves={() => setActiveTab('curves')}
              lastSyncTime={lastSyncTime}
            />
          )}

          {activeTab === 'overview' && (
            <OverviewTab
              results={results}
              nSlots={nSlots}
              hasComputed={hasComputed}
              totalBuyers={buyers.length}
              totalSellers={sellers.length}
              settlements={settlementRecords}
              participantSummaries={participantSummaries}
              sessionLabel={sessionLabel}
              onRunCompute={() => {
                setActiveTab('compute');
                handleCompute();
              }}
            />
          )}

          {activeTab === 'curves' && (
            <SupplyDemandChart
              results={results}
              nSlots={nSlots}
              hasComputed={hasComputed}
              totalBuyers={buyers.length}
              totalSellers={sellers.length}
              onRunCompute={() => {
                setActiveTab('compute');
                handleCompute();
              }}
            />
          )}

          {activeTab === 'settlement' && (
            <SettlementTab
              settlementRecords={settlementRecords}
              hasComputed={hasComputed}
              totalBuyers={buyers.length}
              totalSellers={sellers.length}
              results={results}
              participantSummaries={participantSummaries}
              nSlots={nSlots}
              sessionLabel={sessionLabel}
              onRunCompute={() => {
                setActiveTab('compute');
                handleCompute();
              }}
            />
          )}

          {activeTab === 'participants' && (
            <ParticipantsTab
              buyers={buyers}
              sellers={sellers}
              participantSummaries={participantSummaries}
              nSlots={nSlots}
              hasComputed={hasComputed}
              onPreviewEmail={(p) => setPreviewParticipant(p)}
              onRunCompute={() => {
                setActiveTab('compute');
                handleCompute();
              }}
            />
          )}

          {activeTab === 'emails' && (
            <EmailNotificationsTab
              participantSummaries={participantSummaries}
              buyers={buyers}
              sellers={sellers}
              results={results}
              nSlots={nSlots}
              sessionLabel={sessionLabel}
              hasComputed={hasComputed}
              onPreviewEmail={(p) => setPreviewParticipant(p)}
              onRunCompute={() => {
                setActiveTab('compute');
                handleCompute();
              }}
              onUpdateParticipantEmail={handleUpdateParticipantEmail}
            />
          )}

          {activeTab === 'diagnostics' && (
            <DiagnosticsTab diagnostics={diagnostics} nSlots={nSlots} />
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-4 px-6 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <p>
            ⚡ <strong>Electricity Market Clearing Engine</strong> · Optimal Nodal Pricing &amp; Economic Dispatch
          </p>
          <p className="text-slate-400 font-mono text-[11px]">
            © Sandeep Neupane · {new Date().getFullYear()}
          </p>
        </div>
      </footer>

      {/* Modals */}
      <QRCodeModal
        isOpen={isQRModalOpen}
        onClose={() => setIsQRModalOpen(false)}
        formUrl={config.googleFormUrl}
      />

      <SettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        config={config}
        onSaveConfig={(newCfg) => {
          setConfig(newCfg);
          handleSync();
        }}
        onLoadDemoData={() => {
          const demoCSV = generateDemoCSV(4);
          processCSVData(demoCSV, 'demo');
        }}
        onUploadCSV={(csv) => {
          processCSVData(csv, 'csv-upload');
        }}
        onOpenUserManagement={() => setIsUserManagementModalOpen(true)}
      />

      <EmailPreviewModal
        isOpen={previewParticipant !== null}
        onClose={() => setPreviewParticipant(null)}
        participant={previewParticipant}
        buyers={buyers}
        sellers={sellers}
        results={results}
        nSlots={nSlots}
        sessionLabel={sessionLabel}
      />

      {/* Authentication & User Management Modals */}
      <LoginModal
        isOpen={currentUser === null || isLoginModalOpen}
        onLoginSuccess={(user) => {
          setCurrentUser(user);
          setIsLoginModalOpen(false);
        }}
      />

      {currentUser && (
        <UserManagementModal
          isOpen={isUserManagementModalOpen}
          onClose={() => setIsUserManagementModalOpen(false)}
          currentUser={currentUser}
        />
      )}
    </div>
  );
}

export default App;
