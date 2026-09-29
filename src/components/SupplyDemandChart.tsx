import React, { useState } from 'react';
import { SlotClearingResult } from '../types';
import { Layers, CheckCircle, AlertTriangle, XCircle, Info } from 'lucide-react';

interface SupplyDemandChartProps {
  results: Record<number, SlotClearingResult>;
  nSlots: number;
}

export const SupplyDemandChart: React.FC<SupplyDemandChartProps> = ({ results, nSlots }) => {
  const [selectedSlot, setSelectedSlot] = useState<number>(1);
  const [hoveredPoint, setHoveredPoint] = useState<{ x: number; y: number; text: string } | null>(null);

  const currentResult = results[selectedSlot];

  if (!currentResult) {
    return (
      <div className="p-8 text-center text-slate-500 bg-white rounded-2xl border border-slate-200">
        No market data available for slot T{selectedSlot}.
      </div>
    );
  }

  const {
    status,
    mcp,
    mcv_mw,
    clearing_mode,
    all_buyers = [],
    all_sellers = [],
    accepted_buyers = [],
    accepted_sellers = [],
    total_demand,
    total_supply,
  } = currentResult;

  // Build step-curve points
  const bSorted = [...all_buyers].sort((a, b) => b.price - a.price);
  const sSorted = [...all_sellers].sort((a, b) => a.price - b.price);

  const demPoints: { q: number; p: number }[] = [];
  let cumB = 0;
  if (bSorted.length > 0) {
    demPoints.push({ q: 0, p: bSorted[0].price });
    for (const item of bSorted) {
      demPoints.push({ q: cumB, p: item.price });
      cumB += item.quantity;
      demPoints.push({ q: cumB, p: item.price });
    }
  }

  const supPoints: { q: number; p: number }[] = [];
  let cumS = 0;
  if (sSorted.length > 0) {
    supPoints.push({ q: 0, p: sSorted[0].price });
    for (const item of sSorted) {
      supPoints.push({ q: cumS, p: item.price });
      cumS += item.quantity;
      supPoints.push({ q: cumS, p: item.price });
    }
  }

  // Dimension bounds
  const maxQ = Math.max(total_demand, total_supply, mcv_mw, 50) * 1.15;
  const allPrices = [...bSorted.map((b) => b.price), ...sSorted.map((s) => s.price), mcp];
  const maxP = Math.max(...allPrices, 12) * 1.18;
  const minP = 0;

  const width = 800;
  const height = 400;
  const padL = 60;
  const padR = 30;
  const padT = 30;
  const padB = 50;

  const scaleX = (q: number) => padL + (q / maxQ) * (width - padL - padR);
  const scaleY = (p: number) => height - padB - ((p - minP) / (maxP - minP)) * (height - padT - padB);

  // SVG Path Strings
  const demPathD = demPoints.reduce((acc, pt, i) => `${acc} ${i === 0 ? 'M' : 'L'} ${scaleX(pt.q)} ${scaleY(pt.p)}`, '');
  const supPathD = supPoints.reduce((acc, pt, i) => `${acc} ${i === 0 ? 'M' : 'L'} ${scaleX(pt.q)} ${scaleY(pt.p)}`, '');

  // Partial annotations
  const partialSellers = accepted_sellers.filter((s) => s.acceptance_status === 'Partial');
  const partialBuyers = accepted_buyers.filter((b) => b.acceptance_status === 'Partial');

  return (
    <div className="space-y-6">
      {/* Slot Selector & Status Banner */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-indigo-50 text-indigo-700 rounded-xl">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Supply &amp; Demand Clearing Curves
              </h2>
              <p className="text-xs text-slate-500">
                Piecewise marginal pricing intersection and economic dispatch analysis
              </p>
            </div>
          </div>

          {/* Slot Selector as Dropdown near the chart for easy switching */}
          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            <label className="text-xs font-bold text-slate-700 whitespace-nowrap">
              Select Trading Slot:
            </label>
            <div className="relative flex-1 sm:w-48">
              <select
                value={selectedSlot}
                onChange={(e) => setSelectedSlot(Number(e.target.value))}
                className="w-full appearance-none bg-slate-50 hover:bg-slate-100/80 border border-slate-300 font-mono font-extrabold text-xs text-indigo-950 py-2 pl-3.5 pr-8 rounded-xl outline-none focus:border-indigo-600 focus:bg-white shadow-2xs cursor-pointer transition-colors"
              >
                {Array.from({ length: nSlots }, (_, i) => i + 1).map((s) => {
                  const res = results[s];
                  const isCleared = res && res.status === 'Cleared';
                  return (
                    <option key={s} value={s}>
                      Slot T{s} {isCleared ? `(Cleared · NRs ${res.mcp.toFixed(2)}/kWh)` : '(No Trade)'}
                    </option>
                  );
                })}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2.5 text-slate-500">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* Slot Result Summary Badges with high-contrast text and backgrounds */}
        <div className="flex flex-wrap items-center gap-2.5 pt-3 border-t border-slate-100 text-xs">
          <span className="font-bold text-slate-700">Slot T{selectedSlot} Status:</span>
          {status === 'Cleared' ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full font-extrabold bg-emerald-100 text-emerald-900 border border-emerald-300 shadow-2xs">
              <CheckCircle className="w-3.5 h-3.5 text-emerald-700" />
              <span>Market Cleared</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full font-extrabold bg-rose-100 text-rose-900 border border-rose-300 shadow-2xs">
              <XCircle className="w-3.5 h-3.5 text-rose-700" />
              <span>No Trade</span>
            </span>
          )}

          {status === 'Cleared' && (
            <>
              {/* Market Clearing Price badge */}
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-amber-50 border border-amber-200 text-amber-950 font-mono shadow-2xs">
                <span className="text-[10px] font-sans font-bold uppercase tracking-wider text-amber-800">MCP:</span>
                <strong className="text-amber-900 font-extrabold">NRs {mcp.toFixed(3)}</strong>
                <span className="text-[11px] text-amber-700 font-sans">/ kWh</span>
              </div>

              {/* Market Clearing Volume badge */}
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-blue-50 border border-blue-200 text-blue-950 font-mono shadow-2xs">
                <span className="text-[10px] font-sans font-bold uppercase tracking-wider text-blue-800">MCV:</span>
                <strong className="text-blue-900 font-extrabold">{mcv_mw.toFixed(3)} MW</strong>
                <span className="text-[11px] text-blue-700 font-sans">({(mcv_mw * 0.25).toFixed(3)} MWh)</span>
              </div>

              {/* Market Value badge */}
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-950 font-mono shadow-2xs">
                <span className="text-[10px] font-sans font-bold uppercase tracking-wider text-emerald-800">Market Value:</span>
                <strong className="text-emerald-900 font-extrabold">
                  NRs {Math.round(currentResult.market_value).toLocaleString('en-US')}
                </strong>
              </div>

              <span className="text-slate-600 text-[11px] bg-slate-100 border border-slate-200 px-2.5 py-1 rounded-lg font-medium">
                Mode: {clearing_mode}
              </span>
            </>
          )}
        </div>
      </div>

      {/* Interactive SVG Chart */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-6 shadow-xs relative">
        <div className="flex items-center justify-between mb-3 text-xs">
          <div className="flex items-center gap-4 flex-wrap font-semibold">
            <div className="flex items-center gap-1.5">
              <span className="w-3.5 h-1 rounded-full bg-[#C0392B]"></span>
              <span className="text-rose-900">Demand Curve (Buyer Bids)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3.5 h-1 rounded-full bg-[#1565C0]"></span>
              <span className="text-blue-900">Supply Curve (Seller Offers)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rotate-45 bg-amber-500"></span>
              <span className="text-amber-800">Clearing Point (MCP, MCV)</span>
            </div>
          </div>
          <span className="hidden sm:inline text-slate-400 text-[11px]">Hover curve to inspect values</span>
        </div>

        <div className="relative w-full overflow-x-auto">
          <svg
            viewBox={`0 0 ${width} ${height}`}
            className="w-full h-auto min-w-[600px] select-none"
            style={{ maxHeight: '460px' }}
          >
            {/* Grid Lines */}
            {[0, 0.2, 0.4, 0.6, 0.8, 1.0].map((frac, idx) => {
              const yVal = minP + frac * (maxP - minP);
              const yPos = scaleY(yVal);
              const xVal = frac * maxQ;
              const xPos = scaleX(xVal);

              return (
                <g key={idx}>
                  {/* Horizontal grid line */}
                  <line
                    x1={padL}
                    y1={yPos}
                    x2={width - padR}
                    y2={yPos}
                    stroke="#F1F5F9"
                    strokeWidth="1"
                  />
                  <text
                    x={padL - 8}
                    y={yPos + 4}
                    textAnchor="end"
                    className="text-[10px] font-mono fill-slate-400"
                  >
                    {yVal.toFixed(1)}
                  </text>

                  {/* Vertical grid line */}
                  <line
                    x1={xPos}
                    y1={padT}
                    x2={xPos}
                    y2={height - padB}
                    stroke="#F1F5F9"
                    strokeWidth="1"
                  />
                  <text
                    x={xPos}
                    y={height - padB + 16}
                    textAnchor="middle"
                    className="text-[10px] font-mono fill-slate-400"
                  >
                    {Math.round(xVal)}
                  </text>
                </g>
              );
            })}

            {/* Axes */}
            <line
              x1={padL}
              y1={height - padB}
              x2={width - padR}
              y2={height - padB}
              stroke="#CBD5E1"
              strokeWidth="1.5"
            />
            <line
              x1={padL}
              y1={padT}
              x2={padL}
              y2={height - padB}
              stroke="#CBD5E1"
              strokeWidth="1.5"
            />

            {/* Axis Titles */}
            <text
              x={width / 2}
              y={height - 14}
              textAnchor="middle"
              className="text-[11px] font-bold fill-slate-600"
            >
              Power Quantity (MW)
            </text>
            <text
              transform={`rotate(-90)`}
              x={-(height / 2)}
              y={18}
              textAnchor="middle"
              className="text-[11px] font-bold fill-slate-600"
            >
              Rate (NRs/kWh)
            </text>

            {/* Demand Step Curve */}
            {demPathD && (
              <path
                d={demPathD}
                fill="none"
                stroke="#C0392B"
                strokeWidth="2.75"
                strokeLinecap="round"
                strokeLinejoin="miter"
              />
            )}

            {/* Supply Step Curve */}
            {supPathD && (
              <path
                d={supPathD}
                fill="none"
                stroke="#1565C0"
                strokeWidth="2.75"
                strokeLinecap="round"
                strokeLinejoin="miter"
              />
            )}

            {/* Clearing Point & Dashed Lines */}
            {status === 'Cleared' && (
              <g>
                {/* Horizontal MCP line */}
                <line
                  x1={padL}
                  y1={scaleY(mcp)}
                  x2={scaleX(mcv_mw)}
                  y2={scaleY(mcp)}
                  stroke="#E67E22"
                  strokeWidth="1.75"
                  strokeDasharray="4 4"
                />
                {/* Vertical MCV line */}
                <line
                  x1={scaleX(mcv_mw)}
                  y1={scaleY(mcp)}
                  x2={scaleX(mcv_mw)}
                  y2={height - padB}
                  stroke="#E67E22"
                  strokeWidth="1.75"
                  strokeDasharray="4 4"
                />

                {/* Star Point Marker */}
                <polygon
                  points={`${scaleX(mcv_mw)},${scaleY(mcp) - 7} ${scaleX(mcv_mw) + 5},${scaleY(mcp) + 5} ${scaleX(mcv_mw) - 7},${scaleY(mcp) - 2} ${scaleX(mcv_mw) + 7},${scaleY(mcp) - 2} ${scaleX(mcv_mw) - 5},${scaleY(mcp) + 5}`}
                  fill="#E67E22"
                  stroke="#FFFFFF"
                  strokeWidth="1.5"
                />

                {/* Label Callout with distinctive professional high-contrast styling */}
                <rect
                  x={scaleX(mcv_mw) + 8}
                  y={scaleY(mcp) - 26}
                  width="155"
                  height="26"
                  rx="8"
                  fill="#0D1B4B"
                  stroke="#F59E0B"
                  strokeWidth="1.5"
                  className="shadow-md"
                />
                <text
                  x={scaleX(mcv_mw) + 16}
                  y={scaleY(mcp) - 9}
                  className="text-[11px] font-mono font-black fill-amber-300"
                >
                  MCP: NRs {mcp.toFixed(2)} | {mcv_mw.toFixed(1)} MW
                </text>
              </g>
            )}

            {/* Annotate Partial Sellers */}
            {partialSellers.map((sel, idx) => (
              <circle
                key={`ps-${idx}`}
                cx={scaleX(mcv_mw)}
                cy={scaleY(sel.price)}
                r="5"
                fill="#FFF8E1"
                stroke="#E65100"
                strokeWidth="2"
              />
            ))}

            {/* Annotate Partial Buyers */}
            {partialBuyers.map((b, idx) => (
              <circle
                key={`pb-${idx}`}
                cx={scaleX(mcv_mw)}
                cy={scaleY(b.price)}
                r="5"
                fill="#EDE7F6"
                stroke="#6A1B9A"
                strokeWidth="2"
              />
            ))}
          </svg>
        </div>
      </div>

      {/* Accepted Tables for Selected Slot */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Accepted Buyers (Drawl) */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs">
          <div className="flex items-center justify-between mb-3 border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-600"></span>
              <h3 className="text-sm font-bold text-slate-900">
                Buyer Allocations (Power Drawl)
              </h3>
            </div>
            <span className="text-xs font-semibold text-blue-700 bg-blue-50 px-2.5 py-0.5 rounded-full">
              {accepted_buyers.length} Dispatched
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-blue-900 text-white font-semibold">
                  <th className="p-2.5 rounded-l-lg">Participant</th>
                  <th className="p-2.5 text-right">Bid (NRs/kWh)</th>
                  <th className="p-2.5 text-right">Bid (MW)</th>
                  <th className="p-2.5 text-right">Awarded (MW)</th>
                  <th className="p-2.5 text-center rounded-r-lg">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {all_buyers.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-4 text-center text-slate-400">
                      No buyer bids in this slot
                    </td>
                  </tr>
                ) : (
                  all_buyers.map((b, i) => (
                    <tr
                      key={i}
                      className={
                        b.acceptance_status === 'Full'
                          ? 'bg-emerald-50/50'
                          : b.acceptance_status === 'Partial'
                          ? 'bg-amber-50/50'
                          : 'bg-rose-50/30 text-slate-400'
                      }
                    >
                      <td className="p-2.5 font-medium text-slate-800">{b.name}</td>
                      <td className="p-2.5 text-right font-mono">{b.price.toFixed(3)}</td>
                      <td className="p-2.5 text-right font-mono">{b.quantity.toFixed(1)}</td>
                      <td className="p-2.5 text-right font-mono font-bold text-blue-900">
                        {b.qty_accepted.toFixed(3)}
                      </td>
                      <td className="p-2.5 text-center">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            b.acceptance_status === 'Full'
                              ? 'bg-emerald-100 text-emerald-800'
                              : b.acceptance_status === 'Partial'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-slate-100 text-slate-500'
                          }`}
                        >
                          {b.acceptance_status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Accepted Sellers (Dispatch) */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs">
          <div className="flex items-center justify-between mb-3 border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-600"></span>
              <h3 className="text-sm font-bold text-slate-900">
                Seller Allocations (Power Generation Dispatch)
              </h3>
            </div>
            <span className="text-xs font-semibold text-rose-700 bg-rose-50 px-2.5 py-0.5 rounded-full">
              {accepted_sellers.length} Dispatched
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-rose-900 text-white font-semibold">
                  <th className="p-2.5 rounded-l-lg">Participant</th>
                  <th className="p-2.5 text-right">Offer (NRs/kWh)</th>
                  <th className="p-2.5 text-right">Offer (MW)</th>
                  <th className="p-2.5 text-right">Dispatched (MW)</th>
                  <th className="p-2.5 text-center rounded-r-lg">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {all_sellers.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-4 text-center text-slate-400">
                      No seller offers in this slot
                    </td>
                  </tr>
                ) : (
                  all_sellers.map((s, i) => (
                    <tr
                      key={i}
                      className={
                        s.acceptance_status === 'Full'
                          ? 'bg-emerald-50/50'
                          : s.acceptance_status === 'Partial'
                          ? 'bg-amber-50/50'
                          : 'bg-rose-50/30 text-slate-400'
                      }
                    >
                      <td className="p-2.5 font-medium text-slate-800">{s.name}</td>
                      <td className="p-2.5 text-right font-mono">{s.price.toFixed(3)}</td>
                      <td className="p-2.5 text-right font-mono">{s.quantity.toFixed(1)}</td>
                      <td className="p-2.5 text-right font-mono font-bold text-rose-900">
                        {s.qty_accepted.toFixed(3)}
                      </td>
                      <td className="p-2.5 text-center">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            s.acceptance_status === 'Full'
                              ? 'bg-emerald-100 text-emerald-800'
                              : s.acceptance_status === 'Partial'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-slate-100 text-slate-500'
                          }`}
                        >
                          {s.acceptance_status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
