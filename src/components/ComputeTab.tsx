import React, { useState } from 'react';
import {
  SlotClearingResult,
  RawBidOfferRecord,
  SettlementRecord,
  ParticipantSummaryItem,
  DiagnosticsData,
  EmailLogEntry,
} from '../types';
import {
  collectParticipantSlotData,
  buildParticipantEmail,
  sendBatchNotifications,
} from '../services/emailService';
import { generateMarketReportPDF } from '../services/pdfReportService';
import {
  Cpu,
  Play,
  Send,
  CheckCircle2,
  AlertTriangle,
  Zap,
  Activity,
  ShieldCheck,
  FileCheck,
  TrendingUp,
  Layers,
  Clock,
  Sparkles,
  ArrowRight,
  MailCheck,
  FileText,
} from 'lucide-react';

interface ComputeTabProps {
  buyers: RawBidOfferRecord[];
  sellers: RawBidOfferRecord[];
  nSlots: number;
  results: Record<number, SlotClearingResult>;
  settlementRecords: SettlementRecord[];
  participantSummaries: ParticipantSummaryItem[];
  diagnostics: DiagnosticsData;
  sessionLabel: string;
  hasComputed: boolean;
  onRecompute: () => void;
  onViewOverview: () => void;
  onViewSettlement: () => void;
  onViewCurves: () => void;
  lastSyncTime: Date | null;
}

export const ComputeTab: React.FC<ComputeTabProps> = ({
  buyers,
  sellers,
  nSlots,
  results,
  settlementRecords,
  participantSummaries,
  diagnostics,
  sessionLabel,
  hasComputed,
  onRecompute,
  onViewOverview,
  onViewSettlement,
  onViewCurves,
  lastSyncTime,
}) => {
  const [isComputing, setIsComputing] = useState(false);
  const [computationLog, setComputationLog] = useState<string[]>([
    `[${new Date().toLocaleTimeString()}] Engine core loaded: Optimal nodal market clearing algorithms initialized.`,
    `[${new Date().toLocaleTimeString()}] Active intake buffer: ${buyers.length} buyer bids and ${sellers.length} seller offers received across ${nSlots} time slots.`,
    hasComputed
      ? `[${new Date().toLocaleTimeString()}] Clearing status: Solved. Optimal prices and dispatch results are published.`
      : `[${new Date().toLocaleTimeString()}] Clearing status: Pending computation. Click 'Execute Market Clearing Engine' to simulate final results.`,
  ]);

  // Dispatch state
  const [isSendingEmails, setIsSendingEmails] = useState(false);
  const [emailStatus, setEmailStatus] = useState<string | null>(null);
  const [emailLogs, setEmailLogs] = useState<EmailLogEntry[]>([]);

  const hasParticipants = buyers.length > 0 || sellers.length > 0;
  const slotsList = Array.from({ length: nSlots }, (_, i) => i + 1);
  const clearedSlots = hasComputed ? slotsList.filter((s) => results[s]?.status === 'Cleared') : [];
  const totalClearedMw = hasComputed ? slotsList.reduce((acc, s) => acc + (results[s]?.mcv_mw || 0), 0) : 0;
  const totalMarketValue = hasComputed ? slotsList.reduce((acc, s) => acc + (results[s]?.market_value || 0), 0) : 0;

  // Trigger manual simulation run
  const handleExecuteCompute = () => {
    if (!hasParticipants) {
      alert('Cannot run computation: No valid bids or offers are loaded from the sheet.');
      return;
    }

    setIsComputing(true);
    const newLogs: string[] = [
      `[${new Date().toLocaleTimeString()}] 🚀 Initiating Market Clearing Engine execution...`,
      `[${new Date().toLocaleTimeString()}] Ingested ${buyers.length} buyer bids and ${sellers.length} seller offers across ${nSlots} slots.`,
      `[${new Date().toLocaleTimeString()}] Formulating piecewise-linear step demand and supply curves across ${nSlots} slots.`,
      `[${new Date().toLocaleTimeString()}] Applying merit-order sorting: ascending for generation offers, descending for demand bids.`,
      `[${new Date().toLocaleTimeString()}] Running binary-search equilibrium solver for Market Clearing Price (MCP) & Volume (MCV)...`,
    ];

    setTimeout(() => {
      onRecompute();
      newLogs.push(`[${new Date().toLocaleTimeString()}] Solved slot clearing: Market equilibrium determined.`);
      newLogs.push(`[${new Date().toLocaleTimeString()}] Settlement register & participant drawl/dispatch summaries calculated.`);
      newLogs.push(`[${new Date().toLocaleTimeString()}] 🔒 Bids taking closed & Google Sheet auto-sync disabled to keep results and curve visualization stable.`);
      newLogs.push(`[${new Date().toLocaleTimeString()}] ✅ Market simulation completed successfully. Final results, curves, and email notices are now active.`);
      setComputationLog(newLogs);
      setIsComputing(false);
    }, 600);
  };

  // Dispatch notifications after computation
  const handleDispatchEmails = async (dryRun = false) => {
    if (!hasComputed) {
      alert('Please compute the market simulation first before dispatching notifications.');
      return;
    }

    setIsSendingEmails(true);
    setEmailStatus(dryRun ? 'Running dry-run simulation...' : 'Dispatching real-time notifications to all participants...');

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
        clearedSlots.length,
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
      const res = await sendBatchNotifications(jobs, dryRun, (p) =>
        setEmailStatus(`Dispatching (${p.current}/${p.total}): ${p.name}...`)
      );
      setEmailLogs(res);
      const sent = res.filter((l) => l.status === 'sent').length;
      const dry = res.filter((l) => l.status === 'dry_run').length;
      const failed = res.filter((l) => l.status === 'failed');
      setEmailStatus(
        dryRun
          ? `✅ Dry Run verified: Generated ${dry} confirmation notifications without sending.`
          : failed.length === 0
          ? `✅ Success: Sent ${sent} participant notifications.`
          : `⚠️ ${sent} sent, ${failed.length} failed. ${failed[0].error || ''} ` +
            (res.needsPasscode ? 'Open the Email tab → Email Delivery & Setup and enter the admin passcode.' : 'See the Email tab for the dispatch log and a "Retry failed" button.')
      );
    } catch (err: any) {
      setEmailStatus(`❌ Error during dispatch: ${err.message || String(err)}`);
    } finally {
      setIsSendingEmails(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Compute Engine Hero Control Panel */}
      <div className="bg-gradient-to-br from-[#0A1637] via-[#10235C] to-[#1A388F] text-white rounded-3xl p-6 sm:p-8 shadow-xl border border-indigo-900/60 relative overflow-hidden">
        {/* Subtle decorative background circles */}
        <div className="absolute -right-16 -top-16 w-64 h-64 bg-blue-500/10 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute right-32 -bottom-20 w-72 h-72 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10">
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md text-amber-300 text-xs font-bold uppercase tracking-wider mb-3 border border-white/10">
                <Cpu className="w-3.5 h-3.5 text-amber-400" />
                <span>Optimal Nodal Market Simulation Engine</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white mb-2">
                Compute Market Equilibrium &amp; Dispatch Results
              </h2>
              <p className="text-xs sm:text-sm text-indigo-100/80 leading-relaxed">
                Executes the double-sided auction clearing algorithm to compute optimal nodal Market Clearing Prices (MCP) and awarded capacities (MCV) for all 15-minute trading intervals, ensuring system energy balance and maximizing social welfare.
              </p>
            </div>

            {/* Action buttons */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full lg:w-auto shrink-0">
              <button
                onClick={handleExecuteCompute}
                disabled={isComputing || !hasParticipants}
                className="flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-2xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-black text-sm tracking-wide shadow-lg shadow-amber-500/30 transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
              >
                <Cpu className={`w-5 h-5 ${isComputing ? 'animate-spin' : ''}`} />
                <span>
                  {isComputing
                    ? 'Computing Equilibrium...'
                    : !hasParticipants
                    ? 'No Bids/Offers in Sheet'
                    : hasComputed
                    ? 'Re-run Market Clearing'
                    : 'Execute Engine & Simulate'}
                </span>
              </button>

              <button
                onClick={() => handleDispatchEmails(false)}
                disabled={!hasComputed || isSendingEmails || !hasParticipants}
                className="flex items-center justify-center gap-2 px-5 py-3.5 rounded-2xl bg-white/15 hover:bg-white/25 text-white font-bold text-sm backdrop-blur-md border border-white/20 transition-all active:scale-95 disabled:opacity-40 cursor-pointer"
                title="Only dispatches after computation is completed"
              >
                <Send className="w-4 h-4 text-emerald-400" />
                <span>{isSendingEmails ? 'Dispatching...' : 'Dispatch Notifications'}</span>
              </button>
            </div>
          </div>

          {/* Engine Parameters Metric strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-6 border-t border-white/10">
            <div className="bg-white/5 backdrop-blur-xs rounded-xl p-3 border border-white/5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-200 block mb-0.5">
                Intake Received
              </span>
              <div className="text-lg font-black font-mono text-white">
                {hasParticipants ? `${buyers.length + sellers.length} Submissions` : '—'}
              </div>
              <span className="text-[10px] text-indigo-200/70">
                {hasParticipants
                  ? `${buyers.length} Bids · ${sellers.length} Offers`
                  : 'No bids or offers found'}
              </span>
            </div>

            <div className="bg-white/5 backdrop-blur-xs rounded-xl p-3 border border-white/5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-200 block mb-0.5">
                Time Intervals
              </span>
              <div className="text-lg font-black font-mono text-white">
                {nSlots} Slots
              </div>
              <span className={`text-[10px] font-semibold ${hasComputed ? 'text-emerald-300' : 'text-amber-300'}`}>
                {hasComputed ? `${clearedSlots.length} of ${nSlots} Cleared` : 'Pending Computation'}
              </span>
            </div>

            <div className="bg-white/5 backdrop-blur-xs rounded-xl p-3 border border-white/5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-200 block mb-0.5">
                Total Cleared Capacity
              </span>
              <div className="text-lg font-black font-mono text-amber-300">
                {hasComputed && totalClearedMw > 0 ? `${totalClearedMw.toFixed(1)} MW` : '—'}
              </div>
              <span className="text-[10px] text-indigo-200/70">
                {hasComputed && totalClearedMw > 0 ? `${(totalClearedMw * 0.25).toFixed(2)} MWh energy` : 'Awaiting compute'}
              </span>
            </div>

            <div className="bg-white/5 backdrop-blur-xs rounded-xl p-3 border border-white/5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-200 block mb-0.5">
                Financial Volume
              </span>
              <div className="text-lg font-black font-mono text-emerald-300">
                {hasComputed && totalMarketValue > 0 ? `NRs ${Math.round(totalMarketValue).toLocaleString('en-US')}` : '—'}
              </div>
              <span className="text-[10px] text-indigo-200/70">
                {hasComputed ? 'Total financial volume' : 'Awaiting compute'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Two Column Layout: Execution Console + Post-Compute Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Execution & Simulation Terminal (2 cols) */}
        <div className="lg:col-span-2 bg-slate-900 text-slate-200 rounded-3xl p-5 border border-slate-800 shadow-sm flex flex-col">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-3">
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-rose-500/80 inline-block" />
                <span className="w-3 h-3 rounded-full bg-amber-500/80 inline-block" />
                <span className="w-3 h-3 rounded-full bg-emerald-500/80 inline-block" />
              </div>
              <span className="text-xs font-mono text-slate-400 font-bold ml-2">
                Clearing Engine Simulation Console
              </span>
            </div>
            <span className="text-[11px] font-mono text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-800">
              ● Solver Active
            </span>
          </div>

          {/* Console Text Box */}
          <div className="font-mono text-xs space-y-2 p-3 bg-slate-950/80 rounded-2xl border border-slate-800/80 text-slate-300 flex-1 min-h-[220px] max-h-[300px] overflow-y-auto">
            {computationLog.map((line, idx) => (
              <div
                key={idx}
                className={
                  line.includes('✅')
                    ? 'text-emerald-400 font-bold'
                    : line.includes('🚀')
                    ? 'text-amber-300 font-bold'
                    : 'text-slate-300'
                }
              >
                {line}
              </div>
            ))}
            {isComputing && (
              <div className="text-amber-400 animate-pulse flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                Computing marginal equilibrium and shadow prices...
              </div>
            )}
          </div>

          {/* Quick jump actions after compute */}
          <div className="flex items-center gap-2 mt-4 pt-3 border-t border-slate-800/80 flex-wrap text-xs">
            <span className="text-slate-400 font-medium">Market Output:</span>
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
              disabled={!hasComputed}
              className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-40"
              title="Download full market report as PDF in 1 click"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Download PDF Report</span>
            </button>
            <button
              onClick={onViewOverview}
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold transition-colors flex items-center gap-1"
            >
              <span>Summary Table</span>
              <ArrowRight className="w-3 h-3" />
            </button>
            <button
              onClick={onViewCurves}
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold transition-colors flex items-center gap-1"
            >
              <span>Supply &amp; Demand Curves</span>
              <ArrowRight className="w-3 h-3" />
            </button>
            <button
              onClick={onViewSettlement}
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold transition-colors flex items-center gap-1"
            >
              <span>Settlement Register</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* Right: Email Dispatch Station (1 col) */}
        <div className="bg-white rounded-3xl p-5 border border-slate-200/90 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="p-2 rounded-xl bg-indigo-50 text-indigo-700">
                <MailCheck className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Transaction Dispatch Station
                </h3>
                <p className="text-[11px] text-slate-500">
                  Auto-email real-time pricing to buyers &amp; sellers
                </p>
              </div>
            </div>

            <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-100 text-xs space-y-2 mb-4">
              <div className="flex justify-between items-center text-slate-600">
                <span>Eligible Recipients:</span>
                <strong className="font-mono text-slate-900">{participantSummaries.length}</strong>
              </div>
              <div className="flex justify-between items-center text-slate-600">
                <span>Cleared Slots Notified:</span>
                <strong className="font-mono text-emerald-700">{clearedSlots.length} / {nSlots}</strong>
              </div>
              <div className="flex justify-between items-center text-slate-600">
                <span>Computation Status:</span>
                <span className="font-bold text-emerald-700 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Ready</span>
                </span>
              </div>
            </div>

            {emailStatus && (
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 mb-3">
                {emailStatus}
              </div>
            )}
          </div>

          <div className="space-y-2 pt-2">
            <button
              onClick={() => handleDispatchEmails(true)}
              disabled={isSendingEmails}
              className="w-full py-2.5 px-3 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 font-bold text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <Play className="w-3.5 h-3.5 text-indigo-600" />
              <span>Dry Run Simulation</span>
            </button>

            <button
              onClick={() => handleDispatchEmails(false)}
              disabled={isSendingEmails}
              className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-500 hover:to-teal-600 text-white font-extrabold text-xs shadow-md shadow-emerald-700/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <Send className="w-4 h-4" />
              <span>{isSendingEmails ? 'Sending...' : 'Dispatch All Confirmation Emails'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
