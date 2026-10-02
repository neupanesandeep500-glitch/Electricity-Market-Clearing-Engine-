import React, { useCallback, useEffect, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Copy,
  KeyRound,
  Loader2,
  Mail,
  RefreshCw,
  Send,
  ShieldCheck,
  Lock,
} from 'lucide-react';
import {
  EmailServerStatus,
  checkAdminPasscode,
  fetchEmailStatus,
  getAdminPasscode,
  sendTestEmail,
  setAdminPasscode,
  verifyEmailDelivery,
} from '../services/emailService';
// Single source of truth for the relay script (Vite inlines the file as a string).
import GOOGLE_APPS_SCRIPT_TEMPLATE from '../../apps-script/Code.gs?raw';

interface Props {
  /** Called whenever readiness changes so the parent can show a badge. */
  onStatus?: (s: EmailServerStatus | null) => void;
}

type Banner = { ok: boolean; text: string } | null;

const ENV_ROWS: Array<[string, string]> = [
  ['EMAIL_SENDER', 'The Gmail address that sends the mail'],
  ['EMAIL_APP_PASSWORD', 'The 16-letter Google App Password (spaces are ignored)'],
  ['ENABLE_ADMIN_PASSCODE / ADMIN_PASSCODE', 'Optional. Only if you want a passcode before sending (off by default)'],
  ['EMAIL_FROM_NAME / EMAIL_REPLY_TO', 'Optional display name and reply address'],
  ['GOOGLE_APPS_SCRIPT_URL / GAS_SHARED_SECRET', 'Free-plan route: sends from your Gmail over HTTPS'],
];

export const EmailDeliveryPanel: React.FC<Props> = ({ onStatus }) => {
  const [status, setStatus] = useState<EmailServerStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [passcode, setPasscode] = useState('');
  const [unlocked, setUnlocked] = useState(false);
  const [unlocking, setUnlocking] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testTo, setTestTo] = useState('');
  const [banner, setBanner] = useState<Banner>(null);
  const [copied, setCopied] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    const s = await fetchEmailStatus();
    setStatus(s);
    onStatus?.(s);
    setLoading(false);
    return s;
  }, [onStatus]);

  useEffect(() => {
    (async () => {
      const s = await refresh();
      const saved = getAdminPasscode();
      if (s && !s.passcodeRequired) setUnlocked(true);
      else if (saved) setUnlocked((await checkAdminPasscode(saved)).success);
    })();
  }, [refresh]);

  const unlock = async () => {
    if (!passcode.trim()) return;
    setUnlocking(true);
    setBanner(null);
    const r = await checkAdminPasscode(passcode.trim());
    if (r.success) {
      setAdminPasscode(passcode.trim());
      setUnlocked(true);
      setPasscode('');
    } else {
      setBanner({ ok: false, text: r.error || 'Incorrect passcode.' });
    }
    setUnlocking(false);
  };

  const lock = () => {
    setAdminPasscode('');
    setUnlocked(false);
  };

  const verify = async () => {
    setVerifying(true);
    setBanner(null);
    const r = await verifyEmailDelivery();
    if (r.needsPasscode) setUnlocked(false);
    setBanner({ ok: r.success, text: r.success ? r.message || 'Connection verified.' : r.error || 'Verification failed.' });
    await refresh();
    setVerifying(false);
  };

  const sendTest = async () => {
    setTesting(true);
    setBanner(null);
    const r = await sendTestEmail(testTo.trim());
    if (r.needsPasscode) setUnlocked(false);
    setBanner({
      ok: r.success,
      text: r.success ? `Test email sent via ${r.providerUsed}. Check the inbox (and spam folder).` : r.error || 'Test email failed.',
    });
    await refresh();
    setTesting(false);
  };

  const copyScript = () => {
    navigator.clipboard.writeText(GOOGLE_APPS_SCRIPT_TEMPLATE);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const usagePct = status ? Math.min(100, Math.round((status.usage.sentToday / Math.max(1, status.usage.dailyLimit)) * 100)) : 0;

  return (
    <div className="mb-5 p-4 bg-slate-50/80 border border-slate-200 rounded-2xl space-y-4">
      <div className="flex items-start justify-between gap-3 border-b border-slate-200/80 pb-3">
        <div>
          <span className="font-bold text-xs text-slate-900 flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-indigo-600" />
            <span>Email Delivery</span>
          </span>
          <p className="text-[11px] text-slate-500 mt-0.5">
            The Gmail address and App Password are read from the server's environment variables - never from this browser.
          </p>
        </div>
        <button
          type="button"
          onClick={refresh}
          disabled={loading}
          className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-semibold rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 cursor-pointer disabled:opacity-50"
        >
          <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {loading && !status && (
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <Loader2 className="w-4 h-4 animate-spin" /> Checking server email configuration...
        </div>
      )}

      {!loading && !status && (
        <div className="flex items-start gap-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded-xl p-3">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>Could not read the server's email status. The server may be starting up - press Refresh in a few seconds.</span>
        </div>
      )}

      {status && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="bg-white border border-slate-200 rounded-xl p-3">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Sender</div>
              <div className="text-xs font-mono mt-1 text-slate-900 break-all">{status.sender || 'Not set (EMAIL_SENDER)'}</div>
              <div className={`text-[11px] mt-1 font-semibold ${status.passwordSet ? 'text-emerald-700' : 'text-amber-700'}`}>
                App Password: {status.passwordSet ? 'set on server' : 'missing (EMAIL_APP_PASSWORD)'}
              </div>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-3">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Delivery route</div>
              {status.configured ? (
                <div className="text-xs mt-1 text-emerald-800 font-semibold flex items-start gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                  <span>{status.activeProviders.join(' → ')}</span>
                </div>
              ) : (
                <div className="text-xs mt-1 text-amber-800 font-semibold flex items-start gap-1">
                  <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                  <span>No working route yet</span>
                </div>
              )}
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-3">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Sent today</div>
              <div className="text-xs mt-1 font-mono text-slate-900">
                {status.usage.sentToday} / {status.usage.dailyLimit}
              </div>
              <div className="h-1.5 bg-slate-100 rounded-full mt-2 overflow-hidden">
                <div className={`h-full ${usagePct > 85 ? 'bg-amber-500' : 'bg-indigo-500'}`} style={{ width: `${usagePct}%` }} />
              </div>
            </div>
          </div>

          {(status.problems.length > 0 || status.notes.length > 0) && (
            <ul className="text-[11px] text-amber-900 bg-amber-50 border border-amber-200 rounded-xl p-3 space-y-1 list-disc list-inside">
              {[...status.problems, ...status.notes].map((n, i) => (
                <li key={i}>{n}</li>
              ))}
            </ul>
          )}

          {status.passcodeRequired && !unlocked && (
            <div className="bg-white border border-slate-200 rounded-xl p-3 space-y-2">
              <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                <KeyRound className="w-3.5 h-3.5 text-indigo-600" /> Admin passcode
              </div>
              <p className="text-[11px] text-slate-500">
                Enter the <code className="font-mono">ADMIN_PASSCODE</code> from the server environment to enable sending. It is kept only for this browser tab.
              </p>
              <div className="flex gap-2">
                <input
                  type="password"
                  value={passcode}
                  onChange={(e) => setPasscode(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && unlock()}
                  placeholder="Admin passcode"
                  autoComplete="off"
                  className="flex-1 p-2 bg-white border border-slate-200 rounded-lg text-xs font-mono outline-none focus:border-indigo-600"
                />
                <button
                  type="button"
                  onClick={unlock}
                  disabled={unlocking || !passcode.trim()}
                  className="px-3 py-2 text-xs font-bold rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-50 cursor-pointer"
                >
                  {unlocking ? 'Checking...' : 'Unlock'}
                </button>
              </div>
            </div>
          )}

          {(unlocked || !status.passcodeRequired) && (
            <div className="bg-white border border-slate-200 rounded-xl p-3 space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={verify}
                  disabled={verifying}
                  className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-50 cursor-pointer"
                >
                  {verifying ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5" />}
                  <span>Verify connection</span>
                </button>
                <input
                  type="email"
                  value={testTo}
                  onChange={(e) => setTestTo(e.target.value)}
                  placeholder={`Test recipient (default: sender)`}
                  className="flex-1 min-w-[180px] p-2 bg-white border border-slate-200 rounded-lg text-xs font-mono outline-none focus:border-indigo-600"
                />
                <button
                  type="button"
                  onClick={sendTest}
                  disabled={testing}
                  className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-800 disabled:opacity-50 cursor-pointer"
                >
                  {testing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5 text-indigo-600" />}
                  <span>Send test email</span>
                </button>
                {status.passcodeRequired && (
                  <button type="button" onClick={lock} className="flex items-center gap-1 text-[11px] text-slate-500 hover:text-slate-800 cursor-pointer ml-auto">
                    <Lock className="w-3 h-3" /> Lock
                  </button>
                )}
              </div>
              <p className="text-[11px] text-slate-500">
                "Verify connection" performs a real login to Gmail without emailing anyone. Run it after every change to the environment variables.
              </p>
            </div>
          )}

          {banner && (
            <div
              className={`flex items-start gap-2 text-xs rounded-xl p-3 border ${
                banner.ok ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : 'bg-red-50 border-red-200 text-red-800'
              }`}
            >
              {banner.ok ? <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" /> : <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />}
              <span className="break-words">{banner.text}</span>
            </div>
          )}

          <details className="bg-white border border-slate-200 rounded-xl p-3 text-xs text-slate-700">
            <summary className="font-bold cursor-pointer flex items-center gap-1.5 text-slate-900">
              <Mail className="w-3.5 h-3.5 text-indigo-600" /> Setup guide (environment variables &amp; Render)
            </summary>
            <div className="mt-3 space-y-3">
              <table className="w-full text-[11px]">
                <tbody>
                  {ENV_ROWS.map(([k, v]) => (
                    <tr key={k} className="border-b border-slate-100 last:border-0">
                      <td className="py-1.5 pr-3 font-mono text-indigo-900 align-top whitespace-nowrap">{k}</td>
                      <td className="py-1.5 text-slate-600">{v}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <ol className="list-decimal list-inside space-y-1 text-[11px] text-slate-600">
                <li>Google Account → Security → turn on 2-Step Verification → App passwords → create one for "Mail".</li>
                <li>Render → your service → Environment: add the variables above, then save (the service redeploys).</li>
                <li>Come back here, press <strong>Verify connection</strong>, then <strong>Send test email</strong>.</li>
              </ol>
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-2.5 text-[11px] text-amber-900">
                <strong>Render Free plan:</strong> Render blocks outbound SMTP (ports 25/465/587) on free web services, so a Gmail App Password cannot connect there
                whatever the code does. Either upgrade the service to a paid instance, or use the free HTTPS route: deploy the Apps Script relay below and set
                <code className="font-mono"> GOOGLE_APPS_SCRIPT_URL</code> and <code className="font-mono">GAS_SHARED_SECRET</code>.
                <div className="mt-2">
                  <button
                    type="button"
                    onClick={copyScript}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-bold rounded-lg bg-white border border-amber-300 hover:bg-amber-100 text-amber-900 cursor-pointer"
                  >
                    {copied ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copied ? 'Copied!' : 'Copy Apps Script relay code'}</span>
                  </button>
                </div>
              </div>
            </div>
          </details>
        </>
      )}
    </div>
  );
};
