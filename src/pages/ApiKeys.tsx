import React, { useState, useEffect } from 'react';
import {
  KeyRound,
  Plus,
  Search,
  RefreshCw,
  Copy,
  Trash2,
  Ban,
  RotateCw,
  CheckCircle2,
  AlertCircle,
  Clock,
  ShieldCheck,
  Check
} from 'lucide-react';
import type { ApiKeyItem } from '../types/index.ts';
import { ConfirmationModal } from '../components/ConfirmationModal.tsx';
import { CopyKeyModal } from '../components/CopyKeyModal.tsx';
import { CreateKeyModal } from '../components/CreateKeyModal.tsx';

export const ApiKeys: React.FC = () => {
  const [keys, setKeys] = useState<ApiKeyItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'active' | 'revoked'>('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Modals state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [copyModalData, setCopyModalData] = useState<{ rawKey: string; keyName: string } | null>(null);

  // Confirmation state
  const [confirmAction, setConfirmAction] = useState<{
    type: 'revoke' | 'delete' | 'regenerate';
    key: ApiKeyItem;
  } | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchKeys = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/v1/api-keys');
      const json = await res.json();
      if (res.ok && json.success) {
        setKeys(json.data);
      }
    } catch (err) {
      console.error('Failed to fetch keys:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchKeys();
  }, []);

  const handleCopyPrefix = async (prefix: string, id: string) => {
    try {
      await navigator.clipboard.writeText(prefix);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (e) {
      console.error('Copy failed:', e);
    }
  };

  const executeConfirmAction = async () => {
    if (!confirmAction) return;
    setActionLoading(true);

    try {
      if (confirmAction.type === 'revoke') {
        const res = await fetch(`/api/v1/api-keys/${confirmAction.key.id}/revoke`, { method: 'POST' });
        const data = await res.json();
        if (!res.ok || !data.success) throw new Error(data.error?.message || 'Revocation failed');
        await fetchKeys();
      } else if (confirmAction.type === 'delete') {
        const res = await fetch(`/api/v1/api-keys/${confirmAction.key.id}`, { method: 'DELETE' });
        const data = await res.json();
        if (!res.ok || !data.success) throw new Error(data.error?.message || 'Delete failed');
        await fetchKeys();
      } else if (confirmAction.type === 'regenerate') {
        const res = await fetch(`/api/v1/api-keys/${confirmAction.key.id}/regenerate`, { method: 'POST' });
        const data = await res.json();
        if (!res.ok || !data.success) throw new Error(data.error?.message || 'Regeneration failed');
        await fetchKeys();
        // Show newly generated raw key modal
        setCopyModalData({
          rawKey: data.data.raw_key,
          keyName: data.data.name
        });
      }
      setConfirmAction(null);
    } catch (err: any) {
      alert(err.message || 'Action failed');
    } finally {
      setActionLoading(false);
    }
  };

  const filteredKeys = keys.filter(k => {
    const matchesSearch = k.name.toLowerCase().includes(search.toLowerCase()) ||
                          k.key_prefix.toLowerCase().includes(search.toLowerCase());
    if (!matchesSearch) return false;
    if (filter === 'active') return !k.is_revoked;
    if (filter === 'revoked') return !!k.is_revoked;
    return true;
  });

  return (
    <div className="p-4 lg:p-8 space-y-6">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <span>API Keys & Credentials</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-rose-950 text-rose-300 border border-rose-900/50 font-mono">
              {keys.length} Total
            </span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Authenticate external API clients using cryptographically hashed bearer tokens.
          </p>
        </div>

        <button
          onClick={() => setIsCreateOpen(true)}
          className="px-4 py-2 text-xs font-semibold rounded-xl bg-gradient-to-r from-rose-800 to-rose-700 hover:from-rose-700 hover:to-rose-600 text-white shadow-lg shadow-rose-950/40 flex items-center gap-2 self-start sm:self-auto transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>Generate New API Key</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-3 bg-[#111219] border border-white/5 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search key name or prefix..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 bg-[#090A0F] border border-white/10 rounded-xl text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-rose-600"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
          <div className="flex items-center p-1 bg-[#090A0F] border border-white/5 rounded-xl">
            <button
              onClick={() => setFilter('all')}
              className={`px-3 py-1 text-xs font-medium rounded-lg transition-colors ${
                filter === 'all' ? 'bg-rose-950 text-rose-200 border border-rose-900/50' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              All ({keys.length})
            </button>
            <button
              onClick={() => setFilter('active')}
              className={`px-3 py-1 text-xs font-medium rounded-lg transition-colors ${
                filter === 'active' ? 'bg-rose-950 text-rose-200 border border-rose-900/50' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Active ({keys.filter(k => !k.is_revoked).length})
            </button>
            <button
              onClick={() => setFilter('revoked')}
              className={`px-3 py-1 text-xs font-medium rounded-lg transition-colors ${
                filter === 'revoked' ? 'bg-rose-950 text-rose-200 border border-rose-900/50' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Revoked ({keys.filter(k => k.is_revoked).length})
            </button>
          </div>

          <button
            onClick={fetchKeys}
            className="p-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-slate-200 transition-colors"
            title="Refresh List"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-rose-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* Table Container */}
      <div className="bg-[#111219] border border-white/5 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/5 text-[11px] font-semibold text-slate-500 uppercase tracking-wider bg-black/20">
                <th className="py-3 px-4">Key Identifier</th>
                <th className="py-3 px-4">Prefix / Hash</th>
                <th className="py-3 px-4">Permissions</th>
                <th className="py-3 px-4">Created / Expiry</th>
                <th className="py-3 px-4">Last Used</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-xs">
              {filteredKeys.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center">
                    <div className="flex flex-col items-center justify-center space-y-2">
                      <KeyRound className="w-8 h-8 text-slate-600 mb-1" />
                      <div className="text-sm font-semibold text-slate-300">No API keys found</div>
                      <div className="text-xs text-slate-500 max-w-sm">
                        Create an API key to allow external scripts, automation pipelines, and CI/CD tools to communicate with BusterNodes.
                      </div>
                      <button
                        onClick={() => setIsCreateOpen(true)}
                        className="mt-3 px-3 py-1.5 text-xs font-semibold rounded-lg bg-rose-900/60 hover:bg-rose-800 text-rose-200 border border-rose-700/50"
                      >
                        Create First API Key
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredKeys.map((key) => {
                  const isRevoked = !!key.is_revoked;
                  const isExpired = key.expires_at ? new Date(key.expires_at).getTime() < Date.now() : false;

                  return (
                    <tr key={key.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-slate-200">{key.name}</div>
                        {key.description && (
                          <div className="text-[11px] text-slate-500 truncate max-w-xs">{key.description}</div>
                        )}
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1.5 font-mono text-[11px] text-rose-300 bg-[#090A0F] px-2 py-1 rounded border border-white/5 w-fit">
                          <span>{key.key_prefix}</span>
                          <button
                            onClick={() => handleCopyPrefix(key.key_prefix, key.id)}
                            className="text-slate-500 hover:text-slate-300 ml-1 p-0.5"
                            title="Copy Key Prefix"
                          >
                            {copiedId === key.id ? (
                              <Check className="w-3 h-3 text-emerald-400" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                          </button>
                        </div>
                      </td>

                      <td className="py-3.5 px-4 max-w-xs">
                        <div className="flex flex-wrap gap-1">
                          {key.permissions.slice(0, 3).map((p) => (
                            <span
                              key={p}
                              className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-white/[0.04] text-slate-300 border border-white/5"
                            >
                              {p}
                            </span>
                          ))}
                          {key.permissions.length > 3 && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-rose-950/60 text-rose-300 border border-rose-900/40">
                              +{key.permissions.length - 3} more
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="py-3.5 px-4 font-mono text-[11px] text-slate-400">
                        <div>{new Date(key.created_at).toLocaleDateString()}</div>
                        <div className="text-[10px] text-slate-500 mt-0.5">
                          {key.expires_at ? `Exp: ${new Date(key.expires_at).toLocaleDateString()}` : 'Never expires'}
                        </div>
                      </td>

                      <td className="py-3.5 px-4 font-mono text-[11px] text-slate-400">
                        {key.last_used_at ? (
                          <span className="text-slate-300">{new Date(key.last_used_at).toLocaleDateString()} {new Date(key.last_used_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        ) : (
                          <span className="text-slate-600">Never used</span>
                        )}
                      </td>

                      <td className="py-3.5 px-4">
                        {isRevoked ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-rose-950 text-rose-400 border border-rose-900/60">
                            <Ban className="w-3 h-3" />
                            Revoked
                          </span>
                        ) : isExpired ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-950 text-amber-400 border border-amber-900/60">
                            <Clock className="w-3 h-3" />
                            Expired
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-950 text-emerald-400 border border-emerald-900/60">
                            <CheckCircle2 className="w-3 h-3" />
                            Active
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {!isRevoked && (
                            <>
                              <button
                                onClick={() => setConfirmAction({ type: 'regenerate', key })}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-amber-300 hover:bg-amber-950/30 transition-colors"
                                title="Regenerate Key (Revokes current and generates new)"
                              >
                                <RotateCw className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => setConfirmAction({ type: 'revoke', key })}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-950/30 transition-colors"
                                title="Revoke Key Immediately"
                              >
                                <Ban className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                          <button
                            onClick={() => setConfirmAction({ type: 'delete', key })}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-950/30 transition-colors"
                            title="Delete Key Permanently"
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

      {/* Modals */}
      <CreateKeyModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onKeyCreated={(res) => {
          fetchKeys();
          setCopyModalData(res);
        }}
      />

      {copyModalData && (
        <CopyKeyModal
          isOpen={true}
          keyName={copyModalData.keyName}
          rawKey={copyModalData.rawKey}
          onClose={() => setCopyModalData(null)}
        />
      )}

      {confirmAction && (
        <ConfirmationModal
          isOpen={true}
          title={
            confirmAction.type === 'revoke'
              ? `Revoke API Key: ${confirmAction.key.name}?`
              : confirmAction.type === 'regenerate'
              ? `Regenerate API Key: ${confirmAction.key.name}?`
              : `Permanently Delete API Key: ${confirmAction.key.name}?`
          }
          message={
            confirmAction.type === 'revoke'
              ? 'This API key will immediately become invalid. Any active API clients or deployment scripts using this key will immediately receive 401 KEY_REVOKED errors.'
              : confirmAction.type === 'regenerate'
              ? 'Regenerating will revoke the existing token and issue a fresh secret key with identical permissions. You must copy the new key immediately.'
              : 'This key will be permanently removed from the database. This action cannot be undone.'
          }
          confirmLabel={
            confirmAction.type === 'revoke'
              ? 'Revoke Key'
              : confirmAction.type === 'regenerate'
              ? 'Regenerate & Revoke Old'
              : 'Delete Permanently'
          }
          isDestructive={confirmAction.type !== 'regenerate'}
          isLoading={actionLoading}
          onConfirm={executeConfirmAction}
          onCancel={() => setConfirmAction(null)}
        />
      )}
    </div>
  );
};
