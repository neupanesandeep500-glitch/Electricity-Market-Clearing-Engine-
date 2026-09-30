import express, { Request, Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import nodemailer, { Transporter } from 'nodemailer';
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

function getMailTransporter(user: string, pass: string): Transporter {
  // Use service: 'gmail' for optimal compatibility on cloud environments (Render, GCP, AWS)
  return nodemailer.createTransport({
    service: 'gmail',
    auth: { user, pass },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
    tls: { rejectUnauthorized: false },
  });
}

/**
 * Verify SMTP credentials route
 */
app.post('/api/verify-smtp', async (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  const { sender, password } = req.body || {};
  const user = sender || EMAIL_SENDER;
  const pass = password ? password.replace(/\s+/g, '') : EMAIL_PASSWORD.replace(/\s+/g, '');

  try {
    const tp = getMailTransporter(user, pass);
    await tp.verify();
    return res.json({ success: true, message: `SMTP connection to Gmail verified successfully for ${user}!` });
  } catch (err: any) {
    console.error('SMTP verify error:', err.message);
    return res.json({
      success: false,
      error: `SMTP verification failed: ${err.message || String(err)}. Check App Password or use direct "Open in Mail Client".`,
    });
  }
});

/**
 * Send single individual email notification
 */
app.post('/api/send-single-email', async (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  const { to, subject, html, text, smtpCredentials } = req.body || {};
  if (!to || !to.includes('@')) {
    return res.json({ success: false, error: 'Valid recipient email required' });
  }

  const senderEmail = smtpCredentials?.sender || EMAIL_SENDER;
  const senderPass = smtpCredentials?.password ? smtpCredentials.password.replace(/\s+/g, '') : EMAIL_PASSWORD.replace(/\s+/g, '');

  try {
    const tp = getMailTransporter(senderEmail, senderPass);

    const info = await tp.sendMail({
      from: `"Nepal Electricity Market Clearing Engine" <${senderEmail}>`,
      replyTo: DEFAULT_REPLY_TO,
      to,
      subject,
      text,
      html,
    });

    return res.json({ success: true, messageId: info.messageId });
  } catch (err: any) {
    console.error('Single email send error:', err);
    return res.json({
      success: false,
      error: `Email delivery issue: ${err.message || String(err)}. You can click "Open in Mail Client" to send instantly via Gmail/Outlook.`,
    });
  }
});

/**
 * Batch email notification sender
 */
app.post('/api/send-emails', async (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
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

  // Live SMTP sending
  let transporter: Transporter | null = null;
  try {
    transporter = getMailTransporter(senderEmail, senderPass);
  } catch (err: any) {
    console.error('SMTP Transport creation failed:', err);
  }

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
      continue;
    }

    if (!transporter) {
      logs.push({
        name: job.name,
        role: job.role,
        email: job.email,
        status: 'failed',
        attempts: 1,
        error: 'SMTP transporter uninitialized. Check App Password or use "Open in Mail Client".',
        awarded_mw: job.awarded_mw,
        amount_nrs: job.amount_nrs,
      });
      continue;
    }

    try {
      await transporter.sendMail({
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

      // Small pause to be gentle on SMTP quota
      await new Promise((resolve) => setTimeout(resolve, 200));
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
