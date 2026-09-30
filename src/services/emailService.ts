/**
 * Email Notification Engine & Template Builder
 * Generates transactional confirmation emails for participants after market clearing.
 */

import {
  RawBidOfferRecord,
  SlotClearingResult,
  ParticipantSlotEmailData,
  EmailLogEntry,
} from '../types';

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
    const amountNrs = Number((r.mcp * (awardedQty * 0.25) * 1000).toFixed(2));

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
  const nowStr = new Date().toLocaleString();

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
  const totalAwardedMwh = totalAwardedMw * 0.25;
  const totalAmount = allSlotsData.reduce((sum, sd) => sum + sd.amount_nrs, 0);
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
              ${actionWord}: ${sd.awarded_qty.toFixed(3)} MW (${(sd.awarded_qty * 0.25).toFixed(4)} MWh)
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
  <title>${subject}</title>
</head>
<body style="margin:0;padding:0;background:#EEF2F7;font-family:Arial,Helvetica,sans-serif;color:#1A1A2E;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#EEF2F7;padding:24px 0;">
  <tr>
    <td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:720px;background:#FFFFFF;border-radius:12px;box-shadow:0 4px 20px rgba(0,0,0,0.08);overflow:hidden;">
        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#1A237E 0%,#283593 60%,#1565C0 100%);padding:28px 36px 22px 36px;">
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
              Dear <strong style="color:${colorAccent};">${participantName}</strong>,
            </p>
            <p style="font-size:13px;color:#546E7A;margin:0 0 18px 0;line-height:1.6;">
              The market clearing for session <strong style="color:#1A1A2E;">${sessionLabel}</strong> has been finalized. Below are your cleared results, nodal settlement, and obligation details.
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

export interface EmailProviderConfig {
  provider: 'google_script' | 'brevo' | 'resend' | 'smtp';
  googleAppsScriptUrl?: string;
  brevoApiKey?: string;
  resendApiKey?: string;
  senderEmail?: string;
  appPassword?: string;
}

const EMAIL_CONFIG_KEY = 'nepal_market_email_config_v3';

export const DEFAULT_EMAIL_CONFIG: EmailProviderConfig = {
  provider: 'google_script',
  googleAppsScriptUrl: '',
  brevoApiKey: '',
  resendApiKey: '',
  senderEmail: 'neupanesandeep500@gmail.com',
  appPassword: 'kroetysmnrlvzomr',
};

/**
 * Ready-to-paste Google Apps Script code that sends emails natively from Gmail with ZERO port blocking!
 */
export const GOOGLE_APPS_SCRIPT_TEMPLATE = `// -------------------------------------------------------------
// Nepal Electricity Market Clearing Engine - Email Relay Script
// -------------------------------------------------------------
// 1. Go to https://script.google.com and click "New project"
// 2. Paste this entire code into Code.gs
// 3. Click "Deploy" -> "New deployment"
// 4. Select type: "Web app"
// 5. Execute as: "Me" | Who has access: "Anyone"
// 6. Click "Deploy", authorize permissions, and copy the Web App URL!
// -------------------------------------------------------------

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    
    // Batch dispatch
    if (data.action === "send_batch" && Array.isArray(data.jobs)) {
      var sent = 0;
      for (var i = 0; i < data.jobs.length; i++) {
        var job = data.jobs[i];
        if (job.to && job.to.indexOf("@") !== -1) {
          MailApp.sendEmail({
            to: job.to,
            subject: job.subject,
            htmlBody: job.html,
            body: job.text || "",
            name: "Nepal Electricity Market Clearing Engine"
          });
          sent++;
        }
      }
      return ContentService.createTextOutput(JSON.stringify({ success: true, count: sent }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    // Single email dispatch
    if (data.to) {
      MailApp.sendEmail({
        to: data.to,
        subject: data.subject,
        htmlBody: data.html,
        body: data.text || "",
        name: "Nepal Electricity Market Clearing Engine"
      });
      return ContentService.createTextOutput(JSON.stringify({ success: true, messageId: "gas-" + new Date().getTime() }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    return ContentService.createTextOutput(JSON.stringify({ success: true, message: "Relay ping OK" }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}`;

export function getEmailConfig(): EmailProviderConfig {
  try {
    const raw = localStorage.getItem(EMAIL_CONFIG_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return { ...DEFAULT_EMAIL_CONFIG, ...parsed };
    }
    // Check legacy resend key if present
    const legacyResend = localStorage.getItem('nepal_market_resend_api_key');
    if (legacyResend) {
      return { ...DEFAULT_EMAIL_CONFIG, provider: 'resend', resendApiKey: legacyResend };
    }
  } catch {
    // ignore
  }
  return DEFAULT_EMAIL_CONFIG;
}

export function saveEmailConfig(cfg: EmailProviderConfig): void {
  try {
    localStorage.setItem(EMAIL_CONFIG_KEY, JSON.stringify(cfg));
    if (cfg.resendApiKey) {
      localStorage.setItem('nepal_market_resend_api_key', cfg.resendApiKey);
    }
  } catch {
    // ignore
  }
}

/**
 * Safe JSON parser helper to prevent "Unexpected end of JSON input" errors
 */
async function parseJsonSafely<T = any>(res: Response): Promise<{ ok: boolean; data?: T; error?: string }> {
  try {
    const text = await res.text();
    if (!text || !text.trim()) {
      return {
        ok: false,
        error: `Empty response from server (HTTP ${res.status}). Server may be waking up from sleep.`,
      };
    }
    try {
      const parsed = JSON.parse(text);
      return { ok: res.ok && parsed.success !== false, data: parsed, error: parsed.error };
    } catch {
      return {
        ok: false,
        error: `Server returned non-JSON response (HTTP ${res.status}): ${text.slice(0, 120)}`,
      };
    }
  } catch (err: any) {
    return { ok: false, error: err.message || 'Network stream reading error' };
  }
}

/**
 * Verify Email Provider connection (supports Google Apps Script, Brevo, Resend, and SMTP)
 */
export async function verifyEmailProvider(config?: EmailProviderConfig): Promise<{ success: boolean; message?: string; error?: string }> {
  const cfg = config || getEmailConfig();
  const payload: any = {
    provider: cfg.provider,
    sender: cfg.senderEmail,
    password: cfg.appPassword,
    googleAppsScriptUrl: cfg.googleAppsScriptUrl,
    httpApiKey: cfg.provider === 'brevo' ? cfg.brevoApiKey : cfg.provider === 'resend' ? cfg.resendApiKey : undefined,
  };

  try {
    const res = await fetch('/api/verify-email-provider', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(payload),
    });
    const parsed = await parseJsonSafely(res);
    if (parsed.data) {
      return parsed.data;
    }
    return { success: false, error: parsed.error || 'Verification failed' };
  } catch (err: any) {
    return { success: false, error: err.message || String(err) };
  }
}

/**
 * Verify SMTP connection (backwards compatible)
 */
export async function verifySmtpConnection(smtpCredentials?: {
  sender?: string;
  password?: string;
}): Promise<{ success: boolean; message?: string; error?: string }> {
  return verifyEmailProvider({
    provider: 'smtp',
    senderEmail: smtpCredentials?.sender,
    appPassword: smtpCredentials?.password,
  });
}

/**
 * Send single individual email notification
 */
export async function sendSingleNotification(
  job: {
    to: string;
    subject: string;
    html: string;
    text: string;
  },
  smtpCredentials?: { sender?: string; password?: string },
  httpApi?: { resendApiKey?: string; brevoApiKey?: string; googleAppsScriptUrl?: string }
): Promise<{ success: boolean; messageId?: string; error?: string; providerUsed?: string }> {
  const currentCfg = getEmailConfig();
  const mergedHttpApi = {
    googleAppsScriptUrl: httpApi?.googleAppsScriptUrl || currentCfg.googleAppsScriptUrl,
    brevoApiKey: httpApi?.brevoApiKey || currentCfg.brevoApiKey,
    resendApiKey: httpApi?.resendApiKey || currentCfg.resendApiKey,
  };
  const creds = smtpCredentials || {
    sender: currentCfg.senderEmail,
    password: currentCfg.appPassword,
  };

  try {
    const res = await fetch('/api/send-single-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ ...job, smtpCredentials: creds, httpApi: mergedHttpApi }),
    });
    const parsed = await parseJsonSafely(res);
    if (parsed.data) {
      return parsed.data;
    }
    return {
      success: false,
      error: parsed.error || 'Email delivery failed. Please verify provider settings.',
    };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || String(err),
    };
  }
}

/**
 * Generate a mailto: link for one-click opening in native email client or webmail
 */
export function generateMailtoLink(
  to: string,
  subject: string,
  bodyText: string
): string {
  const encTo = encodeURIComponent(to || '');
  const encSubject = encodeURIComponent(subject || '');
  const encBody = encodeURIComponent(bodyText || '');
  return `mailto:${encTo}?subject=${encSubject}&body=${encBody}`;
}

/**
 * Generate direct Gmail Web link for one-click browser dispatch
 */
export function generateGmailWebLink(
  to: string,
  subject: string,
  bodyText: string
): string {
  const encTo = encodeURIComponent(to || '');
  const encSubject = encodeURIComponent(subject || '');
  const encBody = encodeURIComponent(bodyText || '');
  return `https://mail.google.com/mail/?view=cm&fs=1&to=${encTo}&su=${encSubject}&body=${encBody}`;
}

export type ProgressCallback = (info: {
  current: number;
  total: number;
  name: string;
  status: 'sent' | 'failed' | 'dry_run' | 'no_email';
  error?: string;
}) => void;

/**
 * Trigger batch email notification dispatch via server API with transparent multi-provider support
 */
export async function sendBatchNotifications(
  jobs: {
    name: string;
    email: string;
    role: 'buyer' | 'seller';
    subject: string;
    html: string;
    text: string;
    awarded_mw: number;
    amount_nrs: number;
  }[],
  dryRun = false,
  smtpCredentials?: { sender?: string; password?: string },
  onProgress?: ProgressCallback,
  httpApiOverride?: { resendApiKey?: string; brevoApiKey?: string; googleAppsScriptUrl?: string }
): Promise<EmailLogEntry[]> {
  if (dryRun) {
    return jobs.map((job, idx) => {
      const isEmailValid = !!(job.email && job.email.includes('@'));
      onProgress?.({
        current: idx + 1,
        total: jobs.length,
        name: job.name,
        status: isEmailValid ? 'dry_run' : 'no_email',
      });
      return {
        name: job.name,
        role: job.role,
        email: job.email,
        status: isEmailValid ? 'dry_run' : 'no_email',
        attempts: 0,
        awarded_mw: job.awarded_mw,
        amount_nrs: job.amount_nrs,
        sent_at: new Date().toISOString(),
      };
    });
  }

  // Load configured HTTP delivery API and SMTP settings
  const emailCfg = getEmailConfig();
  const httpApi = {
    googleAppsScriptUrl: httpApiOverride?.googleAppsScriptUrl || emailCfg.googleAppsScriptUrl,
    brevoApiKey: httpApiOverride?.brevoApiKey || emailCfg.brevoApiKey,
    resendApiKey: httpApiOverride?.resendApiKey || emailCfg.resendApiKey,
  };
  const creds = smtpCredentials || {
    sender: emailCfg.senderEmail,
    password: emailCfg.appPassword,
  };

  // Attempt multi-provider batch dispatch via /api/send-emails
  try {
    const res = await fetch('/api/send-emails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ jobs, dryRun: false, smtpCredentials: creds, httpApi }),
    });

    const parsed = await parseJsonSafely(res);
    if (parsed.ok && parsed.data && Array.isArray(parsed.data.logs) && parsed.data.logs.length > 0) {
      parsed.data.logs.forEach((log: EmailLogEntry, idx: number) => {
        onProgress?.({
          current: idx + 1,
          total: jobs.length,
          name: log.name,
          status: log.status,
          error: log.error,
        });
      });
      return parsed.data.logs;
    }
    console.warn('[Dispatch] Server batch returned empty or non-OK response, activating resilient individual failover...');
  } catch (err: any) {
    console.warn('[Dispatch] Server batch fetch encountered network issue, activating resilient individual failover...', err);
  }

  // Resilient Failover: Dispatch individually via /api/send-single-email
  const logs: EmailLogEntry[] = [];
  for (let i = 0; i < jobs.length; i++) {
    const job = jobs[i];
    if (!job.email || !job.email.includes('@')) {
      const entry: EmailLogEntry = {
        name: job.name,
        role: job.role,
        email: '',
        status: 'no_email',
        attempts: 0,
        awarded_mw: job.awarded_mw,
        amount_nrs: job.amount_nrs,
        sent_at: '',
      };
      logs.push(entry);
      onProgress?.({ current: i + 1, total: jobs.length, name: job.name, status: 'no_email' });
      continue;
    }

    try {
      const singleRes = await sendSingleNotification(
        {
          to: job.email,
          subject: job.subject,
          html: job.html,
          text: job.text,
        },
        creds,
        httpApi
      );

      if (singleRes.success) {
        const entry: EmailLogEntry = {
          name: job.name,
          role: job.role,
          email: job.email,
          status: 'sent',
          attempts: 1,
          awarded_mw: job.awarded_mw,
          amount_nrs: job.amount_nrs,
          sent_at: new Date().toISOString(),
        };
        logs.push(entry);
        onProgress?.({ current: i + 1, total: jobs.length, name: job.name, status: 'sent' });
      } else {
        const entry: EmailLogEntry = {
          name: job.name,
          role: job.role,
          email: job.email,
          status: 'failed',
          attempts: 1,
          error: singleRes.error || 'Delivery failed. Check email provider configuration.',
          awarded_mw: job.awarded_mw,
          amount_nrs: job.amount_nrs,
          sent_at: '',
        };
        logs.push(entry);
        onProgress?.({ current: i + 1, total: jobs.length, name: job.name, status: 'failed', error: entry.error });
      }
    } catch (singleErr: any) {
      const entry: EmailLogEntry = {
        name: job.name,
        role: job.role,
        email: job.email,
        status: 'failed',
        attempts: 1,
        error: singleErr.message || 'Network error reaching dispatch server.',
        awarded_mw: job.awarded_mw,
        amount_nrs: job.amount_nrs,
        sent_at: '',
      };
      logs.push(entry);
      onProgress?.({ current: i + 1, total: jobs.length, name: job.name, status: 'failed', error: entry.error });
    }

    if (i < jobs.length - 1) {
      await new Promise((r) => setTimeout(r, 80));
    }
  }

  return logs;
}
