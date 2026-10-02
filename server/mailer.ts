/**
 * Server-side mail delivery.
 *
 * All credentials come from environment variables. Nothing sensitive is ever read from
 * (or sent by) the browser, so the app password never appears in the client bundle,
 * localStorage or network requests.
 *
 *   EMAIL_SENDER         Gmail address that sends the mail
 *   EMAIL_APP_PASSWORD   16-character Google App Password (spaces are ignored)
 *   EMAIL_FROM_NAME      Optional display name
 *   EMAIL_REPLY_TO       Optional Reply-To address
 *
 * Optional HTTPS fallbacks (needed on Render's free plan, which blocks SMTP ports):
 *   GOOGLE_APPS_SCRIPT_URL + GAS_SHARED_SECRET, BREVO_API_KEY, RESEND_API_KEY
 */
import net from 'net';
import nodemailer, { Transporter } from 'nodemailer';

export type ProviderId = 'smtp' | 'google_script' | 'brevo' | 'resend';

export interface MailJob {
  to: string;
  subject: string;
  html: string;
  text: string;
  name?: string;
}

export interface SendResult {
  success: boolean;
  messageId?: string;
  error?: string;
  providerUsed?: string;
  attempts: number;
}

export interface MailConfig {
  sender: string;
  appPassword: string;
  fromName: string;
  replyTo: string;
  smtpHost: string;
  smtpPort: number;
  forcedProvider: 'auto' | ProviderId;
  gasUrl: string;
  gasSecret: string;
  brevoKey: string;
  resendKey: string;
  resendFrom: string;
  dailyLimit: number;
}

const EMAIL_RE = /^[^\s@<>"',;]+@[^\s@<>"',;]+\.[^\s@<>"',;]{2,}$/;

export function isValidEmail(value: unknown): value is string {
  return typeof value === 'string' && value.length <= 254 && EMAIL_RE.test(value.trim());
}

/** Reads env on every call so tests (and Render env edits + restart) always see current values. */
export function loadMailConfig(env: NodeJS.ProcessEnv = process.env): MailConfig {
  const pick = (...keys: string[]) => {
    for (const k of keys) {
      const v = env[k];
      if (v && v.trim()) return v.trim();
    }
    return '';
  };
  const forced = pick('EMAIL_PROVIDER').toLowerCase();
  const valid: Array<MailConfig['forcedProvider']> = ['auto', 'smtp', 'google_script', 'brevo', 'resend'];
  return {
    sender: pick('EMAIL_SENDER', 'EMAIL_USER', 'GMAIL_USER'),
    // Gmail displays app passwords as four groups of four letters; strip any whitespace.
    appPassword: pick('EMAIL_APP_PASSWORD', 'EMAIL_PASSWORD', 'GMAIL_APP_PASSWORD').replace(/\s+/g, ''),
    fromName: pick('EMAIL_FROM_NAME') || 'Nepal Electricity Market Clearing Engine',
    replyTo: pick('EMAIL_REPLY_TO'),
    smtpHost: pick('SMTP_HOST') || 'smtp.gmail.com',
    smtpPort: Number(pick('SMTP_PORT')) || 465,
    forcedProvider: (valid.includes(forced as any) ? forced : 'auto') as MailConfig['forcedProvider'],
    gasUrl: pick('GOOGLE_APPS_SCRIPT_URL', 'EMAIL_RELAY_URL'),
    gasSecret: pick('GAS_SHARED_SECRET'),
    brevoKey: pick('BREVO_API_KEY'),
    resendKey: pick('RESEND_API_KEY'),
    resendFrom: pick('RESEND_FROM') || 'onboarding@resend.dev',
    dailyLimit: Number(pick('EMAIL_DAILY_LIMIT')) || 450, // Gmail allows ~500/day for personal accounts
  };
}

/** Human-readable problems with the credentials, or [] when they look right. */
export function validateCredentials(cfg: MailConfig): string[] {
  const problems: string[] = [];
  if (!cfg.sender) problems.push('EMAIL_SENDER is not set.');
  else if (!isValidEmail(cfg.sender)) problems.push('EMAIL_SENDER is not a valid email address.');
  if (!cfg.appPassword) problems.push('EMAIL_APP_PASSWORD is not set.');
  else if (!/^[a-z]{16}$/i.test(cfg.appPassword)) {
    problems.push(
      `EMAIL_APP_PASSWORD must be exactly 16 letters (it is ${cfg.appPassword.length} characters). ` +
        'Use a Google App Password, not your normal Gmail password.'
    );
  }
  return problems;
}

export function maskEmail(email: string): string {
  const [user, domain] = email.split('@');
  if (!user || !domain) return '';
  return `${user.slice(0, 2)}${'*'.repeat(Math.max(1, user.length - 2))}@${domain}`;
}

/* ------------------------------------------------------------------ */
/* Network probe: is outbound SMTP reachable from this host?           */
/* ------------------------------------------------------------------ */

let probeCache: { at: number; host: string; port: number; reachable: boolean; detail: string } | null = null;

export function probeSmtp(host: string, port = 465, timeoutMs = 5000): Promise<{ reachable: boolean; detail: string }> {
  return new Promise((resolve) => {
    const socket = net.connect({ host, port, family: 4 });
    const done = (reachable: boolean, detail: string) => {
      socket.destroy();
      resolve({ reachable, detail });
    };
    socket.setTimeout(timeoutMs, () => done(false, `Connection to ${host}:${port} timed out after ${timeoutMs / 1000}s`));
    socket.once('connect', () => done(true, `Connected to ${host}:${port}`));
    socket.once('error', (e: NodeJS.ErrnoException) => done(false, `${e.code || 'ERROR'}: ${e.message}`));
  });
}

export async function smtpReachable(host: string, port = 465, force = false): Promise<{ reachable: boolean; detail: string }> {
  if (!force && probeCache && probeCache.host === host && probeCache.port === port && Date.now() - probeCache.at < 5 * 60_000) {
    return { reachable: probeCache.reachable, detail: probeCache.detail };
  }
  const r = await probeSmtp(host, port);
  probeCache = { at: Date.now(), host, port, ...r };
  return r;
}

/* ------------------------------------------------------------------ */
/* Daily usage counter (resets at midnight Nepal time)                 */
/* ------------------------------------------------------------------ */

let usage = { day: '', count: 0 };
const nptDay = () => new Date(Date.now() + 5.75 * 3600_000).toISOString().slice(0, 10);

export function getUsage(cfg = loadMailConfig()) {
  if (usage.day !== nptDay()) usage = { day: nptDay(), count: 0 };
  return { sentToday: usage.count, dailyLimit: cfg.dailyLimit, remaining: Math.max(0, cfg.dailyLimit - usage.count) };
}
function recordSent() {
  getUsage();
  usage.count++;
}

/* ------------------------------------------------------------------ */
/* Providers                                                           */
/* ------------------------------------------------------------------ */

let smtpTransport: { key: string; tp: Transporter } | null = null;

function getSmtpTransport(cfg: MailConfig): Transporter {
  const key = `${cfg.smtpHost}|${cfg.smtpPort}|${cfg.sender}|${cfg.appPassword}`;
  if (smtpTransport && smtpTransport.key === key) return smtpTransport.tp;
  smtpTransport?.tp.close();
  const tp = nodemailer.createTransport({
    host: cfg.smtpHost,
    port: cfg.smtpPort,
    secure: cfg.smtpPort === 465, // 465 = implicit TLS; anything else negotiates STARTTLS when offered
    auth: { user: cfg.sender, pass: cfg.appPassword },
    pool: true,
    maxConnections: 3,
    maxMessages: 100,
    // Real-world Gmail handshakes (TLS + AUTH) routinely take several seconds from cloud hosts.
    connectionTimeout: 15_000,
    greetingTimeout: 15_000,
    socketTimeout: 30_000,
    dnsTimeout: 10_000,
    // Some hosts resolve smtp.gmail.com to IPv6 first and then cannot route it.
    family: 4,
  } as any);
  tp.on('error', (err) => console.warn('[mail] SMTP transport notice:', (err as Error)?.message || err));
  smtpTransport = { key, tp };
  return tp;
}

/** Turn low-level errors into messages an administrator can act on. */
export function explainSmtpError(err: any, cfg = loadMailConfig()): string {
  const code = err?.code as string | undefined;
  const response = String(err?.response || err?.message || err);
  if (code === 'EAUTH' || /535|Username and Password not accepted|BadCredentials/i.test(response)) {
    return (
      `Gmail rejected the login for ${cfg.sender || 'EMAIL_SENDER'}. Check that (1) 2-Step Verification is on for that account, ` +
      '(2) EMAIL_APP_PASSWORD is a freshly generated 16-letter App Password for this same account, and (3) it has not been revoked.'
    );
  }
  if (code === 'ETIMEDOUT' || code === 'ECONNECTION' || code === 'ESOCKET' || code === 'ENETUNREACH' || code === 'ECONNREFUSED' || /timed? ?out/i.test(response)) {
    return (
      `Could not reach ${cfg.smtpHost}:${cfg.smtpPort} (${code || 'timeout'}). Outbound SMTP is blocked on Render's Free plan - ` +
      'upgrade the service to a paid instance, or set GOOGLE_APPS_SCRIPT_URL (free, uses HTTPS) as the delivery route.'
    );
  }
  if (code === 'EENVELOPE' || /recipient|invalid.*address|550|553/i.test(response)) {
    return `The recipient address was rejected by the mail server: ${response.slice(0, 160)}`;
  }
  if (/daily user sending limit|550 5\.4\.5|quota/i.test(response)) {
    return 'Gmail daily sending limit reached. Try again tomorrow or reduce the number of recipients.';
  }
  return response.slice(0, 220);
}

const isTransient = (err: any) =>
  ['ETIMEDOUT', 'ECONNRESET', 'ESOCKET', 'ECONNECTION', 'EDNS'].includes(err?.code) || /^4\d\d/.test(String(err?.responseCode || ''));

async function sendViaSmtp(cfg: MailConfig, job: MailJob): Promise<{ messageId?: string }> {
  const tp = getSmtpTransport(cfg);
  const info = await tp.sendMail({
    from: { name: cfg.fromName, address: cfg.sender },
    replyTo: cfg.replyTo || undefined,
    to: job.to.trim(),
    subject: job.subject.replace(/[\r\n]+/g, ' ').slice(0, 250),
    text: job.text,
    html: job.html,
  });
  return { messageId: info.messageId };
}

async function postJson(url: string, init: RequestInit, timeoutMs = 25_000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}

export async function sendViaAppsScript(
  cfg: MailConfig,
  payload: Record<string, unknown>
): Promise<{ ok: boolean; data?: any; error?: string }> {
  try {
    const res = await postJson(cfg.gasUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' }, // avoids a CORS-style preflight on Apps Script
      body: JSON.stringify({ ...payload, secret: cfg.gasSecret || undefined }),
      redirect: 'follow',
    }, 60_000);
    const text = await res.text();
    let data: any;
    try {
      data = JSON.parse(text);
    } catch {
      return { ok: false, error: `Apps Script did not return JSON (HTTP ${res.status}). Re-deploy the script as a Web app with access "Anyone".` };
    }
    if (data?.success === false) return { ok: false, data, error: data.error || 'Apps Script reported an error' };
    return { ok: res.ok, data, error: res.ok ? undefined : `HTTP ${res.status}` };
  } catch (e: any) {
    return { ok: false, error: e?.name === 'AbortError' ? 'Apps Script request timed out' : e?.message || 'Apps Script request failed' };
  }
}

async function sendViaBrevo(cfg: MailConfig, job: MailJob): Promise<{ messageId?: string }> {
  const res = await postJson('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'api-key': cfg.brevoKey, 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      sender: { name: cfg.fromName, email: cfg.sender },
      to: [{ email: job.to.trim() }],
      replyTo: cfg.replyTo ? { email: cfg.replyTo } : undefined,
      subject: job.subject,
      htmlContent: job.html,
      textContent: job.text,
    }),
  });
  const data: any = await res.json().catch(() => ({}));
  if (!res.ok || !data.messageId) throw new Error(data?.message || `Brevo API error (HTTP ${res.status})`);
  return { messageId: data.messageId };
}

async function sendViaResend(cfg: MailConfig, job: MailJob): Promise<{ messageId?: string }> {
  const res = await postJson('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${cfg.resendKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: `${cfg.fromName} <${cfg.resendFrom}>`,
      to: [job.to.trim()],
      reply_to: cfg.replyTo || undefined,
      subject: job.subject,
      html: job.html,
      text: job.text,
    }),
  });
  const data: any = await res.json().catch(() => ({}));
  if (!res.ok || !data.id) throw new Error(data?.message || `Resend API error (HTTP ${res.status})`);
  return { messageId: data.id };
}

/* ------------------------------------------------------------------ */
/* Provider selection and unified dispatch                             */
/* ------------------------------------------------------------------ */

export interface ProviderPlan {
  order: ProviderId[];
  notes: string[];
}

/** Decide which providers to try, and in what order, from configuration + network reachability. */
export async function planProviders(cfg = loadMailConfig()): Promise<ProviderPlan> {
  const notes: string[] = [];
  const configured: Record<ProviderId, boolean> = {
    smtp: validateCredentials(cfg).length === 0,
    google_script: cfg.gasUrl.length > 10,
    brevo: cfg.brevoKey.length > 10 && isValidEmail(cfg.sender),
    resend: cfg.resendKey.length > 10,
  };

  if (cfg.forcedProvider !== 'auto') {
    if (!configured[cfg.forcedProvider]) notes.push(`EMAIL_PROVIDER=${cfg.forcedProvider} is set but its settings are incomplete.`);
    return { order: configured[cfg.forcedProvider] ? [cfg.forcedProvider] : [], notes };
  }

  const order: ProviderId[] = [];
  if (configured.smtp) {
    const probe = await smtpReachable(cfg.smtpHost, cfg.smtpPort);
    if (probe.reachable) order.push('smtp');
    else notes.push(`Direct Gmail SMTP skipped: ${probe.detail}. Outbound SMTP is blocked on Render's Free plan.`);
  }
  for (const id of ['google_script', 'brevo', 'resend'] as const) if (configured[id]) order.push(id);
  return { order, notes };
}

const LABEL: Record<ProviderId, string> = {
  smtp: 'Gmail SMTP (App Password)',
  google_script: 'Google Apps Script relay (HTTPS)',
  brevo: 'Brevo API (HTTPS)',
  resend: 'Resend API (HTTPS)',
};
export const providerLabel = (id: ProviderId) => LABEL[id];

async function sendOnce(id: ProviderId, cfg: MailConfig, job: MailJob): Promise<{ messageId?: string }> {
  switch (id) {
    case 'smtp':
      return sendViaSmtp(cfg, job);
    case 'google_script': {
      const r = await sendViaAppsScript(cfg, { action: 'send', to: job.to, subject: job.subject, html: job.html, text: job.text });
      if (!r.ok) throw new Error(r.error || 'Apps Script send failed');
      return { messageId: r.data?.messageId || `gas-${Date.now()}` };
    }
    case 'brevo':
      return sendViaBrevo(cfg, job);
    case 'resend':
      return sendViaResend(cfg, job);
  }
}

/**
 * Send one email through the first provider that works. Transient failures are retried
 * with backoff; a hard failure (e.g. wrong password) moves on to the next provider.
 */
export async function sendEmail(job: MailJob, plan?: ProviderPlan): Promise<SendResult> {
  const cfg = loadMailConfig();
  if (!isValidEmail(job.to)) return { success: false, error: 'Invalid recipient email address.', attempts: 0 };

  const usage = getUsage(cfg);
  if (usage.remaining <= 0) {
    return { success: false, error: `Daily sending limit (${cfg.dailyLimit}) reached; resets at midnight Nepal time.`, attempts: 0 };
  }

  const p = plan || (await planProviders(cfg));
  if (p.order.length === 0) {
    const why = validateCredentials(cfg);
    return {
      success: false,
      attempts: 0,
      error:
        'No email provider is available. ' +
        [...why, ...p.notes].join(' ') +
        (why.length === 0 && p.notes.length === 0 ? 'Set EMAIL_SENDER and EMAIL_APP_PASSWORD (and GOOGLE_APPS_SCRIPT_URL on the Free plan).' : ''),
    };
  }

  let attempts = 0;
  const errors: string[] = [];
  for (const id of p.order) {
    for (let i = 0; i < 3; i++) {
      attempts++;
      try {
        const out = await sendOnce(id, cfg, job);
        recordSent();
        return { success: true, messageId: out.messageId, providerUsed: LABEL[id], attempts };
      } catch (err: any) {
        const msg = id === 'smtp' ? explainSmtpError(err, cfg) : err?.message || String(err);
        if (i < 2 && id === 'smtp' && isTransient(err)) {
          await new Promise((r) => setTimeout(r, 800 * (i + 1)));
          continue;
        }
        errors.push(`${LABEL[id]}: ${msg}`);
        break;
      }
    }
  }
  return { success: false, error: errors.join(' | '), attempts };
}

/**
 * Verify configuration without sending anything to participants.
 * For SMTP this performs a real login (transporter.verify()).
 */
export async function verifyProviders(cfg = loadMailConfig()) {
  const plan = await planProviders(cfg);
  const checks: Array<{ provider: string; ok: boolean; detail: string }> = [];

  const creds = validateCredentials(cfg);
  if (creds.length === 0 && (cfg.forcedProvider === 'auto' || cfg.forcedProvider === 'smtp')) {
    if (plan.order.includes('smtp')) {
      try {
        await getSmtpTransport(cfg).verify();
        checks.push({ provider: LABEL.smtp, ok: true, detail: `Logged in to ${cfg.smtpHost} as ${cfg.sender}.` });
      } catch (e: any) {
        checks.push({ provider: LABEL.smtp, ok: false, detail: explainSmtpError(e, cfg) });
      }
    } else {
      checks.push({ provider: LABEL.smtp, ok: false, detail: plan.notes.find((n) => n.startsWith('Direct')) || 'SMTP unavailable' });
    }
  } else if (cfg.forcedProvider === 'auto' || cfg.forcedProvider === 'smtp') {
    checks.push({ provider: LABEL.smtp, ok: false, detail: creds.join(' ') });
  }

  if (cfg.gasUrl) {
    const r = await sendViaAppsScript(cfg, { action: 'ping' });
    checks.push({
      provider: LABEL.google_script,
      ok: r.ok,
      detail: r.ok
        ? `Relay reachable${r.data?.remainingQuota != null ? `; ${r.data.remainingQuota} sends left today` : ''}${r.data?.account ? ` (account ${r.data.account})` : ''}.`
        : r.error || 'Relay unreachable',
    });
  }
  if (cfg.brevoKey) {
    try {
      const res = await postJson('https://api.brevo.com/v3/account', { headers: { 'api-key': cfg.brevoKey, Accept: 'application/json' } }, 10_000);
      checks.push({ provider: LABEL.brevo, ok: res.ok, detail: res.ok ? 'API key accepted.' : `Rejected (HTTP ${res.status})` });
    } catch (e: any) {
      checks.push({ provider: LABEL.brevo, ok: false, detail: e.message });
    }
  }
  if (cfg.resendKey) {
    try {
      const res = await postJson('https://api.resend.com/api-keys', { headers: { Authorization: `Bearer ${cfg.resendKey}` } }, 10_000);
      checks.push({ provider: LABEL.resend, ok: res.ok, detail: res.ok ? 'API key accepted.' : `Rejected (HTTP ${res.status})` });
    } catch (e: any) {
      checks.push({ provider: LABEL.resend, ok: false, detail: e.message });
    }
  }
  return { ok: checks.some((c) => c.ok), checks, notes: plan.notes, activeOrder: plan.order.map((id) => LABEL[id]) };
}

/** Non-sensitive snapshot for the UI. */
export async function getStatus(cfg = loadMailConfig()) {
  const plan = await planProviders(cfg);
  return {
    configured: plan.order.length > 0,
    sender: cfg.sender ? maskEmail(cfg.sender) : '',
    senderSet: !!cfg.sender,
    passwordSet: !!cfg.appPassword,
    problems: validateCredentials(cfg),
    activeProviders: plan.order.map((id) => LABEL[id]),
    notes: plan.notes,
    onRender: !!process.env.RENDER,
    usage: getUsage(cfg),
  };
}
