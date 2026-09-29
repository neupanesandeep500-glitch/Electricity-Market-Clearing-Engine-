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

// Email credentials
const EMAIL_SENDER = process.env.EMAIL_SENDER || 'neupanesandeep500@gmail.com';
const EMAIL_PASSWORD = process.env.EMAIL_PASSWORD || 'kroe tysm nrlv zomr';

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

/**
 * Batch email notification sender
 */
app.post('/api/send-emails', async (req: Request, res: Response) => {
  const { jobs, dryRun, smtpCredentials } = req.body;

  if (!jobs || !Array.isArray(jobs)) {
    return res.status(400).json({ error: 'jobs array required' });
  }

  const logs: any[] = [];
  const senderEmail = smtpCredentials?.sender || EMAIL_SENDER;
  const senderPass = smtpCredentials?.password || EMAIL_PASSWORD;

  if (dryRun || !senderEmail || !senderPass) {
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
    transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: senderEmail,
        pass: senderPass.replace(/\s+/g, ''),
      },
    });
  } catch (err) {
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
        error: 'SMTP transporter uninitialized',
        awarded_mw: job.awarded_mw,
        amount_nrs: job.amount_nrs,
      });
      continue;
    }

    try {
      await transporter.sendMail({
        from: `"Nepal Electricity Market" <${senderEmail}>`,
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

  app.listen(PORT, () => {
    console.log(`⚡ Server running at http://localhost:${PORT}`);
  });
}

startServer();
