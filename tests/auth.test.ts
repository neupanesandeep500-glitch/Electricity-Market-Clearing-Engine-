import { test } from 'node:test';
import assert from 'node:assert/strict';

// Minimal browser storage shim. The "old" admin session is already saved, exactly as the previous version left it.
const makeStore = (seed: Record<string, string> = {}) => {
  const m = new Map(Object.entries(seed));
  return {
    getItem: (k: string) => (m.has(k) ? m.get(k)! : null),
    setItem: (k: string, v: string) => void m.set(k, String(v)),
    removeItem: (k: string) => void m.delete(k),
    keys: () => [...m.keys()],
  };
};
const SESSION_KEY = 'nepal_market_auth_user_v2';
const local = makeStore({
  [SESSION_KEY]: JSON.stringify({ id: 'usr_admin_sandeep', email: 'neupanesandeep500@gmaail.com', name: 'Admin', role: 'ADMIN' }),
});
(globalThis as any).localStorage = local;
(globalThis as any).sessionStorage = makeStore();

const auth = await import('../src/services/authService');

test('opening the app never restores a previous (e.g. admin) session', () => {
  assert.equal(auth.getCurrentUser(), null);
  assert.equal(local.getItem(SESSION_KEY), null, 'old saved session is deleted');
});

test('signing in works, but the session is never written to permanent storage', () => {
  const r = auth.authenticateWithDetails('jeevan.umh@gmail.com', 'Users123');
  assert.ok(r.success);
  assert.equal(auth.getCurrentUser()?.email, 'jeevan.umh@gmail.com');
  assert.equal(local.getItem(SESSION_KEY), null);
  assert.equal(((globalThis as any).sessionStorage).getItem(SESSION_KEY), null);
  auth.logoutUser();
  assert.equal(auth.getCurrentUser(), null);
});

test('a wrong password does not sign in', () => {
  assert.equal(auth.authenticateWithDetails('jeevan.umh@gmail.com', 'nope').success, false);
  assert.equal(auth.getCurrentUser(), null);
});

test('a user can change their own password (USERS role)', () => {
  const id = 'usr_user_jeevan';
  assert.equal(auth.changeOwnPassword(id, 'wrong', 'NewPass123').success, false);
  assert.match(auth.changeOwnPassword(id, 'Users123', 'abc').error!, /at least 6/);
  assert.match(auth.changeOwnPassword(id, 'Users123', 'Users123').error!, /different/);
  assert.ok(auth.changeOwnPassword(id, 'Users123', 'NewPass123').success);
  assert.equal(auth.authenticateWithDetails('jeevan.umh@gmail.com', 'Users123').success, false, 'old password stops working');
  assert.ok(auth.authenticateWithDetails('jeevan.umh@gmail.com', 'NewPass123').success, 'new password works');
  auth.logoutUser();
});

test('an admin can change their own password', () => {
  const id = 'usr_admin_sandeep';
  assert.ok(auth.changeOwnPassword(id, 'Sarthvik@30', 'Admin#Secret9').success);
  assert.equal(auth.authenticateWithDetails('neupanesandeep500@gmail.com', 'Sarthvik@30').success, false);
  assert.ok(auth.authenticateWithDetails('neupanesandeep500@gmail.com', 'Admin#Secret9').success);
  auth.logoutUser();
});

test('email passcode is off by default, even if ADMIN_PASSCODE exists on the server', async () => {
  const sec = await import('../server/security');
  process.env.ADMIN_PASSCODE = 'left-over-from-render-blueprint';
  delete process.env.ENABLE_ADMIN_PASSCODE;
  assert.equal(sec.passcodeRequired(), false);
  process.env.ENABLE_ADMIN_PASSCODE = 'true';
  assert.equal(sec.passcodeRequired(), true, 'can still be switched on deliberately');
  delete process.env.ENABLE_ADMIN_PASSCODE;
  delete process.env.ADMIN_PASSCODE;
});
