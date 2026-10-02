import express, { Request, Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { generateStandaloneHTML } from './src/engine/standaloneHtmlGenerator';
import {
  sendEmail,
  planProviders,
  verifyProviders,
  getStatus,
  loadMailConfig,
  isValidEmail,
  smtpReachable,
  type MailJob,
} from './server/mailer';
import { requireAdmin, rateLimit, securityHeaders, passcodeRequired } from './server/security';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Render terminates TLS in front of the app; trust it so req.ip is the real client (rate limits, lockouts).
app.set('trust proxy', 1);
app.disable('x-powered-by');
app.use(securityHeaders);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

/** Health endpoint for Render's health check and uptime pings. Reveals no secrets. */
app.get(['/api/health', '/api/ping'], async (_req: Request, res: Response) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  const status = await getStatus();
  res.json({
    status: 'ok',
    uptimeSeconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
    service: 'Nepal Electricity Market Clearing Engine',
    emailReady: status.configured,
  });
});

/** Keep-alive self-ping (stops Render's free tier sleeping while someone is using the app). */
const externalUrl = process.env.RENDER_EXTERNAL_URL || process.env.APP_URL;
if (externalUrl && process.env.KEEP_ALIVE !== 'false') {
  setInterval(async () => {
    try {
      await fetch(`${externalUrl.replace(/\/+$/, '')}/api/health`);
    } catch (err: any) {
      console.warn('[KeepAlive] self-ping failed:', err.message);
    }
  }, 10 * 60 * 1000).unref();
}

/** Google Sheet CSV proxy (avoids browser CORS). */
app.get('/api/fetch-sheet', async (req: Request, res: Response) => {
  const { sheetId, sheetName } = req.query;
  if (!sheetId || typeof sheetId !== 'string' || !/^[A-Za-z0-9_-]{10,120}$/.test(sheetId)) {
    return res.status(400).send('A valid sheetId is required');
  }
  const sName = typeof sheetName === 'string' && sheetName ? sheetName : 'Form Responses 1';
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
      console.warn(`Failed fetching sheet from ${targetUrl}:`, err);
    }
  }
  return res.status(502).send('Failed to retrieve spreadsheet data from Google Sheets');
});

process.on('uncaughtException', (err) => console.error('[Process SafeGuard] uncaughtException:', err));
process.on('unhandledRejection', (reason: any) => console.error('[Process SafeGuard] unhandledRejection:', reason?.stack || reason));

/* ------------------------------------------------------------------ */
/* Email API                                                           */
/* ------------------------------------------------------------------ */

const emailLimiter = rateLimit(240, 10 * 60_000);
const MAX_BATCH = 100;
const MAX_HTML_BYTES = 400_000;

/** Non-sensitive status: what is configured, which route will be used, and whether a passcode is needed. */
app.get('/api/email/status', emailLimiter, async (_req: Request, res: Response) => {
  res.setHeader('Cache-Control', 'no-store');
  res.json({ success: true, ...(await getStatus()), passcodeRequired: passcodeRequired() });
});

/** Checks the passcode only (lets the UI validate it before the first real action). */
app.post('/api/email/auth-check', emailLimiter, requireAdmin, (_req, res) => res.json({ success: true }));

/** Real login test against Gmail / the relay, without emailing anyone. */
const verifyHandler = async (_req: Request, res: Response) => {
  try {
    const c = loadMailConfig();
    await smtpReachable(c.smtpHost, c.smtpPort, true); // refresh network probe
    const result = await verifyProviders();
    res.json({
      success: result.ok,
      message: result.ok ? `Ready. Mail will be sent via: ${result.activeOrder.join(' → ')}.` : undefined,
      error: result.ok ? undefined : [...result.checks.filter((c) => !c.ok).map((c) => `${c.provider}: ${c.detail}`), ...result.notes].join(' ') || 'No provider configured.',
      ...result,
    });
  } catch (err: any) {
    res.json({ success: false, error: err.message || 'Verification failed' });
  }
};
app.post(['/api/email/verify', '/api/verify-email-provider', '/api/verify-smtp'], emailLimiter, requireAdmin, verifyHandler);

/** Sends one test message so the administrator can confirm delivery end-to-end. */
app.post('/api/email/test', emailLimiter, requireAdmin, async (req: Request, res: Response) => {
  const cfg = loadMailConfig();
  const to = String(req.body?.to || cfg.sender || '').trim();
  if (!isValidEmail(to)) return res.json({ success: false, error: 'Enter a valid recipient address for the test email.' });
  const when = new Date().toLocaleString('en-GB', { timeZone: 'Asia/Kathmandu', dateStyle: 'medium', timeStyle: 'medium' });
  const result = await sendEmail({
    to,
    subject: 'Test email - Nepal Electricity Market Clearing Engine',
    text: `This is a test message sent at ${when} (NPT). Email delivery is working.`,
    html: `<div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;padding:24px;border:1px solid #E3E8F0;border-radius:12px">
      <h2 style="color:#1A237E;margin:0 0 8px">⚡ Email delivery is working</h2>
      <p style="color:#455A64;font-size:14px;line-height:1.6;margin:0">This test message from the Nepal Electricity Market Clearing Engine was sent at ${when} (NPT).</p></div>`,
  });
  res.json(result);
});

/** Send one email. */
const singleHandler = async (req: Request, res: Response) => {
  const { to, subject, html, text } = req.body || {};
  if (!isValidEmail(to)) return res.json({ success: false, error: 'A valid recipient email is required.' });
  if (typeof subject !== 'string' || typeof html !== 'string' || html.length > MAX_HTML_BYTES) {
    return res.json({ success: false, error: 'Invalid subject or message body.' });
  }
  const result = await sendEmail({ to, subject, html, text: typeof text === 'string' ? text : '' });
  res.json(result);
};
app.post(['/api/email/send', '/api/send-single-email'], emailLimiter, requireAdmin, singleHandler);

/** Send many emails (one per participant), 3 at a time, reporting a result per participant. */
const batchHandler = async (req: Request, res: Response) => {
  const { jobs, dryRun } = req.body || {};
  if (!Array.isArray(jobs)) return res.json({ success: false, error: 'jobs array required', logs: [] });
  if (jobs.length > MAX_BATCH) return res.json({ success: false, error: `At most ${MAX_BATCH} emails per request.`, logs: [] });

  const logs: any[] = new Array(jobs.length);
  const base = (j: any) => ({ name: j.name, role: j.role, email: j.email || '', awarded_mw: j.awarded_mw ?? 0, amount_nrs: j.amount_nrs ?? 0 });

  const plan = dryRun ? { order: [], notes: [] } : await planProviders();
  let next = 0;
  const worker = async () => {
    while (true) {
      const i = next++;
      if (i >= jobs.length) return;
      const j = jobs[i] || {};
      if (!isValidEmail(j.email)) {
        logs[i] = { ...base(j), status: 'no_email', attempts: 0, sent_at: '' };
        continue;
      }
      if (dryRun) {
        logs[i] = { ...base(j), status: 'dry_run', attempts: 0, sent_at: new Date().toISOString() };
        continue;
      }
      if (typeof j.subject !== 'string' || typeof j.html !== 'string' || j.html.length > MAX_HTML_BYTES) {
        logs[i] = { ...base(j), status: 'failed', attempts: 0, error: 'Invalid message content.', sent_at: '' };
        continue;
      }
      const job: MailJob = { to: j.email, subject: j.subject, html: j.html, text: j.text || '' };
      const r = await sendEmail(job, plan);
      logs[i] = r.success
        ? { ...base(j), status: 'sent', attempts: r.attempts, provider: r.providerUsed, sent_at: new Date().toISOString() }
        : { ...base(j), status: 'failed', attempts: r.attempts, error: r.error, sent_at: '' };
    }
  };
  await Promise.all(Array.from({ length: Math.min(3, jobs.length) }, worker));
  res.json({ success: true, dryRun: !!dryRun, logs });
};
app.post(['/api/email/batch', '/api/send-emails'], emailLimiter, requireAdmin, batchHandler);

/* ------------------------------------------------------------------ */

app.get('/api/download-standalone', (req: Request, res: Response) => {
  const clean = (v: unknown, fallback: string) => (typeof v === 'string' && v ? v.replace(/[^\w\s:/.?=&%#@+\-]/g, '') : fallback);
  const sheetId = clean(req.query.sheetId, '17xtp2EWVr8HhWVp9R9137AauNQv0V6DV5RPPdTEZ5Tg');
  const sheetName = clean(req.query.sheetName, 'Form Responses 1');
  const formUrl = clean(
    req.query.formUrl,
    'https://docs.google.com/forms/d/1pnNFvIy_I10zvgq8Bv8zqqCHh9zS9EeNmUMldGiDdZk/viewform'
  );
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="nepal_electricity_market_standalone.html"');
  res.send(generateStandaloneHTML(sheetId, sheetName, formUrl));
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: 'spa' });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(Number(PORT), '0.0.0.0', async () => {
    console.log(`⚡ Server running on port ${PORT} (${process.env.NODE_ENV || 'development'})`);
    // Tell the operator right away whether email will work, instead of discovering it at dispatch time.
    const s = await getStatus();
    if (s.configured) console.log(`[mail] Ready. Route: ${s.activeProviders.join(' -> ')} | sender ${s.sender}`);
    else console.warn(`[mail] NOT ready. ${[...s.problems, ...s.notes].join(' ') || 'No provider configured.'}`);
    if (passcodeRequired() && !process.env.ADMIN_PASSCODE) console.warn('[security] ADMIN_PASSCODE is not set - email sending is disabled until it is.');
  });
}

startServer();
