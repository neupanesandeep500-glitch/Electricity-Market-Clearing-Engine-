import React, { useState } from 'react';
import { UserAccount, UserRole } from '../types';
import {
  getStoredUsers,
  createNewUser,
  updateUser,
  deleteUser,
  toggleUserStatus,
  restoreInbuiltJeevan,
  INBUILT_USER,
} from '../services/authService';
import {
  Users,
  UserPlus,
  Trash2,
  Edit2,
  Save,
  X,
  Check,
  AlertCircle,
  KeyRound,
  Shield,
  ShieldCheck,
  UserCheck,
  Power,
  PowerOff,
  RotateCcw,
  Mail,
  User,
  Lock,
  Sparkles,
} from 'lucide-react';

interface UserManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserAccount;
}

export const UserManagementModal: React.FC<UserManagementModalProps> = ({
  isOpen,
  onClose,
  currentUser,
}) => {
  const [users, setUsers] = useState<UserAccount[]>(getStoredUsers());
  const [newEmail, setNewEmail] = useState('');
  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState<UserRole>('USERS');
  const [newPassword, setNewPassword] = useState('');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Edit Mode state
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editRole, setEditRole] = useState<UserRole>('USERS');
  const [editPassword, setEditPassword] = useState('');
  const [editDisabled, setEditDisabled] = useState(false);

  if (!isOpen) return null;

  // Refresh local state helper
  const refreshUsers = () => {
    setUsers(getStoredUsers());
  };

  // Find Jeevan account if it currently exists in stored roster
  const jeevanAccount = users.find(
    (u) =>
      u.id === INBUILT_USER.id ||
      u.email.toLowerCase() === 'jeevan.umh@gmail.com' ||
      (u.isSystemUser && u.role === 'USERS')
  );

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);

    const res = createNewUser(currentUser, {
      email: newEmail,
      name: newName,
      role: newRole,
      password: newPassword,
    });

    if (res.success && res.user) {
      setFeedback({ type: 'success', message: `User "${res.user.email}" successfully registered!` });
      refreshUsers();
      setNewEmail('');
      setNewName('');
      setNewPassword('');
    } else {
      setFeedback({ type: 'error', message: res.error || 'Failed to create user.' });
    }
  };

  const startEdit = (user: UserAccount) => {
    setEditingUserId(user.id);
    setEditName(user.name);
    setEditEmail(user.email);
    setEditRole(user.role);
    setEditPassword('');
    setEditDisabled(!!user.disabled);
    setFeedback(null);
  };

  const cancelEdit = () => {
    setEditingUserId(null);
    setEditName('');
    setEditEmail('');
    setEditPassword('');
    setEditDisabled(false);
  };

  const handleSaveEdit = (userId: string) => {
    setFeedback(null);

    const res = updateUser(currentUser, userId, {
      name: editName,
      email: editEmail,
      role: editRole,
      password: editPassword ? editPassword : undefined,
      disabled: editDisabled,
    });

    if (res.success && res.user) {
      setFeedback({
        type: 'success',
        message: `Account "${res.user.name}" (${res.user.email}) updated successfully.`,
      });
      refreshUsers();
      setEditingUserId(null);
    } else {
      setFeedback({ type: 'error', message: res.error || 'Failed to update user account.' });
    }
  };

  const handleToggleStatus = (targetUser: UserAccount) => {
    setFeedback(null);
    const res = toggleUserStatus(currentUser, targetUser.id);
    if (res.success && res.user) {
      const stateStr = res.user.disabled ? 'DISABLED' : 'ENABLED';
      setFeedback({
        type: 'success',
        message: `Account "${res.user.name}" has been ${stateStr}. ${
          res.user.disabled ? 'Login access is currently blocked.' : 'Login access is active.'
        }`,
      });
      refreshUsers();
    } else {
      setFeedback({ type: 'error', message: res.error || 'Failed to update account status.' });
    }
  };

  const handleDelete = (id: string, email: string, isJeevan = false) => {
    if (id === currentUser.id) {
      setFeedback({ type: 'error', message: 'You cannot delete your own active administrator account.' });
      return;
    }

    const confirmPrompt = isJeevan
      ? `Are you sure you want to permanently delete the inbuilt Jeevan account (${email})?\n\nThis account will be removed and will not be able to log in. You can restore it later if needed.`
      : `Are you sure you want to permanently delete user "${email}"?`;

    if (!confirm(confirmPrompt)) return;
    setFeedback(null);

    const res = deleteUser(currentUser, id);
    if (res.success) {
      setFeedback({
        type: 'success',
        message: `Account "${email}" deleted permanently. It will not be re-created on reload.`,
      });
      refreshUsers();
      if (editingUserId === id) {
        cancelEdit();
      }
    } else {
      setFeedback({ type: 'error', message: res.error || 'Failed to delete account.' });
    }
  };

  const handleRestoreJeevan = () => {
    setFeedback(null);
    const res = restoreInbuiltJeevan(currentUser);
    if (res.success && res.user) {
      setFeedback({
        type: 'success',
        message: `Default Jeevan account restored successfully: ${res.user.email} (Password: ${res.user.password})`,
      });
      refreshUsers();
    } else {
      setFeedback({ type: 'error', message: res.error || 'Failed to restore Jeevan account.' });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl max-h-[94vh] bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-[#0D1B4B] via-[#1A237E] to-[#1565C0] px-6 py-4 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-white/10 rounded-xl shadow-xs">
              <Users className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold">Admin User &amp; Accounts Management</h3>
                <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-300 border border-amber-400/30">
                  Admin Authority
                </span>
              </div>
              <p className="text-xs text-white/75 mt-0.5">
                Enable/Disable, Edit credentials (Email &amp; Password), Modify, or Delete System &amp; Participant Accounts
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
            title="Close window"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-6 text-xs">
          {feedback && (
            <div
              className={`p-3.5 rounded-xl flex items-center gap-2.5 shadow-2xs ${
                feedback.type === 'success'
                  ? 'bg-emerald-50 text-emerald-900 border border-emerald-200'
                  : 'bg-rose-50 text-rose-900 border border-rose-200'
              }`}
            >
              {feedback.type === 'success' ? (
                <Check className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              )}
              <span className="font-semibold text-xs">{feedback.message}</span>
            </div>
          )}

          {/* DEDICATED INBUILT JEEVAN ACCOUNT MANAGEMENT SECTION */}
          <div className="border border-indigo-200 rounded-2xl bg-gradient-to-br from-indigo-50/70 via-slate-50 to-amber-50/40 p-4 sm:p-5 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-indigo-100">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-indigo-900 text-white flex items-center justify-center font-bold text-xs shadow-xs">
                  <UserCheck className="w-4 h-4 text-amber-400" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="font-bold text-slate-900 text-sm">
                      Inbuilt Participant Account: Jeevan
                    </h4>
                    {jeevanAccount ? (
                      jeevanAccount.disabled ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-rose-100 text-rose-800 border border-rose-300">
                          <PowerOff className="w-2.5 h-2.5" />
                          <span>DISABLED (Access Blocked)</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-300">
                          <Check className="w-2.5 h-2.5" />
                          <span>ENABLED (Active)</span>
                        </span>
                      )
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-slate-200 text-slate-700 border border-slate-300">
                        <Trash2 className="w-2.5 h-2.5" />
                        <span>DELETED</span>
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Code inbuilt default participant account. As Admin, you can enable/disable, modify email and password, or delete it permanently.
                  </p>
                </div>
              </div>

              {/* Action Buttons for Jeevan Account */}
              {jeevanAccount ? (
                <div className="flex items-center gap-2 flex-wrap">
                  {/* Enable / Disable Button */}
                  <button
                    onClick={() => handleToggleStatus(jeevanAccount)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer ${
                      jeevanAccount.disabled
                        ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                        : 'bg-amber-500 hover:bg-amber-600 text-slate-950'
                    }`}
                    title={jeevanAccount.disabled ? 'Enable Jeevan account to allow login' : 'Disable Jeevan account to block login'}
                  >
                    {jeevanAccount.disabled ? (
                      <>
                        <Power className="w-3.5 h-3.5" />
                        <span>Enable Account</span>
                      </>
                    ) : (
                      <>
                        <PowerOff className="w-3.5 h-3.5" />
                        <span>Disable Account</span>
                      </>
                    )}
                  </button>

                  {/* Edit Credentials */}
                  <button
                    onClick={() => startEdit(jeevanAccount)}
                    className="px-3 py-1.5 bg-indigo-900 hover:bg-indigo-800 text-white rounded-lg text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
                    title="Edit Jeevan's email, name, or password"
                  >
                    <Edit2 className="w-3.5 h-3.5 text-amber-400" />
                    <span>Edit Email &amp; Password</span>
                  </button>

                  {/* Delete Button */}
                  <button
                    onClick={() => handleDelete(jeevanAccount.id, jeevanAccount.email, true)}
                    className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-xs font-bold transition-all shadow-2xs flex items-center gap-1.5 cursor-pointer"
                    title="Permanently remove Jeevan's account from system"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete Account</span>
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleRestoreJeevan}
                    className="px-3 py-1.5 bg-indigo-900 hover:bg-indigo-800 text-white rounded-lg text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
                    title="Restore default Jeevan account"
                  >
                    <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
                    <span>Restore Default Jeevan Account</span>
                  </button>
                </div>
              )}
            </div>

            {/* Jeevan Details Preview */}
            {jeevanAccount && (
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 pt-3">
                <div className="p-2.5 bg-white border border-slate-200 rounded-xl">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Participant Name</span>
                  <span className="font-bold text-slate-800 text-xs truncate block">{jeevanAccount.name}</span>
                </div>
                <div className="p-2.5 bg-white border border-slate-200 rounded-xl">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Configured Email</span>
                  <span className="font-mono text-indigo-900 font-semibold text-xs truncate block">{jeevanAccount.email}</span>
                </div>
                <div className="p-2.5 bg-white border border-slate-200 rounded-xl">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Login Role</span>
                  <span className="font-bold text-slate-800 text-xs flex items-center gap-1">
                    <UserCheck className="w-3.5 h-3.5 text-blue-600" />
                    <span>{jeevanAccount.role}</span>
                  </span>
                </div>
                <div className="p-2.5 bg-white border border-slate-200 rounded-xl">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Current Status</span>
                  <span
                    className={`font-bold text-xs flex items-center gap-1 ${
                      jeevanAccount.disabled ? 'text-rose-600' : 'text-emerald-700'
                    }`}
                  >
                    {jeevanAccount.disabled ? (
                      <>
                        <PowerOff className="w-3 h-3 text-rose-500" />
                        <span>Disabled (Cannot Login)</span>
                      </>
                    ) : (
                      <>
                        <Check className="w-3 h-3 text-emerald-600" />
                        <span>Active (Can Login)</span>
                      </>
                    )}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Form to add user */}
          <div className="bg-slate-50 border border-slate-200/90 rounded-2xl p-4 sm:p-5">
            <h4 className="font-bold text-slate-900 text-sm flex items-center gap-2 mb-3">
              <UserPlus className="w-4 h-4 text-indigo-700" />
              <span>Register New User Account</span>
            </h4>

            <form onSubmit={handleCreate} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Full Name / Organization</label>
                <input
                  type="text"
                  required
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. Ramesh Sharma / NEA Dispatch"
                  className="w-full p-2.5 bg-white border border-slate-200 rounded-lg focus:border-indigo-600 outline-none text-xs"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Email Address</label>
                <input
                  type="email"
                  required
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="name@domain.com"
                  className="w-full p-2.5 bg-white border border-slate-200 rounded-lg font-mono focus:border-indigo-600 outline-none text-xs"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Account Role</label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as UserRole)}
                  className="w-full p-2.5 bg-white border border-slate-200 rounded-lg font-semibold text-slate-800 focus:border-indigo-600 outline-none text-xs"
                >
                  <option value="USERS">USERS (Participant - View &amp; Notifications)</option>
                  <option value="ADMIN">ADMIN (Full Authority &amp; System Settings)</option>
                </select>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Password</label>
                <input
                  type="password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Password (min 4 characters)..."
                  className="w-full p-2.5 bg-white border border-slate-200 rounded-lg font-mono focus:border-indigo-600 outline-none text-xs"
                />
              </div>

              <div className="sm:col-span-2 flex justify-end mt-1">
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-900 hover:bg-indigo-800 text-white font-bold rounded-lg shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <UserPlus className="w-3.5 h-3.5 text-amber-400" />
                  <span>Create Account</span>
                </button>
              </div>
            </form>
          </div>

          {/* User Roster Table with Edit, Add & Delete */}
          <div>
            <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
              <h4 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <Users className="w-4 h-4 text-indigo-700" />
                <span>All Registered System Accounts ({users.length})</span>
              </h4>
              <span className="text-[11px] text-slate-500">
                Admin can enable/disable, modify email and password, or delete any account.
              </span>
            </div>

            <div className="overflow-x-auto border border-slate-200 rounded-xl shadow-2xs">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200">
                    <th className="p-3">User &amp; Contact</th>
                    <th className="p-3">Role</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">Credentials</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {users.map((u) => {
                    const isEditing = editingUserId === u.id;
                    const isSelf = u.id === currentUser.id;
                    const isJeevan =
                      u.id === INBUILT_USER.id ||
                      u.email.toLowerCase() === 'jeevan.umh@gmail.com' ||
                      (u.isSystemUser && u.role === 'USERS');

                    if (isEditing) {
                      return (
                        <tr key={u.id} className="bg-amber-50/70 border-2 border-amber-300 transition-colors">
                          <td className="p-3 space-y-2">
                            <div>
                              <label className="text-[10px] font-bold text-slate-600 uppercase block mb-0.5">
                                Full Name
                              </label>
                              <input
                                type="text"
                                value={editName}
                                onChange={(e) => setEditName(e.target.value)}
                                className="w-full p-1.5 bg-white border border-slate-300 rounded font-semibold text-slate-900 text-xs outline-none focus:border-indigo-600"
                              />
                            </div>
                            <div>
                              <label className="text-[10px] font-bold text-slate-600 uppercase block mb-0.5">
                                Email Address
                              </label>
                              <input
                                type="email"
                                value={editEmail}
                                onChange={(e) => setEditEmail(e.target.value)}
                                className="w-full p-1.5 bg-white border border-slate-300 rounded font-mono text-slate-900 text-xs outline-none focus:border-indigo-600 font-semibold"
                              />
                            </div>
                          </td>

                          <td className="p-3 align-top">
                            <label className="text-[10px] font-bold text-slate-600 uppercase block mb-1">
                              Role
                            </label>
                            <select
                              value={editRole}
                              onChange={(e) => setEditRole(e.target.value as UserRole)}
                              className="p-1.5 bg-white border border-slate-300 rounded font-semibold text-slate-800 text-xs outline-none focus:border-indigo-600 w-full"
                            >
                              <option value="USERS">USERS</option>
                              <option value="ADMIN">ADMIN</option>
                            </select>
                          </td>

                          <td className="p-3 align-top">
                            <label className="text-[10px] font-bold text-slate-600 uppercase block mb-1">
                              Account Status
                            </label>
                            {isSelf ? (
                              <span className="text-[11px] text-slate-500 font-semibold italic">Admin (Always Active)</span>
                            ) : (
                              <select
                                value={editDisabled ? 'disabled' : 'enabled'}
                                onChange={(e) => setEditDisabled(e.target.value === 'disabled')}
                                className="p-1.5 bg-white border border-slate-300 rounded font-semibold text-xs outline-none focus:border-indigo-600 w-full"
                              >
                                <option value="enabled">Active / Enabled</option>
                                <option value="disabled">Disabled (Blocked)</option>
                              </select>
                            )}
                          </td>

                          <td className="p-3 align-top">
                            <label className="text-[10px] font-bold text-slate-600 uppercase block mb-1">
                              New Password
                            </label>
                            <input
                              type="password"
                              value={editPassword}
                              onChange={(e) => setEditPassword(e.target.value)}
                              placeholder="Enter new password (optional)"
                              className="w-full p-1.5 bg-white border border-slate-300 rounded font-mono text-xs outline-none focus:border-indigo-600"
                            />
                            <span className="text-[10px] text-slate-500 mt-1 block">Leave blank to keep unchanged</span>
                          </td>

                          <td className="p-3 text-right align-top space-x-1.5 whitespace-nowrap">
                            <button
                              onClick={() => handleSaveEdit(u.id)}
                              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded text-xs transition-colors inline-flex items-center gap-1 cursor-pointer shadow-xs"
                              title="Save Changes"
                            >
                              <Save className="w-3.5 h-3.5" />
                              <span>Save</span>
                            </button>
                            <button
                              onClick={cancelEdit}
                              className="px-2.5 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold rounded text-xs transition-colors inline-flex items-center gap-1 cursor-pointer"
                              title="Cancel Edit"
                            >
                              <X className="w-3.5 h-3.5" />
                              <span>Cancel</span>
                            </button>
                          </td>
                        </tr>
                      );
                    }

                    return (
                      <tr key={u.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="p-3">
                          <div className="font-bold text-slate-900 flex items-center gap-1.5 flex-wrap">
                            <span>{u.name}</span>
                            {isSelf && (
                              <span className="text-[10px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-800 border border-indigo-200">
                                You
                              </span>
                            )}
                            {isJeevan && (
                              <span className="text-[10px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300">
                                Inbuilt Jeevan
                              </span>
                            )}
                          </div>
                          <div className="font-mono text-[11px] text-slate-600 mt-0.5">{u.email}</div>
                        </td>

                        <td className="p-3">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                              u.role === 'ADMIN'
                                ? 'bg-amber-100 text-amber-900 border border-amber-300'
                                : 'bg-blue-100 text-blue-900 border border-blue-200'
                            }`}
                          >
                            {u.role === 'ADMIN' ? (
                              <ShieldCheck className="w-3 h-3 text-amber-700" />
                            ) : (
                              <UserCheck className="w-3 h-3 text-blue-700" />
                            )}
                            <span>{u.role}</span>
                          </span>
                        </td>

                        <td className="p-3">
                          {u.disabled ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
                              <PowerOff className="w-2.5 h-2.5 text-rose-600" />
                              <span>Disabled</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                              <Check className="w-2.5 h-2.5 text-emerald-600" />
                              <span>Active</span>
                            </span>
                          )}
                        </td>

                        <td className="p-3 text-slate-500 font-mono text-[11px]">
                          <span className="text-slate-400">••••••••</span>
                        </td>

                        <td className="p-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {/* Enable/Disable status toggle button */}
                            {!isSelf && (
                              <button
                                onClick={() => handleToggleStatus(u)}
                                className={`p-1.5 rounded-md transition-colors cursor-pointer ${
                                  u.disabled
                                    ? 'text-emerald-700 hover:text-emerald-900 hover:bg-emerald-50'
                                    : 'text-amber-700 hover:text-amber-900 hover:bg-amber-50'
                                }`}
                                title={u.disabled ? 'Enable account' : 'Disable account'}
                              >
                                {u.disabled ? <Power className="w-4 h-4" /> : <PowerOff className="w-4 h-4" />}
                              </button>
                            )}

                            {/* Edit Button */}
                            <button
                              onClick={() => startEdit(u)}
                              className="p-1.5 text-indigo-700 hover:text-indigo-900 hover:bg-indigo-50 rounded-md transition-colors cursor-pointer"
                              title="Edit user details, change email or password"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>

                            {/* Delete Button */}
                            {isSelf ? (
                              <span className="text-[10px] text-slate-400 italic px-2">Active Admin</span>
                            ) : (
                              <button
                                onClick={() => handleDelete(u.id, u.email, isJeevan)}
                                className="p-1.5 text-rose-600 hover:text-rose-800 hover:bg-rose-50 rounded-md transition-colors cursor-pointer"
                                title="Delete user account"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-slate-50 px-6 py-3 border-t border-slate-200 flex items-center justify-between">
          <span className="text-[11px] text-slate-500">
            Changes take effect immediately and persist across sessions.
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-semibold text-slate-700 hover:text-slate-900 bg-white border border-slate-200 rounded-lg shadow-2xs cursor-pointer hover:bg-slate-50"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
