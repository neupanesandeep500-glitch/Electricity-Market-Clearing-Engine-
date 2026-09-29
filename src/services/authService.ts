/**
 * Authentication and User Management Service
 * Strict Role-Based Access Control (ADMIN vs USERS)
 * Inbuilt accounts:
 * - Admin: neupanesandeep500@gmaail.com / Sarthvik@30
 * - User: jeevan.umh@gmail.com / Users123
 */

import { UserAccount, UserRole } from '../types';

const USERS_STORAGE_KEY = 'nepal_market_users_v2';
const CURRENT_USER_KEY = 'nepal_market_auth_user_v2';

// Inbuilt protected accounts exactly as requested
export const INBUILT_ADMIN: UserAccount = {
  id: 'usr_admin_sandeep',
  email: 'neupanesandeep500@gmaail.com', // also supports neupanesandeep500@gmail.com
  name: 'Sandeep Neupane (Market Administrator)',
  role: 'ADMIN',
  password: 'Sarthvik@30',
  createdAt: '2026-06-26T00:00:00.000Z',
  isSystemUser: true,
};

export const INBUILT_USER: UserAccount = {
  id: 'usr_user_jeevan',
  email: 'jeevan.umh@gmail.com',
  name: 'Jeevan (Market Participant)',
  role: 'USERS',
  password: 'Users123',
  createdAt: '2026-06-26T00:00:00.000Z',
  isSystemUser: true,
};

/**
 * Initialize storage with inbuilt accounts
 */
export function getStoredUsers(): UserAccount[] {
  try {
    const raw = localStorage.getItem(USERS_STORAGE_KEY);
    if (!raw) {
      const initial = [INBUILT_ADMIN, INBUILT_USER];
      localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(initial));
      return initial;
    }
    const parsed: UserAccount[] = JSON.parse(raw);
    // Ensure inbuilt accounts are always present
    const hasAdmin = parsed.some(
      (u) => u.email.toLowerCase() === INBUILT_ADMIN.email.toLowerCase()
    );
    const hasUser = parsed.some(
      (u) => u.email.toLowerCase() === INBUILT_USER.email.toLowerCase()
    );

    let updated = [...parsed];
    if (!hasAdmin) updated.unshift(INBUILT_ADMIN);
    if (!hasUser) updated.push(INBUILT_USER);

    // Save back if missing
    if (!hasAdmin || !hasUser) {
      localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(updated));
    }
    return updated;
  } catch {
    return [INBUILT_ADMIN, INBUILT_USER];
  }
}

/**
 * Authenticate credentials
 */
export function authenticateUser(emailInput: string, passwordInput: string): UserAccount | null {
  const cleanEmail = emailInput.trim().toLowerCase();
  const cleanPassword = passwordInput.trim();

  // Direct check for admin email spelling variants (user typed neupanesandeep500@gmaail.com)
  if (
    (cleanEmail === 'neupanesandeep500@gmaail.com' || cleanEmail === 'neupanesandeep500@gmail.com') &&
    cleanPassword === 'Sarthvik@30'
  ) {
    saveCurrentUser(INBUILT_ADMIN);
    return INBUILT_ADMIN;
  }

  // Direct check for default user
  if (cleanEmail === 'jeevan.umh@gmail.com' && cleanPassword === 'Users123') {
    saveCurrentUser(INBUILT_USER);
    return INBUILT_USER;
  }

  // Check stored database
  const allUsers = getStoredUsers();
  const found = allUsers.find(
    (u) => u.email.toLowerCase() === cleanEmail && (u.password || '').trim() === cleanPassword
  );

  if (found) {
    const safeUser: UserAccount = {
      id: found.id,
      email: found.email,
      name: found.name,
      role: found.role,
      createdAt: found.createdAt,
      isSystemUser: found.isSystemUser,
    };
    saveCurrentUser(safeUser);
    return safeUser;
  }

  return null;
}

export function getCurrentUser(): UserAccount | null {
  try {
    const raw = localStorage.getItem(CURRENT_USER_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function saveCurrentUser(user: UserAccount | null) {
  if (user) {
    // Exclude password from active session
    const sessionUser = { ...user };
    delete sessionUser.password;
    localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(sessionUser));
  } else {
    localStorage.removeItem(CURRENT_USER_KEY);
  }
}

export function logoutUser() {
  saveCurrentUser(null);
}

/**
 * Admin: Create a new user account
 */
export function createNewUser(
  creator: UserAccount,
  data: { email: string; name: string; role: UserRole; password: string }
): { success: boolean; error?: string; user?: UserAccount } {
  if (creator.role !== 'ADMIN') {
    return { success: false, error: 'Unauthorized: Only an ADMIN can create user accounts.' };
  }

  const cleanEmail = data.email.trim().toLowerCase();
  if (!cleanEmail || !cleanEmail.includes('@')) {
    return { success: false, error: 'Please provide a valid email address.' };
  }

  if (!data.password || data.password.length < 4) {
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
  };

  const updated = [...existing, newUser];
  localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(updated));

  return { success: true, user: newUser };
}

/**
 * Admin: Modify/Edit an existing user account
 */
export function updateUser(
  creator: UserAccount,
  userId: string,
  data: { email?: string; name?: string; role?: UserRole; password?: string }
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
    name: data.name ? data.name.trim() : current.name,
    email: data.email ? data.email.trim().toLowerCase() : current.email,
    role: data.role || current.role,
    password: data.password && data.password.trim().length >= 4 ? data.password.trim() : current.password,
  };

  const updatedList = [...existing];
  updatedList[index] = updatedUser;
  localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(updatedList));

  return { success: true, user: updatedUser };
}

/**
 * Admin: Delete a user account (Admin can delete any other user)
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

  const filtered = existing.filter((u) => u.id !== userId);
  localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(filtered));

  return { success: true };
}
