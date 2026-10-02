import React, { useState } from 'react';
import { SlotClearingResult, SettlementRecord, ParticipantSummaryItem } from '../types';
import { generateMarketReportPDF } from '../services/pdfReportService';
import {
  BarChart3,
  TrendingUp,
  Download,
  Cpu,
  AlertCircle,
  Clock,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Zap,
  Activity,
  Layers,
  FileText,
} from 'lucide-react';

interface OverviewTabProps {
  results: Record<number, SlotClearingResult>;
  nSlots: number;
  hasComputed?: boolean;
  totalBuyers?: number;
  totalSellers?: number;
  onRunCompute?: () => void;
  settlements?: SettlementRecord[];
  participantSummaries?: ParticipantSummaryItem[];
  sessionLabel?: string;
}

export const OverviewTab: React.FC<OverviewTabProps> = ({
  results,
  nSlots,
  hasComputed = false,
  totalBuyers = 0,
  totalSellers = 0,
  onRunCompute,
  settlements = [],
  participantSummaries = [],
  sessionLabel = 'NEM Session',
}) => {
  // Independent zoom states for the two separated charts
  const [mcpZoom, setMcpZoom] = useState<number>(1);
  const [mcvZoom, setMcvZoom] = useState<number>(1);

  // Independent hover states
  const [hoveredMcpSlot, setHoveredMcpSlot] = useState<number | null>(null);
  const [hoveredMcvSlot, setHoveredMcvSlot] = useState<number | null>(null);

  const slotsList = Array.from({ length: nSlots }, (_, i) => i + 1);
  const hasParticipants = totalBuyers > 0 || totalSellers > 0;
  const isCalculated = hasComputed && hasParticipants;

  // Zoom handlers for MCP chart
  const handleMcpZoomIn = () => setMcpZoom((prev) => Math.min(2.5, Number((prev + 0.25).toFixed(2))));
  const handleMcpZoomOut = () => setMcpZoom((prev) => Math.max(1, Number((prev - 0.25).toFixed(2))));
  const handleMcpResetZoom = () => {
    setMcpZoom(1);
    setHoveredMcpSlot(null);
  };

  // Zoom handlers for MCV chart
  const handleMcvZoomIn = () => setMcvZoom((prev) => Math.min(2.5, Number((prev + 0.25).toFixed(2))));
  const handleMcvZoomOut = () => setMcvZoom((prev) => Math.max(1, Number((prev - 0.25).toFixed(2))));
  const handleMcvResetZoom = () => {
    setMcvZoom(1);
    setHoveredMcvSlot(null);
  };

  // Compute maximum values and tick scales
  const clearedSlots = slotsList.filter((s) => isCalculated && results[s]?.status === 'Cleared');
  const rawMaxMcp = Math.max(...slotsList.map((s) => (isCalculated ? results[s]?.mcp || 0 : 0)), 8);
  const rawMaxMw = Math.max(...slotsList.map((s) => (isCalculated ? results[s]?.mcv_mw || 0 : 0)), 50);
  const rawMaxMv = Math.max(...slotsList.map((s) => (isCalculated ? results[s]?.market_value || 0 : 0)), 100000);

  // Nice rounded upper bounds for clean integer ticks
  const maxMcp = Math.ceil(rawMaxMcp / 2) * 2 || 10;
  const maxMw = Math.ceil(rawMaxMw / 10) * 10 || 50;
  const maxMv = Math.ceil(rawMaxMv / 50000) * 50000 || 200000;

  // Summary statistics for badges
  const avgMcp = clearedSlots.length > 0
    ? clearedSlots.reduce((acc, s) => acc + (results[s]?.mcp || 0), 0) / clearedSlots.length
    : 0;
  const peakMw = clearedSlots.length > 0
    ? Math.max(...clearedSlots.map((s) => results[s]?.mcv_mw || 0))
    : 0;
  const totalEnergyMwh = clearedSlots.reduce((acc, s) => acc + (results[s]?.mcv_mwh || 0), 0);
  const totalMarketTurnover = clearedSlots.reduce((acc, s) => acc + (results[s]?.market_value || 0), 0);

  const exportSummaryCSV = () => {
    const headers = [
      'Slot',
      'MCP (NRs/kWh)',
      'MW Cleared',
      'MWh Cleared',
      'Demand (MW)',
      'Supply (MW)',
      'Market Value (NRs)',
      'Clearing Mode',
      'Status',
    ];

    const rows = slotsList.map((s) => {
      const r = results[s];
      if (!isCalculated || !r || r.status !== 'Cleared') {
        return [`T${s}`, '—', '—', '—', '—', '—', '—', '—', !hasParticipants ? 'No Data' : 'Pending Compute'];
      }
      return [
        `T${s}`,
        r.mcp.toFixed(3),
        r.mcv_mw.toFixed(3),
        r.mcv_mwh.toFixed(4),
        r.total_demand.toFixed(2),
        r.total_supply.toFixed(2),
        r.market_value.toFixed(2),
        `"${r.clearing_mode}"`,
        r.status,
      ];
    });

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `market_clearing_summary_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
  };

  const handleDownloadPDF = () => {
    generateMarketReportPDF({
      results,
      settlements,
      participantSummaries,
      nSlots,
      sessionLabel,
      totalBuyers,
      totalSellers,
    });
  };

  return (
    <div className="space-y-6">
      {/* Intake State Status Banner */}
      {!hasParticipants ? (
        <div className="bg-amber-50 border border-amber-200/90 rounded-2xl p-4 sm:p-5 flex items-start gap-3 shadow-xs">
          <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <h3 className="text-sm font-bold text-amber-950">
              No Valid Bids or Offers Found in Sheet
            </h3>
            <p className="text-xs text-amber-800 mt-1 leading-relaxed">
              The connected Google Sheet currently contains no valid participant bids or offers. All market clearing values across the system are displayed as <span className="font-mono font-bold text-amber-900">—</span>. To simulate market clearing, submit bids via the Participant Google Form QR code or click <strong>Refresh</strong> in the header.
            </p>
          </div>
        </div>
      ) : !hasComputed ? (
        <div className="bg-gradient-to-r from-blue-50 via-indigo-50/50 to-white border border-indigo-200 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xs">
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-xl bg-indigo-600 text-white shadow-sm shrink-0">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700">
                  Data Intake Refreshed
                </span>
                <span className="text-xs font-semibold text-slate-500">
                  Awaiting Execution
                </span>
              </div>
              <h3 className="text-sm sm:text-base font-bold text-slate-900 mt-0.5">
                {totalBuyers} Buyer Bids &amp; {totalSellers} Seller Offers Received
              </h3>
              <p className="text-xs text-slate-600 mt-0.5">
                Market data is loaded. Run the clearing engine to calculate optimal nodal prices, balance dispatch capacity, and generate final curves.
              </p>
            </div>
          </div>
          {onRunCompute && (
            <button
              onClick={onRunCompute}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-sm transition-all active:scale-95 cursor-pointer shrink-0"
            >
              <Cpu className="w-4 h-4 text-amber-300" />
              <span>Run Market Clearing Engine</span>
            </button>
          )}
        </div>
      ) : null}

      {/* Table Section */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Slot-wise Market Clearing Summary
            </h2>
            <p className="text-xs text-slate-500">
              {isCalculated
                ? 'Aggregated clearing results, cleared energy volumes, and nodal prices'
                : 'Intake received — market values pending computation'}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={handleDownloadPDF}
              disabled={!isCalculated}
              className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold rounded-lg bg-rose-600 hover:bg-rose-700 text-white transition-all shadow-xs cursor-pointer active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
              title="Download market clearing and commercial settlement report as PDF in 1 click"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Download PDF Report</span>
            </button>

            <button
              onClick={exportSummaryCSV}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 transition-colors shadow-2xs cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export Summary CSV</span>
            </button>
          </div>
        </div>

        <div className="overflow-x-auto border border-slate-100 rounded-xl">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-[#1A237E] text-white font-semibold">
                <th className="p-3 text-center">Slot</th>
                <th className="p-3 text-right">MCP (NRs/kWh)</th>
                <th className="p-3 text-right">MW Cleared</th>
                <th className="p-3 text-right">MWh Cleared</th>
                <th className="p-3 text-right">Demand (MW)</th>
                <th className="p-3 text-right">Supply (MW)</th>
                <th className="p-3 text-right">Market Value (NRs)</th>
                <th className="p-3 text-center">Clearing Mode</th>
                <th className="p-3 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {slotsList.map((s) => {
                const r = results[s];
                const isCleared = isCalculated && r && r.status === 'Cleared';

                return (
                  <tr
                    key={s}
                    className={`transition-colors ${
                      isCleared ? 'hover:bg-slate-50' : 'bg-slate-50/40'
                    }`}
                  >
                    <td className="p-3 font-bold font-mono text-center text-indigo-950">
                      T{s}
                    </td>
                    <td className="p-3 text-right font-mono font-bold text-amber-700">
                      {isCleared ? r.mcp.toFixed(3) : '—'}
                    </td>
                    <td className="p-3 text-right font-mono font-bold text-blue-700">
                      {isCleared ? r.mcv_mw.toFixed(3) : '—'}
                    </td>
                    <td className="p-3 text-right font-mono text-cyan-800">
                      {isCleared ? r.mcv_mwh.toFixed(4) : '—'}
                    </td>
                    <td className="p-3 text-right font-mono text-slate-600">
                      {isCleared ? r.total_demand.toFixed(1) : '—'}
                    </td>
                    <td className="p-3 text-right font-mono text-slate-600">
                      {isCleared ? r.total_supply.toFixed(1) : '—'}
                    </td>
                    <td className="p-3 text-right font-mono font-bold text-emerald-700">
                      {isCleared
                        ? `NRs ${r.market_value.toLocaleString('en-US', { minimumFractionDigits: 2 })}`
                        : '—'}
                    </td>
                    <td className="p-3 text-center text-[11px] text-slate-600">
                      {isCleared ? (
                        <span className="bg-slate-100 px-2 py-0.5 rounded text-slate-700 font-medium">
                          {r.clearing_mode.includes('Generator') ? 'Generator Cap' : 'Normal Intersection'}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="p-3 text-center">
                      {isCleared ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          Cleared
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 text-slate-500 border border-slate-200">
                          {!hasParticipants ? 'No Data' : 'Pending'}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Visual Trends Breakdown - TWO TOTALLY SEPARATE CHARTS (MCP and MCV) */}
      {!isCalculated ? (
        <div className="bg-white border border-slate-200/90 rounded-2xl p-8 text-center shadow-xs">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto mb-3">
            <BarChart3 className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-slate-900 mb-1">
            {!hasParticipants
              ? 'No Market Clearing Curves Available'
              : 'Market Clearing Charts Awaiting Computation'}
          </h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto mb-4">
            {!hasParticipants
              ? 'No valid participant bids or offers are present in the Google Sheet. Data values are shown as —.'
              : `${totalBuyers} buyer bids and ${totalSellers} seller offers are loaded. Run the computation in the Compute tab to plot separate Market Clearing Price (MCP) & Dispatched MW charts.`}
          </p>
          {hasParticipants && onRunCompute && (
            <button
              onClick={onRunCompute}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-sm transition-all active:scale-95 cursor-pointer"
            >
              <Cpu className="w-4 h-4 text-amber-300" />
              <span>Execute Market Clearing Engine</span>
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {/* Grid of Two Dedicated Charts: Left = MCP (NRs/kWh), Right = MCV (MW) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

            {/* ========================================================= */}
            {/* CHART 1: TOTALLY SEPARATE MARKET CLEARING PRICE (MCP) */}
            {/* ========================================================= */}
            <div className="bg-white border border-amber-200/80 rounded-2xl p-5 shadow-xs relative flex flex-col justify-between">
              <div>
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-600 shadow-2xs">
                      <TrendingUp className="w-4 h-4 text-amber-600" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-extrabold text-slate-900">
                          Market Clearing Price (MCP)
                        </h3>
                        <span className="text-[10px] font-mono font-bold px-2 py-0.5 bg-amber-100 text-amber-900 rounded-full border border-amber-200">
                          NRs/kWh
                        </span>
                      </div>
                      <p className="text-xs text-slate-500">Nodal equilibrium rate per 15-minute slot</p>
                    </div>
                  </div>

                  {/* MCP Zoom Controls */}
                  <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl text-xs">
                    <span className="px-1.5 font-mono font-bold text-slate-700 text-[10px]">
                      {Math.round(mcpZoom * 100)}%
                    </span>
                    <button
                      onClick={handleMcpZoomIn}
                      disabled={mcpZoom >= 2.5}
                      className="p-1 rounded bg-white text-slate-700 hover:text-amber-900 hover:bg-slate-50 border border-slate-200 disabled:opacity-40 cursor-pointer shadow-2xs"
                      title="Zoom In (+25%)"
                    >
                      <ZoomIn className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={handleMcpZoomOut}
                      disabled={mcpZoom <= 1}
                      className="p-1 rounded bg-white text-slate-700 hover:text-amber-900 hover:bg-slate-50 border border-slate-200 disabled:opacity-40 cursor-pointer shadow-2xs"
                      title="Zoom Out (-25%)"
                    >
                      <ZoomOut className="w-3.5 h-3.5" />
                    </button>
                    {mcpZoom > 1 && (
                      <button
                        onClick={handleMcpResetZoom}
                        className="p-1 rounded bg-white text-slate-700 hover:text-amber-900 hover:bg-slate-50 border border-slate-200 cursor-pointer shadow-2xs"
                        title="Reset Zoom"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* MCP Metrics Ribbon */}
                <div className="grid grid-cols-3 gap-2 mb-3 p-2.5 bg-amber-50/50 rounded-xl border border-amber-100 text-xs">
                  <div>
                    <span className="text-[10px] text-amber-800 block uppercase font-bold">Avg MCP</span>
                    <strong className="font-mono text-amber-950 font-extrabold text-sm">
                      NRs {avgMcp.toFixed(3)}
                    </strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-amber-800 block uppercase font-bold">Max MCP</span>
                    <strong className="font-mono text-amber-700 font-extrabold text-sm">
                      NRs {rawMaxMcp.toFixed(3)}
                    </strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-amber-800 block uppercase font-bold">Axis Upper Bound</span>
                    <strong className="font-mono text-slate-700 font-bold text-sm">
                      {maxMcp} NRs/kWh
                    </strong>
                  </div>
                </div>

                {/* Dynamic MCP Hover Tooltip */}
                {hoveredMcpSlot !== null && results[hoveredMcpSlot] && (
                  <div className="absolute top-28 right-6 z-20 bg-slate-900/95 text-white backdrop-blur-md rounded-xl p-3 shadow-xl border border-amber-500/40 text-xs font-mono space-y-1 pointer-events-none animate-in fade-in duration-100">
                    <div className="text-[11px] text-amber-400 font-sans font-bold flex items-center justify-between gap-4">
                      <span>Slot T{hoveredMcpSlot} Rate</span>
                      <span className="text-emerald-400">{results[hoveredMcpSlot].status}</span>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-slate-300 font-sans">MCP:</span>
                      <strong className="text-amber-300 font-extrabold">NRs {results[hoveredMcpSlot].mcp.toFixed(3)} / kWh</strong>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-slate-300 font-sans">Clearing Mode:</span>
                      <span className="text-slate-300 text-[10px]">{results[hoveredMcpSlot].clearing_mode}</span>
                    </div>
                  </div>
                )}

                {/* SVG Chart for MCP */}
                <div className="relative w-full overflow-x-auto pt-2">
                  <svg
                    viewBox="0 0 540 220"
                    className="w-full h-auto min-w-[380px] select-none transition-transform duration-200"
                    style={{ transform: `scale(${mcpZoom})`, transformOrigin: 'bottom center' }}
                    onMouseLeave={() => setHoveredMcpSlot(null)}
                  >
                    {/* Y-Axis Label */}
                    <text x="10" y="16" className="text-[10px] font-sans font-bold fill-amber-700">
                      NRs/kWh
                    </text>

                    {/* Horizontal Y-Axis Grid Lines & Numbers */}
                    {[1, 0.75, 0.5, 0.25, 0].map((pct, i) => {
                      const yVal = 180 - pct * 140;
                      const tickLabel = (pct * maxMcp).toFixed(1);
                      return (
                        <g key={i}>
                          <line
                            x1="45"
                            y1={yVal}
                            x2="520"
                            y2={yVal}
                            stroke={pct === 0 ? '#94A3B8' : '#F1F5F9'}
                            strokeDasharray={pct === 0 ? '' : '3 3'}
                            strokeWidth={pct === 0 ? '1.5' : '1'}
                          />
                          <text
                            x="40"
                            y={yVal + 3}
                            textAnchor="end"
                            className="text-[9px] font-mono font-medium fill-slate-400"
                          >
                            {tickLabel}
                          </text>
                        </g>
                      );
                    })}

                    {/* MCP Bars per Slot */}
                    {slotsList.map((s, idx) => {
                      const r = results[s];
                      const isCleared = r && r.status === 'Cleared';
                      const mcpVal = isCleared ? r.mcp : 0;
                      const barHeight = Math.max(isCleared ? (mcpVal / maxMcp) * 140 : 4, 4);

                      const slotWidth = (520 - 55) / slotsList.length;
                      const slotCenterX = 55 + idx * slotWidth + slotWidth / 2;
                      const barWidth = Math.min(48, slotWidth * 0.65);
                      const barX = slotCenterX - barWidth / 2;
                      const barY = 180 - barHeight;

                      return (
                        <g
                          key={s}
                          className="cursor-pointer group"
                          onMouseEnter={() => setHoveredMcpSlot(s)}
                        >
                          {/* Background hover column */}
                          <rect
                            x={slotCenterX - slotWidth / 2 + 2}
                            y="25"
                            width={slotWidth - 4}
                            height="155"
                            rx="8"
                            className="fill-transparent hover:fill-amber-50/50 transition-colors"
                          />

                          {/* MCP Bar */}
                          <rect
                            x={barX}
                            y={barY}
                            width={barWidth}
                            height={barHeight}
                            rx="6"
                            fill="url(#mcpAmberGradient)"
                            stroke={isCleared ? '#B45309' : '#CBD5E1'}
                            strokeWidth="1"
                            className="transition-all duration-300 drop-shadow-xs"
                          />

                          {/* Value on top of bar */}
                          <text
                            x={slotCenterX}
                            y={Math.max(barY - 6, 26)}
                            textAnchor="middle"
                            className="text-[11px] font-mono font-black fill-amber-900"
                          >
                            {isCleared ? `NRs ${mcpVal.toFixed(2)}` : '0'}
                          </text>

                          {/* Slot Label beneath axis */}
                          <text
                            x={slotCenterX}
                            y="198"
                            textAnchor="middle"
                            className="text-[11px] font-mono font-bold fill-slate-800"
                          >
                            T{s}
                          </text>

                          {/* Status indicator dot */}
                          <circle
                            cx={slotCenterX}
                            cy="208"
                            r="3.5"
                            fill={isCleared ? '#10B981' : '#F43F5E'}
                          />
                        </g>
                      );
                    })}

                    <defs>
                      <linearGradient id="mcpAmberGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#FBBF24" />
                        <stop offset="100%" stopColor="#D97706" />
                      </linearGradient>
                    </defs>
                  </svg>
                </div>
              </div>

              {/* MCP Slot Breakdown Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3 pt-3 border-t border-slate-100">
                {slotsList.map((s) => {
                  const r = results[s];
                  const isCleared = r && r.status === 'Cleared';
                  return (
                    <div key={s} className="bg-amber-50/40 rounded-xl p-2.5 border border-amber-100">
                      <div className="flex items-center justify-between text-xs mb-0.5">
                        <span className="font-extrabold font-mono text-amber-950">Slot T{s}</span>
                        <span className={`w-2 h-2 rounded-full ${isCleared ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                      </div>
                      <div className="text-xs font-mono font-bold text-amber-800">
                        {isCleared ? `NRs ${r.mcp.toFixed(3)}` : 'No Trade'}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* ========================================================= */}
            {/* CHART 2: TOTALLY SEPARATE MARKET CLEARING VOLUME (MCV MW) */}
            {/* ========================================================= */}
            <div className="bg-white border border-blue-200/80 rounded-2xl p-5 shadow-xs relative flex flex-col justify-between">
              <div>
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2.5 rounded-xl bg-blue-50 border border-blue-200 text-blue-600 shadow-2xs">
                      <BarChart3 className="w-4 h-4 text-blue-600" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-extrabold text-slate-900">
                          Market Clearing Volume (MCV)
                        </h3>
                        <span className="text-[10px] font-mono font-bold px-2 py-0.5 bg-blue-100 text-blue-900 rounded-full border border-blue-200">
                          MW
                        </span>
                      </div>
                      <p className="text-xs text-slate-500">Awarded generation dispatch &amp; buyer drawl power</p>
                    </div>
                  </div>

                  {/* MCV Zoom Controls */}
                  <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl text-xs">
                    <span className="px-1.5 font-mono font-bold text-slate-700 text-[10px]">
                      {Math.round(mcvZoom * 100)}%
                    </span>
                    <button
                      onClick={handleMcvZoomIn}
                      disabled={mcvZoom >= 2.5}
                      className="p-1 rounded bg-white text-slate-700 hover:text-blue-900 hover:bg-slate-50 border border-slate-200 disabled:opacity-40 cursor-pointer shadow-2xs"
                      title="Zoom In (+25%)"
                    >
                      <ZoomIn className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={handleMcvZoomOut}
                      disabled={mcvZoom <= 1}
                      className="p-1 rounded bg-white text-slate-700 hover:text-blue-900 hover:bg-slate-50 border border-slate-200 disabled:opacity-40 cursor-pointer shadow-2xs"
                      title="Zoom Out (-25%)"
                    >
                      <ZoomOut className="w-3.5 h-3.5" />
                    </button>
                    {mcvZoom > 1 && (
                      <button
                        onClick={handleMcvResetZoom}
                        className="p-1 rounded bg-white text-slate-700 hover:text-blue-900 hover:bg-slate-50 border border-slate-200 cursor-pointer shadow-2xs"
                        title="Reset Zoom"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* MCV Metrics Ribbon */}
                <div className="grid grid-cols-3 gap-2 mb-3 p-2.5 bg-blue-50/50 rounded-xl border border-blue-100 text-xs">
                  <div>
                    <span className="text-[10px] text-blue-800 block uppercase font-bold">Peak Cleared</span>
                    <strong className="font-mono text-blue-950 font-extrabold text-sm">
                      {peakMw.toFixed(2)} MW
                    </strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-blue-800 block uppercase font-bold">Energy Volume</span>
                    <strong className="font-mono text-blue-700 font-extrabold text-sm">
                      {totalEnergyMwh.toFixed(3)} MWh
                    </strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-blue-800 block uppercase font-bold">Axis Upper Bound</span>
                    <strong className="font-mono text-slate-700 font-bold text-sm">
                      {maxMw} MW
                    </strong>
                  </div>
                </div>

                {/* Dynamic MCV Hover Tooltip */}
                {hoveredMcvSlot !== null && results[hoveredMcvSlot] && (
                  <div className="absolute top-28 right-6 z-20 bg-slate-900/95 text-white backdrop-blur-md rounded-xl p-3 shadow-xl border border-blue-500/40 text-xs font-mono space-y-1 pointer-events-none animate-in fade-in duration-100">
                    <div className="text-[11px] text-blue-400 font-sans font-bold flex items-center justify-between gap-4">
                      <span>Slot T{hoveredMcvSlot} Volume</span>
                      <span className="text-emerald-400">{results[hoveredMcvSlot].status}</span>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-slate-300 font-sans">Power (MCV):</span>
                      <strong className="text-blue-300 font-extrabold">{results[hoveredMcvSlot].mcv_mw.toFixed(3)} MW</strong>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-slate-300 font-sans">Energy (MWh):</span>
                      <strong className="text-cyan-300 font-bold">{results[hoveredMcvSlot].mcv_mwh.toFixed(4)} MWh</strong>
                    </div>
                    <div className="flex items-center justify-between gap-4 text-[10px] text-slate-400 pt-0.5 border-t border-slate-700">
                      <span>Req Demand: {results[hoveredMcvSlot].total_demand.toFixed(1)} MW</span>
                      <span>Req Supply: {results[hoveredMcvSlot].total_supply.toFixed(1)} MW</span>
                    </div>
                  </div>
                )}

                {/* SVG Chart for MCV */}
                <div className="relative w-full overflow-x-auto pt-2">
                  <svg
                    viewBox="0 0 540 220"
                    className="w-full h-auto min-w-[380px] select-none transition-transform duration-200"
                    style={{ transform: `scale(${mcvZoom})`, transformOrigin: 'bottom center' }}
                    onMouseLeave={() => setHoveredMcvSlot(null)}
                  >
                    {/* Y-Axis Label */}
                    <text x="10" y="16" className="text-[10px] font-sans font-bold fill-blue-700">
                      MW Power
                    </text>

                    {/* Horizontal Y-Axis Grid Lines & Numbers */}
                    {[1, 0.75, 0.5, 0.25, 0].map((pct, i) => {
                      const yVal = 180 - pct * 140;
                      const tickLabel = (pct * maxMw).toFixed(1);
                      return (
                        <g key={i}>
                          <line
                            x1="45"
                            y1={yVal}
                            x2="520"
                            y2={yVal}
                            stroke={pct === 0 ? '#94A3B8' : '#F1F5F9'}
                            strokeDasharray={pct === 0 ? '' : '3 3'}
                            strokeWidth={pct === 0 ? '1.5' : '1'}
                          />
                          <text
                            x="40"
                            y={yVal + 3}
                            textAnchor="end"
                            className="text-[9px] font-mono font-medium fill-slate-400"
                          >
                            {tickLabel}
                          </text>
                        </g>
                      );
                    })}

                    {/* MCV Bars per Slot */}
                    {slotsList.map((s, idx) => {
                      const r = results[s];
                      const isCleared = r && r.status === 'Cleared';
                      const mwVal = isCleared ? r.mcv_mw : 0;
                      const mwhVal = isCleared ? r.mcv_mwh : 0;
                      const barHeight = Math.max(isCleared ? (mwVal / maxMw) * 140 : 4, 4);

                      const slotWidth = (520 - 55) / slotsList.length;
                      const slotCenterX = 55 + idx * slotWidth + slotWidth / 2;
                      const barWidth = Math.min(48, slotWidth * 0.65);
                      const barX = slotCenterX - barWidth / 2;
                      const barY = 180 - barHeight;

                      return (
                        <g
                          key={s}
                          className="cursor-pointer group"
                          onMouseEnter={() => setHoveredMcvSlot(s)}
                        >
                          {/* Background hover column */}
                          <rect
                            x={slotCenterX - slotWidth / 2 + 2}
                            y="25"
                            width={slotWidth - 4}
                            height="155"
                            rx="8"
                            className="fill-transparent hover:fill-blue-50/50 transition-colors"
                          />

                          {/* MCV Bar */}
                          <rect
                            x={barX}
                            y={barY}
                            width={barWidth}
                            height={barHeight}
                            rx="6"
                            fill="url(#mcvBlueGradient)"
                            stroke={isCleared ? '#1D4ED8' : '#CBD5E1'}
                            strokeWidth="1"
                            className="transition-all duration-300 drop-shadow-xs"
                          />

                          {/* Value on top of bar */}
                          <text
                            x={slotCenterX}
                            y={Math.max(barY - 6, 26)}
                            textAnchor="middle"
                            className="text-[11px] font-mono font-black fill-blue-900"
                          >
                            {isCleared ? `${mwVal.toFixed(1)} MW` : '0 MW'}
                          </text>

                          {/* Energy subtitle on bar */}
                          {isCleared && barHeight > 30 && (
                            <text
                              x={slotCenterX}
                              y={barY + 14}
                              textAnchor="middle"
                              className="text-[9px] font-mono font-bold fill-white/90"
                            >
                              {mwhVal.toFixed(2)} MWh
                            </text>
                          )}

                          {/* Slot Label beneath axis */}
                          <text
                            x={slotCenterX}
                            y="198"
                            textAnchor="middle"
                            className="text-[11px] font-mono font-bold fill-slate-800"
                          >
                            T{s}
                          </text>

                          {/* Status indicator dot */}
                          <circle
                            cx={slotCenterX}
                            cy="208"
                            r="3.5"
                            fill={isCleared ? '#10B981' : '#F43F5E'}
                          />
                        </g>
                      );
                    })}

                    <defs>
                      <linearGradient id="mcvBlueGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#60A5FA" />
                        <stop offset="100%" stopColor="#2563EB" />
                      </linearGradient>
                    </defs>
                  </svg>
                </div>
              </div>

              {/* MCV Slot Breakdown Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3 pt-3 border-t border-slate-100">
                {slotsList.map((s) => {
                  const r = results[s];
                  const isCleared = r && r.status === 'Cleared';
                  return (
                    <div key={s} className="bg-blue-50/40 rounded-xl p-2.5 border border-blue-100">
                      <div className="flex items-center justify-between text-xs mb-0.5">
                        <span className="font-extrabold font-mono text-blue-950">Slot T{s}</span>
                        <span className={`w-2 h-2 rounded-full ${isCleared ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                      </div>
                      <div className="text-xs font-mono font-bold text-blue-800">
                        {isCleared ? `${r.mcv_mw.toFixed(2)} MW` : '0 MW'}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* ========================================================= */}
          {/* CHART 3: FINANCIAL SETTLEMENT TURNOVER PER SLOT (NRs) */}
          {/* ========================================================= */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-600">
                  <Activity className="w-4 h-4 text-emerald-600" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-slate-900">
                    Market Financial Settlement Turnover per Slot
                  </h3>
                  <p className="text-xs text-slate-500">
                    Total financial volume (NRs = MCP × MWh × 1000)
                  </p>
                </div>
              </div>

              <div className="px-3.5 py-1.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-mono font-extrabold text-emerald-800">
                Total Turnover: NRs {Math.round(totalMarketTurnover).toLocaleString('en-US')}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
              {slotsList.map((s) => {
                const r = results[s];
                const mv = r?.market_value || 0;
                const pctMv = Math.min(100, (mv / maxMv) * 100);

                return (
                  <div key={s} className="p-3.5 bg-slate-50/80 rounded-xl border border-slate-100 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-extrabold text-indigo-950 font-mono">Interval T{s}</span>
                      <span className="font-mono font-extrabold text-emerald-700">
                        {r?.status === 'Cleared'
                          ? `NRs ${Math.round(mv).toLocaleString('en-US')}`
                          : 'NRs 0'}
                      </span>
                    </div>
                    <div className="h-2.5 w-full bg-slate-200/70 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-emerald-500 to-teal-700 rounded-full transition-all duration-500"
                        style={{ width: `${pctMv}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono">
                      <span>Rate: {r?.status === 'Cleared' ? `NRs ${r.mcp.toFixed(2)}` : '—'}</span>
                      <span>Power: {r?.status === 'Cleared' ? `${r.mcv_mw.toFixed(1)} MW` : '—'}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
