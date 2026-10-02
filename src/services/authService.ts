/**
 * Authentication and User Management Service
 * Strict Role-Based Access Control (ADMIN vs USERS)
 * Inbuilt accounts:
 * - Admin: neupanesandeep500@gmaail.com / Sarthvik@30
 * - Inbuilt User: jeevan.umh@gmail.com / Users123 (Fully configurable, can be enabled/disabled, edited, or deleted by Admin)
 */

import { UserAccount, UserRole } from '../types';

const USERS_STORAGE_KEY = 'nepal_market_users_v2';
const CURRENT_USER_KEY = 'nepal_market_auth_user_v2';
const DELETED_USERS_KEY = 'nepal_market_deleted_users_v2';

/**
 * Sign-in is NOT remembered. Every time the app is opened (new tab, new browser session, or
 * after the app is closed) the login screen is shown and the password must be entered.
 *
 * The signed-in user is held in memory only. Set this to true if you also want a page refresh
 * in the same tab to keep the user signed in (uses sessionStorage, cleared when the tab closes).
 */
const KEEP_SESSION_ON_REFRESH = false;

let memorySession: UserAccount | null = null;

// Remove any session that an earlier version saved permanently in this browser.
try {
  localStorage.removeItem(CURRENT_USER_KEY);
} catch {
  /* storage unavailable */
}

// Inbuilt protected accounts
export const INBUILT_ADMIN: UserAccount = {
  id: 'usr_admin_sandeep',
  email: 'neupanesandeep500@gmaail.com', // also supports neupanesandeep500@gmail.com
  name: 'Sandeep Neupane (Market Administrator)',
  role: 'ADMIN',
  password: 'Sarthvik@30',
  createdAt: '2026-06-26T00:00:00.000Z',
  isSystemUser: true,
  disabled: false,
};

export const INBUILT_USER: UserAccount = {
  id: 'usr_user_jeevan',
  email: 'jeevan.umh@gmail.com',
  name: 'Jeevan (Market Participant)',
  role: 'USERS',
  password: 'Users123',
  createdAt: '2026-06-26T00:00:00.000Z',
  isSystemUser: true,
  disabled: false,
};

/**
 * Get list of explicitly deleted user IDs so they are not resurrected
 */
export function getDeletedUserIds(): string[] {
  try {
    const raw = localStorage.getItem(DELETED_USERS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveDeletedUserId(id: string): void {
  try {
    const list = getDeletedUserIds();
    if (!list.includes(id)) {
      list.push(id);
      localStorage.setItem(DELETED_USERS_KEY, JSON.stringify(list));
    }
  } catch (e) {
    console.error('Failed to save deleted user id', e);
  }
}

export function removeDeletedUserId(id: string): void {
  try {
    const list = getDeletedUserIds().filter((d) => d !== id);
    localStorage.setItem(DELETED_USERS_KEY, JSON.stringify(list));
  } catch (e) {
    console.error('Failed to remove deleted user id', e);
  }
}

/**
 * Initialize and get stored users list.
 * Respects admin modifications, disabled states, and deletions.
 */
export function getStoredUsers(): UserAccount[] {
  try {
    const raw = localStorage.getItem(USERS_STORAGE_KEY);
    const deletedIds = getDeletedUserIds();

    if (!raw) {
      // First boot: populate default accounts unless already marked as deleted
      const initial: UserAccount[] = [INBUILT_ADMIN];
      if (!deletedIds.includes(INBUILT_USER.id)) {
        initial.push(INBUILT_USER);
      }
      localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(initial));
      return initial;
    }

    const parsed: UserAccount[] = JSON.parse(raw);

    // Filter out any users that have been deleted
    let filtered = parsed.filter((u) => !deletedIds.includes(u.id));

    // Ensure at least one ADMIN account exists to prevent complete lockout
    const hasAdmin = filtered.some((u) => u.role === 'ADMIN');
    if (!hasAdmin) {
      filtered.unshift(INBUILT_ADMIN);
      localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(filtered));
    }

    return filtered;
  } catch {
    return [INBUILT_ADMIN, INBUILT_USER];
  }
}

export interface AuthResult {
  success: boolean;
  user?: UserAccount;
  error?: string;
}

/**
 * Authenticate credentials with comprehensive error messages
 * Checks if account exists, if it is disabled, and if password matches
 */
export function authenticateWithDetails(emailInput: string, passwordInput: string): AuthResult {
  const cleanEmail = emailInput.trim().toLowerCase();
  const cleanPassword = passwordInput.trim();

  if (!cleanEmail || !cleanPassword) {
    return { success: false, error: 'Please enter both Email and Password.' };
  }

  const allUsers = getStoredUsers();

  // Find user by email
  const found = allUsers.find((u) => {
    const userEmail = u.email.toLowerCase().trim();
    if (userEmail === cleanEmail) return true;

    // Support admin typo: neupanesandeep500@gmaail.com vs neupanesandeep500@gmail.com
    if (
      (u.id === 'usr_admin_sandeep' || u.role === 'ADMIN') &&
      (userEmail === 'neupanesandeep500@gmaail.com' || userEmail === 'neupanesandeep500@gmail.com') &&
      (cleanEmail === 'neupanesandeep500@gmaail.com' || cleanEmail === 'neupanesandeep500@gmail.com')
    ) {
      return true;
    }

    return false;
  });

  if (!found) {
    const deletedIds = getDeletedUserIds();
    if (deletedIds.includes('usr_user_jeevan') && cleanEmail === 'jeevan.umh@gmail.com') {
      return {
        success: false,
        error: 'Account Deleted: The Jeevan participant account was removed by the administrator.',
      };
    }
    return { success: false, error: 'No account found matching this email address.' };
  }

  // Check if account has been disabled by Admin
  if (found.disabled) {
    return {
      success: false,
      error: `Account Disabled: The account "${found.name}" (${found.email}) has been disabled by the administrator. Contact Admin to re-enable access.`,
    };
  }

  // Verify password
  const storedPassword = (found.password || '').trim();
  if (storedPassword !== cleanPassword) {
    return { success: false, error: 'Invalid password. Please check your credentials and try again.' };
  }

  const safeUser: UserAccount = {
    id: found.id,
    email: found.email,
    name: found.name,
    role: found.role,
    createdAt: found.createdAt,
    isSystemUser: found.isSystemUser,
    disabled: found.disabled,
  };

  saveCurrentUser(safeUser);
  return { success: true, user: safeUser };
}

/**
 * Authenticate credentials (backwards compatible helper)
 */
export function authenticateUser(emailInput: string, passwordInput: string): UserAccount | null {
  const res = authenticateWithDetails(emailInput, passwordInput);
  return res.success && res.user ? res.user : null;
}

export function getCurrentUser(): UserAccount | null {
  try {
    let sessionUser: UserAccount | null = memorySession;
    if (!sessionUser && KEEP_SESSION_ON_REFRESH) {
      const raw = sessionStorage.getItem(CURRENT_USER_KEY);
      sessionUser = raw ? (JSON.parse(raw) as UserAccount) : null;
    }
    if (!sessionUser) return null;

    // Validate that user still exists and has not been disabled or deleted
    const allUsers = getStoredUsers();
    const currentInDb = allUsers.find((u) => u.id === sessionUser!.id);
    if (!currentInDb || currentInDb.disabled) {
      logoutUser();
      return null;
    }

    memorySession = sessionUser;
    return sessionUser;
  } catch {
    return null;
  }
}

export function saveCurrentUser(user: UserAccount | null): void {
  if (user) {
    const sessionUser = { ...user };
    delete sessionUser.password;
    memorySession = sessionUser;
    if (KEEP_SESSION_ON_REFRESH) {
      try {
        sessionStorage.setItem(CURRENT_USER_KEY, JSON.stringify(sessionUser));
      } catch {
        /* ignore */
      }
    }
  } else {
    memorySession = null;
    try {
      sessionStorage.removeItem(CURRENT_USER_KEY);
      localStorage.removeItem(CURRENT_USER_KEY);
    } catch {
      /* ignore */
    }
  }
}

export function logoutUser(): void {
  saveCurrentUser(null);
}

/**
 * Any signed-in user (ADMIN or USERS): change your OWN password.
 * Requires the current password. Applies to this browser's account list.
 */
export function changeOwnPassword(
  userId: string,
  currentPassword: string,
  newPassword: string
): { success: boolean; error?: string } {
  const current = currentPassword.trim();
  const next = newPassword.trim();

  if (!current || !next) return { success: false, error: 'Please fill in all password fields.' };
  if (next.length < 6) return { success: false, error: 'New password must be at least 6 characters long.' };

  const existing = getStoredUsers();
  const index = existing.findIndex((u) => u.id === userId);
  if (index === -1) return { success: false, error: 'Your account was not found. Please sign in again.' };

  if ((existing[index].password || '').trim() !== current) {
    return { success: false, error: 'Current password is incorrect.' };
  }
  if (next === current) {
    return { success: false, error: 'New password must be different from the current password.' };
  }

  const updated = [...existing];
  updated[index] = { ...existing[index], password: next };
  localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(updated));
  return { success: true };
}

/**
 * Admin: Create a new user account
 */
export function createNewUser(
  creator: UserAccount,
  data: { email: string; name: string; role: UserRole; password: string; disabled?: boolean }
): { success: boolean; error?: string; user?: UserAccount } {
  if (creator.role !== 'ADMIN') {
    return { success: false, error: 'Unauthorized: Only an ADMIN can create user accounts.' };
  }

  const cleanEmail = data.email.trim().toLowerCase();
  if (!cleanEmail || !cleanEmail.includes('@')) {
    return { success: false, error: 'Please provide a valid email address.' };
  }

  if (!data.password || data.password.trim().length < 4) {
    return { success: false, error: 'Password must be at least 4 characters long.' };
  }

  const existing = getStoredUsers();
  if (existing.some((u) => u.email.toLowerCase() === cleanEmail)) {
    return { success: false, error: 'A user with this email address already exists.' };
  }

  const newUser: UserAccount = {
    id: `usr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    email: cleanEmail,
    name: data.name.trim() || cleanEmail.split('@')[0],
    role: data.role,
    password: data.password.trim(),
    createdAt: new Date().toISOString(),
    isSystemUser: false,
    disabled: !!data.disabled,
  };

  const updated = [...existing, newUser];
  localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(updated));

  return { success: true, user: newUser };
}

/**
 * Admin: Modify/Edit an existing user account (including Jeevan's account)
 */
export function updateUser(
  creator: UserAccount,
  userId: string,
  data: { email?: string; name?: string; role?: UserRole; password?: string; disabled?: boolean }
): { success: boolean; error?: string; user?: UserAccount } {
  if (creator.role !== 'ADMIN') {
    return { success: false, error: 'Unauthorized: Only an ADMIN can modify user accounts.' };
  }

  const existing = getStoredUsers();
  const index = existing.findIndex((u) => u.id === userId);

  if (index === -1) {
    return { success: false, error: 'User not found in system.' };
  }

  const current = existing[index];

  // Prevent disabling self
  if (creator.id === userId && data.disabled === true) {
    return { success: false, error: 'Cannot disable your own active administrator account.' };
  }

  if (data.email) {
    const cleanEmail = data.email.trim().toLowerCase();
    if (!cleanEmail.includes('@')) {
      return { success: false, error: 'Invalid email address provided.' };
    }
    // Check duplicate
    const dup = existing.find((u) => u.id !== userId && u.email.toLowerCase() === cleanEmail);
    if (dup) {
      return { success: false, error: 'Another account is already registered with this email address.' };
    }
  }

  const updatedUser: UserAccount = {
    ...current,
    name: data.name !== undefined ? data.name.trim() : current.name,
    email: data.email !== undefined ? data.email.trim().toLowerCase() : current.email,
    role: data.role || current.role,
    password: data.password && data.password.trim().length >= 4 ? data.password.trim() : current.password,
    disabled: data.disabled !== undefined ? data.disabled : current.disabled,
  };

  const updatedList = [...existing];
  updatedList[index] = updatedUser;
  localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(updatedList));

  // If the active session is the updated user, update session as well
  const currentSession = getCurrentUser();
  if (currentSession && currentSession.id === userId) {
    saveCurrentUser(updatedUser);
  }

  return { success: true, user: updatedUser };
}

/**
 * Admin: Enable or Disable a user account
 */
export function toggleUserStatus(
  creator: UserAccount,
  userId: string
): { success: boolean; error?: string; user?: UserAccount } {
  if (creator.role !== 'ADMIN') {
    return { success: false, error: 'Unauthorized: Only an ADMIN can change account status.' };
  }

  if (creator.id === userId) {
    return { success: false, error: 'Cannot disable your own active administrator account.' };
  }

  const existing = getStoredUsers();
  const index = existing.findIndex((u) => u.id === userId);
  if (index === -1) {
    return { success: false, error: 'User not found.' };
  }

  const target = existing[index];
  const newDisabled = !target.disabled;

  const updatedUser: UserAccount = {
    ...target,
    disabled: newDisabled,
  };

  const updatedList = [...existing];
  updatedList[index] = updatedUser;
  localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(updatedList));

  return { success: true, user: updatedUser };
}

/**
 * Admin: Delete a user account (Can delete any other user, including Jeevan's inbuilt account)
 */
export function deleteUser(creator: UserAccount, userId: string): { success: boolean; error?: string } {
  if (creator.role !== 'ADMIN') {
    return { success: false, error: 'Unauthorized: Only an ADMIN can remove user accounts.' };
  }

  if (creator.id === userId) {
    return { success: false, error: 'Cannot delete your own active administrator account.' };
  }

  const existing = getStoredUsers();
  const target = existing.find((u) => u.id === userId);

  if (!target) {
    return { success: false, error: 'User not found.' };
  }

  // Record into deletedIds list so it won't be resurrected
  saveDeletedUserId(userId);

  const filtered = existing.filter((u) => u.id !== userId);
  localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(filtered));

  return { success: true };
}

/**
 * Admin: Restore the default Jeevan inbuilt account
 */
export function restoreInbuiltJeevan(creator: UserAccount): { success: boolean; error?: string; user?: UserAccount } {
  if (creator.role !== 'ADMIN') {
    return { success: false, error: 'Unauthorized: Only an ADMIN can restore inbuilt accounts.' };
  }

  removeDeletedUserId(INBUILT_USER.id);
  const existing = getStoredUsers().filter((u) => u.id !== INBUILT_USER.id);
  const restored: UserAccount = { ...INBUILT_USER, disabled: false };
  const updated = [...existing, restored];
  localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(updated));

  return { success: true, user: restored };
}
