import React from 'react';
import { SlotClearingResult } from '../types';
import { BarChart3, TrendingUp, CheckCircle2, XCircle, Download } from 'lucide-react';

interface OverviewTabProps {
  results: Record<number, SlotClearingResult>;
  nSlots: number;
}

export const OverviewTab: React.FC<OverviewTabProps> = ({ results, nSlots }) => {
  const slotsList = Array.from({ length: nSlots }, (_, i) => i + 1);

  // Compute maximum values for bar scaling
  const maxMcp = Math.max(...slotsList.map((s) => results[s]?.mcp || 0), 10);
  const maxMw = Math.max(...slotsList.map((s) => results[s]?.mcv_mw || 0), 100);
  const maxMv = Math.max(...slotsList.map((s) => results[s]?.market_value || 0), 500000);

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
      if (!r || r.status !== 'Cleared') {
        return [`T${s}`, '—', '—', '—', '—', '—', '—', '—', 'No Trade'];
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

  return (
    <div className="space-y-6">
      {/* Table Section */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Slot-wise Market Clearing Summary
            </h2>
            <p className="text-xs text-slate-500">
              Aggregated clearing results, cleared energy volumes, and nodal prices
            </p>
          </div>
          <button
            onClick={exportSummaryCSV}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 transition-colors shadow-2xs"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Summary CSV</span>
          </button>
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
                const isCleared = r && r.status === 'Cleared';

                return (
                  <tr
                    key={s}
                    className={`transition-colors ${
                      isCleared ? 'hover:bg-slate-50' : 'bg-rose-50/20'
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
                          <CheckCircle2 className="w-3 h-3" />
                          <span>Cleared</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                          <XCircle className="w-3 h-3" />
                          <span>No Trade</span>
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

      {/* Visual Trends Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Trend 1: MCP & MW Volume by Slot - Dual Column Column Chart with Data Labels */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-amber-50 text-amber-600">
                <TrendingUp className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Market Clearing Price &amp; Dispatched MW
                </h3>
                <p className="text-xs text-slate-500">Dual metrics comparison with exact clearing values</p>
              </div>
            </div>

            {/* Legend */}
            <div className="flex items-center gap-3 text-[11px] font-semibold">
              <span className="flex items-center gap-1.5 text-amber-700">
                <span className="w-3 h-3 rounded-md bg-amber-500 shadow-2xs"></span> MCP (NRs/kWh)
              </span>
              <span className="flex items-center gap-1.5 text-blue-700">
                <span className="w-3 h-3 rounded-md bg-blue-600 shadow-2xs"></span> Dispatched (MW)
              </span>
            </div>
          </div>

          {/* SVG Grouped Column Chart with Explicit Data Labels right on top of bars */}
          <div className="pt-2">
            <div className="relative w-full overflow-x-auto">
              <svg viewBox="0 0 520 220" className="w-full h-auto min-w-[420px] select-none">
                {/* Horizontal guide lines */}
                {[0.25, 0.5, 0.75, 1].map((pct, i) => (
                  <line
                    key={i}
                    x1="40"
                    y1={180 - pct * 140}
                    x2="500"
                    y2={180 - pct * 140}
                    stroke="#F1F5F9"
                    strokeDasharray="3 3"
                    strokeWidth="1"
                  />
                ))}

                {/* Base axis line */}
                <line x1="40" y1="180" x2="500" y2="180" stroke="#CBD5E1" strokeWidth="1.5" />

                {/* Bars per Slot */}
                {slotsList.map((s, idx) => {
                  const r = results[s];
                  const isCleared = r && r.status === 'Cleared';
                  const mcpVal = isCleared ? r.mcp : 0;
                  const mwVal = isCleared ? r.mcv_mw : 0;

                  // Scales
                  const mcpHeight = Math.max(isCleared ? (mcpVal / maxMcp) * 130 : 4, 4);
                  const mwHeight = Math.max(isCleared ? (mwVal / maxMw) * 130 : 4, 4);

                  // Slot X centers
                  const slotWidth = (500 - 40) / slotsList.length;
                  const slotCenterX = 40 + idx * slotWidth + slotWidth / 2;

                  const barWidth = 26;
                  const gap = 4;
                  const mcpX = slotCenterX - barWidth - gap / 2;
                  const mwX = slotCenterX + gap / 2;

                  const mcpY = 180 - mcpHeight;
                  const mwY = 180 - mwHeight;

                  return (
                    <g key={s} className="group">
                      {/* Slot boundary background highlight */}
                      <rect
                        x={slotCenterX - slotWidth / 2 + 4}
                        y="20"
                        width={slotWidth - 8}
                        height="160"
                        rx="8"
                        className="fill-transparent hover:fill-slate-50 transition-colors"
                      />

                      {/* MCP Bar (Amber) */}
                      <rect
                        x={mcpX}
                        y={mcpY}
                        width={barWidth}
                        height={mcpHeight}
                        rx="5"
                        fill="url(#amberGradient)"
                        className="transition-all duration-300"
                      />

                      {/* MCP Exact Value Label on Top */}
                      <text
                        x={mcpX + barWidth / 2}
                        y={Math.max(mcpY - 6, 28)}
                        textAnchor="middle"
                        className="text-[10px] font-mono font-black fill-amber-700 font-bold"
                      >
                        {isCleared ? mcpVal.toFixed(2) : '0'}
                      </text>

                      {/* Dispatched MW Bar (Blue) */}
                      <rect
                        x={mwX}
                        y={mwY}
                        width={barWidth}
                        height={mwHeight}
                        rx="5"
                        fill="url(#blueGradient)"
                        className="transition-all duration-300"
                      />

                      {/* MW Exact Value Label on Top */}
                      <text
                        x={mwX + barWidth / 2}
                        y={Math.max(mwY - 6, 28)}
                        textAnchor="middle"
                        className="text-[10px] font-mono font-black fill-blue-700 font-bold"
                      >
                        {isCleared ? `${Math.round(mwVal)}` : '0'}
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
                        r="3"
                        fill={isCleared ? '#10B981' : '#F43F5E'}
                      />
                    </g>
                  );
                })}

                {/* SVG Gradients */}
                <defs>
                  <linearGradient id="amberGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#F59E0B" />
                    <stop offset="100%" stopColor="#D97706" />
                  </linearGradient>
                  <linearGradient id="blueGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#3B82F6" />
                    <stop offset="100%" stopColor="#1D4ED8" />
                  </linearGradient>
                </defs>
              </svg>
            </div>

            {/* Supplementary Data Table Strip directly adjacent to the chart */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-2 pt-3 border-t border-slate-100">
              {slotsList.map((s) => {
                const r = results[s];
                const isCleared = r && r.status === 'Cleared';
                return (
                  <div key={s} className="bg-slate-50/80 rounded-xl p-2.5 border border-slate-100">
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="font-extrabold font-mono text-indigo-950">Slot T{s}</span>
                      <span className={`w-2 h-2 rounded-full ${isCleared ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                    </div>
                    <div className="text-[11px] font-mono flex items-center justify-between">
                      <span className="text-slate-500 font-sans">Price:</span>
                      <strong className="text-amber-700">{isCleared ? `NRs ${r.mcp.toFixed(3)}` : 'No Trade'}</strong>
                    </div>
                    <div className="text-[11px] font-mono flex items-center justify-between">
                      <span className="text-slate-500 font-sans">Power:</span>
                      <strong className="text-blue-700">{isCleared ? `${r.mcv_mw.toFixed(2)} MW` : '0 MW'}</strong>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Trend 2: Market Financial Settlement Volume */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs">
          <div className="flex items-center gap-2 mb-4">
            <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600">
              <BarChart3 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Market Financial Turnover per Slot
              </h3>
              <p className="text-xs text-slate-500">Total settlement volume (NRs = MCP × MWh × 1000)</p>
            </div>
          </div>

          <div className="space-y-3.5 pt-2">
            {slotsList.map((s) => {
              const r = results[s];
              const mv = r?.market_value || 0;
              const pctMv = Math.min(100, (mv / maxMv) * 100);

              return (
                <div key={s} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-indigo-950 font-mono">Slot T{s}</span>
                    <span className="font-mono font-bold text-emerald-700">
                      {r?.status === 'Cleared'
                        ? `NRs ${Math.round(mv).toLocaleString('en-US')}`
                        : 'NRs 0'}
                    </span>
                  </div>
                  <div className="h-3.5 w-full bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-emerald-500 to-teal-700 rounded-full transition-all duration-500"
                      style={{ width: `${pctMv}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-4 p-3 bg-slate-50 rounded-xl border border-slate-100 text-xs text-slate-600 flex items-center justify-between">
            <span className="font-medium">Total Session Market Volume:</span>
            <span className="font-mono font-extrabold text-emerald-700 text-sm">
              NRs{' '}
              {Math.round(
                slotsList.reduce((acc, s) => acc + (results[s]?.market_value || 0), 0)
              ).toLocaleString('en-US')}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
