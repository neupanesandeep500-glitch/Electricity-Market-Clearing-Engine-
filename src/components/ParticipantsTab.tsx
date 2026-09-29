import React, { useState } from 'react';
import { RawBidOfferRecord, ParticipantSummaryItem, SlotClearingResult } from '../types';
import { Search, Download, Mail, Users, Flame } from 'lucide-react';

interface ParticipantsTabProps {
  buyers: RawBidOfferRecord[];
  sellers: RawBidOfferRecord[];
  participantSummaries: ParticipantSummaryItem[];
  nSlots: number;
  onPreviewEmail: (participant: ParticipantSummaryItem) => void;
}

export const ParticipantsTab: React.FC<ParticipantsTabProps> = ({
  buyers,
  sellers,
  participantSummaries,
  nSlots,
  onPreviewEmail,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | 'buyer' | 'seller'>('all');

  const filteredSummaries = participantSummaries.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = roleFilter === 'all' || p.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  // Calculate price matrix for Heatmap
  const slotNums = Array.from({ length: nSlots }, (_, i) => i + 1);

  const getSlotPrice = (name: string, slot: number, side: 'buyer' | 'seller') => {
    const list = side === 'buyer' ? buyers : sellers;
    const match = list.find((item) => item.name === name && item.slot === slot);
    return match ? match.price : null;
  };

  const uniqueBuyerNames = Array.from(new Set(buyers.map((b) => b.name)));
  const uniqueSellerNames = Array.from(new Set(sellers.map((s) => s.name)));

  const exportCSV = (side: 'buyer' | 'seller') => {
    const data = side === 'buyer' ? buyers : sellers;
    const headers = ['Name', 'Email', 'Role', 'Slot', 'Price (NRs/kWh)', 'Quantity (MW)'];
    const rows = data.map((d) => [
      `"${d.name}"`,
      `"${d.email}"`,
      d.role,
      `T${d.slot}`,
      d.price.toFixed(3),
      d.quantity.toFixed(3),
    ]);
    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${side}s_data_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
  };

  return (
    <div className="space-y-6">
      {/* Search & Actions Bar */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-5 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search participant name or email..."
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-indigo-600 focus:bg-white transition-colors"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg text-xs font-semibold">
            <button
              onClick={() => setRoleFilter('all')}
              className={`px-3 py-1 rounded-md transition-colors ${
                roleFilter === 'all' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600'
              }`}
            >
              All ({participantSummaries.length})
            </button>
            <button
              onClick={() => setRoleFilter('buyer')}
              className={`px-3 py-1 rounded-md transition-colors ${
                roleFilter === 'buyer' ? 'bg-white text-blue-700 shadow-2xs' : 'text-slate-600'
              }`}
            >
              Buyers ({uniqueBuyerNames.length})
            </button>
            <button
              onClick={() => setRoleFilter('seller')}
              className={`px-3 py-1 rounded-md transition-colors ${
                roleFilter === 'seller' ? 'bg-white text-rose-700 shadow-2xs' : 'text-slate-600'
              }`}
            >
              Sellers ({uniqueSellerNames.length})
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => exportCSV('buyer')}
              className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-blue-700 transition-colors shadow-2xs"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Buyers CSV</span>
            </button>
            <button
              onClick={() => exportCSV('seller')}
              className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-rose-700 transition-colors shadow-2xs"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Sellers CSV</span>
            </button>
          </div>
        </div>
      </div>

      {/* Participant Roster & Dispatch Performance */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs">
        <h2 className="text-base font-bold text-slate-900 mb-1">
          Participant Capacity &amp; Dispatch Performance
        </h2>
        <p className="text-xs text-slate-500 mb-4">
          Comparative audit of submitted power bids/offers vs cleared allocation and financial receivables
        </p>

        <div className="overflow-x-auto border border-slate-100 rounded-xl">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-[#1A237E] text-white font-semibold">
                <th className="p-3">Participant Name</th>
                <th className="p-3 text-center">Role</th>
                <th className="p-3 text-right">Submitted (MW)</th>
                <th className="p-3 text-right">Cleared (MW)</th>
                <th className="p-3 text-right">Acceptance Rate</th>
                <th className="p-3 text-right">Total Settlement (NRs)</th>
                <th className="p-3 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredSummaries.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-6 text-center text-slate-400">
                    No participants matched your search.
                  </td>
                </tr>
              ) : (
                filteredSummaries.map((p, idx) => (
                  <tr
                    key={idx}
                    className={`transition-colors hover:bg-slate-50 ${
                      p.role === 'buyer' ? 'bg-blue-50/15' : 'bg-rose-50/15'
                    }`}
                  >
                    <td className="p-3 font-semibold text-slate-800">
                      <div>{p.name}</div>
                      <div className="text-[10px] font-mono text-slate-400 font-normal">
                        {p.email && p.email.includes('@') ? (
                          <span className="text-emerald-700 font-sans font-medium flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Verified Contact
                          </span>
                        ) : (
                          <span className="text-slate-400">Offline participant</span>
                        )}
                      </div>
                    </td>
                    <td className="p-3 text-center">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          p.role === 'buyer'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        {p.role === 'buyer' ? 'Buyer (Drawl)' : 'Seller (Gen)'}
                      </span>
                    </td>
                    <td className="p-3 text-right font-mono text-slate-700">
                      {p.total_bid_offer_mw.toFixed(1)} MW
                    </td>
                    <td className="p-3 text-right font-mono font-bold text-slate-900">
                      {p.actual_dispatch_drawl_mw.toFixed(1)} MW
                    </td>
                    <td className="p-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <div className="w-16 h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              p.acceptance_rate_pct > 75
                                ? 'bg-emerald-500'
                                : p.acceptance_rate_pct > 25
                                ? 'bg-amber-500'
                                : 'bg-rose-500'
                            }`}
                            style={{ width: `${p.acceptance_rate_pct}%` }}
                          />
                        </div>
                        <span className="font-mono font-bold text-slate-700 text-[11px]">
                          {p.acceptance_rate_pct}%
                        </span>
                      </div>
                    </td>
                    <td className="p-3 text-right font-mono font-extrabold text-emerald-700">
                      NRs {p.total_settlement_nrs.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="p-3 text-center">
                      <button
                        onClick={() => onPreviewEmail(p)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-indigo-700 hover:text-indigo-900 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors"
                      >
                        <Mail className="w-3.5 h-3.5" />
                        <span>Preview Email</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Heatmap Matrices */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Buyer Bid Price Heatmap */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs">
          <div className="flex items-center gap-2 mb-3">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-600"></span>
            <h3 className="text-sm font-bold text-slate-900">
              Buyer Bid Price Heatmap (NRs/kWh)
            </h3>
          </div>
          <div className="overflow-x-auto border border-slate-100 rounded-xl">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-blue-900 text-white">
                  <th className="p-2.5 text-left">Buyer</th>
                  {slotNums.map((s) => (
                    <th key={s} className="p-2.5 text-center">T{s}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {uniqueBuyerNames.map((name, i) => (
                  <tr key={i}>
                    <td className="p-2.5 font-medium text-slate-800 text-left">{name}</td>
                    {slotNums.map((s) => {
                      const p = getSlotPrice(name, s, 'buyer');
                      return (
                        <td
                          key={s}
                          className="p-2 text-center font-mono font-bold"
                          style={{
                            backgroundColor: p ? `rgba(21, 101, 192, ${Math.min(0.8, (p / 14) * 0.9)})` : 'transparent',
                            color: p && p > 7.5 ? '#FFFFFF' : '#1E293B',
                          }}
                        >
                          {p !== null ? p.toFixed(2) : '—'}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Seller Offer Price Heatmap */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs">
          <div className="flex items-center gap-2 mb-3">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-600"></span>
            <h3 className="text-sm font-bold text-slate-900">
              Seller Offer Price Heatmap (NRs/kWh)
            </h3>
          </div>
          <div className="overflow-x-auto border border-slate-100 rounded-xl">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-rose-900 text-white">
                  <th className="p-2.5 text-left">Seller</th>
                  {slotNums.map((s) => (
                    <th key={s} className="p-2.5 text-center">T{s}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {uniqueSellerNames.map((name, i) => (
                  <tr key={i}>
                    <td className="p-2.5 font-medium text-slate-800 text-left">{name}</td>
                    {slotNums.map((s) => {
                      const p = getSlotPrice(name, s, 'seller');
                      return (
                        <td
                          key={s}
                          className="p-2 text-center font-mono font-bold"
                          style={{
                            backgroundColor: p ? `rgba(198, 40, 40, ${Math.min(0.8, (p / 10) * 0.9)})` : 'transparent',
                            color: p && p > 6.0 ? '#FFFFFF' : '#1E293B',
                          }}
                        >
                          {p !== null ? p.toFixed(2) : '—'}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
