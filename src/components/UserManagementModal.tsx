import React, { useState } from 'react';
import { UserAccount, UserRole } from '../types';
import { getStoredUsers, createNewUser, updateUser, deleteUser } from '../services/authService';
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

  if (!isOpen) return null;

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
      setUsers(getStoredUsers());
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
    setFeedback(null);
  };

  const cancelEdit = () => {
    setEditingUserId(null);
    setEditName('');
    setEditEmail('');
    setEditPassword('');
  };

  const handleSaveEdit = (userId: string) => {
    setFeedback(null);

    const res = updateUser(currentUser, userId, {
      name: editName,
      email: editEmail,
      role: editRole,
      password: editPassword ? editPassword : undefined,
    });

    if (res.success && res.user) {
      setFeedback({ type: 'success', message: `User account "${res.user.name}" updated successfully.` });
      setUsers(getStoredUsers());
      setEditingUserId(null);
    } else {
      setFeedback({ type: 'error', message: res.error || 'Failed to update user account.' });
    }
  };

  const handleDelete = (id: string, email: string) => {
    if (id === currentUser.id) {
      setFeedback({ type: 'error', message: 'You cannot delete your own active administrator account.' });
      return;
    }

    if (!confirm(`Are you sure you want to permanently delete user "${email}"?`)) return;
    setFeedback(null);

    const res = deleteUser(currentUser, id);
    if (res.success) {
      setFeedback({ type: 'success', message: `User "${email}" deleted successfully.` });
      setUsers(getStoredUsers());
      if (editingUserId === id) {
        cancelEdit();
      }
    } else {
      setFeedback({ type: 'error', message: res.error || 'Failed to delete.' });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-3xl max-h-[92vh] bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-[#0D1B4B] via-[#1A237E] to-[#1565C0] px-6 py-4 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-white/10 rounded-xl">
              <Users className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <h3 className="text-base font-bold">User Account Administration</h3>
              <p className="text-xs text-white/70">
                ADMIN Portal · Add, Edit, and Delete System &amp; Participant Accounts
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-6 text-xs">
          {feedback && (
            <div
              className={`p-3 rounded-xl flex items-center gap-2 ${
                feedback.type === 'success'
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                  : 'bg-rose-50 text-rose-800 border border-rose-200'
              }`}
            >
              {feedback.type === 'success' ? (
                <Check className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              )}
              <span className="font-medium">{feedback.message}</span>
            </div>
          )}

          {/* Form to add user */}
          <div className="bg-slate-50 border border-slate-200/90 rounded-2xl p-4 sm:p-5">
            <h4 className="font-bold text-slate-900 text-sm flex items-center gap-2 mb-3">
              <UserPlus className="w-4 h-4 text-indigo-700" />
              <span>Add New User Account</span>
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
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <Users className="w-4 h-4 text-indigo-700" />
                <span>Manage Registered Accounts ({users.length})</span>
              </h4>
              <span className="text-[11px] text-slate-500">
                Admin can edit, update passwords, and delete any account.
              </span>
            </div>

            <div className="overflow-x-auto border border-slate-200 rounded-xl shadow-2xs">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200">
                    <th className="p-3">User &amp; Contact</th>
                    <th className="p-3">Role</th>
                    <th className="p-3">Credentials</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {users.map((u) => {
                    const isEditing = editingUserId === u.id;
                    const isSelf = u.id === currentUser.id;

                    if (isEditing) {
                      return (
                        <tr key={u.id} className="bg-amber-50/60 transition-colors">
                          <td className="p-3 space-y-2">
                            <div>
                              <label className="text-[10px] font-bold text-slate-500 uppercase">Name</label>
                              <input
                                type="text"
                                value={editName}
                                onChange={(e) => setEditName(e.target.value)}
                                className="w-full p-1.5 bg-white border border-slate-300 rounded font-semibold text-slate-900 text-xs outline-none focus:border-indigo-600"
                              />
                            </div>
                            <div>
                              <label className="text-[10px] font-bold text-slate-500 uppercase">Email</label>
                              <input
                                type="email"
                                value={editEmail}
                                onChange={(e) => setEditEmail(e.target.value)}
                                className="w-full p-1.5 bg-white border border-slate-300 rounded font-mono text-slate-700 text-xs outline-none focus:border-indigo-600"
                              />
                            </div>
                          </td>
                          <td className="p-3 align-top">
                            <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Role</label>
                            <select
                              value={editRole}
                              onChange={(e) => setEditRole(e.target.value as UserRole)}
                              className="p-1.5 bg-white border border-slate-300 rounded font-semibold text-slate-800 text-xs outline-none focus:border-indigo-600"
                            >
                              <option value="USERS">USERS</option>
                              <option value="ADMIN">ADMIN</option>
                            </select>
                          </td>
                          <td className="p-3 align-top">
                            <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                              New Password (Optional)
                            </label>
                            <input
                              type="password"
                              value={editPassword}
                              onChange={(e) => setEditPassword(e.target.value)}
                              placeholder="Leave blank to keep current"
                              className="w-full p-1.5 bg-white border border-slate-300 rounded font-mono text-xs outline-none focus:border-indigo-600"
                            />
                          </td>
                          <td className="p-3 text-right align-top space-x-1.5">
                            <button
                              onClick={() => handleSaveEdit(u.id)}
                              className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded text-xs transition-colors inline-flex items-center gap-1 cursor-pointer"
                              title="Save Changes"
                            >
                              <Save className="w-3.5 h-3.5" />
                              <span>Save</span>
                            </button>
                            <button
                              onClick={cancelEdit}
                              className="px-2.5 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold rounded text-xs transition-colors inline-flex items-center gap-1 cursor-pointer"
                              title="Cancel"
                            >
                              <X className="w-3.5 h-3.5" />
                              <span>Cancel</span>
                            </button>
                          </td>
                        </tr>
                      );
                    }

                    return (
                      <tr key={u.id} className="hover:bg-slate-50 transition-colors">
                        <td className="p-3">
                          <div className="font-bold text-slate-900 flex items-center gap-1.5">
                            <span>{u.name}</span>
                            {isSelf && (
                              <span className="text-[10px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-800">
                                You
                              </span>
                            )}
                          </div>
                          <div className="font-mono text-[11px] text-slate-500">{u.email}</div>
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
                        <td className="p-3 text-slate-500 font-mono text-[11px]">
                          <span className="text-slate-400">••••••••</span>
                        </td>
                        <td className="p-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {/* Edit Button */}
                            <button
                              onClick={() => startEdit(u)}
                              className="p-1.5 text-indigo-700 hover:text-indigo-900 hover:bg-indigo-50 rounded-md transition-colors cursor-pointer"
                              title="Edit user details or reset password"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>

                            {/* Delete Button */}
                            {isSelf ? (
                              <span className="text-[10px] text-slate-400 italic px-2">Active</span>
                            ) : (
                              <button
                                onClick={() => handleDelete(u.id, u.email)}
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
