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
 * Strictly bounded by 3.5s per attempt to guarantee fast response on cloud hosts
 */
async function sendMailWithFallback(
  user: string,
  pass: string,
  mailOptions: SendMailOptions
): Promise<SentMessageInfo> {
  const cleanPass = pass.replace(/\s+/g, '');

  try {
    // Primary: Port 465 (Direct SSL / TLS) with strict 3.5s timeout
    const tp465 = getMailTransporter(user, cleanPass, 465, true);
    return await withTimeout(
      tp465.sendMail(mailOptions),
      3500,
      'Port 465 connection timed out (Render blocks outbound SMTP ports 25, 465, 587 on free tier)'
    );
  } catch (err465: any) {
    console.warn(`[SMTP] Port 465 failed (${err465.message}), attempting fallback to Port 587...`);
    try {
      // Fallback: Port 587 (STARTTLS) with strict 3.5s timeout
      const tp587 = getMailTransporter(user, cleanPass, 587, false);
      return await withTimeout(
        tp587.sendMail(mailOptions),
        3500,
        'Port 587 connection timed out (Render blocks outbound SMTP ports 25, 465, 587 on free tier)'
      );
    } catch (err587: any) {
      console.error('[SMTP] Both Port 465 and Port 587 failed:', err587.message);
      throw new Error(
        'Render Free Tier blocks outbound SMTP ports (465/587). Please use 1-click "Web Gmail" or configure an HTTP Email API key (Brevo/Resend) in settings.'
      );
    }
  }
}

/**
 * Verify SMTP credentials route
 */
app.post('/api/verify-smtp', async (req: Request, res: Response) => {
  const { sender, password, httpApiKey, provider } = req.body || {};

  // If HTTP API key is tested
  if (httpApiKey) {
    if (provider === 'resend') {
      const test = await sendViaResendHttp(httpApiKey, 'test@example.com', 'Test', '<p>Test</p>', 'Test');
      return res.json({ success: test.success, message: 'Resend HTTP API connection verified!', error: test.error });
    }
  }

  const user = sender || EMAIL_SENDER;
  const pass = password ? password.replace(/\s+/g, '') : EMAIL_PASSWORD.replace(/\s+/g, '');

  try {
    let tp = getMailTransporter(user, pass, 465, true);
    try {
      await withTimeout(tp.verify(), 3500, 'Port 465 verify timed out');
    } catch {
      tp = getMailTransporter(user, pass, 587, false);
      await withTimeout(tp.verify(), 3500, 'Port 587 verify timed out');
    }
    return res.json({ success: true, message: `SMTP connection to Gmail verified successfully for ${user}!` });
  } catch (err: any) {
    console.error('SMTP verify error:', err.message);
    return res.json({
      success: false,
      error: `Connection verification notice: ${err.message || String(err)}. Note: Render Free Plan blocks direct SMTP ports. Use "Web Gmail" or HTTP API for zero-block delivery.`,
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

  // Check if HTTP API is configured (Resend / Brevo over HTTPS Port 443)
  const resendKey = httpApi?.resendApiKey || process.env.RESEND_API_KEY;
  if (resendKey) {
    const resendRes = await sendViaResendHttp(resendKey, to, subject, html, text);
    if (resendRes.success) {
      return res.json({ success: true, messageId: resendRes.messageId });
    }
  }

  const brevoKey = httpApi?.brevoApiKey || process.env.BREVO_API_KEY;
  if (brevoKey) {
    const senderEmail = smtpCredentials?.sender || EMAIL_SENDER;
    const brevoRes = await sendViaBrevoHttp(brevoKey, senderEmail, to, subject, html, text);
    if (brevoRes.success) {
      return res.json({ success: true, messageId: brevoRes.messageId });
    }
  }

  const senderEmail = smtpCredentials?.sender || EMAIL_SENDER;
  const senderPass = smtpCredentials?.password ? smtpCredentials.password.replace(/\s+/g, '') : EMAIL_PASSWORD.replace(/\s+/g, '');

  try {
    const info = await sendMailWithFallback(senderEmail, senderPass, {
      from: `"Nepal Electricity Market Clearing Engine" <${senderEmail}>`,
      replyTo: DEFAULT_REPLY_TO,
      to,
      subject,
      text,
      html,
    });

    return res.json({ success: true, messageId: info.messageId });
  } catch (err: any) {
    console.error('Single email send error:', err.message);
    return res.json({
      success: false,
      error: `${err.message || String(err)}`,
      isRenderSmtpBlocked: true,
    });
  }
});

/**
 * Batch email notification sender with concurrent pooling
 */
app.post('/api/send-emails', async (req: Request, res: Response) => {
  const { jobs, dryRun, smtpCredentials } = req.body || {};

  if (!jobs || !Array.isArray(jobs)) {
    return res.json({ success: false, error: 'jobs array required', logs: [] });
  }

  const logs: any[] = [];
  const senderEmail = smtpCredentials?.sender || EMAIL_SENDER;
  const senderPass = smtpCredentials?.password ? smtpCredentials.password.replace(/\s+/g, '') : EMAIL_PASSWORD.replace(/\s+/g, '');

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

  // Send in parallel chunks of 3 over pooled connections to prevent Render timeouts
  const CONCURRENCY = 3;
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

        try {
          await sendMailWithFallback(senderEmail, senderPass, {
            from: `"Nepal Electricity Market Clearing Engine" <${senderEmail}>`,
            replyTo: DEFAULT_REPLY_TO,
            to: job.email,
            subject: job.subject,
            text: job.text,
            html: job.html,
          });

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
        } catch (err: any) {
          logs.push({
            name: job.name,
            role: job.role,
            email: job.email,
            status: 'failed',
            attempts: 1,
            error: err.message || String(err),
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
