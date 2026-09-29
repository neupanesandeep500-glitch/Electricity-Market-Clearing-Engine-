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
} from 'lucide-react';

export default function App() {
  // Configuration
  const [config, setConfig] = useState<GoogleSheetConfig>({
    sheetId: DEFAULT_SHEET_ID,
    sheetName: DEFAULT_SHEET_NAME,
    googleFormUrl: DEFAULT_GOOGLE_FORM_URL,
    autoSync: true,
    syncIntervalSec: 30,
  });

  // Data & Engine State
  const [buyers, setBuyers] = useState<RawBidOfferRecord[]>([]);
  const [sellers, setSellers] = useState<RawBidOfferRecord[]>([]);
  const [nSlots, setNSlots] = useState<number>(DEFAULT_FALLBACK_SLOTS);
  const [results, setResults] = useState<Record<number, SlotClearingResult>>({});
  const [diagnostics, setDiagnostics] = useState<DiagnosticsData>({
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
  const [settlementRecords, setSettlementRecords] = useState<SettlementRecord[]>([]);
  const [participantSummaries, setParticipantSummaries] = useState<ParticipantSummaryItem[]>([]);

  // Navigation & UI State
  const [activeTab, setActiveTab] = useState<
    'overview' | 'compute' | 'curves' | 'settlement' | 'participants' | 'emails' | 'diagnostics'
  >('compute');
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [sourceType, setSourceType] = useState<'google-sheets' | 'demo' | 'csv-upload'>('demo');
  const [error, setError] = useState<string | null>(null);

  // Modals & Auth
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(getCurrentUser());
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [isUserManagementModalOpen, setIsUserManagementModalOpen] = useState(false);
  const [isQRModalOpen, setIsQRModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [previewParticipant, setPreviewParticipant] = useState<ParticipantSummaryItem | null>(null);

  const sessionLabel = useRef(`Market Session ${new Date().toLocaleDateString()}`).current;

  // Handle Logout
  const handleLogout = () => {
    logoutUser();
    setCurrentUser(null);
  };

  // Process raw CSV through market clearing engine
  const processCSVData = useCallback(
    (csvText: string, source: 'google-sheets' | 'demo' | 'csv-upload') => {
      try {
        const { buyers: parsedBuyers, sellers: parsedSellers, diagnostics: diag, n_slots } = parseResponses(csvText);

        if (parsedBuyers.length === 0 && parsedSellers.length === 0) {
          throw new Error('No valid bid or offer rows found in responses.');
        }

        const clearingResults = runAllSlots(parsedBuyers, parsedSellers, n_slots);
        const settlements = createSettlementRegister(clearingResults, n_slots);
        const summaries = createParticipantSummary(parsedBuyers, parsedSellers, clearingResults);

        setBuyers(parsedBuyers);
        setSellers(parsedSellers);
        setNSlots(n_slots);
        setResults(clearingResults);
        setDiagnostics(diag);
        setSettlementRecords(settlements);
        setParticipantSummaries(summaries);
        setSourceType(source);
        setLastSyncTime(new Date());
        setError(null);
      } catch (err: any) {
        console.error('Failed to parse or clear market data:', err);
        setError(`Processing Error: ${err.message || String(err)}`);
      }
    },
    []
  );

  // Fetch from Google Sheet
  const handleSync = useCallback(async () => {
    setIsSyncing(true);
    setError(null);
    try {
      const { csv, source } = await fetchSheetCSV({
        sheetId: config.sheetId,
        sheetName: config.sheetName,
      });

      processCSVData(csv, 'google-sheets');
    } catch (err: any) {
      console.warn('Google Sheet fetch error:', err.message);
      // Fall back to demo data if first load fails
      if (buyers.length === 0 && sellers.length === 0) {
        const demoCSV = generateDemoCSV(4);
        processCSVData(demoCSV, 'demo');
      }
      setError(`Notice: Using local simulation feed (${err.message}). Check sheet permissions or settings.`);
    } finally {
      setIsSyncing(false);
    }
  }, [config.sheetId, config.sheetName, processCSVData, buyers.length, sellers.length]);

  // Initial load
  useEffect(() => {
    handleSync();
  }, [handleSync]);

  // Polling Interval
  useEffect(() => {
    if (!config.autoSync || config.syncIntervalSec <= 0) return;

    const timer = setInterval(() => {
      handleSync();
    }, config.syncIntervalSec * 1000);

    return () => clearInterval(timer);
  }, [config.autoSync, config.syncIntervalSec, handleSync]);

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
        onSync={handleSync}
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
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-5">
        {/* Mobile/Quick Form QR Callout Banner */}
        <section className="bg-gradient-to-r from-white via-indigo-50/40 to-white border border-indigo-100/80 rounded-2xl p-4 sm:p-5 mb-5 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-indigo-900 text-white flex items-center justify-center shrink-0 shadow-sm">
              <QrCode className="w-6 h-6 text-amber-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-indigo-700 uppercase tracking-wider">
                  Participant Live Onboarding
                </span>
                <span className="text-slate-300">·</span>
                <span className="text-xs text-slate-500">Market Bids &amp; Offers</span>
              </div>
              <h2 className="text-sm sm:text-base font-extrabold text-slate-900 leading-tight">
                Scan QR Code to submit Bids (Buyers) or Generation Offers (Sellers)
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto">
            <button
              onClick={() => setIsQRModalOpen(true)}
              className="flex-1 md:flex-none flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-xl bg-indigo-900 hover:bg-indigo-800 text-white transition-colors shadow-xs cursor-pointer"
            >
              <QrCode className="w-4 h-4 text-amber-400" />
              <span>Display QR Code</span>
            </button>

            <button
              onClick={() => setActiveTab('compute')}
              className="flex-1 md:flex-none flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 transition-colors shadow-xs cursor-pointer"
            >
              <Cpu className="w-4 h-4" />
              <span>Compute Market</span>
            </button>
          </div>
        </section>

        {/* Global KPIs */}
        <KpiCards
          results={results}
          nSlots={nSlots}
          totalBuyers={uniqueBuyerCount}
          totalSellers={uniqueSellerCount}
        />

        {/* Responsive Segmented Tabs */}
        <div className="sticky top-[69px] z-30 bg-[#F8FAFC] pb-3">
          <nav className="flex items-center gap-1 p-1 bg-slate-200/80 rounded-xl overflow-x-auto shadow-2xs">
            <button
              onClick={() => setActiveTab('compute')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                activeTab === 'compute'
                  ? 'bg-gradient-to-r from-indigo-950 to-blue-900 text-white shadow-xs'
                  : 'text-slate-700 hover:text-slate-950 hover:bg-white/50'
              }`}
            >
              <Cpu className={`w-4 h-4 ${activeTab === 'compute' ? 'text-amber-400' : 'text-slate-600'}`} />
              <span>Compute Engine</span>
            </button>

            <button
              onClick={() => setActiveTab('overview')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                activeTab === 'overview'
                  ? 'bg-white text-indigo-950 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
              }`}
            >
              <LayoutDashboard className="w-4 h-4" />
              <span>Market Overview</span>
            </button>

            <button
              onClick={() => setActiveTab('curves')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                activeTab === 'curves'
                  ? 'bg-white text-indigo-950 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
              }`}
            >
              <TrendingUp className="w-4 h-4" />
              <span>Supply &amp; Demand Curves</span>
            </button>

            <button
              onClick={() => setActiveTab('settlement')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                activeTab === 'settlement'
                  ? 'bg-white text-indigo-950 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
              }`}
            >
              <CreditCard className="w-4 h-4" />
              <span>Settlement Register</span>
            </button>

            <button
              onClick={() => setActiveTab('participants')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                activeTab === 'participants'
                  ? 'bg-white text-indigo-950 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
              }`}
            >
              <Users className="w-4 h-4" />
              <span>Participants ({participantSummaries.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('emails')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                activeTab === 'emails'
                  ? 'bg-white text-indigo-950 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
              }`}
            >
              <MailCheck className="w-4 h-4" />
              <span>Email Confirmation Engine</span>
            </button>

            <button
              onClick={() => setActiveTab('diagnostics')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                activeTab === 'diagnostics'
                  ? 'bg-white text-indigo-950 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
              }`}
            >
              <ShieldAlert className="w-4 h-4" />
              <span>Quality Diagnostics</span>
            </button>
          </nav>
        </div>

        {/* Tab Views */}
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
              onRecompute={handleSync}
              onViewOverview={() => setActiveTab('overview')}
              onViewSettlement={() => setActiveTab('settlement')}
              onViewCurves={() => setActiveTab('curves')}
              lastSyncTime={lastSyncTime}
            />
          )}

          {activeTab === 'overview' && (
            <OverviewTab results={results} nSlots={nSlots} />
          )}

          {activeTab === 'curves' && (
            <SupplyDemandChart results={results} nSlots={nSlots} />
          )}

          {activeTab === 'settlement' && (
            <SettlementTab settlementRecords={settlementRecords} />
          )}

          {activeTab === 'participants' && (
            <ParticipantsTab
              buyers={buyers}
              sellers={sellers}
              participantSummaries={participantSummaries}
              nSlots={nSlots}
              onPreviewEmail={(p) => setPreviewParticipant(p)}
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
              onPreviewEmail={(p) => setPreviewParticipant(p)}
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
