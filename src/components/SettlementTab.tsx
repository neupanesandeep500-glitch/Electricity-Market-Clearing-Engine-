import React, { useState } from 'react';
import { SettlementRecord, SlotClearingResult, ParticipantSummaryItem } from '../types';
import { generateMarketReportPDF } from '../services/pdfReportService';
import { DollarSign, Download, Search, CheckCircle, AlertTriangle, AlertCircle, Clock, Cpu, FileText } from 'lucide-react';

interface SettlementTabProps {
  settlementRecords: SettlementRecord[];
  hasComputed?: boolean;
  totalBuyers?: number;
  totalSellers?: number;
  onRunCompute?: () => void;
  results?: Record<number, SlotClearingResult>;
  participantSummaries?: ParticipantSummaryItem[];
  nSlots?: number;
  sessionLabel?: string;
}

export const SettlementTab: React.FC<SettlementTabProps> = ({
  settlementRecords,
  hasComputed = false,
  totalBuyers = 0,
  totalSellers = 0,
  onRunCompute,
  results = {},
  participantSummaries = [],
  nSlots = 4,
  sessionLabel = 'NEM Session',
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | 'Buyer' | 'Seller'>('all');

  const hasParticipants = totalBuyers > 0 || totalSellers > 0;
  const isCalculated = hasComputed && settlementRecords.length > 0;

  const buyerTotal = isCalculated
    ? settlementRecords
        .filter((r) => r.role === 'Buyer')
        .reduce((sum, r) => sum + r.amount_nrs, 0)
    : 0;

  const sellerTotal = isCalculated
    ? settlementRecords
        .filter((r) => r.role === 'Seller')
        .reduce((sum, r) => sum + r.amount_nrs, 0)
    : 0;

  const filteredRecords = settlementRecords.filter((r) => {
    const matchesSearch =
      r.participant.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.slot.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = roleFilter === 'all' || r.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  const exportSettlementCSV = () => {
    const headers = [
      'Slot',
      'Role',
      'Participant',
      'Email',
      'MCP (NRs/kWh)',
      'Awarded (MW)',
      'Energy (MWh)',
      'Amount (NRs)',
      'Status',
    ];

    const rows = settlementRecords.map((r) => [
      r.slot,
      r.role,
      `"${r.participant}"`,
      r.email || '',
      r.mcp.toFixed(3),
      r.qty_accepted_mw.toFixed(3),
      r.energy_mwh.toFixed(4),
      r.amount_nrs.toFixed(2),
      r.status,
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `market_settlement_register_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
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
              The connected Google Sheet currently contains no valid participant bids or offers. Settlement amounts across all participants are displayed as <span className="font-mono font-bold text-amber-900">—</span>. Submit participant bids via Google Form or click <strong>Refresh</strong>.
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
                  Awaiting Computation
                </span>
              </div>
              <h3 className="text-sm sm:text-base font-bold text-slate-900 mt-0.5">
                {totalBuyers} Buyer Bids &amp; {totalSellers} Seller Offers Loaded
              </h3>
              <p className="text-xs text-slate-600 mt-0.5">
                Financial drawl payables and generation receivables will be generated when you run the market clearing engine.
              </p>
            </div>
          </div>
          {onRunCompute && (
            <button
              onClick={onRunCompute}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-sm transition-all active:scale-95 cursor-pointer shrink-0"
            >
              <Cpu className="w-4 h-4 text-amber-300" />
              <span>Execute Market Clearing Engine</span>
            </button>
          )}
        </div>
      ) : null}

      {/* Financial KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-5 shadow-xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
            Buyer Payable (Total Drawl)
          </span>
          <div className="text-xl sm:text-2xl font-extrabold font-mono text-blue-700 tracking-tight">
            {isCalculated ? `NRs ${buyerTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}` : '—'}
          </div>
          <p className="text-xs text-slate-500 mt-1">
            {isCalculated ? 'Total revenue collected from buyers' : 'Awaiting computation'}
          </p>
        </div>

        <div className="bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-5 shadow-xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
            Seller Receivable (Total Dispatch)
          </span>
          <div className="text-xl sm:text-2xl font-extrabold font-mono text-rose-700 tracking-tight">
            {isCalculated ? `NRs ${sellerTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}` : '—'}
          </div>
          <p className="text-xs text-slate-500 mt-1">
            {isCalculated ? 'Total remuneration to generators' : 'Awaiting computation'}
          </p>
        </div>

        <div className="bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-5 shadow-xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
            Market Cleared Balance
          </span>
          <div className="text-xl sm:text-2xl font-extrabold font-mono text-emerald-700 tracking-tight">
            {isCalculated
              ? `NRs ${((buyerTotal + sellerTotal) / 2).toLocaleString('en-US', { minimumFractionDigits: 2 })}`
              : '—'}
          </div>
          <p className="text-xs text-slate-500 mt-1">
            {isCalculated ? 'Net financial clearing volume' : 'Awaiting computation'}
          </p>
        </div>
      </div>

      {/* Main Table Card */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-4">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Full Financial Settlement Register
            </h2>
            <p className="text-xs text-slate-500">
              Itemized nodal payments and receivables per participant and time slot
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
            {/* Search Input */}
            <div className="relative flex-1 md:w-56">
              <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search participant or slot..."
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-indigo-600 focus:bg-white transition-colors"
              />
            </div>

            {/* Filter Buttons */}
            <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg text-xs font-semibold">
              <button
                onClick={() => setRoleFilter('all')}
                className={`px-2.5 py-1 rounded-md transition-colors ${
                  roleFilter === 'all' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600'
                }`}
              >
                All
              </button>
              <button
                onClick={() => setRoleFilter('Buyer')}
                className={`px-2.5 py-1 rounded-md transition-colors ${
                  roleFilter === 'Buyer' ? 'bg-white text-blue-700 shadow-2xs' : 'text-slate-600'
                }`}
              >
                Buyers
              </button>
              <button
                onClick={() => setRoleFilter('Seller')}
                className={`px-2.5 py-1 rounded-md transition-colors ${
                  roleFilter === 'Seller' ? 'bg-white text-rose-700 shadow-2xs' : 'text-slate-600'
                }`}
              >
                Sellers
              </button>
            </div>

            {/* PDF Report Export Button */}
            <button
              onClick={() =>
                generateMarketReportPDF({
                  results,
                  settlements: settlementRecords,
                  participantSummaries,
                  nSlots,
                  sessionLabel,
                  totalBuyers,
                  totalSellers,
                })
              }
              disabled={!isCalculated}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg bg-rose-600 hover:bg-rose-700 text-white transition-all shadow-xs cursor-pointer active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
              title="Download official settlement and dispatch report as PDF in 1 click"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Download PDF</span>
            </button>

            {/* Export CSV Button */}
            <button
              onClick={exportSettlementCSV}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 transition-colors shadow-2xs shrink-0"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto border border-slate-100 rounded-xl">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-[#1A237E] text-white font-semibold">
                <th className="p-3 text-center">Slot</th>
                <th className="p-3 text-center">Role</th>
                <th className="p-3">Participant</th>
                <th className="p-3 text-right">MCP (NRs/kWh)</th>
                <th className="p-3 text-right">Awarded (MW)</th>
                <th className="p-3 text-right">Energy (MWh)</th>
                <th className="p-3 text-right">Settlement Amount (NRs)</th>
                <th className="p-3 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-500">
                    {!hasParticipants
                      ? 'No valid bids or offers found in sheet. All settlement balances are currently —.'
                      : !hasComputed
                      ? 'Computation Pending: Bids and offers are loaded. Run the clearing engine in the Compute tab to generate settlement statements.'
                      : 'No settlement records match your search or filter.'}
                  </td>
                </tr>
              ) : (
                filteredRecords.map((r, i) => (
                  <tr
                    key={i}
                    className={`transition-colors hover:bg-slate-50 ${
                      r.role === 'Buyer' ? 'bg-blue-50/20' : 'bg-rose-50/20'
                    }`}
                  >
                    <td className="p-3 text-center font-bold font-mono text-indigo-950">
                      {r.slot}
                    </td>
                    <td className="p-3 text-center">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          r.role === 'Buyer'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        {r.role}
                      </span>
                    </td>
                    <td className="p-3 font-semibold text-slate-800">
                      <div>{r.participant}</div>
                      {r.email && (
                        <div className="text-[10px] font-normal text-slate-400 font-mono">
                          {r.email}
                        </div>
                      )}
                    </td>
                    <td className="p-3 text-right font-mono font-medium text-slate-700">
                      {r.mcp.toFixed(3)}
                    </td>
                    <td className="p-3 text-right font-mono font-bold text-slate-900">
                      {r.qty_accepted_mw.toFixed(3)}
                    </td>
                    <td className="p-3 text-right font-mono text-cyan-800">
                      {r.energy_mwh.toFixed(4)}
                    </td>
                    <td className="p-3 text-right font-mono font-extrabold text-emerald-700">
                      NRs {r.amount_nrs.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="p-3 text-center">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          r.status === 'Full'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {r.status === 'Full' ? (
                          <CheckCircle className="w-3 h-3" />
                        ) : (
                          <AlertTriangle className="w-3 h-3" />
                        )}
                        <span>{r.status}</span>
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
  );
};
