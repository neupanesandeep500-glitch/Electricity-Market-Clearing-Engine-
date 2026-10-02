import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import net from 'net';
import {
  loadMailConfig, validateCredentials, planProviders, sendEmail, verifyProviders,
  isValidEmail, maskEmail, explainSmtpError,
} from '../server/mailer';

/** Minimal SMTP server: accepts AUTH PLAIN/LOGIN for one account and records delivered messages. */
function startFakeSmtp(user: string, pass: string) {
  const delivered: Array<{ to: string[]; data: string }> = [];
  const server = net.createServer((sock) => {
    let state: 'cmd' | 'data' | 'login-user' | 'login-pass' = 'cmd';
    let rcpt: string[] = [];
    let buf = '';
    let data = '';
    sock.write('220 fake ESMTP\r\n');
    sock.on('data', (chunk) => {
      buf += chunk.toString();
      let idx: number;
      while ((idx = buf.indexOf('\r\n')) >= 0) {
        const line = buf.slice(0, idx);
        buf = buf.slice(idx + 2);
        if (state === 'data') {
          if (line === '.') { delivered.push({ to: rcpt, data }); data = ''; rcpt = []; state = 'cmd'; sock.write('250 queued\r\n'); }
          else data += line + '\n';
        } else if (state === 'login-user') { state = 'login-pass'; sock.write('334 UGFzc3dvcmQ6\r\n'); }
        else if (state === 'login-pass') {
          const ok = Buffer.from(line, 'base64').toString() === pass;
          state = 'cmd';
          sock.write(ok ? '235 2.7.0 Accepted\r\n' : '535-5.7.8 Username and Password not accepted\r\n535 5.7.8 BadCredentials\r\n');
        } else if (/^EHLO/i.test(line)) sock.write('250-fake\r\n250 AUTH PLAIN LOGIN\r\n');
        else if (/^AUTH PLAIN/i.test(line)) {
          const [, , b64] = line.split(' ');
          const [, u, p] = Buffer.from(b64, 'base64').toString().split('\0');
          sock.write(u === user && p === pass ? '235 2.7.0 Accepted\r\n' : '535-5.7.8 Username and Password not accepted\r\n535 5.7.8 BadCredentials\r\n');
        } else if (/^AUTH LOGIN/i.test(line)) { state = 'login-user'; sock.write('334 VXNlcm5hbWU6\r\n'); }
        else if (/^MAIL FROM/i.test(line)) sock.write('250 ok\r\n');
        else if (/^RCPT TO/i.test(line)) { rcpt.push(line.replace(/^RCPT TO:\s*<?|>?$/gi, '')); sock.write('250 ok\r\n'); }
        else if (/^DATA/i.test(line)) { state = 'data'; sock.write('354 go\r\n'); }
        else if (/^QUIT/i.test(line)) { sock.write('221 bye\r\n'); sock.end(); }
        else sock.write('250 ok\r\n');
      }
    });
    sock.on('error', () => {});
  });
  return new Promise<{ port: number; delivered: typeof delivered; close: () => void }>((resolve) =>
    server.listen(0, '127.0.0.1', () => resolve({ port: (server.address() as net.AddressInfo).port, delivered, close: () => server.close() }))
  );
}

const APP_PW = 'abcdefghijklmnop';
let smtp: Awaited<ReturnType<typeof startFakeSmtp>>;
const saved = { ...process.env };
const resetEnv = () => {
  for (const k of Object.keys(process.env)) if (/^(EMAIL_|SMTP_|GOOGLE_|GAS_|BREVO_|RESEND_)/.test(k)) delete process.env[k];
};

before(async () => { smtp = await startFakeSmtp('me@gmail.com', APP_PW); });
after(() => { smtp.close(); process.env = saved; });

test('config: spaces in the app password are ignored; legacy names still work', () => {
  resetEnv();
  process.env.EMAIL_SENDER = ' me@gmail.com ';
  process.env.EMAIL_PASSWORD = 'abcd efgh ijkl mnop'; // legacy variable name, as shown by Google
  const cfg = loadMailConfig();
  assert.equal(cfg.sender, 'me@gmail.com');
  assert.equal(cfg.appPassword, APP_PW);
  assert.deepEqual(validateCredentials(cfg), []);
});

test('config: wrong-length passwords and missing values produce clear problems', () => {
  resetEnv();
  assert.equal(validateCredentials(loadMailConfig()).length, 2);
  process.env.EMAIL_SENDER = 'me@gmail.com';
  process.env.EMAIL_APP_PASSWORD = 'my-normal-gmail-password';
  assert.match(validateCredentials(loadMailConfig()).join(' '), /exactly 16 letters/);
});

test('helpers', () => {
  assert.ok(isValidEmail('a.b@c.com') && !isValidEmail('a@b') && !isValidEmail('a b@c.com') && !isValidEmail('x@y.com,z@y.com'));
  assert.equal(maskEmail('sandeep@gmail.com'), 'sa*****@gmail.com');
});

test('SMTP: delivers a message through the configured account', async () => {
  resetEnv();
  Object.assign(process.env, { EMAIL_SENDER: 'me@gmail.com', EMAIL_APP_PASSWORD: APP_PW, SMTP_HOST: '127.0.0.1', SMTP_PORT: String(smtp.port) });
  const v = await verifyProviders();
  assert.ok(v.ok, JSON.stringify(v));
  const r = await sendEmail({ to: 'participant@example.com', subject: 'Result', text: 'hello', html: '<b>hello</b>' });
  assert.ok(r.success, r.error);
  assert.match(r.providerUsed!, /SMTP/);
  assert.equal(smtp.delivered.length, 1);
  assert.deepEqual(smtp.delivered[0].to, ['participant@example.com']);
  assert.match(smtp.delivered[0].data, /Subject: Result/);
});

test('SMTP: a wrong app password gives an actionable message, not a generic failure', async () => {
  resetEnv();
  Object.assign(process.env, { EMAIL_SENDER: 'me@gmail.com', EMAIL_APP_PASSWORD: 'zzzzzzzzzzzzzzzz', SMTP_HOST: '127.0.0.1', SMTP_PORT: String(smtp.port) });
  const r = await sendEmail({ to: 'p@example.com', subject: 's', text: 't', html: 'h' });
  assert.ok(!r.success);
  assert.match(r.error!, /App Password/);
});

test('SMTP blocked (Render free plan): detected up front and reported with the fix', async () => {
  resetEnv();
  Object.assign(process.env, { EMAIL_SENDER: 'me@gmail.com', EMAIL_APP_PASSWORD: APP_PW, SMTP_HOST: '127.0.0.1', SMTP_PORT: '1' }); // nothing listens on port 1
  const plan = await planProviders();
  assert.deepEqual(plan.order, []);
  assert.match(plan.notes.join(' '), /blocked on Render/);
  const r = await sendEmail({ to: 'p@example.com', subject: 's', text: 't', html: 'h' });
  assert.ok(!r.success);
  assert.match(r.error!, /No email provider is available/);
});

test('Apps Script relay is used when SMTP is blocked, and the secret is sent', async () => {
  resetEnv();
  const bodies: any[] = [];
  const gas = net.createServer((sock) => {
    let raw = '';
    sock.on('data', (c) => {
      raw += c.toString();
      const m = raw.match(/content-length: (\d+)/i);
      const head = raw.indexOf('\r\n\r\n');
      if (m && head >= 0 && raw.length >= head + 4 + Number(m[1])) {
        bodies.push(JSON.parse(raw.slice(head + 4)));
        const body = JSON.stringify({ success: true, messageId: 'gas-1', remainingQuota: 99 });
        sock.end(`HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: ${Buffer.byteLength(body)}\r\nConnection: close\r\n\r\n${body}`);
      }
    });
    sock.on('error', () => {});
  });
  await new Promise<void>((res) => gas.listen(0, '127.0.0.1', () => res()));
  const port = (gas.address() as net.AddressInfo).port;
  Object.assign(process.env, {
    EMAIL_SENDER: 'me@gmail.com', EMAIL_APP_PASSWORD: APP_PW, SMTP_HOST: '127.0.0.1', SMTP_PORT: '1',
    GOOGLE_APPS_SCRIPT_URL: `http://127.0.0.1:${port}/exec`, GAS_SHARED_SECRET: 'topsecret',
  });
  const r = await sendEmail({ to: 'p@example.com', subject: 's', text: 't', html: 'h' });
  gas.close();
  assert.ok(r.success, r.error);
  assert.match(r.providerUsed!, /Apps Script/);
  assert.equal(bodies[0].secret, 'topsecret');
  assert.equal(bodies[0].to, 'p@example.com');
});

test('explainSmtpError maps timeouts to the Render guidance', () => {
  resetEnv();
  assert.match(explainSmtpError({ code: 'ETIMEDOUT', message: 'x' }), /Render's Free plan/);
});
