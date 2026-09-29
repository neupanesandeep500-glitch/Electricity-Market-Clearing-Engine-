import React from 'react';
import { SlotClearingResult } from '../types';
import { Zap, Activity, BatteryCharging, DollarSign, Users, CheckCircle2 } from 'lucide-react';

interface KpiCardsProps {
  results: Record<number, SlotClearingResult>;
  nSlots: number;
  totalBuyers: number;
  totalSellers: number;
}

export const KpiCards: React.FC<KpiCardsProps> = ({
  results,
  nSlots,
  totalBuyers,
  totalSellers,
}) => {
  const clearedSlots = Object.values(results).filter((r) => r && r.status === 'Cleared');
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
          {clearedSlots.length > 0 ? `NRs ${avgMcp.toFixed(3)}` : '—'}
        </div>
        <div className="text-[11px] text-slate-500 font-medium">
          NRs/kWh · across cleared slots
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
          {clearedSlots.length > 0 ? `${totalMw.toFixed(2)}` : '—'}
          <span className="text-sm font-semibold text-slate-400 ml-1">MW</span>
        </div>
        <div className="text-[11px] text-slate-500 font-medium">
          Total dispatched capacity
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
          {clearedSlots.length > 0 ? `${totalMwh.toFixed(3)}` : '—'}
          <span className="text-sm font-semibold text-slate-400 ml-1">MWh</span>
        </div>
        <div className="text-[11px] text-slate-500 font-medium">
          MW × 0.25 (15-min slots)
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
          {clearedSlots.length > 0
            ? `NRs ${Math.round(totalMarketValue).toLocaleString('en-US')}`
            : '—'}
        </div>
        <div className="text-[11px] text-slate-500 font-medium">
          Total settlement volume
        </div>
      </div>

      {/* 5. Participants */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs relative overflow-hidden">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
            Participants
          </span>
          <div className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600">
            <Users className="w-4 h-4" />
          </div>
        </div>
        <div className="text-xl sm:text-2xl font-extrabold font-mono text-indigo-900 tracking-tight leading-none mb-1">
          {totalBuyers + totalSellers}
        </div>
        <div className="text-[11px] text-slate-500 font-medium truncate">
          <span className="text-blue-600 font-semibold">{totalBuyers} Buyers</span> ·{' '}
          <span className="text-rose-600 font-semibold">{totalSellers} Sellers</span>
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
          {clearedSlots.length} / {nSlots}
        </div>
        <div className="text-[11px] text-emerald-600 font-semibold">
          {clearedSlots.length === nSlots ? '100% Slots Cleared' : `${clearedSlots.length} Cleared`}
        </div>
      </div>
    </div>
  );
};
