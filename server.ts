import express, { Request, Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import net from 'net';
import nodemailer, { Transporter, SendMailOptions, SentMessageInfo } from 'nodemailer';
import dotenv from 'dotenv';
import { generateStandaloneHTML } from './src/engine/standaloneHtmlGenerator';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Email credentials & environment resolvers (supports all common environment variable naming on Render)
function getEnvEmailSender(): string {
  return (
    process.env.EMAIL_SENDER ||
    process.env.EMAIL_USER ||
    process.env.SMTP_USER ||
    process.env.SMTP_EMAIL ||
    process.env.GMAIL_USER ||
    process.env.GMAIL_ADDRESS ||
    process.env.SENDER_EMAIL ||
    process.env.USER_EMAIL ||
    process.env.MAIL_USERNAME ||
    'neupanesandeep500@gmail.com'
  ).trim();
}

function getEnvEmailPassword(): string {
  return (
    process.env.EMAIL_PASSWORD ||
    process.env.EMAIL_PASS ||
    process.env.SMTP_PASS ||
    process.env.SMTP_PASSWORD ||
    process.env.GMAIL_APP_PASSWORD ||
    process.env.APP_PASSWORD ||
    process.env.MAIL_PASSWORD ||
    'kroetysmnrlvzomr'
  ).replace(/\s+/g, '');
}

function getEnvReplyTo(): string {
  return (
    process.env.EMAIL_REPLY_TO ||
    process.env.REPLY_TO ||
    '080mspse021.sandeep@pcampus.edu.np'
  ).trim();
}

function getEnvSmtpHost(): string {
  return (process.env.SMTP_HOST || 'smtp.gmail.com').trim();
}

function getEnvSmtpPort(): number {
  return process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT, 10) : 465;
}

function getEnvGoogleAppsScriptUrl(): string | undefined {
  return (
    process.env.GOOGLE_APPS_SCRIPT_URL ||
    process.env.EMAIL_RELAY_URL ||
    process.env.APPS_SCRIPT_URL ||
    process.env.GAS_URL
  )?.trim();
}

function getEnvBrevoKey(): string | undefined {
  return (
    process.env.BREVO_API_KEY ||
    process.env.BREVO_KEY ||
    process.env.SENDINBLUE_API_KEY ||
    process.env.SIB_API_KEY
  )?.trim();
}

function getEnvResendKey(): string | undefined {
  return (process.env.RESEND_API_KEY || process.env.RESEND_KEY)?.trim();
}

function getEnvSendGridKey(): string | undefined {
  return (process.env.SENDGRID_API_KEY || process.env.SG_API_KEY)?.trim();
}

/**
 * Health & Ping endpoints for uptime monitors and keep-alive (prevents Render free tier spin-down)
 */
app.get(['/api/health', '/api/ping'], (_req: Request, res: Response) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.json({
    status: 'ok',
    uptimeSeconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
    service: 'Nepal Electricity Market Clearing Engine',
    hasBrevoKey: !!getEnvBrevoKey(),
    hasResendKey: !!getEnvResendKey(),
    hasSendGridKey: !!getEnvSendGridKey(),
    hasGoogleScriptUrl: !!getEnvGoogleAppsScriptUrl(),
    smtpConfigured: !!(getEnvEmailSender() && getEnvEmailPassword()),
  });
});

/**
 * Email Environment Status inspection endpoint
 * Allows the UI to display which credentials are currently set in Render environment
 */
app.get('/api/email-env-status', (_req: Request, res: Response) => {
  const sender = getEnvEmailSender();
  const hasPass = !!getEnvEmailPassword();
  const gasUrl = getEnvGoogleAppsScriptUrl();
  const brevoKey = getEnvBrevoKey();
  const resendKey = getEnvResendKey();
  const sgKey = getEnvSendGridKey();

  const maskedSender = sender
    ? sender.replace(/^(..)(.*)(@.*)$/, (_m, p1, _p2, p3) => `${p1}***${p3}`)
    : '';

  let activeProvider = 'None';
  if (gasUrl) {
    activeProvider = 'Google Apps Script Relay (HTTPS)';
  } else if (brevoKey) {
    activeProvider = 'Brevo HTTP API (HTTPS)';
  } else if (resendKey) {
    activeProvider = 'Resend HTTP API (HTTPS)';
  } else if (sgKey) {
    activeProvider = 'SendGrid HTTP API (HTTPS)';
  } else if (sender && hasPass) {
    activeProvider = `Gmail/SMTP (${getEnvSmtpHost()})`;
  }

  res.json({
    status: 'ok',
    activeProvider,
    smtpConfigured: !!(sender && hasPass),
    smtpSender: maskedSender,
    smtpHost: getEnvSmtpHost(),
    smtpPort: getEnvSmtpPort(),
    hasGoogleScriptUrl: !!gasUrl,
    hasBrevoKey: !!brevoKey,
    hasResendKey: !!resendKey,
    hasSendGridKey: !!sgKey,
  });
});

/**
 * Keep-alive self-pinger: if deployed with RENDER_EXTERNAL_URL or APP_URL,
 * periodically pings itself every 10 minutes to stay awake.
 */
const externalUrl = process.env.RENDER_EXTERNAL_URL || process.env.APP_URL;
if (externalUrl) {
  const pingIntervalMs = 10 * 60 * 1000; // 10 minutes
  setInterval(async () => {
    try {
      const pingTarget = `${externalUrl.replace(/\/+$/, '')}/api/health`;
      await fetch(pingTarget);
      console.log(`[KeepAlive] Pinged ${pingTarget} successfully at ${new Date().toISOString()}`);
    } catch (err: any) {
      console.warn(`[KeepAlive] Self-ping notice:`, err.message);
    }
  }, pingIntervalMs);
}

/**
 * Proxy route for fetching Google Sheet CSV without CORS blocking
 */
app.get('/api/fetch-sheet', async (req: Request, res: Response) => {
  const { sheetId, sheetName } = req.query;

  if (!sheetId || typeof sheetId !== 'string') {
    return res.status(400).send('sheetId is required');
  }

  const sName = (sheetName as string) || 'Form Responses 1';

  const targets = [
    `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sName)}`,
    `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&id=${sheetId}&gid=0`,
  ];

  for (const targetUrl of targets) {
    try {
      const response = await fetch(targetUrl);
      if (response.ok) {
        const text = await response.text();
        if (text && text.trim().length > 10 && !text.includes('<!DOCTYPE html>')) {
          res.setHeader('Content-Type', 'text/csv; charset=utf-8');
          return res.send(text);
        }
      }
    } catch (err) {
      console.warn(`Failed fetching from ${targetUrl}:`, err);
    }
  }

  return res.status(502).send('Failed to retrieve spreadsheet data from Google Sheets');
});

// Global process safeguards to prevent background network timeouts or socket events from crashing Node.js
process.on('uncaughtException', (err) => {
  console.error('[Process SafeGuard] uncaughtException caught:', err.message);
});
process.on('unhandledRejection', (reason: any) => {
  console.error('[Process SafeGuard] unhandledRejection caught:', reason?.message || reason);
});

function withTimeout<T>(promise: Promise<T>, ms: number, errMsg: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(errMsg)), ms)),
  ]);
}

/**
 * Fast TCP connection probing to check if outbound SMTP ports (465/587) are reachable
 * Prevents Render reverse proxy 30s timeouts when cloud firewalls drop outbound SMTP
 */
let smtpConnectivityCache: { reachable: boolean; lastChecked: number; host: string; port: number } | null = null;

async function checkSmtpReachable(host: string, port: number, timeoutMs = 2000): Promise<boolean> {
  const now = Date.now();
  if (
    smtpConnectivityCache &&
    smtpConnectivityCache.host === host &&
    smtpConnectivityCache.port === port &&
    now - smtpConnectivityCache.lastChecked < 30000
  ) {
    return smtpConnectivityCache.reachable;
  }

  return new Promise((resolve) => {
    let settled = false;
    const socket = net.createConnection({ host, port, timeout: timeoutMs });

    socket.on('connect', () => {
      if (!settled) {
        settled = true;
        socket.destroy();
        smtpConnectivityCache = { reachable: true, lastChecked: Date.now(), host, port };
        resolve(true);
      }
    });

    socket.on('timeout', () => {
      if (!settled) {
        settled = true;
        socket.destroy();
        smtpConnectivityCache = { reachable: false, lastChecked: Date.now(), host, port };
        resolve(false);
      }
    });

    socket.on('error', () => {
      if (!settled) {
        settled = true;
        socket.destroy();
        smtpConnectivityCache = { reachable: false, lastChecked: Date.now(), host, port };
        resolve(false);
      }
    });
  });
}

/**
 * Creates clean, safe non-pooled mail transporter with explicit error listener
 */
function createDirectMailTransporter(
  user: string,
  pass: string,
  port = 465,
  secure = true,
  host?: string
): Transporter {
  const cleanPass = pass.replace(/\s+/g, '');
  const targetHost = host || getEnvSmtpHost();
  const tp = nodemailer.createTransport({
    host: targetHost,
    port,
    secure,
    auth: { user, pass: cleanPass },
    connectionTimeout: 4000,
    greetingTimeout: 4000,
    socketTimeout: 5000,
    tls: {
      rejectUnauthorized: false,
    },
  });

  // Attach error handler to prevent unhandled EventEmitter error crashes
  tp.on('error', (err) => {
    console.warn(`[SMTP Warning] Transporter socket notice on port ${port}:`, err?.message || err);
  });

  return tp;
}

/**
 * Send email via Google Apps Script Web App Relay (Port 443 HTTPS - 100% works on Render free & paid)
 * Google Apps Script runs natively in Google cloud and can send emails via GmailApp with 0 port blocks!
 */
async function sendViaGoogleAppsScript(
  scriptUrl: string,
  payload: {
    to?: string;
    subject?: string;
    html?: string;
    text?: string;
    action?: string;
    jobs?: any[];
  }
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const res = await fetch(scriptUrl.trim(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      redirect: 'follow',
    });

    const text = await res.text();
    let data: any = {};
    try {
      data = JSON.parse(text);
    } catch {
      // Some Apps Scripts return plain text or HTML redirect
      if (res.ok && (text.includes('success') || text.includes('OK') || text.length === 0)) {
        return { success: true, messageId: `gas-${Date.now()}` };
      }
      return { success: false, error: `Google Apps Script returned: ${text.slice(0, 150)}` };
    }

    if (res.ok && data?.success !== false) {
      return { success: true, messageId: data.messageId || `gas-${Date.now()}` };
    }
    return { success: false, error: data?.error || data?.message || `Google Apps Script error (HTTP ${res.status})` };
  } catch (err: any) {
    return { success: false, error: err.message || 'Google Apps Script HTTP relay failed' };
  }
}

/**
 * Send email via Resend HTTP API (Port 443 HTTPS - 100% works on Render free & paid)
 */
async function sendViaResendHttp(
  apiKey: string,
  to: string,
  subject: string,
  html: string,
  text: string,
  fromEmail = 'onboarding@resend.dev'
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey.trim()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: `Nepal Electricity Market <${fromEmail}>`,
        to: [to],
        subject,
        html,
        text,
      }),
    });
    const data = (await res.json()) as any;
    if (res.ok && data?.id) {
      return { success: true, messageId: data.id };
    }
    return { success: false, error: data?.message || `Resend API error (HTTP ${res.status})` };
  } catch (err: any) {
    return { success: false, error: err.message || 'Resend HTTP API failed' };
  }
}

/**
 * Send email via Brevo HTTP API (Port 443 HTTPS - 100% works on Render free & paid)
 */
async function sendViaBrevoHttp(
  apiKey: string,
  senderEmail: string,
  to: string,
  subject: string,
  html: string,
  text: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'api-key': apiKey.trim(),
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        sender: { name: 'Nepal Electricity Market Clearing Engine', email: senderEmail },
        to: [{ email: to }],
        subject,
        htmlContent: html,
        textContent: text,
      }),
    });
    const data = (await res.json()) as any;
    if (res.ok && data?.messageId) {
      return { success: true, messageId: data.messageId };
    }
    return { success: false, error: data?.message || `Brevo API error (HTTP ${res.status})` };
  } catch (err: any) {
    return { success: false, error: err.message || 'Brevo HTTP API failed' };
  }
}

/**
 * Send email via SendGrid HTTP API (Port 443 HTTPS - 100% works on Render free & paid)
 */
async function sendViaSendGridHttp(
  apiKey: string,
  senderEmail: string,
  to: string,
  subject: string,
  html: string,
  text: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey.trim()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: to }] }],
        from: { email: senderEmail, name: 'Nepal Electricity Market Clearing Engine' },
        subject,
        content: [
          { type: 'text/plain', value: text },
          { type: 'text/html', value: html },
        ],
      }),
    });

    if (res.status === 202 || res.ok) {
      return { success: true, messageId: `sg-${Date.now()}` };
    }
    const errText = await res.text();
    return { success: false, error: `SendGrid error (HTTP ${res.status}): ${errText.slice(0, 150)}` };
  } catch (err: any) {
    return { success: false, error: err.message || 'SendGrid HTTP API failed' };
  }
}

/**
 * Robust email sender with primary Port 465 (SSL) and fallback to Port 587 (STARTTLS)
 */
async function sendMailWithFallback(
  user: string,
  pass: string,
  mailOptions: SendMailOptions,
  customHost?: string,
  customPort?: number
): Promise<SentMessageInfo> {
  const cleanPass = pass.replace(/\s+/g, '');
  const host = customHost || getEnvSmtpHost();

  const primaryPort = customPort || (host === 'smtp.gmail.com' ? 465 : 465);

  const isPrimary = await checkSmtpReachable(host, primaryPort, 2000);
  if (!isPrimary) {
    const is587 = await checkSmtpReachable(host, 587, 2000);
    if (!is587) {
      throw new Error(
        `Outbound SMTP connection to ${host}:${primaryPort}/587 timed out. Note: On Render free tier services, outbound SMTP ports are blocked by Render. To send emails on Render, please configure Google Apps Script Relay (free via your Gmail) or Brevo API in Email Settings.`
      );
    }
  }

  try {
    // Primary attempt (typically Port 465 SSL)
    const tpPrimary = createDirectMailTransporter(user, cleanPass, primaryPort, primaryPort === 465, host);
    return await withTimeout(
      tpPrimary.sendMail(mailOptions),
      4500,
      `Port ${primaryPort} connection timed out`
    );
  } catch (errPrimary: any) {
    console.warn(`[SMTP Port ${primaryPort}] notice (${errPrimary.message}), attempting fallback to Port 587...`);
    try {
      // Fallback: Port 587 (STARTTLS)
      const tp587 = createDirectMailTransporter(user, cleanPass, 587, false, host);
      return await withTimeout(
        tp587.sendMail(mailOptions),
        4500,
        'Port 587 connection timed out'
      );
    } catch (err587: any) {
      console.error('[SMTP] Both Port 465 and Port 587 attempts failed:', err587.message);
      throw new Error(
        `SMTP delivery failed (${errPrimary.message || err587.message}). Note: On Render free tier services, raw outbound SMTP ports (465/587) are blocked by Render. You can add BREVO_API_KEY, RESEND_API_KEY, or GOOGLE_APPS_SCRIPT_URL in your Render environment variables for 100% guaranteed delivery.`
      );
    }
  }
}

/**
 * Unified Dispatcher: Dispatches single email through the best available provider
 * Priority: Google Apps Script Web App -> Brevo HTTP -> Resend HTTP -> SendGrid HTTP -> Direct SMTP
 */
async function dispatchSingleEmail(
  job: { to: string; subject: string; html: string; text: string; name?: string; role?: string },
  smtpCredentials?: { sender?: string; password?: string; host?: string; port?: number },
  httpApi?: { googleAppsScriptUrl?: string; brevoApiKey?: string; resendApiKey?: string }
): Promise<{ success: boolean; messageId?: string; error?: string; providerUsed: string }> {
  // 1. Google Apps Script Web App (HTTPS Port 443 - zero blocked ports, uses own Gmail)
  const scriptUrl = httpApi?.googleAppsScriptUrl || getEnvGoogleAppsScriptUrl();
  if (scriptUrl && scriptUrl.trim().length > 10) {
    const res = await sendViaGoogleAppsScript(scriptUrl, {
      to: job.to,
      subject: job.subject,
      html: job.html,
      text: job.text,
    });
    if (res.success) {
      return { success: true, messageId: res.messageId, providerUsed: 'Google Apps Script (HTTPS)' };
    }
    console.warn('[Dispatch] Google Apps Script relay failed, trying next provider:', res.error);
  }

  // 2. Brevo HTTP API (HTTPS Port 443 - 300 free emails/day)
  const brevoKey = httpApi?.brevoApiKey || getEnvBrevoKey();
  if (brevoKey && brevoKey.trim().length > 10) {
    const senderEmail = smtpCredentials?.sender || getEnvEmailSender();
    const res = await sendViaBrevoHttp(brevoKey, senderEmail, job.to, job.subject, job.html, job.text);
    if (res.success) {
      return { success: true, messageId: res.messageId, providerUsed: 'Brevo HTTP API (HTTPS)' };
    }
    console.warn('[Dispatch] Brevo API failed, trying next provider:', res.error);
  }

  // 3. Resend HTTP API (HTTPS Port 443 - 100 free emails/day)
  const resendKey = httpApi?.resendApiKey || getEnvResendKey();
  if (resendKey && resendKey.trim().length > 10) {
    const res = await sendViaResendHttp(resendKey, job.to, job.subject, job.html, job.text);
    if (res.success) {
      return { success: true, messageId: res.messageId, providerUsed: 'Resend HTTP API (HTTPS)' };
    }
    console.warn('[Dispatch] Resend API failed, trying next provider:', res.error);
  }

  // 4. SendGrid HTTP API (HTTPS Port 443)
  const sgKey = getEnvSendGridKey();
  if (sgKey && sgKey.trim().length > 10) {
    const senderEmail = smtpCredentials?.sender || getEnvEmailSender();
    const res = await sendViaSendGridHttp(sgKey, senderEmail, job.to, job.subject, job.html, job.text);
    if (res.success) {
      return { success: true, messageId: res.messageId, providerUsed: 'SendGrid HTTP API (HTTPS)' };
    }
    console.warn('[Dispatch] SendGrid API failed, trying next provider:', res.error);
  }

  // 5. Direct SMTP (Ports 465/587 - Works on Render Paid / VPS / Local / unblocked cloud)
  const senderEmail = smtpCredentials?.sender || getEnvEmailSender();
  const senderPass = smtpCredentials?.password
    ? smtpCredentials.password.replace(/\s+/g, '')
    : getEnvEmailPassword();

  try {
    const info = await sendMailWithFallback(
      senderEmail,
      senderPass,
      {
        from: `"Nepal Electricity Market Clearing Engine" <${senderEmail}>`,
        replyTo: getEnvReplyTo(),
        to: job.to,
        subject: job.subject,
        text: job.text,
        html: job.html,
      },
      smtpCredentials?.host,
      smtpCredentials?.port
    );
    return { success: true, messageId: info.messageId, providerUsed: `SMTP (${getEnvSmtpHost()})` };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || 'SMTP delivery failed.',
      providerUsed: 'None (Delivery Failed)',
    };
  }
}

/**
 * Verify Email Provider connection (supports Google Apps Script, Brevo, Resend, and SMTP)
 */
app.post(['/api/verify-smtp', '/api/verify-email-provider'], async (req: Request, res: Response) => {
  const { sender, password, httpApiKey, googleAppsScriptUrl, provider } = req.body || {};

  // Test Google Apps Script
  if (provider === 'google_script' || googleAppsScriptUrl) {
    const targetUrl = googleAppsScriptUrl || httpApiKey;
    if (!targetUrl || !targetUrl.startsWith('http')) {
      return res.json({ success: false, error: 'Valid Google Apps Script Web App URL required' });
    }
    try {
      const pingRes = await fetch(targetUrl.trim(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'ping' }),
        redirect: 'follow',
      });
      if (pingRes.ok) {
        return res.json({ success: true, message: 'Google Apps Script Relay verified successfully! Ready to send via Gmail.' });
      }
      return res.json({ success: false, error: `Google Apps Script returned HTTP ${pingRes.status}` });
    } catch (err: any) {
      return res.json({ success: false, error: `Could not reach Google Apps Script URL: ${err.message}` });
    }
  }

  // Test Brevo API Key
  if (provider === 'brevo' || (httpApiKey && httpApiKey.startsWith('xkeysib-'))) {
    const key = httpApiKey;
    try {
      const testRes = await fetch('https://api.brevo.com/v3/account', {
        headers: { 'api-key': key.trim(), 'Accept': 'application/json' },
      });
      if (testRes.ok) {
        const data = (await testRes.json()) as any;
        return res.json({
          success: true,
          message: `Brevo API connection verified successfully! Account: ${data.email || 'Active'}`,
        });
      }
      const data = (await testRes.json()) as any;
      return res.json({ success: false, error: data?.message || `Brevo authentication failed (HTTP ${testRes.status})` });
    } catch (err: any) {
      return res.json({ success: false, error: `Brevo API check error: ${err.message}` });
    }
  }

  // Test Resend API Key
  if (provider === 'resend' || (httpApiKey && httpApiKey.startsWith('re_'))) {
    const key = httpApiKey;
    try {
      const testRes = await fetch('https://api.resend.com/api-keys', {
        headers: { 'Authorization': `Bearer ${key.trim()}` },
      });
      if (testRes.ok) {
        return res.json({ success: true, message: 'Resend HTTP API connection verified successfully!' });
      }
      const data = (await testRes.json()) as any;
      return res.json({ success: false, error: data?.message || `Resend authentication failed (HTTP ${testRes.status})` });
    } catch (err: any) {
      return res.json({ success: false, error: `Resend API check error: ${err.message}` });
    }
  }

  // Direct SMTP check
  const user = sender || getEnvEmailSender();
  const pass = password ? password.replace(/\s+/g, '') : getEnvEmailPassword();

  try {
    const is465 = await checkSmtpReachable('smtp.gmail.com', 465, 2000);
    const is587 = is465 ? true : await checkSmtpReachable('smtp.gmail.com', 587, 2000);
    if (!is465 && !is587) {
      return res.status(200).json({
        success: false,
        error:
          'Outbound SMTP ports (465/587) timed out. Note: On Render free tier services, raw outbound SMTP ports are blocked by Render. To send emails on Render, please configure Google Apps Script Relay (free via your Gmail) or Brevo API in Email Provider Settings.',
      });
    }

    let tp = createDirectMailTransporter(user, pass, is465 ? 465 : 587, is465);
    await withTimeout(tp.verify(), 4000, 'SMTP verify timed out');
    return res.status(200).json({ success: true, message: `SMTP connection verified successfully for ${user}!` });
  } catch (err: any) {
    console.error('SMTP verify error:', err.message);
    return res.status(200).json({
      success: false,
      error: `Notice: ${err.message || String(err)}. Note: On Render free tier services, raw outbound SMTP ports (465/587) are blocked by Render. You can add BREVO_API_KEY, RESEND_API_KEY, or GOOGLE_APPS_SCRIPT_URL in your Render environment variables for 100% guaranteed delivery.`,
    });
  }
});

/**
 * Send single individual email notification
 */
app.post('/api/send-single-email', async (req: Request, res: Response) => {
  try {
    const { to, subject, html, text, smtpCredentials, httpApi } = req.body || {};
    if (!to || !to.includes('@')) {
      return res.status(200).json({ success: false, error: 'Valid recipient email required' });
    }

    const result = await dispatchSingleEmail(
      { to, subject, html, text },
      smtpCredentials,
      httpApi
    );

    return res.status(200).json(result);
  } catch (err: any) {
    console.error('Error in /api/send-single-email:', err);
    return res.status(200).json({
      success: false,
      error: err.message || 'Email delivery failed on server',
    });
  }
});

/**
 * Batch email notification sender with multi-provider dispatch & parallel concurrency
 */
app.post('/api/send-emails', async (req: Request, res: Response) => {
  try {
    const { jobs, dryRun, smtpCredentials, httpApi } = req.body || {};

    if (!jobs || !Array.isArray(jobs)) {
      return res.status(200).json({ success: false, error: 'jobs array required', logs: [] });
    }

    const logs: any[] = [];

    if (dryRun) {
      for (const job of jobs) {
        logs.push({
          name: job.name,
          role: job.role,
          email: job.email,
          status: job.email && job.email.includes('@') ? 'dry_run' : 'no_email',
          attempts: 0,
          awarded_mw: job.awarded_mw,
          amount_nrs: job.amount_nrs,
          sent_at: new Date().toISOString(),
        });
      }
      return res.status(200).json({ success: true, dryRun: true, logs });
    }

    // Check if Google Apps Script URL supports bulk batch dispatch in a single call
    const scriptUrl = httpApi?.googleAppsScriptUrl || getEnvGoogleAppsScriptUrl();
    if (scriptUrl && scriptUrl.trim().length > 10) {
      try {
        const validJobs = jobs.filter((j) => j.email && j.email.includes('@'));
        if (validJobs.length > 0) {
          const batchRes = await sendViaGoogleAppsScript(scriptUrl, {
            action: 'send_batch',
            jobs: validJobs.map((j) => ({
              to: j.email,
              subject: j.subject,
              html: j.html,
              text: j.text,
              name: j.name,
              role: j.role,
            })),
          });

          if (batchRes.success) {
            for (const job of jobs) {
              if (!job.email || !job.email.includes('@')) {
                logs.push({
                  name: job.name,
                  role: job.role,
                  email: '',
                  status: 'no_email',
                  attempts: 0,
                  awarded_mw: job.awarded_mw,
                  amount_nrs: job.amount_nrs,
                  sent_at: '',
                });
              } else {
                logs.push({
                  name: job.name,
                  role: job.role,
                  email: job.email,
                  status: 'sent',
                  attempts: 1,
                  awarded_mw: job.awarded_mw,
                  amount_nrs: job.amount_nrs,
                  sent_at: new Date().toISOString(),
                });
              }
            }
            return res.status(200).json({ success: true, dryRun: false, logs, provider: 'Google Apps Script Batch' });
          }
        }
      } catch (gasErr: any) {
        console.warn('[Dispatch] Google Apps Script bulk batch call failed, falling back to chunked dispatch:', gasErr.message);
      }
    }

    // Fast check: If no HTTP relay is present, probe SMTP port before starting chunked loop
    // to prevent hanging connection and 30s timeout on Render reverse proxy
    const hasHttpRelay = !!(
      scriptUrl ||
      getEnvBrevoKey() ||
      getEnvResendKey() ||
      getEnvSendGridKey() ||
      httpApi?.brevoApiKey ||
      httpApi?.resendApiKey
    );

    if (!hasHttpRelay) {
      const is465Reachable = await checkSmtpReachable(getEnvSmtpHost(), 465, 2000);
      const is587Reachable = is465Reachable ? true : await checkSmtpReachable(getEnvSmtpHost(), 587, 2000);
      if (!is465Reachable && !is587Reachable) {
        return res.status(200).json({
          success: false,
          error:
            "Outbound SMTP connection to smtp.gmail.com:465/587 timed out. Note: On Render free tier services, raw outbound SMTP ports are blocked by Render's firewall. To send 1-click email notifications on Render, please configure Google Apps Script Relay (free via your Gmail) or Brevo API in Email Provider Settings.",
          logs: jobs.map((j) => ({
            name: j.name,
            role: j.role,
            email: j.email || '',
            status: j.email && j.email.includes('@') ? 'failed' : 'no_email',
            attempts: j.email && j.email.includes('@') ? 1 : 0,
            error: "Render free firewall blocks outbound SMTP ports 465/587. Configure Google Apps Script Relay or Brevo in Email Settings.",
            awarded_mw: j.awarded_mw,
            amount_nrs: j.amount_nrs,
            sent_at: '',
          })),
        });
      }
    }

    // Controlled concurrent dispatch using unified dispatcher
    const CONCURRENCY = 2;
    for (let i = 0; i < jobs.length; i += CONCURRENCY) {
      const chunk = jobs.slice(i, i + CONCURRENCY);
      await Promise.all(
        chunk.map(async (job) => {
          if (!job.email || !job.email.includes('@')) {
            logs.push({
              name: job.name,
              role: job.role,
              email: '',
              status: 'no_email',
              attempts: 0,
              awarded_mw: job.awarded_mw,
              amount_nrs: job.amount_nrs,
              sent_at: '',
            });
            return;
          }

          const dispatchResult = await dispatchSingleEmail(
            {
              to: job.email,
              subject: job.subject,
              html: job.html,
              text: job.text,
              name: job.name,
              role: job.role,
            },
            smtpCredentials,
            httpApi
          );

          if (dispatchResult.success) {
            logs.push({
              name: job.name,
              role: job.role,
              email: job.email,
              status: 'sent',
              attempts: 1,
              awarded_mw: job.awarded_mw,
              amount_nrs: job.amount_nrs,
              sent_at: new Date().toISOString(),
            });
          } else {
            logs.push({
              name: job.name,
              role: job.role,
              email: job.email,
              status: 'failed',
              attempts: 1,
              error: dispatchResult.error,
              awarded_mw: job.awarded_mw,
              amount_nrs: job.amount_nrs,
              sent_at: '',
            });
          }
        })
      );
    }

    return res.status(200).json({ success: true, dryRun: false, logs });
  } catch (err: any) {
    console.error('Error in /api/send-emails:', err);
    return res.status(200).json({
      success: false,
      error: err.message || 'Batch email dispatch failed on server',
      logs: [],
    });
  }
});

/**
 * Route to download dynamic standalone HTML
 */
app.get('/api/download-standalone', (req: Request, res: Response) => {
  const sheetId = (req.query.sheetId as string) || '17xtp2EWVr8HhWVp9R9137AauNQv0V6DV5RPPdTEZ5Tg';
  const sheetName = (req.query.sheetName as string) || 'Form Responses 1';
  const formUrl = (req.query.formUrl as string) || 'https://docs.google.com/forms/d/1pnNFvIy_I10zvgq8Bv8zqqCHh9zS9EeNmUMldGiDdZk/viewform';

  const html = generateStandaloneHTML(sheetId, sheetName, formUrl);
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="nepal_electricity_market_standalone.html"');
  res.send(html);
});

// Setup Vite middleware in dev or static files in production
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(Number(PORT), '0.0.0.0', () => {
    console.log(`⚡ Server running at http://0.0.0.0:${PORT} (Port ${PORT})`);
  });
}

startServer();
