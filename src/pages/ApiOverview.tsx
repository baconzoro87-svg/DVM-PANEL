import React, { useState, useEffect } from 'react';
import {
  KeyRound,
  ShieldCheck,
  Activity,
  AlertTriangle,
  Zap,
  TrendingUp,
  Clock,
  ArrowUpRight,
  RefreshCw,
  Server
} from 'lucide-react';
import type { OverviewData } from '../types/index.ts';

interface ApiOverviewProps {
  onNavigateToKeys: () => void;
  onNavigateToLogs: () => void;
  onNavigateToDocs: () => void;
}

export const ApiOverview: React.FC<ApiOverviewProps> = ({
  onNavigateToKeys,
  onNavigateToLogs,
  onNavigateToDocs,
}) => {
  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hoveredBar, setHoveredBar] = useState<{ hour: string; total: number; failed: number } | null>(null);

  const fetchOverview = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/v1/overview');
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || 'Failed to fetch API overview');
      }
      setData(json.data);
    } catch (err: any) {
      setError(err.message || 'Error loading telemetry');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOverview();
  }, []);

  if (loading && !data) {
    return (
      <div className="p-8 flex flex-col items-center justify-center min-h-[400px]">
        <RefreshCw className="w-8 h-8 text-rose-500 animate-spin mb-3" />
        <div className="text-sm text-slate-400">Loading API telemetry metrics...</div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="p-8">
        <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-900/60 text-rose-300 text-sm flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5" />
            <span>{error}</span>
          </div>
          <button
            onClick={fetchOverview}
            className="px-3 py-1 bg-rose-800 hover:bg-rose-700 text-white rounded-lg text-xs font-medium"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const keys = data?.keys || { total: 0, active: 0, revoked: 0 };
  const requests = data?.requests || { total: 0, today: 0, failed: 0, requestsPerMinute: 0 };
  const topEndpoints = data?.topEndpoints || [];
  const hourly = data?.hourlyBreakdown || [];
  const recentLogs = data?.recentActivity || [];

  // Calculate maximum requests in hourly data for responsive chart scaling
  const maxHourlyRequests = Math.max(...hourly.map(h => h.total_requests), 10);

  return (
    <div className="p-4 lg:p-8 space-y-6">
      {/* Top Banner / Hero Info */}
      <div className="relative overflow-hidden p-6 rounded-2xl bg-gradient-to-r from-[#14080D] via-[#111219] to-[#0A0B10] border border-rose-950/60 shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="font-extrabold text-xl sm:text-2xl text-slate-100">BusterNodes API System</span>
              <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-rose-950 text-rose-300 border border-rose-800/40">v1 REST API</span>
            </div>
            <p className="text-xs sm:text-sm text-slate-400 max-w-2xl leading-relaxed">
              Programmatic Docker virtualization infrastructure with SHA-256 token hashing, RBAC permissions, token bucket rate limiting, and zero-systemd deployment.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={fetchOverview}
              className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white transition-colors"
              title="Refresh Telemetry"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <button
              onClick={onNavigateToDocs}
              className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-rose-800 to-rose-700 hover:from-rose-700 hover:to-rose-600 text-white text-xs font-semibold shadow-lg shadow-rose-950/40 flex items-center gap-2 transition-all"
            >
              <span>Explore Interactive Docs</span>
              <ArrowUpRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* KPI Telemetry Metrics Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total API Keys */}
        <div className="p-4 rounded-xl bg-[#111219] border border-white/5 hover:border-rose-950/50 transition-all">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">Total API Keys</span>
            <KeyRound className="w-4 h-4 text-rose-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-slate-100 font-mono tabular-nums">{keys.total}</span>
            <span className="text-xs text-emerald-400 font-medium">{keys.active} active</span>
          </div>
          <div className="text-[11px] text-slate-500 mt-2 flex items-center justify-between">
            <span>Revoked keys: {keys.revoked}</span>
            <button onClick={onNavigateToKeys} className="text-rose-400 hover:underline">Manage &rarr;</button>
          </div>
        </div>

        {/* Requests Today */}
        <div className="p-4 rounded-xl bg-[#111219] border border-white/5 hover:border-rose-950/50 transition-all">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">Requests (24h)</span>
            <Activity className="w-4 h-4 text-rose-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-slate-100 font-mono tabular-nums">{requests.today.toLocaleString()}</span>
            <span className="text-xs text-slate-400">total: {requests.total.toLocaleString()}</span>
          </div>
          <div className="text-[11px] text-slate-500 mt-2 flex items-center justify-between">
            <span>Failed: <span className={requests.failed > 0 ? 'text-rose-400 font-medium' : 'text-slate-400'}>{requests.failed}</span></span>
            <button onClick={onNavigateToLogs} className="text-rose-400 hover:underline">View logs &rarr;</button>
          </div>
        </div>

        {/* Requests Per Minute */}
        <div className="p-4 rounded-xl bg-[#111219] border border-white/5 hover:border-rose-950/50 transition-all">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">Current Throughput</span>
            <Zap className="w-4 h-4 text-rose-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-slate-100 font-mono tabular-nums">{requests.requestsPerMinute}</span>
            <span className="text-xs text-slate-400">req/min</span>
          </div>
          <div className="text-[11px] text-slate-500 mt-2">
            <span>Average sliding 15-min window</span>
          </div>
        </div>

        {/* Failed Requests Rate */}
        <div className="p-4 rounded-xl bg-[#111219] border border-white/5 hover:border-rose-950/50 transition-all">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">Error Rate</span>
            <TrendingUp className="w-4 h-4 text-rose-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-slate-100 font-mono tabular-nums">
              {requests.today > 0 ? ((requests.failed / requests.today) * 100).toFixed(1) : '0.0'}%
            </span>
            <span className="text-xs text-slate-400">4xx & 5xx</span>
          </div>
          <div className="text-[11px] text-emerald-400 mt-2 flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Rate limiting enforced</span>
          </div>
        </div>
      </div>

      {/* Grid: Hourly Usage Graph + Top Endpoints */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Hourly Usage Graph (2 cols) */}
        <div className="lg:col-span-2 p-5 rounded-2xl bg-[#111219] border border-white/5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-slate-100 uppercase tracking-wider">API Request Volume (Past 24 Hours)</h2>
              <p className="text-xs text-slate-400 mt-0.5">Real-time HTTP traffic logged to SQLite database</p>
            </div>
            {hoveredBar && (
              <div className="text-xs font-mono px-2.5 py-1 rounded bg-black/60 border border-rose-900/50 text-rose-300">
                {hoveredBar.hour}: <strong className="text-white">{hoveredBar.total} reqs</strong> ({hoveredBar.failed} errors)
              </div>
            )}
          </div>

          {/* Responsive CSS Bar Chart */}
          <div className="h-56 pt-6 flex items-end gap-1.5 sm:gap-2 border-b border-white/10 pb-2">
            {hourly.length === 0 ? (
              <div className="w-full h-full flex items-center justify-center text-xs text-slate-500">
                No requests recorded in the last 24 hours. Invoke an endpoint via Swagger to generate metrics.
              </div>
            ) : (
              hourly.map((h, idx) => {
                const heightPercent = Math.max(12, Math.round((h.total_requests / maxHourlyRequests) * 100));
                const failPercent = h.total_requests > 0 ? Math.round((h.failed_requests / h.total_requests) * 100) : 0;
                return (
                  <div
                    key={idx}
                    onMouseEnter={() => setHoveredBar({ hour: h.hour_label, total: h.total_requests, failed: h.failed_requests })}
                    onMouseLeave={() => setHoveredBar(null)}
                    className="flex-1 flex flex-col items-center gap-1 group cursor-pointer"
                  >
                    <div className="w-full relative flex flex-col justify-end rounded-t overflow-hidden bg-rose-950/20 group-hover:bg-rose-950/40 transition-colors" style={{ height: `${heightPercent}%` }}>
                      {failPercent > 0 && (
                        <div
                          className="w-full bg-rose-600"
                          style={{ height: `${failPercent}%` }}
                        />
                      )}
                      <div
                        className="w-full bg-gradient-to-t from-rose-900 to-rose-700 group-hover:from-rose-800 group-hover:to-rose-600 transition-colors"
                        style={{ height: `${100 - failPercent}%` }}
                      />
                    </div>
                    <span className="text-[10px] text-slate-500 font-mono group-hover:text-slate-300 transform -rotate-45 sm:rotate-0 origin-center truncate">
                      {h.hour_label.split(':')[0]}h
                    </span>
                  </div>
                );
              })
            )}
          </div>

          <div className="flex items-center justify-between text-xs text-slate-400 pt-1">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-sm bg-rose-700" />
                <span>Successful Requests (2xx/3xx)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-sm bg-rose-500" />
                <span>Errors (4xx/5xx)</span>
              </div>
            </div>
            <span className="font-mono text-slate-500">Live Telemetry</span>
          </div>
        </div>

        {/* Most Frequently Used Endpoints (1 col) */}
        <div className="p-5 rounded-2xl bg-[#111219] border border-white/5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-100 uppercase tracking-wider">Top Endpoints</h2>
            <span className="text-xs text-slate-500 font-mono">By Invocations</span>
          </div>

          <div className="space-y-3">
            {topEndpoints.length === 0 ? (
              <div className="text-xs text-slate-500 py-6 text-center">No endpoint traffic logged yet.</div>
            ) : (
              topEndpoints.map((ep, idx) => (
                <div key={idx} className="p-2.5 rounded-xl bg-[#090A0F] border border-white/5 flex items-center justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${
                        ep.method === 'GET' ? 'bg-emerald-950 text-emerald-400 border border-emerald-900/50' :
                        ep.method === 'POST' ? 'bg-blue-950 text-blue-400 border border-blue-900/50' :
                        'bg-rose-950 text-rose-400 border border-rose-900/50'
                      }`}>
                        {ep.method}
                      </span>
                      <span className="font-mono text-xs text-slate-200">{ep.endpoint}</span>
                    </div>
                    <div className="text-[11px] text-slate-500 font-mono">
                      Avg latency: <span className="text-slate-300 font-semibold tabular-nums">{Math.round(ep.avg_duration)}ms</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-bold text-slate-200 font-mono tabular-nums">{ep.count}</span>
                    <div className="text-[10px] text-slate-500">reqs</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Recent API Activity Feed */}
      <div className="p-5 rounded-2xl bg-[#111219] border border-white/5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-rose-400" />
            <h2 className="text-sm font-bold text-slate-100 uppercase tracking-wider">Recent API Activity Feed</h2>
          </div>
          <button
            onClick={onNavigateToLogs}
            className="text-xs text-rose-400 hover:text-rose-300 font-semibold flex items-center gap-1"
          >
            <span>View All Activity Logs</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/5 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3">Method</th>
                <th className="py-2.5 px-3">Endpoint</th>
                <th className="py-2.5 px-3">Key Prefix</th>
                <th className="py-2.5 px-3">Duration</th>
                <th className="py-2.5 px-3">Client IP</th>
                <th className="py-2.5 px-3 text-right">Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-xs font-mono">
              {recentLogs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-6 text-center text-slate-500">No recent activity found</td>
                </tr>
              ) : (
                recentLogs.map((log) => {
                  const isSuccess = log.status_code >= 200 && log.status_code < 300;
                  const isClientError = log.status_code >= 400 && log.status_code < 500;
                  return (
                    <tr key={log.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="py-2.5 px-3">
                        <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                          isSuccess ? 'bg-emerald-950 text-emerald-400 border border-emerald-900/50' :
                          isClientError ? 'bg-amber-950 text-amber-400 border border-amber-900/50' :
                          'bg-rose-950 text-rose-400 border border-rose-900/50'
                        }`}>
                          {log.status_code}
                        </span>
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="font-semibold text-slate-300">{log.method}</span>
                      </td>
                      <td className="py-2.5 px-3 text-slate-200">
                        {log.endpoint}
                      </td>
                      <td className="py-2.5 px-3 text-slate-400 truncate max-w-[140px]">
                        {log.key_prefix || 'anonymous'}
                      </td>
                      <td className="py-2.5 px-3 text-slate-300 tabular-nums">
                        {log.duration_ms}ms
                      </td>
                      <td className="py-2.5 px-3 text-slate-400">
                        {log.ip_address}
                      </td>
                      <td className="py-2.5 px-3 text-right text-slate-500 text-[11px]">
                        {new Date(log.timestamp).toLocaleTimeString()}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
