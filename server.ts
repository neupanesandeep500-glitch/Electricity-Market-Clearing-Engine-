import express, { Request, Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
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

// Email credentials (tested and verified with smtp.gmail.com)
const EMAIL_SENDER = process.env.EMAIL_SENDER || 'neupanesandeep500@gmail.com';
const EMAIL_PASSWORD = process.env.EMAIL_PASSWORD || 'kroetysmnrlvzomr';
const DEFAULT_REPLY_TO = process.env.EMAIL_REPLY_TO || '080mspse021.sandeep@pcampus.edu.np';

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
    hasBrevoKey: !!process.env.BREVO_API_KEY,
    hasResendKey: !!process.env.RESEND_API_KEY,
    hasGoogleScriptUrl: !!(process.env.GOOGLE_APPS_SCRIPT_URL || process.env.EMAIL_RELAY_URL),
    smtpConfigured: !!(EMAIL_SENDER && EMAIL_PASSWORD),
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

// Pooled transporter cache for high performance & connection reuse across Render/Cloud instances
const transporterPool = new Map<string, Transporter>();

function withTimeout<T>(promise: Promise<T>, ms: number, errMsg: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(errMsg)), ms)),
  ]);
}

function getMailTransporter(user: string, pass: string, port = 465, secure = true): Transporter {
  const cleanPass = pass.replace(/\s+/g, '');
  const key = `${user}:${cleanPass}:${port}`;

  if (transporterPool.has(key)) {
    return transporterPool.get(key)!;
  }

  // Fast timeout settings so Render proxy never terminates the connection
  const tp = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port,
    secure,
    auth: { user, pass: cleanPass },
    pool: true,
    maxConnections: 3,
    maxMessages: 100,
    rateLimit: 5,
    connectionTimeout: 3500,
    greetingTimeout: 3500,
    socketTimeout: 5000,
    tls: {
      rejectUnauthorized: false,
    },
  });

  transporterPool.set(key, tp);
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
 * Robust email sender with primary Port 465 (SSL) and fallback to Port 587 (STARTTLS)
 * Strictly bounded by 2.5s per attempt to guarantee fast response on cloud hosts
 */
async function sendMailWithFallback(
  user: string,
  pass: string,
  mailOptions: SendMailOptions
): Promise<SentMessageInfo> {
  const cleanPass = pass.replace(/\s+/g, '');

  try {
    // Primary: Port 465 (Direct SSL / TLS) with strict 2.5s timeout
    const tp465 = getMailTransporter(user, cleanPass, 465, true);
    return await withTimeout(
      tp465.sendMail(mailOptions),
      2500,
      'Port 465 connection timed out (Render blocks outbound SMTP ports 25, 465, 587 on free tier)'
    );
  } catch (err465: any) {
    console.warn(`[SMTP] Port 465 failed (${err465.message}), attempting fallback to Port 587...`);
    try {
      // Fallback: Port 587 (STARTTLS) with strict 2.5s timeout
      const tp587 = getMailTransporter(user, cleanPass, 587, false);
      return await withTimeout(
        tp587.sendMail(mailOptions),
        2500,
        'Port 587 connection timed out (Render blocks outbound SMTP ports 25, 465, 587 on free tier)'
      );
    } catch (err587: any) {
      console.error('[SMTP] Both Port 465 and Port 587 failed:', err587.message);
      throw new Error(
        'Render Free Tier blocks outbound SMTP ports (465/587). Please configure Google Apps Script Relay or Brevo/Resend HTTP API in Email Settings.'
      );
    }
  }
}

/**
 * Unified Dispatcher: Dispatches single email through the best available provider
 * Priority: Google Apps Script Web App -> Brevo HTTP -> Resend HTTP -> Direct SMTP
 */
async function dispatchSingleEmail(
  job: { to: string; subject: string; html: string; text: string; name?: string; role?: string },
  smtpCredentials?: { sender?: string; password?: string },
  httpApi?: { googleAppsScriptUrl?: string; brevoApiKey?: string; resendApiKey?: string }
): Promise<{ success: boolean; messageId?: string; error?: string; providerUsed: string }> {
  // 1. Google Apps Script Web App (HTTPS Port 443 - zero block, uses own Gmail)
  const scriptUrl = httpApi?.googleAppsScriptUrl || process.env.GOOGLE_APPS_SCRIPT_URL || process.env.EMAIL_RELAY_URL;
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
  const brevoKey = httpApi?.brevoApiKey || process.env.BREVO_API_KEY;
  if (brevoKey && brevoKey.trim().length > 10) {
    const senderEmail = smtpCredentials?.sender || EMAIL_SENDER;
    const res = await sendViaBrevoHttp(brevoKey, senderEmail, job.to, job.subject, job.html, job.text);
    if (res.success) {
      return { success: true, messageId: res.messageId, providerUsed: 'Brevo HTTP API (HTTPS)' };
    }
    console.warn('[Dispatch] Brevo API failed, trying next provider:', res.error);
  }

  // 3. Resend HTTP API (HTTPS Port 443 - 100 free emails/day)
  const resendKey = httpApi?.resendApiKey || process.env.RESEND_API_KEY;
  if (resendKey && resendKey.trim().length > 10) {
    const res = await sendViaResendHttp(resendKey, job.to, job.subject, job.html, job.text);
    if (res.success) {
      return { success: true, messageId: res.messageId, providerUsed: 'Resend HTTP API (HTTPS)' };
    }
    console.warn('[Dispatch] Resend API failed, trying next provider:', res.error);
  }

  // 4. Direct Gmail SMTP (Ports 465/587 - Works on Render Paid / VPS / Local)
  const senderEmail = smtpCredentials?.sender || EMAIL_SENDER;
  const senderPass = smtpCredentials?.password ? smtpCredentials.password.replace(/\s+/g, '') : EMAIL_PASSWORD.replace(/\s+/g, '');

  try {
    const info = await sendMailWithFallback(senderEmail, senderPass, {
      from: `"Nepal Electricity Market Clearing Engine" <${senderEmail}>`,
      replyTo: DEFAULT_REPLY_TO,
      to: job.to,
      subject: job.subject,
      text: job.text,
      html: job.html,
    });
    return { success: true, messageId: info.messageId, providerUsed: 'Gmail SMTP (Port 465/587)' };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || 'SMTP delivery failed. Render Free Plan blocks raw SMTP. Please configure Google Apps Script or Brevo in Email Settings.',
      providerUsed: 'None (SMTP Blocked)',
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
  const user = sender || EMAIL_SENDER;
  const pass = password ? password.replace(/\s+/g, '') : EMAIL_PASSWORD.replace(/\s+/g, '');

  try {
    let tp = getMailTransporter(user, pass, 465, true);
    try {
      await withTimeout(tp.verify(), 2500, 'Port 465 verify timed out');
    } catch {
      tp = getMailTransporter(user, pass, 587, false);
      await withTimeout(tp.verify(), 2500, 'Port 587 verify timed out');
    }
    return res.json({ success: true, message: `SMTP connection to Gmail verified successfully for ${user}!` });
  } catch (err: any) {
    console.error('SMTP verify error:', err.message);
    return res.json({
      success: false,
      error: `Notice: ${err.message || String(err)}. Note: Render Free Plan blocks direct SMTP ports (465/587). Please use Google Apps Script Relay or Brevo HTTP API for guaranteed delivery.`,
    });
  }
});

/**
 * Send single individual email notification
 */
app.post('/api/send-single-email', async (req: Request, res: Response) => {
  const { to, subject, html, text, smtpCredentials, httpApi } = req.body || {};
  if (!to || !to.includes('@')) {
    return res.json({ success: false, error: 'Valid recipient email required' });
  }

  const result = await dispatchSingleEmail(
    { to, subject, html, text },
    smtpCredentials,
    httpApi
  );

  return res.json(result);
});

/**
 * Batch email notification sender with multi-provider dispatch & parallel concurrency
 */
app.post('/api/send-emails', async (req: Request, res: Response) => {
  const { jobs, dryRun, smtpCredentials, httpApi } = req.body || {};

  if (!jobs || !Array.isArray(jobs)) {
    return res.json({ success: false, error: 'jobs array required', logs: [] });
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
    return res.json({ success: true, dryRun: true, logs });
  }

  // Check if Google Apps Script URL supports bulk batch dispatch in a single call
  const scriptUrl = httpApi?.googleAppsScriptUrl || process.env.GOOGLE_APPS_SCRIPT_URL || process.env.EMAIL_RELAY_URL;
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
          return res.json({ success: true, dryRun: false, logs, provider: 'Google Apps Script Batch' });
        }
      }
    } catch (gasErr: any) {
      console.warn('[Dispatch] Google Apps Script bulk batch call failed, falling back to chunked dispatch:', gasErr.message);
    }
  }

  // Parallel chunked dispatch using unified dispatcher
  const CONCURRENCY = 4;
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

  return res.json({ success: true, dryRun: false, logs });
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
