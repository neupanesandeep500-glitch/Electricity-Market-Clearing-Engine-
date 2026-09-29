import React, { useState } from 'react';
import { SettlementRecord } from '../types';
import { DollarSign, Download, Search, CheckCircle, AlertTriangle } from 'lucide-react';

interface SettlementTabProps {
  settlementRecords: SettlementRecord[];
}

export const SettlementTab: React.FC<SettlementTabProps> = ({ settlementRecords }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | 'Buyer' | 'Seller'>('all');

  const buyerTotal = settlementRecords
    .filter((r) => r.role === 'Buyer')
    .reduce((sum, r) => sum + r.amount_nrs, 0);

  const sellerTotal = settlementRecords
    .filter((r) => r.role === 'Seller')
    .reduce((sum, r) => sum + r.amount_nrs, 0);

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
      {/* Financial KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-5 shadow-xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
            Buyer Payable (Total Drawl)
          </span>
          <div className="text-xl sm:text-2xl font-extrabold font-mono text-blue-700 tracking-tight">
            NRs {buyerTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </div>
          <p className="text-xs text-slate-500 mt-1">Total revenue collected from buyers</p>
        </div>

        <div className="bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-5 shadow-xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
            Seller Receivable (Total Dispatch)
          </span>
          <div className="text-xl sm:text-2xl font-extrabold font-mono text-rose-700 tracking-tight">
            NRs {sellerTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </div>
          <p className="text-xs text-slate-500 mt-1">Total remuneration to generators</p>
        </div>

        <div className="bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-5 shadow-xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
            Market Cleared Balance
          </span>
          <div className="text-xl sm:text-2xl font-extrabold font-mono text-emerald-700 tracking-tight">
            NRs {((buyerTotal + sellerTotal) / 2).toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </div>
          <p className="text-xs text-slate-500 mt-1">Net financial clearing volume</p>
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

            {/* Export Button */}
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
                  <td colSpan={8} className="p-6 text-center text-slate-400">
                    No settlement records found.
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
