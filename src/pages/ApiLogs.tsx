import React, { useState, useEffect } from 'react';
import {
  Activity,
  Search,
  RefreshCw,
  Filter,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  AlertCircle,
  Clock
} from 'lucide-react';
import type { ApiLogItem } from '../types/index.ts';

export const ApiLogs: React.FC = () => {
  const [logs, setLogs] = useState<ApiLogItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [endpointSearch, setEndpointSearch] = useState('');
  const [statusGroup, setStatusGroup] = useState<'all' | '2xx' | '4xx' | '5xx'>('all');
  const [page, setPage] = useState(0);
  const limit = 25;

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        limit: limit.toString(),
        offset: (page * limit).toString(),
        statusGroup
      });
      if (endpointSearch.trim()) {
        params.set('endpoint', endpointSearch.trim());
      }

      const res = await fetch(`/api/v1/logs?${params.toString()}`);
      const json = await res.json();
      if (res.ok && json.success) {
        setLogs(json.data.rows);
        setTotal(json.data.total);
      }
    } catch (err) {
      console.error('Failed to load logs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [page, statusGroup]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(0);
    fetchLogs();
  };

  const totalPages = Math.ceil(total / limit) || 1;

  return (
    <div className="p-4 lg:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <span>API Activity & Audit Logs</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-rose-950 text-rose-300 border border-rose-900/50 font-mono tabular-nums">
              {total} Total Events
            </span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Complete telemetry of all REST requests. Authentication headers, raw keys, and passwords are permanently stripped before persistence.
          </p>
        </div>

        <button
          onClick={fetchLogs}
          className="px-3.5 py-2 text-xs font-semibold rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white transition-colors flex items-center gap-2 self-start sm:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-rose-400' : ''}`} />
          <span>Refresh Feed</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-3 bg-[#111219] border border-white/5 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3">
        <form onSubmit={handleSearchSubmit} className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Filter endpoint (e.g. /vms, /status)..."
            value={endpointSearch}
            onChange={(e) => setEndpointSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 bg-[#090A0F] border border-white/10 rounded-xl text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-rose-600"
          />
        </form>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
          <div className="flex items-center p-1 bg-[#090A0F] border border-white/5 rounded-xl">
            {(['all', '2xx', '4xx', '5xx'] as const).map(grp => (
              <button
                key={grp}
                onClick={() => { setStatusGroup(grp); setPage(0); }}
                className={`px-3 py-1 text-xs font-medium rounded-lg transition-colors ${
                  statusGroup === grp
                    ? 'bg-rose-950 text-rose-200 border border-rose-900/50'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {grp === 'all' ? 'All Statuses' : grp.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-[#111219] border border-white/5 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/5 text-[11px] font-semibold text-slate-500 uppercase tracking-wider bg-black/20">
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Method</th>
                <th className="py-3 px-4">Request Endpoint</th>
                <th className="py-3 px-4">API Key Prefix</th>
                <th className="py-3 px-4">Latency</th>
                <th className="py-3 px-4">Client IP</th>
                <th className="py-3 px-4 text-right">Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-xs font-mono">
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-500">
                    <Activity className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                    <div>No request activity matched your query</div>
                  </td>
                </tr>
              ) : (
                logs.map((log) => {
                  const isSuccess = log.status_code >= 200 && log.status_code < 300;
                  const isClientError = log.status_code >= 400 && log.status_code < 500;
                  const isServerError = log.status_code >= 500;

                  return (
                    <tr key={log.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="py-3 px-4">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold ${
                          isSuccess ? 'bg-emerald-950 text-emerald-400 border border-emerald-900/50' :
                          isClientError ? 'bg-amber-950 text-amber-400 border border-amber-900/50' :
                          'bg-rose-950 text-rose-400 border border-rose-900/50'
                        }`}>
                          {log.status_code}
                          {log.error_code && <span className="font-normal text-[9px] opacity-80">({log.error_code})</span>}
                        </span>
                      </td>

                      <td className="py-3 px-4">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          log.method === 'GET' ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-900/40' :
                          log.method === 'POST' ? 'bg-blue-950/80 text-blue-300 border border-blue-900/40' :
                          log.method === 'DELETE' ? 'bg-rose-950/80 text-rose-300 border border-rose-900/40' :
                          'bg-slate-900 text-slate-300'
                        }`}>
                          {log.method}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-slate-200">
                        {log.endpoint}
                      </td>

                      <td className="py-3 px-4 text-slate-400 truncate max-w-[150px]">
                        {log.key_prefix || <span className="text-slate-600 italic">anonymous</span>}
                      </td>

                      <td className="py-3 px-4 text-slate-300 tabular-nums">
                        {log.duration_ms}ms
                      </td>

                      <td className="py-3 px-4 text-slate-400">
                        {log.ip_address}
                      </td>

                      <td className="py-3 px-4 text-right text-slate-500 text-[11px]">
                        {new Date(log.timestamp).toLocaleString()}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        <div className="p-4 border-t border-white/5 flex items-center justify-between text-xs text-slate-400">
          <div>
            Showing <span className="text-slate-200 font-semibold">{page * limit + 1}</span> to{' '}
            <span className="text-slate-200 font-semibold">{Math.min((page + 1) * limit, total)}</span> of{' '}
            <span className="text-slate-200 font-semibold">{total}</span> events
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0}
              className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="font-mono text-slate-300 px-2">
              Page {page + 1} of {totalPages}
            </span>
            <button
              onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
