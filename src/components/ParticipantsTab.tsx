import React, { useState } from 'react';
import { RawBidOfferRecord, ParticipantSummaryItem } from '../types';
import {
  Search,
  Download,
  Mail,
  Users,
  Flame,
  AlertCircle,
  Clock,
  Cpu,
  Lock,
  ShieldCheck,
  CheckCircle2,
  EyeOff,
  Layers,
} from 'lucide-react';

interface ParticipantsTabProps {
  buyers: RawBidOfferRecord[];
  sellers: RawBidOfferRecord[];
  participantSummaries: ParticipantSummaryItem[];
  nSlots: number;
  hasComputed?: boolean;
  onPreviewEmail: (participant: ParticipantSummaryItem) => void;
  onRunCompute?: () => void;
}

export const ParticipantsTab: React.FC<ParticipantsTabProps> = ({
  buyers,
  sellers,
  participantSummaries,
  nSlots,
  hasComputed = false,
  onPreviewEmail,
  onRunCompute,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | 'buyer' | 'seller'>('all');

  const hasParticipants = buyers.length > 0 || sellers.length > 0;
  const isCalculated = hasComputed && participantSummaries.length > 0;

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
      {/* 1. Empty State: No participants found in sheet */}
      {!hasParticipants && (
        <div className="bg-amber-50 border border-amber-200/90 rounded-2xl p-5 flex items-start gap-3.5 shadow-xs">
          <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <h3 className="text-sm font-bold text-amber-950">
              No Valid Bids or Offers Found in Sheet
            </h3>
            <p className="text-xs text-amber-800 mt-1 leading-relaxed">
              The connected Google Sheet currently contains no valid participant bids or offers. Participant directories, heatmaps, and dispatch schedules are empty (displayed as <span className="font-mono font-bold text-amber-900">—</span>). Submit bids via Google Form or click <strong>Refresh</strong>.
            </p>
          </div>
        </div>
      )}

      {/* 2. Closed Auction Intake State: Bids & offers are coming, but identities & rates remain sealed */}
      {hasParticipants && !hasComputed && (
        <div className="space-y-5">
          {/* Header Banner */}
          <div className="bg-gradient-to-r from-[#0D1B4B] via-[#1A237E] to-[#1565C0] text-white rounded-2xl p-5 sm:p-6 shadow-md border border-indigo-900/50 flex flex-col md:flex-row items-start md:items-center justify-between gap-5">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-amber-400 text-slate-950 flex items-center justify-center shrink-0 shadow-md font-bold">
                <Lock className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-300 border border-amber-400/30">
                    Closed Auction Protocol
                  </span>
                  <span className="text-xs text-indigo-200 font-mono">
                    Sealed Intake Buffer Active
                  </span>
                </div>
                <h3 className="text-base sm:text-lg font-extrabold leading-snug">
                  Bids &amp; Offers Intake Window Active ({buyers.length} Bids, {sellers.length} Offers)
                </h3>
                <p className="text-xs text-indigo-100/90 mt-1 max-w-2xl leading-relaxed">
                  Per closed auction standards, individual participant names and bid prices are sealed until the clearing engine is executed. Live counts of incoming bids and offers are synchronized automatically.
                </p>
              </div>
            </div>

            {onRunCompute && (
              <button
                onClick={onRunCompute}
                className="w-full md:w-auto px-5 py-3 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-extrabold text-xs shadow-lg shadow-amber-500/20 transition-all active:scale-95 cursor-pointer flex items-center justify-center gap-2 shrink-0"
              >
                <Cpu className="w-4 h-4" />
                <span>Execute Clearing Engine</span>
              </button>
            )}
          </div>

          {/* Aggregate Intake Statistics Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Demand Submissions
                </span>
                <span className="w-2.5 h-2.5 rounded-full bg-blue-600"></span>
              </div>
              <div className="text-3xl font-extrabold font-mono text-blue-900">
                {buyers.length}
              </div>
              <p className="text-xs text-slate-600 mt-1">
                Buyer bids submitted across {nSlots} trading slots
              </p>
            </div>

            <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Generation Offers
                </span>
                <span className="w-2.5 h-2.5 rounded-full bg-rose-600"></span>
              </div>
              <div className="text-3xl font-extrabold font-mono text-rose-900">
                {sellers.length}
              </div>
              <p className="text-xs text-slate-600 mt-1">
                Seller generation offers submitted
              </p>
            </div>

            <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Auction Status
                </span>
                <EyeOff className="w-4 h-4 text-amber-600" />
              </div>
              <div className="text-lg font-extrabold font-mono text-amber-700">
                Sealed Confidential
              </div>
              <p className="text-xs text-slate-600 mt-1">
                Individual rates unmasked upon market clearing
              </p>
            </div>
          </div>

          {/* Confidentiality Notice Box */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-8 text-center shadow-xs">
            <div className="w-14 h-14 rounded-2xl bg-slate-100 text-slate-700 flex items-center justify-center mx-auto mb-3">
              <EyeOff className="w-7 h-7 text-indigo-700" />
            </div>
            <h4 className="text-base font-bold text-slate-900 mb-1">
              Confidential Closed Auction Vault
            </h4>
            <p className="text-xs text-slate-500 max-w-lg mx-auto leading-relaxed mb-5">
              To prevent market collusion and gaming, individual participant names, generation assets, and price bids are held sealed in the intake vault. Once bids and offers close and computation is initiated, all dispatch schedules, market clearing prices, and settlement registers will be displayed.
            </p>
            {onRunCompute && (
              <button
                onClick={onRunCompute}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-900 hover:bg-indigo-800 text-white font-bold text-xs shadow-sm transition-all active:scale-95 cursor-pointer"
              >
                <Cpu className="w-4 h-4 text-amber-400" />
                <span>Run Market Clearing to Reveal Results</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* 3. Post-Computation State: Full Results Displayed */}
      {hasParticipants && hasComputed && (
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
                  className={`px-3 py-1 rounded-md transition-colors cursor-pointer ${
                    roleFilter === 'all' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600'
                  }`}
                >
                  All ({participantSummaries.length})
                </button>
                <button
                  onClick={() => setRoleFilter('buyer')}
                  className={`px-3 py-1 rounded-md transition-colors cursor-pointer ${
                    roleFilter === 'buyer' ? 'bg-white text-blue-700 shadow-2xs' : 'text-slate-600'
                  }`}
                >
                  Buyers ({uniqueBuyerNames.length})
                </button>
                <button
                  onClick={() => setRoleFilter('seller')}
                  className={`px-3 py-1 rounded-md transition-colors cursor-pointer ${
                    roleFilter === 'seller' ? 'bg-white text-rose-700 shadow-2xs' : 'text-slate-600'
                  }`}
                >
                  Sellers ({uniqueSellerNames.length})
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => exportCSV('buyer')}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-blue-50 text-blue-800 hover:bg-blue-100 rounded-lg border border-blue-200 transition-colors cursor-pointer"
                  title="Export raw buyer bids to CSV"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Buyer Bids CSV</span>
                </button>

                <button
                  onClick={() => exportCSV('seller')}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-rose-50 text-rose-800 hover:bg-rose-100 rounded-lg border border-rose-200 transition-colors cursor-pointer"
                  title="Export raw seller offers to CSV"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Seller Offers CSV</span>
                </button>
              </div>
            </div>
          </div>

          {/* Participant Summaries Table */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-indigo-50 text-indigo-700 rounded-xl">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Market Participant Register &amp; Dispatch Allocation
                  </h3>
                  <p className="text-xs text-slate-500">
                    Computed merit-order allocation, acceptance rate, and settlement summary
                  </p>
                </div>
              </div>
              <span className="text-xs text-slate-500 font-mono">
                {filteredSummaries.length} of {participantSummaries.length} entities
              </span>
            </div>

            <div className="overflow-x-auto border border-slate-100 rounded-xl">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                    <th className="p-3">Participant</th>
                    <th className="p-3">Role</th>
                    <th className="p-3 text-right">Requested (MW)</th>
                    <th className="p-3 text-right">Awarded (MW)</th>
                    <th className="p-3 text-right">Energy (MWh)</th>
                    <th className="p-3 text-right">Acceptance Rate</th>
                    <th className="p-3 text-right">Net Settlement</th>
                    <th className="p-3 text-center">Notification</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredSummaries.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-slate-400">
                        No participants match the selected filter.
                      </td>
                    </tr>
                  ) : (
                    filteredSummaries.map((p, idx) => (
                      <tr key={idx} className="hover:bg-slate-50 transition-colors">
                        <td className="p-3">
                          <div className="font-bold text-slate-900">{p.name}</div>
                          <div className="text-[11px] font-mono text-slate-500">{p.email}</div>
                        </td>
                        <td className="p-3">
                          <span
                            className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                              p.role === 'buyer'
                                ? 'bg-blue-100 text-blue-800'
                                : 'bg-rose-100 text-rose-800'
                            }`}
                          >
                            {p.role.toUpperCase()}
                          </span>
                        </td>
                        <td className="p-3 text-right font-mono font-medium text-slate-700">
                          {p.total_bid_offer_mw.toFixed(2)}
                        </td>
                        <td className="p-3 text-right font-mono font-bold text-slate-900">
                          {p.actual_dispatch_drawl_mw.toFixed(2)}
                        </td>
                        <td className="p-3 text-right font-mono text-slate-600">
                          {(p.actual_dispatch_drawl_mw * 0.25).toFixed(3)}
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
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-indigo-700 hover:text-indigo-900 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors cursor-pointer"
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
      )}
    </div>
  );
};
