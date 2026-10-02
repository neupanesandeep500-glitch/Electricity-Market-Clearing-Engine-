import crypto from 'crypto';
import type { Request, Response, NextFunction } from 'express';

/**
 * Protects every endpoint that can send mail or touch mail settings.
 * Without this, anyone who finds the URL could send arbitrary email from the owner's Gmail.
 *
 *   ADMIN_PASSCODE   shared secret the administrator types once in the Email tab.
 *
 * In development (NODE_ENV !== 'production') the check is skipped when no passcode is set.
 */

const failures = new Map<string, { count: number; first: number }>();
const FAIL_WINDOW_MS = 15 * 60_000;
const MAX_FAILURES = 8;

function safeEqual(a: string, b: string): boolean {
  const ha = crypto.createHash('sha256').update(a).digest();
  const hb = crypto.createHash('sha256').update(b).digest();
  return crypto.timingSafeEqual(ha, hb);
}

export const passcodeConfigured = () => !!(process.env.ADMIN_PASSCODE && process.env.ADMIN_PASSCODE.trim());
// OFF by default. Only enforced when BOTH ENABLE_ADMIN_PASSCODE=true and ADMIN_PASSCODE is set.
export const passcodeRequired = () => process.env.ENABLE_ADMIN_PASSCODE === 'true' && passcodeConfigured();

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!passcodeRequired()) return next(); // local development only

  if (!passcodeConfigured()) {
    return res.status(503).json({
      success: false,
      error: 'ADMIN_PASSCODE is not set on the server. Add it to the environment variables (Render: Environment tab) and redeploy.',
    });
  }

  const ip = req.ip || 'unknown';
  const now = Date.now();
  const rec = failures.get(ip);
  if (rec && now - rec.first > FAIL_WINDOW_MS) failures.delete(ip);
  const current = failures.get(ip);
  if (current && current.count >= MAX_FAILURES) {
    return res.status(429).json({ success: false, error: 'Too many incorrect passcode attempts. Try again in 15 minutes.' });
  }

  const supplied = String(req.header('x-admin-passcode') || '');
  if (supplied && safeEqual(supplied, process.env.ADMIN_PASSCODE!.trim())) {
    failures.delete(ip);
    return next();
  }

  const entry = failures.get(ip) || { count: 0, first: now };
  entry.count++;
  failures.set(ip, entry);
  return res.status(401).json({ success: false, error: supplied ? 'Incorrect admin passcode.' : 'Admin passcode required.', needsPasscode: true });
}

/** Tiny in-memory sliding-window limiter (single instance is all Render's free/starter plans run). */
export function rateLimit(max: number, windowMs: number) {
  const hits = new Map<string, number[]>();
  return (req: Request, res: Response, next: NextFunction) => {
    const key = req.ip || 'unknown';
    const now = Date.now();
    const list = (hits.get(key) || []).filter((t) => now - t < windowMs);
    if (list.length >= max) {
      res.setHeader('Retry-After', String(Math.ceil(windowMs / 1000)));
      return res.status(429).json({ success: false, error: 'Too many requests. Please slow down.' });
    }
    list.push(now);
    hits.set(key, list);
    if (hits.size > 5000) for (const [k, v] of hits) if (!v.some((t) => now - t < windowMs)) hits.delete(k);
    next();
  };
}

export function securityHeaders(_req: Request, res: Response, next: NextFunction) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  next();
}
