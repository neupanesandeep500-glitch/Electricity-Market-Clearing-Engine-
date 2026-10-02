import React from 'react';
import { SlotClearingResult } from '../types';
import { Zap, Activity, BatteryCharging, DollarSign, Users, CheckCircle2 } from 'lucide-react';

interface KpiCardsProps {
  results: Record<number, SlotClearingResult>;
  nSlots: number;
  totalBuyers: number;
  totalSellers: number;
  hasComputed?: boolean;
}

export const KpiCards: React.FC<KpiCardsProps> = ({
  results,
  nSlots,
  totalBuyers,
  totalSellers,
  hasComputed = false,
}) => {
  const hasParticipants = totalBuyers > 0 || totalSellers > 0;
  const isCalculated = hasComputed && hasParticipants;

  const clearedSlots = isCalculated
    ? Object.values(results).filter((r) => r && r.status === 'Cleared')
    : [];

  const avgMcp =
    clearedSlots.length > 0
      ? clearedSlots.reduce((sum, r) => sum + r.mcp, 0) / clearedSlots.length
      : 0;

  const totalMw = clearedSlots.reduce((sum, r) => sum + r.mcv_mw, 0);
  const totalMwh = clearedSlots.reduce((sum, r) => sum + r.mcv_mwh, 0);
  const totalMarketValue = clearedSlots.reduce((sum, r) => sum + r.market_value, 0);

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
      {/* 1. Average MCP */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs relative overflow-hidden">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
            Average MCP
          </span>
          <div className="p-1.5 rounded-lg bg-amber-50 text-amber-600">
            <Zap className="w-4 h-4" />
          </div>
        </div>
        <div className="text-xl sm:text-2xl font-extrabold font-mono text-amber-600 tracking-tight leading-none mb-1">
          {isCalculated && clearedSlots.length > 0 ? `NRs ${avgMcp.toFixed(3)}` : '—'}
        </div>
        <div className="text-[11px] text-slate-500 font-medium">
          {isCalculated ? 'NRs/kWh · across cleared slots' : 'Awaiting computation'}
        </div>
      </div>

      {/* 2. MW Cleared */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs relative overflow-hidden">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
            Power Cleared
          </span>
          <div className="p-1.5 rounded-lg bg-blue-50 text-blue-600">
            <Activity className="w-4 h-4" />
          </div>
        </div>
        <div className="text-xl sm:text-2xl font-extrabold font-mono text-blue-700 tracking-tight leading-none mb-1">
          {isCalculated && clearedSlots.length > 0 ? (
            <>
              {totalMw.toFixed(2)}
              <span className="text-sm font-semibold text-slate-400 ml-1">MW</span>
            </>
          ) : (
            '—'
          )}
        </div>
        <div className="text-[11px] text-slate-500 font-medium">
          {isCalculated ? 'Total dispatched capacity' : 'Awaiting computation'}
        </div>
      </div>

      {/* 3. MWh Cleared */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs relative overflow-hidden">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
            Energy Cleared
          </span>
          <div className="p-1.5 rounded-lg bg-cyan-50 text-cyan-600">
            <BatteryCharging className="w-4 h-4" />
          </div>
        </div>
        <div className="text-xl sm:text-2xl font-extrabold font-mono text-cyan-700 tracking-tight leading-none mb-1">
          {isCalculated && clearedSlots.length > 0 ? (
            <>
              {totalMwh.toFixed(3)}
              <span className="text-sm font-semibold text-slate-400 ml-1">MWh</span>
            </>
          ) : (
            '—'
          )}
        </div>
        <div className="text-[11px] text-slate-500 font-medium">
          {isCalculated ? 'MW × 0.25 (15-min slots)' : 'Awaiting computation'}
        </div>
      </div>

      {/* 4. Total Market Value */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs relative overflow-hidden">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
            Market Value
          </span>
          <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600">
            <DollarSign className="w-4 h-4" />
          </div>
        </div>
        <div className="text-xl sm:text-2xl font-extrabold font-mono text-emerald-700 tracking-tight leading-none mb-1">
          {isCalculated && clearedSlots.length > 0
            ? `NRs ${Math.round(totalMarketValue).toLocaleString('en-US')}`
            : '—'}
        </div>
        <div className="text-[11px] text-slate-500 font-medium">
          {isCalculated ? 'Total settlement volume' : 'Awaiting computation'}
        </div>
      </div>

      {/* 5. Participants Intake */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs relative overflow-hidden">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
            Intake Received
          </span>
          <div className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600">
            <Users className="w-4 h-4" />
          </div>
        </div>
        <div className="text-xl sm:text-2xl font-extrabold font-mono text-indigo-900 tracking-tight leading-none mb-1">
          {hasParticipants ? totalBuyers + totalSellers : '—'}
        </div>
        <div className="text-[11px] text-slate-500 font-medium truncate">
          {hasParticipants ? (
            <>
              <span className="text-blue-600 font-semibold">{totalBuyers} Bids</span> ·{' '}
              <span className="text-rose-600 font-semibold">{totalSellers} Offers</span>
            </>
          ) : (
            'No valid bids/offers'
          )}
        </div>
      </div>

      {/* 6. Clearing Efficiency */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs relative overflow-hidden">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
            Slot Status
          </span>
          <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600">
            <CheckCircle2 className="w-4 h-4" />
          </div>
        </div>
        <div className="text-xl sm:text-2xl font-extrabold font-mono text-slate-900 tracking-tight leading-none mb-1">
          {isCalculated ? `${clearedSlots.length} / ${nSlots}` : '—'}
        </div>
        <div className="text-[11px] text-emerald-600 font-semibold">
          {!hasParticipants
            ? 'No bids/offers in sheet'
            : !hasComputed
            ? 'Pending computation'
            : clearedSlots.length === nSlots
            ? '100% Slots Cleared'
            : `${clearedSlots.length} Cleared`}
        </div>
      </div>
    </div>
  );
};
