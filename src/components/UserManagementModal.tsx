import React, { useState } from 'react';
import { UserAccount, UserRole } from '../types';
import { getStoredUsers, createNewUser, deleteUser } from '../services/authService';
import { Users, UserPlus, Trash2, ShieldCheck, ShieldAlert, X, Check, AlertCircle } from 'lucide-react';

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

  const handleDelete = (id: string, email: string) => {
    if (!confirm(`Are you sure you want to remove user "${email}"?`)) return;
    setFeedback(null);

    const res = deleteUser(currentUser, id);
    if (res.success) {
      setFeedback({ type: 'success', message: `User account deleted.` });
      setUsers(getStoredUsers());
    } else {
      setFeedback({ type: 'error', message: res.error || 'Failed to delete.' });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl max-h-[90vh] bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-[#1A237E] px-6 py-4 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-white/10 rounded-xl">
              <Users className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <h3 className="text-base font-bold">User Account Administration</h3>
              <p className="text-xs text-white/70">
                ADMIN Authorized Portal · Provision &amp; Manage System Accounts
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
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
              <span>{feedback.message}</span>
            </div>
          )}

          {/* Form to add user */}
          <div className="bg-slate-50 border border-slate-200/90 rounded-2xl p-4 sm:p-5">
            <h4 className="font-bold text-slate-900 text-sm flex items-center gap-2 mb-3">
              <UserPlus className="w-4 h-4 text-indigo-700" />
              <span>Create New Account</span>
            </h4>

            <form onSubmit={handleCreate} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Full Name / Organization</label>
                <input
                  type="text"
                  required
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. Ramesh Sharma"
                  className="w-full p-2.5 bg-white border border-slate-200 rounded-lg focus:border-indigo-600 outline-none"
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
                  className="w-full p-2.5 bg-white border border-slate-200 rounded-lg font-mono focus:border-indigo-600 outline-none"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Account Role</label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as UserRole)}
                  className="w-full p-2.5 bg-white border border-slate-200 rounded-lg font-semibold text-slate-800 focus:border-indigo-600 outline-none"
                >
                  <option value="USERS">USERS (Standard Access - View/Run/Notify)</option>
                  <option value="ADMIN">ADMIN (Full Authority &amp; User Provisioning)</option>
                </select>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Account Password</label>
                <input
                  type="text"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Temporary or permanent password..."
                  className="w-full p-2.5 bg-white border border-slate-200 rounded-lg font-mono focus:border-indigo-600 outline-none"
                />
              </div>

              <div className="sm:col-span-2 flex justify-end mt-1">
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-900 hover:bg-indigo-800 text-white font-bold rounded-lg shadow-xs transition-colors flex items-center gap-1.5"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>Register Account</span>
                </button>
              </div>
            </form>
          </div>

          {/* User Roster Table */}
          <div>
            <h4 className="font-bold text-slate-900 text-sm mb-3">Registered Users Directory</h4>
            <div className="overflow-x-auto border border-slate-200 rounded-xl">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-100 text-slate-700 font-semibold">
                    <th className="p-3">User</th>
                    <th className="p-3">Role</th>
                    <th className="p-3">Status</th>
                    <th className="p-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {users.map((u) => (
                    <tr key={u.id} className="hover:bg-slate-50 transition-colors">
                      <td className="p-3">
                        <div className="font-bold text-slate-900">{u.name}</div>
                        <div className="font-mono text-[11px] text-slate-500">{u.email}</div>
                      </td>
                      <td className="p-3">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            u.role === 'ADMIN'
                              ? 'bg-amber-100 text-amber-900 border border-amber-300'
                              : 'bg-blue-100 text-blue-900 border border-blue-200'
                          }`}
                        >
                          {u.role}
                        </span>
                      </td>
                      <td className="p-3 text-slate-500">
                        {u.isSystemUser ? (
                          <span className="text-indigo-700 font-medium">Inbuilt Core Account</span>
                        ) : (
                          <span>Created {new Date(u.createdAt).toLocaleDateString()}</span>
                        )}
                      </td>
                      <td className="p-3 text-right">
                        {u.isSystemUser ? (
                          <span className="text-[10px] text-slate-400 italic">Protected</span>
                        ) : (
                          <button
                            onClick={() => handleDelete(u.id, u.email)}
                            className="p-1.5 text-rose-600 hover:text-rose-800 hover:bg-rose-50 rounded-md transition-colors"
                            title="Delete User"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-slate-50 px-6 py-3 border-t border-slate-200 text-right">
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-white border border-slate-200 rounded-lg shadow-2xs"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
