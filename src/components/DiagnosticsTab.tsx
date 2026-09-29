import React from 'react';
import { DiagnosticsData } from '../types';
import { MAX_VALID_PRICE, MAX_VALID_QTY } from '../engine/clearingEngine';
import { ShieldCheck, AlertTriangle, CheckCircle2, FileSearch } from 'lucide-react';

interface DiagnosticsTabProps {
  diagnostics: DiagnosticsData;
  nSlots: number;
}

export const DiagnosticsTab: React.FC<DiagnosticsTabProps> = ({ diagnostics, nSlots }) => {
  const auditChecks = [
    {
      check: 'Total rows processed in source sheet',
      value: diagnostics.rows_seen,
      status: 'info',
    },
    {
      check: 'Rows skipped (no Buyer/Seller role detected)',
      value: diagnostics.rows_skipped_no_role,
      status: diagnostics.rows_skipped_no_role > 0 ? 'warning' : 'ok',
    },
    {
      check: 'Bid/Offer values dropped (non-numeric / blank)',
      value: diagnostics.values_dropped_nan,
      status: diagnostics.values_dropped_nan > 0 ? 'warning' : 'ok',
    },
    {
      check: 'Bid/Offer values dropped (non-positive ≤ 0)',
      value: diagnostics.values_dropped_nonpos,
      status: diagnostics.values_dropped_nonpos > 0 ? 'warning' : 'ok',
    },
    {
      check: `Outlier values dropped (> ${MAX_VALID_PRICE} NRs/kWh or > ${MAX_VALID_QTY} MW)`,
      value: diagnostics.values_dropped_outlier,
      status: diagnostics.values_dropped_outlier > 0 ? 'danger' : 'ok',
    },
    {
      check: 'Valid bid/offer records admitted into engine',
      value: diagnostics.records_kept,
      status: 'ok',
    },
    {
      check: 'Timestamp column detected (for deterministic FCFS tie-break)',
      value: diagnostics.timestamp_col_found ? 'Yes (ISO Timestamp)' : 'No (Form Row Order Fallback)',
      status: diagnostics.timestamp_col_found ? 'ok' : 'info',
    },
    {
      check: 'Unique buyer participants',
      value: diagnostics.unique_buyers,
      status: 'info',
    },
    {
      check: 'Unique seller participants',
      value: diagnostics.unique_sellers,
      status: 'info',
    },
    {
      check: 'Buyers missing a valid email address',
      value: diagnostics.missing_email_buyers,
      status: diagnostics.missing_email_buyers > 0 ? 'warning' : 'ok',
    },
    {
      check: 'Sellers missing a valid email address',
      value: diagnostics.missing_email_sellers,
      status: diagnostics.missing_email_sellers > 0 ? 'warning' : 'ok',
    },
    {
      check: `Participants with incomplete slot coverage (< ${nSlots} slots)`,
      value: diagnostics.incomplete_buyers + diagnostics.incomplete_sellers,
      status: diagnostics.incomplete_buyers + diagnostics.incomplete_sellers > 0 ? 'warning' : 'ok',
    },
    {
      check: 'Duplicate (participant, slot) submissions detected',
      value: diagnostics.duplicate_buyer_rows + diagnostics.duplicate_seller_rows,
      status: diagnostics.duplicate_buyer_rows + diagnostics.duplicate_seller_rows > 0 ? 'warning' : 'ok',
    },
  ];

  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs">
        <div className="flex items-center gap-2 mb-2">
          <div className="p-2 rounded-xl bg-indigo-50 text-indigo-700">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Data Extraction &amp; Quality Diagnostics
            </h2>
            <p className="text-xs text-slate-500">
              Audit logs from data cleaning, parsing guardrails, and validation filters
            </p>
          </div>
        </div>

        <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-600 mb-5">
          <p className="font-semibold text-slate-800 mb-1">🛡️ Integrity Guardrails:</p>
          <p>
            Values exceeding {MAX_VALID_PRICE} NRs/kWh or {MAX_VALID_QTY} MW are rejected during parsing so rogue entries cannot distort market clearing. When identical prices occur, deterministic First-Come First-Served (FCFS) tie-breaking orders entries by submission timestamp or original sheet row index.
          </p>
        </div>

        <div className="overflow-x-auto border border-slate-100 rounded-xl">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-[#1A237E] text-white font-semibold">
                <th className="p-3">Integrity &amp; Parsing Verification Check</th>
                <th className="p-3 text-center">Audited Value</th>
                <th className="p-3 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {auditChecks.map((row, idx) => (
                <tr key={idx} className="hover:bg-slate-50 transition-colors">
                  <td className="p-3 font-medium text-slate-800">{row.check}</td>
                  <td className="p-3 text-center font-mono font-bold text-slate-900">
                    {String(row.value)}
                  </td>
                  <td className="p-3 text-center">
                    {row.status === 'ok' ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>Pass</span>
                      </span>
                    ) : row.status === 'warning' ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                        <AlertTriangle className="w-3 h-3" />
                        <span>Check</span>
                      </span>
                    ) : row.status === 'danger' ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                        <AlertTriangle className="w-3 h-3" />
                        <span>Dropped</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700">
                        <span>Info</span>
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
