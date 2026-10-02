/**
 * Email Notification Engine & Template Builder
 * Generates transactional confirmation emails for participants after market clearing.
 */

import { settlementCents, mwToMwh } from '../engine/clearingEngine';
import {
  RawBidOfferRecord,
  SlotClearingResult,
  ParticipantSlotEmailData,
  EmailLogEntry,
} from '../types';

/** Escape text before placing it in HTML (participant names come from a public Google Form). */
export function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Market time is Nepal time, whatever the browser's locale is. */
export function formatNptTime(d = new Date()): string {
  return d.toLocaleString('en-GB', { timeZone: 'Asia/Kathmandu', dateStyle: 'medium', timeStyle: 'short' }) + ' NPT';
}

export function formatClearingMode(modeStr?: string): string {
  if (!modeStr) return 'Normal Intersection';
  if (modeStr.includes('Generator Cap') || modeStr.includes('Demand-Exceeds')) {
    return 'Generator Cap';
  }
  return 'Normal Intersection';
}

/**
 * Collect per-slot data for a single participant
 */
export function collectParticipantSlotData(
  participantName: string,
  participantRole: 'buyer' | 'seller',
  buyers: RawBidOfferRecord[],
  sellers: RawBidOfferRecord[],
  results: Record<number, SlotClearingResult>,
  nSlots: number
): ParticipantSlotEmailData[] {
  const source = participantRole === 'buyer' ? buyers : sellers;
  const myRows = source.filter((r) => r.name === participantName);

  const slotData: ParticipantSlotEmailData[] = [];

  for (let s = 1; s <= nSlots; s++) {
    const r = results[s];
    const mySlot = myRows.find((r) => r.slot === s);

    const submittedPrice = mySlot ? mySlot.price : 0;
    const submittedQty = mySlot ? mySlot.quantity : 0;

    if (!r || r.status !== 'Cleared') {
      slotData.push({
        slot: s,
        status: 'No Trade',
        mcp: 0,
        mcv_mw: 0,
        mcv_mwh: 0,
        market_value: 0,
        clearing_mode: '—',
        submitted_qty: submittedQty,
        submitted_price: submittedPrice,
        awarded_qty: 0,
        acceptance_status: 'No Trade',
        amount_nrs: 0,
      });
      continue;
    }

    const accList = participantRole === 'buyer' ? r.accepted_buyers : r.accepted_sellers;
    const myAcc = accList.find((a) => a.name === participantName);

    const awardedQty = myAcc ? myAcc.qty_accepted : 0;
    const acceptanceStatus = myAcc ? myAcc.acceptance_status : 'Rejected';
    // Use the exact paisa-allocated amount from the engine so the email always matches the settlement register.
    const amountNrs = myAcc?.amount_nrs ?? settlementCents(r.mcp, awardedQty) / 100;

    slotData.push({
      slot: s,
      status: 'Cleared',
      mcp: r.mcp,
      mcv_mw: r.mcv_mw,
      mcv_mwh: r.mcv_mwh,
      market_value: r.market_value,
      clearing_mode: r.clearing_mode,
      submitted_qty: submittedQty,
      submitted_price: submittedPrice,
      awarded_qty: awardedQty,
      acceptance_status: acceptanceStatus,
      amount_nrs: amountNrs,
    });
  }

  return slotData;
}

/**
 * Build rich HTML email body matching the Python script template
 */
export function buildParticipantEmail(
  participantName: string,
  participantRole: 'buyer' | 'seller',
  allSlotsData: ParticipantSlotEmailData[],
  sessionLabel: string,
  clearedCount: number,
  totalSlots: number
): { subject: string; html: string; text: string } {
  const roleDisplay = participantRole === 'buyer' ? 'Buyer' : 'Seller';
  const actionWord = participantRole === 'buyer' ? 'Drawl' : 'Dispatch';
  const verbPast = participantRole === 'buyer' ? 'Drawn' : 'Dispatched';
  const colorAccent = participantRole === 'buyer' ? '#1565C0' : '#C62828';
  const colorLight = participantRole === 'buyer' ? '#EBF3FB' : '#FFEBEE';
  const colorBorder = participantRole === 'buyer' ? '#BBDEFB' : '#FFCDD2';
  const roleIcon = participantRole === 'buyer' ? '🔋 BUYER (Drawl)' : '🏭 SELLER (Dispatch)';
  const nowStr = formatNptTime();
  const safeName = escapeHtml(participantName);
  const safeSession = escapeHtml(sessionLabel);

  const subject = `[Market Result] ${sessionLabel} | ${roleDisplay}: ${participantName} | ${clearedCount}/${totalSlots} Slots Cleared`;

  // Slot rows
  let slotRowsHtml = '';
  for (const sd of allSlotsData) {
    const slotLabel = `T${sd.slot}`;
    let rowBg = '#FFFFFF';
    let badge = '';
    let mcpStr = '—';
    let awdQty = '—';
    let awdAmt = '—';
    let modeStr = '—';

    if (sd.status === 'No Trade') {
      rowBg = '#FFF5F5';
      badge = `<span style="color:#B71C1C;font-weight:700;background:#FFEBEE;padding:2px 8px;border-radius:12px;font-size:11px;">❌ No Trade</span>`;
    } else {
      mcpStr = `NRs ${sd.mcp.toFixed(3)}/kWh`;
      modeStr = formatClearingMode(sd.clearing_mode);
      awdQty = `${sd.awarded_qty.toFixed(3)} MW`;
      awdAmt = `NRs ${sd.amount_nrs.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;

      if (sd.acceptance_status === 'Full') {
        rowBg = '#F1F8F1';
        badge = `<span style="color:#1B5E20;font-weight:700;background:#E8F5E9;padding:2px 8px;border-radius:12px;font-size:11px;">✅ Full Acceptance</span>`;
      } else if (sd.acceptance_status === 'Partial') {
        rowBg = '#FFFDE7';
        badge = `<span style="color:#E65100;font-weight:700;background:#FFF8E1;padding:2px 8px;border-radius:12px;font-size:11px;">⚠ Partial</span>`;
      } else {
        rowBg = '#FFF5F5';
        badge = `<span style="color:#B71C1C;font-weight:700;background:#FFEBEE;padding:2px 8px;border-radius:12px;font-size:11px;">❌ Rejected</span>`;
        awdQty = '0.000 MW';
        awdAmt = 'NRs 0.00';
      }
    }

    slotRowsHtml += `
      <tr style="background:${rowBg};">
        <td style="padding:9px 13px;border:1px solid #E3E8F0;font-weight:700;color:#1A237E;text-align:center;">${slotLabel}</td>
        <td style="padding:9px 13px;border:1px solid #E3E8F0;text-align:right;">${sd.submitted_price.toFixed(3)}</td>
        <td style="padding:9px 13px;border:1px solid #E3E8F0;text-align:right;">${sd.submitted_qty.toFixed(3)}</td>
        <td style="padding:9px 13px;border:1px solid #E3E8F0;font-weight:600;text-align:center;">${mcpStr}</td>
        <td style="padding:9px 13px;border:1px solid #E3E8F0;font-weight:600;color:${colorAccent};text-align:right;">${awdQty}</td>
        <td style="padding:9px 13px;border:1px solid #E3E8F0;font-weight:700;color:#2E7D32;text-align:right;">${awdAmt}</td>
        <td style="padding:9px 13px;border:1px solid #E3E8F0;text-align:center;">${badge}</td>
        <td style="padding:9px 13px;border:1px solid #E3E8F0;color:#546E7A;font-size:11px;text-align:center;">${modeStr}</td>
      </tr>`;
  }

  const totalAwardedMw = allSlotsData.reduce((sum, sd) => sum + sd.awarded_qty, 0);
  const totalAwardedMwh = mwToMwh(totalAwardedMw);
  const totalAmount = Math.round(allSlotsData.reduce((sum, sd) => sum + Math.round(sd.amount_nrs * 100), 0)) / 100;
  const receivablePayable = participantRole === 'seller' ? 'Receivable' : 'Payable';

  // Instructions section
  const clearedSlots = allSlotsData.filter(
    (sd) => sd.status === 'Cleared' && (sd.acceptance_status === 'Full' || sd.acceptance_status === 'Partial')
  );

  let dispatchSection = '';
  if (clearedSlots.length > 0) {
    let instrRows = '';
    for (const sd of clearedSlots) {
      if (sd.awarded_qty > 0) {
        instrRows += `
          <tr>
            <td style="padding:8px 12px;border:1px solid #E3E8F0;font-weight:700;color:#1A237E;text-align:center;">T${sd.slot}</td>
            <td style="padding:8px 12px;border:1px solid #E3E8F0;text-align:center;">MCP = NRs ${sd.mcp.toFixed(3)}/kWh</td>
            <td style="padding:8px 12px;border:1px solid #E3E8F0;color:${colorAccent};font-weight:700;text-align:right;">
              ${actionWord}: ${sd.awarded_qty.toFixed(3)} MW (${mwToMwh(sd.awarded_qty).toFixed(4)} MWh)
            </td>
            <td style="padding:8px 12px;border:1px solid #E3E8F0;color:#2E7D32;font-weight:700;text-align:right;">
              NRs ${sd.amount_nrs.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </td>
          </tr>`;
      }
    }

    dispatchSection = `
      <div style="margin-top:24px;">
        <h3 style="color:#1A237E;font-size:14px;border-bottom:2px solid #E3E8F0;padding-bottom:8px;margin-bottom:12px;">
          ⚡ ${actionWord} & Settlement Schedule
        </h3>
        <table style="width:100%;border-collapse:collapse;font-size:12px;">
          <thead>
            <tr style="background:#1A237E;color:#FFFFFF;">
              <th style="padding:8px;border:1px solid rgba(255,255,255,0.2);">Slot</th>
              <th style="padding:8px;border:1px solid rgba(255,255,255,0.2);">MCP</th>
              <th style="padding:8px;border:1px solid rgba(255,255,255,0.2);">${verbPast} Quantity</th>
              <th style="padding:8px;border:1px solid rgba(255,255,255,0.2);">Amount (${receivablePayable})</th>
            </tr>
          </thead>
          <tbody>${instrRows}</tbody>
        </table>
        <p style="color:#546E7A;font-size:11px;margin-top:10px;">
          All quantities are in MW for 15-minute slots (×0.25 = MWh). Settlement amounts = MCP × MWh × 1000 NRs/MWh.
        </p>
      </div>`;
  } else {
    dispatchSection = `
      <div style="margin-top:24px;padding:16px;background:#FFEBEE;border-radius:8px;border-left:4px solid #C62828;">
        <p style="color:#B71C1C;font-size:13px;margin:0;font-weight:600;">
          ❌ No slots were accepted in this session. No dispatch or drawl obligation applies.
        </p>
      </div>`;
  }

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;background:#EEF2F7;font-family:Arial,Helvetica,sans-serif;color:#1A1A2E;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${clearedCount} of ${totalSlots} slots cleared for ${safeName} - total ${receivablePayable.toLowerCase()} NRs ${totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
<table width="100%" cellpadding="0" cellspacing="0" style="background:#EEF2F7;padding:24px 0;">
  <tr>
    <td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:720px;background:#FFFFFF;border-radius:12px;box-shadow:0 4px 20px rgba(0,0,0,0.08);overflow:hidden;">
        <!-- Header -->
        <tr>
          <td bgcolor="#1A237E" style="background-color:#1A237E;background-image:linear-gradient(135deg,#1A237E 0%,#283593 60%,#1565C0 100%);padding:28px 36px 22px 36px;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td>
                  <span style="font-size:24px;font-weight:800;color:#FFFFFF;letter-spacing:0.5px;">⚡ Nepal Electricity Market</span><br>
                  <span style="font-size:13px;color:rgba(255,255,255,0.85);margin-top:4px;display:inline-block;">Market Clearing Result Notification</span>
                </td>
                <td align="right" valign="top">
                  <span style="display:inline-block;background:rgba(255,255,255,0.18);border:1px solid rgba(255,255,255,0.3);border-radius:16px;padding:4px 12px;font-size:11px;color:#FFFFFF;font-weight:600;">
                    Market Clearing System
                  </span><br>
                  <span style="font-size:11px;color:rgba(255,255,255,0.7);margin-top:6px;display:inline-block;">${nowStr}</span>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr><td style="background:${colorAccent};height:4px;"></td></tr>

        <!-- Greeting -->
        <tr>
          <td style="padding:28px 36px 0 36px;">
            <p style="font-size:15px;color:#1A1A2E;margin:0 0 6px 0;">
              Dear <strong style="color:${colorAccent};">${safeName}</strong>,
            </p>
            <p style="font-size:13px;color:#546E7A;margin:0 0 18px 0;line-height:1.6;">
              The market clearing for session <strong style="color:#1A1A2E;">${safeSession}</strong> has been finalized. Below are your cleared results, nodal settlement, and obligation details.
            </p>
            <div style="display:inline-block;padding:6px 16px;border-radius:20px;background:${colorLight};border:1px solid ${colorBorder};margin-bottom:20px;">
              <span style="color:${colorAccent};font-weight:700;font-size:12px;">${roleIcon}</span>
              &nbsp;&nbsp;
              <span style="color:#546E7A;font-size:12px;">${clearedCount} of ${totalSlots} slots cleared</span>
            </div>
          </td>
        </tr>

        <!-- Table -->
        <tr>
          <td style="padding:0 36px;">
            <h3 style="color:#1A237E;border-bottom:2px solid #E3E8F0;padding-bottom:8px;font-size:13px;margin-bottom:10px;">
              📊 Slot-wise Clearing Results & Allocations
            </h3>
            <div style="overflow-x:auto;border-radius:6px;border:1px solid #E3E8F0;">
              <table style="width:100%;border-collapse:collapse;font-size:12px;">
                <thead>
                  <tr style="background:#1A237E;color:#FFFFFF;">
                    <th style="padding:9px;border:1px solid rgba(255,255,255,0.2);">Slot</th>
                    <th style="padding:9px;border:1px solid rgba(255,255,255,0.2);">Rate<br>(NRs/kWh)</th>
                    <th style="padding:9px;border:1px solid rgba(255,255,255,0.2);">Submitted<br>(MW)</th>
                    <th style="padding:9px;border:1px solid rgba(255,255,255,0.2);">MCP<br>(NRs/kWh)</th>
                    <th style="padding:9px;border:1px solid rgba(255,255,255,0.2);">${verbPast}<br>(MW)</th>
                    <th style="padding:9px;border:1px solid rgba(255,255,255,0.2);">Amount<br>(${receivablePayable})</th>
                    <th style="padding:9px;border:1px solid rgba(255,255,255,0.2);">Status</th>
                    <th style="padding:9px;border:1px solid rgba(255,255,255,0.2);">Mode</th>
                  </tr>
                </thead>
                <tbody>${slotRowsHtml}</tbody>
              </table>
            </div>
          </td>
        </tr>

        <!-- Totals Box -->
        <tr>
          <td style="padding:20px 36px 0 36px;">
            <table width="100%" cellpadding="0" cellspacing="0" style="background:${colorLight};border-radius:8px;border:1px solid ${colorBorder};">
              <tr>
                <td style="padding:14px 18px;border-right:1px solid ${colorBorder};">
                  <span style="color:#546E7A;font-size:10px;text-transform:uppercase;font-weight:600;">Total ${verbPast} Quantity</span><br>
                  <span style="color:${colorAccent};font-size:18px;font-weight:800;">${totalAwardedMw.toFixed(3)} MW</span>
                  <span style="color:#546E7A;font-size:12px;"> / ${totalAwardedMwh.toFixed(4)} MWh</span>
                </td>
                <td style="padding:14px 18px;border-right:1px solid ${colorBorder};">
                  <span style="color:#546E7A;font-size:10px;text-transform:uppercase;font-weight:600;">Total ${receivablePayable}</span><br>
                  <span style="color:#2E7D32;font-size:18px;font-weight:800;">NRs ${totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                </td>
                <td style="padding:14px 18px;">
                  <span style="color:#546E7A;font-size:10px;text-transform:uppercase;font-weight:600;">Slots Cleared</span><br>
                  <span style="color:#1A237E;font-size:18px;font-weight:800;">${clearedCount} / ${totalSlots}</span>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Dispatch Section -->
        <tr><td style="padding:0 36px;">${dispatchSection}</td></tr>

        <!-- Disclaimer -->
        <tr>
          <td style="padding:20px 36px 0 36px;">
            <div style="background:#F8FAFC;border-radius:6px;padding:12px 16px;border-left:4px solid #E67E22;">
              <p style="color:#546E7A;font-size:11px;margin:0;line-height:1.6;">
                <strong style="color:#E67E22;">Notice:</strong> This automated confirmation is generated by the Nepal Electricity Market Simulation Engine. Results are binding for training and simulation purposes.
              </p>
            </div>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="padding:22px 36px;border-top:1px solid #E3E8F0;margin-top:20px;text-align:center;background:#F8FAFC;">
            <p style="color:#64748B;font-size:11px;margin:0;line-height:1.6;">
              ⚡ <strong>Electricity Market Clearing Engine</strong><br>
              Optimal Nodal Pricing & Economic Dispatch · © Sandeep Neupane 2026
            </p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`;

  const plainText = `Nepal Electricity Market – ${sessionLabel}
Result Notification for: ${participantName} (${roleDisplay})
============================================================
${allSlotsData
  .map(
    (sd) =>
      `T${sd.slot}: Status=${sd.acceptance_status} | Submitted=${sd.submitted_qty.toFixed(3)} MW @ NRs ${sd.submitted_price.toFixed(3)}/kWh | Awarded=${sd.awarded_qty.toFixed(3)} MW | MCP=${sd.mcp.toFixed(3)} | Amount=NRs ${sd.amount_nrs.toFixed(2)}`
  )
  .join('\n')}
============================================================
Total Awarded: ${totalAwardedMw.toFixed(3)} MW (${totalAwardedMwh.toFixed(4)} MWh)
Total Amount (${receivablePayable}): NRs ${totalAmount.toFixed(2)}
Generated: ${nowStr}
`;

  return { subject, html, text: plainText };
}


/* ------------------------------------------------------------------ */
/* Delivery API client                                                 */
/*                                                                     */
/* Credentials live ONLY in server environment variables. The browser  */
/* never sees or sends the Gmail address or App Password; it only      */
/* sends the admin passcode (kept for the tab session) so that nobody  */
/* else can trigger email from the server.                             */
/* ------------------------------------------------------------------ */

// Earlier versions kept the Gmail App Password in localStorage. Remove it from this browser.
try {
  localStorage.removeItem('nepal_market_email_config_v3');
  localStorage.removeItem('nepal_market_resend_api_key');
} catch {
  /* storage unavailable */
}

const PASSCODE_KEY = 'nepal_market_admin_passcode';

export function getAdminPasscode(): string {
  try {
    return sessionStorage.getItem(PASSCODE_KEY) || '';
  } catch {
    return '';
  }
}

export function setAdminPasscode(value: string): void {
  try {
    if (value) sessionStorage.setItem(PASSCODE_KEY, value);
    else sessionStorage.removeItem(PASSCODE_KEY);
  } catch {
    /* ignore */
  }
}

function apiHeaders(): Record<string, string> {
  const h: Record<string, string> = { 'Content-Type': 'application/json', Accept: 'application/json' };
  const code = getAdminPasscode();
  if (code) h['x-admin-passcode'] = code;
  return h;
}

export interface EmailServerStatus {
  configured: boolean;
  sender: string;
  senderSet: boolean;
  passwordSet: boolean;
  problems: string[];
  activeProviders: string[];
  notes: string[];
  onRender: boolean;
  passcodeRequired: boolean;
  usage: { sentToday: number; dailyLimit: number; remaining: number };
}

interface ApiResult<T = any> {
  ok: boolean;
  status: number;
  data?: T;
  error?: string;
  needsPasscode?: boolean;
}

async function callApi<T = any>(url: string, init?: RequestInit): Promise<ApiResult<T>> {
  try {
    const res = await fetch(url, { ...init, headers: { ...apiHeaders(), ...(init?.headers || {}) } });
    const text = await res.text();
    if (!text.trim()) {
      return { ok: false, status: res.status, error: `Empty response from server (HTTP ${res.status}). It may be waking up - try again in a few seconds.` };
    }
    let data: any;
    try {
      data = JSON.parse(text);
    } catch {
      return { ok: false, status: res.status, error: `Unexpected server response (HTTP ${res.status}).` };
    }
    return {
      ok: res.ok && data?.success !== false,
      status: res.status,
      data,
      error: data?.error,
      needsPasscode: res.status === 401 || res.status === 503 || data?.needsPasscode === true,
    };
  } catch (err: any) {
    return { ok: false, status: 0, error: `Could not reach the server: ${err?.message || err}` };
  }
}

export async function fetchEmailStatus(): Promise<EmailServerStatus | null> {
  const r = await callApi<EmailServerStatus>('/api/email/status');
  return r.data && (r.data as any).success ? r.data : null;
}

/** Validates the admin passcode without sending anything. */
export async function checkAdminPasscode(passcode: string): Promise<{ success: boolean; error?: string }> {
  const res = await callApi('/api/email/auth-check', { method: 'POST', headers: { 'x-admin-passcode': passcode }, body: '{}' });
  return { success: res.ok, error: res.ok ? undefined : res.error };
}

export interface VerifyResult {
  success: boolean;
  message?: string;
  error?: string;
  needsPasscode?: boolean;
  checks?: Array<{ provider: string; ok: boolean; detail: string }>;
}

/** Real login test against Gmail / the relay (nothing is sent to participants). */
export async function verifyEmailDelivery(): Promise<VerifyResult> {
  const r = await callApi<VerifyResult>('/api/email/verify', { method: 'POST', body: '{}' });
  return { ...(r.data || {}), success: !!r.data?.success && r.ok, error: r.data?.error || r.error, needsPasscode: r.needsPasscode };
}

export async function sendTestEmail(to: string): Promise<{ success: boolean; error?: string; providerUsed?: string; needsPasscode?: boolean }> {
  const r = await callApi('/api/email/test', { method: 'POST', body: JSON.stringify({ to }) });
  return { success: !!r.data?.success, error: r.data?.error || r.error, providerUsed: r.data?.providerUsed, needsPasscode: r.needsPasscode };
}

export async function sendSingleNotification(job: {
  to: string;
  subject: string;
  html: string;
  text: string;
}): Promise<{ success: boolean; messageId?: string; error?: string; providerUsed?: string; needsPasscode?: boolean }> {
  const r = await callApi('/api/email/send', { method: 'POST', body: JSON.stringify(job) });
  return { ...(r.data || {}), success: !!r.data?.success, error: r.data?.error || r.error, needsPasscode: r.needsPasscode };
}

/** Generate a mailto: link for one-click opening in native email client or webmail */
export function generateMailtoLink(to: string, subject: string, bodyText: string): string {
  return `mailto:${encodeURIComponent(to || '')}?subject=${encodeURIComponent(subject || '')}&body=${encodeURIComponent(bodyText || '')}`;
}

/** Generate direct Gmail Web link for one-click browser dispatch */
export function generateGmailWebLink(to: string, subject: string, bodyText: string): string {
  return `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(to || '')}&su=${encodeURIComponent(subject || '')}&body=${encodeURIComponent(bodyText || '')}`;
}

export type ProgressCallback = (info: {
  current: number;
  total: number;
  name: string;
  status: 'sent' | 'failed' | 'dry_run' | 'no_email';
  error?: string;
}) => void;

export interface BatchJob {
  name: string;
  email: string;
  role: 'buyer' | 'seller';
  subject: string;
  html: string;
  text: string;
  awarded_mw: number;
  amount_nrs: number;
}

/**
 * Dispatch notifications in small chunks so progress is real, and so that a failure never causes
 * already-sent participants to be emailed a second time (there is deliberately no "resend everything" fallback).
 */
export async function sendBatchNotifications(
  jobs: BatchJob[],
  dryRun = false,
  onProgress?: ProgressCallback
): Promise<EmailLogEntry[] & { needsPasscode?: boolean }> {
  const logs: EmailLogEntry[] = [];
  let needsPasscode = false;
  const CHUNK = 5;

  const failEntry = (j: BatchJob, error: string): EmailLogEntry => ({
    name: j.name, role: j.role, email: j.email, status: 'failed', attempts: 1, error,
    awarded_mw: j.awarded_mw, amount_nrs: j.amount_nrs, sent_at: '',
  });

  for (let i = 0; i < jobs.length; i += CHUNK) {
    const chunk = jobs.slice(i, i + CHUNK);
    let chunkLogs: EmailLogEntry[];

    if (needsPasscode) {
      chunkLogs = chunk.map((j) => failEntry(j, 'Admin passcode required - enter it in Email Delivery settings.'));
    } else {
      const r = await callApi<{ logs: EmailLogEntry[] }>('/api/email/batch', { method: 'POST', body: JSON.stringify({ jobs: chunk, dryRun }) });
      if (r.needsPasscode) needsPasscode = true;
      if (r.data && Array.isArray(r.data.logs) && r.data.logs.length === chunk.length) {
        chunkLogs = r.data.logs;
      } else {
        const why = r.error || 'Server did not return delivery results.';
        chunkLogs = chunk.map((j) => (j.email && j.email.includes('@') ? failEntry(j, why) : { ...failEntry(j, ''), status: 'no_email' as const, attempts: 0, email: '' }));
      }
    }

    chunkLogs.forEach((log, k) => {
      logs.push(log);
      onProgress?.({ current: i + k + 1, total: jobs.length, name: log.name, status: log.status, error: log.error });
    });
  }
  return Object.assign(logs, { needsPasscode });
}
