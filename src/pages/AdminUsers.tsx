import React, { useState, useEffect } from 'react';
import {
  Users,
  UserPlus,
  Shield,
  ShieldAlert,
  Server,
  Layers,
  Edit2,
  Trash2,
  CheckCircle,
  AlertTriangle,
  RefreshCw,
  Search,
  Lock,
  Mail,
  UserCheck
} from 'lucide-react';
import type { UserItem } from '../types/index.ts';
import { ConfirmationModal } from '../components/ConfirmationModal.tsx';

export const AdminUsers: React.FC = () => {
  const [users, setUsers] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingUser, setEditingUser] = useState<UserItem | null>(null);
  const [editSlots, setEditSlots] = useState<number>(0);
  const [editRole, setEditRole] = useState<'admin' | 'user'>('user');
  const [editStatus, setEditStatus] = useState<'active' | 'suspended'>('active');
  const [savingEdit, setSavingEdit] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<UserItem | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // New user form states
  const [newUsername, setNewUsername] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<'admin' | 'user'>('user');
  const [newSlots, setNewSlots] = useState(1);
  const [creatingUser, setCreatingUser] = useState(false);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('dvm_token');
      const res = await fetch('/api/v1/admin/users', {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setUsers(data.data);
      }
    } catch {
      setMessage({ type: 'error', text: 'Failed to fetch registered users' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const openEditModal = (u: UserItem) => {
    setEditingUser(u);
    setEditSlots(u.assigned_slots || 0);
    setEditRole(u.role);
    setEditStatus(u.status);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    setSavingEdit(true);

    try {
      const token = localStorage.getItem('dvm_token');
      const res = await fetch(`/api/v1/admin/users/${editingUser.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          role: editRole,
          status: editStatus,
          assigned_slots: Number(editSlots)
        })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error?.message || 'Failed to update user');
      }

      setMessage({ type: 'success', text: `User '${editingUser.username}' updated successfully` });
      setEditingUser(null);
      await fetchUsers();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Update failed' });
    } finally {
      setSavingEdit(false);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreatingUser(true);
    setMessage(null);

    try {
      const token = localStorage.getItem('dvm_token');
      const res = await fetch('/api/v1/admin/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          username: newUsername,
          email: newEmail,
          password: newPassword,
          role: newRole,
          assigned_slots: Number(newSlots)
        })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error?.message || 'Failed to create user');
      }

      setMessage({ type: 'success', text: `User '${newUsername}' provisioned successfully` });
      setIsCreateOpen(false);
      setNewUsername('');
      setNewEmail('');
      setNewPassword('');
      setNewSlots(1);
      await fetchUsers();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Creation failed' });
    } finally {
      setCreatingUser(false);
    }
  };

  const executeDeleteUser = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);

    try {
      const token = localStorage.getItem('dvm_token');
      const res = await fetch(`/api/v1/admin/users/${deleteTarget.id}`, {
        method: 'DELETE',
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error?.message || 'Failed to delete user');
      }

      setMessage({ type: 'success', text: `User '${deleteTarget.username}' deleted permanently` });
      setDeleteTarget(null);
      await fetchUsers();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Delete failed' });
    } finally {
      setDeleteLoading(false);
    }
  };

  const filteredUsers = users.filter((u) => {
    const q = searchQuery.toLowerCase();
    return u.username.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
  });

  return (
    <div className="p-4 lg:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-950/60 border border-rose-800/50 text-rose-300 text-xs font-mono uppercase mb-2">
            <Users className="w-3.5 h-3.5 text-rose-400" />
            <span>Admin Dashboard</span>
          </div>
          <h2 className="text-2xl font-bold text-white tracking-tight">User Account & Slot Management</h2>
          <p className="text-xs text-slate-400 mt-1">
            Assign VPS deployment slot quotas, suspend accounts, and manage system roles across BusterNodes.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchUsers}
            className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer"
            title="Refresh Users"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-rose-400' : ''}`} />
          </button>
          <button
            onClick={() => setIsCreateOpen(true)}
            className="px-4 py-2.5 rounded-xl text-xs font-semibold text-white bg-gradient-to-r from-rose-600 to-pink-700 hover:from-rose-500 hover:to-pink-600 shadow-lg shadow-rose-950/50 flex items-center gap-2 transition-all cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            <span>Create User</span>
          </button>
        </div>
      </div>

      {message && (
        <div
          className={`p-4 rounded-xl border flex items-center justify-between gap-3 text-xs ${
            message.type === 'success'
              ? 'bg-emerald-950/60 border-emerald-800/60 text-emerald-200'
              : 'bg-rose-950/60 border-rose-800/60 text-rose-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {message.type === 'success' ? (
              <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            )}
            <span>{message.text}</span>
          </div>
          <button
            onClick={() => setMessage(null)}
            className="text-slate-400 hover:text-white text-xs underline cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Search Bar */}
      <div className="relative max-w-md">
        <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search by username or email..."
          className="w-full pl-10 pr-4 py-2 bg-[#0F111A] border border-slate-800 rounded-xl text-xs text-white placeholder-slate-600 focus:outline-none focus:border-rose-500"
        />
      </div>

      {/* Users Table */}
      <div className="rounded-2xl border border-rose-950/80 bg-[#0F111A] overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#090A0F] text-slate-400 font-mono uppercase text-[11px] border-b border-rose-950/60">
              <tr>
                <th className="px-5 py-3.5">User Identity</th>
                <th className="px-5 py-3.5">Role</th>
                <th className="px-5 py-3.5">Status</th>
                <th className="px-5 py-3.5">Assigned Slots</th>
                <th className="px-5 py-3.5">Active Instances</th>
                <th className="px-5 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-rose-950/40 text-slate-300">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-slate-500">
                    No users matching criteria.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u) => {
                  const isAdmin = u.role === 'admin';
                  const isSuspended = u.status === 'suspended';

                  return (
                    <tr key={u.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-rose-950/60 border border-rose-800/40 flex items-center justify-center font-bold text-rose-300">
                            {u.username[0]?.toUpperCase()}
                          </div>
                          <div>
                            <div className="font-bold text-white flex items-center gap-2">
                              <span>{u.username}</span>
                              {u.must_change_password && (
                                <span className="px-1.5 py-0.5 rounded text-[10px] bg-amber-950/80 text-amber-300 border border-amber-800/60 font-mono">
                                  Default Pass
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-400 font-mono">{u.email}</div>
                          </div>
                        </div>
                      </td>

                      <td className="px-5 py-4">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider ${
                            isAdmin
                              ? 'bg-rose-950 text-rose-300 border border-rose-700/60'
                              : 'bg-slate-900 text-slate-400 border border-slate-800'
                          }`}
                        >
                          {isAdmin ? <Shield className="w-3 h-3 text-rose-400" /> : <Layers className="w-3 h-3" />}
                          <span>{u.role}</span>
                        </span>
                      </td>

                      <td className="px-5 py-4">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono uppercase font-semibold ${
                            isSuspended
                              ? 'bg-rose-950/80 text-rose-400 border border-rose-800/60'
                              : 'bg-emerald-950/60 text-emerald-400 border border-emerald-800/50'
                          }`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${isSuspended ? 'bg-rose-500' : 'bg-emerald-400'}`} />
                          <span>{u.status}</span>
                        </span>
                      </td>

                      <td className="px-5 py-4">
                        <div className="font-mono font-bold text-sm text-slate-200">
                          {u.assigned_slots || 0}{' '}
                          <span className="text-[10px] text-slate-500 font-normal">slots</span>
                        </div>
                      </td>

                      <td className="px-5 py-4">
                        <div className="flex items-center gap-1.5 font-mono">
                          <Server className="w-3.5 h-3.5 text-slate-500" />
                          <span className="font-bold text-slate-200">{u.vms_count || 0}</span>
                          <span className="text-slate-500 text-[11px]">deployed</span>
                        </div>
                      </td>

                      <td className="px-5 py-4 text-right">
                        <div className="inline-flex items-center gap-2">
                          <button
                            onClick={() => openEditModal(u)}
                            className="p-1.5 rounded-lg bg-[#07080C] hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 transition-colors cursor-pointer"
                            title="Edit Role & Slots"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => setDeleteTarget(u)}
                            disabled={isAdmin}
                            className="p-1.5 rounded-lg bg-[#07080C] hover:bg-rose-950/40 text-slate-500 hover:text-rose-400 border border-slate-800 transition-colors disabled:opacity-30 cursor-pointer"
                            title={isAdmin ? 'Administrator cannot be deleted' : 'Delete User'}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit User Modal */}
      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-md bg-[#0F111A] border border-rose-800/60 rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-rose-950/60">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Edit2 className="w-4 h-4 text-rose-400" />
                <span>Edit User: {editingUser.username}</span>
              </h3>
              <button
                onClick={() => setEditingUser(null)}
                className="text-slate-400 hover:text-white text-xs cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Assigned VPS Deployment Slots
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  required
                  value={editSlots}
                  onChange={(e) => setEditSlots(parseInt(e.target.value, 10) || 0)}
                  className="w-full px-3.5 py-2.5 bg-[#07080C] border border-slate-800 rounded-xl text-sm font-mono text-white focus:outline-none focus:border-rose-500"
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  Users can only deploy VPS instances when they have assigned slots available.
                </p>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Account Status
                </label>
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value as any)}
                  className="w-full px-3.5 py-2.5 bg-[#07080C] border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-rose-500"
                >
                  <option value="active">Active (Full access permitted)</option>
                  <option value="suspended">Suspended (Login blocked)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Role
                </label>
                <select
                  value={editRole}
                  onChange={(e) => setEditRole(e.target.value as any)}
                  className="w-full px-3.5 py-2.5 bg-[#07080C] border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-rose-500"
                >
                  <option value="user">Standard User</option>
                  <option value="admin">Administrator (Fleet Control)</option>
                </select>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="flex-1 py-2.5 rounded-xl text-xs text-slate-400 bg-slate-900 border border-slate-800 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingEdit}
                  className="flex-1 py-2.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-rose-600 to-pink-700 hover:from-rose-500 transition-all cursor-pointer disabled:opacity-50"
                >
                  {savingEdit ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create User Modal */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-md bg-[#0F111A] border border-rose-800/60 rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-rose-950/60">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-rose-400" />
                <span>Create New User Account</span>
              </h3>
              <button
                onClick={() => setIsCreateOpen(false)}
                className="text-slate-400 hover:text-white text-xs cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="space-y-3.5">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Username</label>
                <input
                  type="text"
                  required
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  placeholder="e.g. dev_client"
                  className="w-full px-3.5 py-2.5 bg-[#07080C] border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-rose-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Email Address</label>
                <input
                  type="email"
                  required
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="e.g. client@domain.com"
                  className="w-full px-3.5 py-2.5 bg-[#07080C] border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-rose-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Initial Password</label>
                <input
                  type="password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Minimum 6 characters"
                  className="w-full px-3.5 py-2.5 bg-[#07080C] border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-rose-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Role</label>
                  <select
                    value={newRole}
                    onChange={(e) => setNewRole(e.target.value as any)}
                    className="w-full px-3.5 py-2.5 bg-[#07080C] border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-rose-500"
                  >
                    <option value="user">User</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Assigned Slots</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={newSlots}
                    onChange={(e) => setNewSlots(parseInt(e.target.value, 10) || 0)}
                    className="w-full px-3.5 py-2.5 bg-[#07080C] border border-slate-800 rounded-xl text-xs font-mono text-white focus:outline-none focus:border-rose-500"
                  />
                </div>
              </div>

              <div className="flex items-center gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="flex-1 py-2.5 rounded-xl text-xs text-slate-400 bg-slate-900 border border-slate-800 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creatingUser}
                  className="flex-1 py-2.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-rose-600 to-pink-700 hover:from-rose-500 transition-all cursor-pointer disabled:opacity-50"
                >
                  {creatingUser ? 'Creating...' : 'Provision User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {deleteTarget && (
        <ConfirmationModal
          isOpen={true}
          title={`Permanently delete user '${deleteTarget.username}'?`}
          message="This will delete the user account and terminate all associated container instances. This action is irreversible."
          confirmLabel="Delete User & Wipes VMs"
          isDestructive={true}
          isLoading={deleteLoading}
          onConfirm={executeDeleteUser}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
};
