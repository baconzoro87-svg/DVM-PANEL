import React, { useState } from 'react';
import { Cpu, Server, HardDrive, CheckCircle2, AlertTriangle, RefreshCw, Terminal, Activity, Disc, Layers } from 'lucide-react';
import type { SystemStatusData } from '../types/index.ts';

interface DiagnosticsProps {
  systemStatus: SystemStatusData | null;
  onRefresh: () => void;
}

export const Diagnostics: React.FC<DiagnosticsProps> = ({
  systemStatus,
  onRefresh,
}) => {
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await onRefresh();
    setTimeout(() => setIsRefreshing(false), 500);
  };

  const isDockerLive = systemStatus?.docker.available;
  const res = systemStatus?.resources;

  return (
    <div className="p-4 lg:p-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <span>Host & Virtualization Diagnostics</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-rose-950 text-rose-300 border border-rose-900/50 font-mono">
              BusterNodes
            </span>
          </h2>
          <p className="text-xs text-slate-400 mt-1 max-w-2xl">
            Real-time evaluation of host hardware capabilities, kernel virtualization sockets, and container orchestration readiness.
          </p>
        </div>

        <button
          onClick={handleRefresh}
          className="px-3.5 py-2 text-xs font-semibold rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white transition-colors flex items-center gap-2 self-start sm:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-rose-400' : ''}`} />
          <span>Re-inspect Host</span>
        </button>
      </div>

      {/* Docker Engine Status Card */}
      <div className={`p-6 rounded-2xl border ${
        isDockerLive
          ? 'bg-emerald-950/20 border-emerald-900/50 shadow-xl'
          : 'bg-[#14080D] border-amber-900/50 shadow-xl'
      }`}>
        <div className="flex items-start gap-4">
          <div className={`p-3 rounded-xl shrink-0 ${
            isDockerLive
              ? 'bg-emerald-950 text-emerald-400 border border-emerald-800/50'
              : 'bg-amber-950 text-amber-400 border border-amber-800/50'
          }`}>
            {isDockerLive ? <CheckCircle2 className="w-6 h-6" /> : <AlertTriangle className="w-6 h-6" />}
          </div>

          <div className="space-y-2 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base font-bold text-slate-100">
                Docker Virtualization Engine: {isDockerLive ? 'Live & Connected' : 'Standby / Container Emulation Mode'}
              </h3>
              <span className={`text-[10px] font-mono px-2 py-0.5 rounded ${
                isDockerLive
                  ? 'bg-emerald-950 text-emerald-300 border border-emerald-800/50'
                  : 'bg-amber-950 text-amber-300 border border-amber-800/50'
              }`}>
                {systemStatus?.docker.mode || 'MANAGED_CONTAINER_STATE'}
              </span>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              {systemStatus?.docker.diagnostics}
            </p>

            <div className="pt-2 grid grid-cols-1 sm:grid-cols-3 gap-3 font-mono text-xs">
              <div className="p-2.5 rounded-lg bg-black/40 border border-white/5">
                <div className="text-[10px] text-slate-500 uppercase">Docker CLI</div>
                <div className="text-slate-200 font-bold">{isDockerLive ? 'Present' : 'Not installed in sandbox'}</div>
              </div>
              <div className="p-2.5 rounded-lg bg-black/40 border border-white/5">
                <div className="text-[10px] text-slate-500 uppercase">Socket (/var/run/docker.sock)</div>
                <div className="text-slate-200 font-bold">{systemStatus?.docker.socket_detected ? 'Detected' : 'Not Mounted'}</div>
              </div>
              <div className="p-2.5 rounded-lg bg-black/40 border border-white/5">
                <div className="text-[10px] text-slate-500 uppercase">Docker Server Version</div>
                <div className="text-slate-200 font-bold">{systemStatus?.docker.version || 'Unavailable'}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Real Hardware Infrastructure Breakdown */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Real CPU */}
        <div className="p-4 rounded-xl bg-[#111219] border border-white/5">
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1.5">
            <Cpu className="w-3.5 h-3.5 text-rose-400" />
            Host CPU Cores
          </div>
          <div className="text-xl font-bold font-mono text-slate-100">
            {res ? `${res.cpu.cores} Cores` : `${systemStatus?.host.cpus || 0} Cores`}
          </div>
          <div className="text-[11px] text-slate-500 mt-1 font-mono">
            {res ? `${res.cpu.allocatedCores} allocated (${res.cpu.availableCores} free)` : 'Calculated live'}
          </div>
        </div>

        {/* Real RAM */}
        <div className="p-4 rounded-xl bg-[#111219] border border-white/5">
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1.5">
            <HardDrive className="w-3.5 h-3.5 text-rose-400" />
            System Memory (RAM)
          </div>
          <div className="text-xl font-bold font-mono text-slate-100">
            {res ? `${(res.ram.totalMb / 1024).toFixed(1)} GB` : `${systemStatus ? Math.round(systemStatus.host.total_memory_mb / 1024) : 0} GB`}
          </div>
          <div className="text-[11px] text-slate-500 mt-1 font-mono">
            {res ? `${(res.ram.freeMb / 1024).toFixed(1)} GB free (${(res.ram.allocatedMb / 1024).toFixed(1)} GB allocated)` : 'Real kernel stats'}
          </div>
        </div>

        {/* Real SSD Storage */}
        <div className="p-4 rounded-xl bg-[#111219] border border-white/5">
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1.5">
            <Disc className="w-3.5 h-3.5 text-rose-400" />
            Root SSD / NVMe Storage
          </div>
          <div className="text-xl font-bold font-mono text-slate-100">
            {res && res.disk.totalGb > 0 ? `${res.disk.totalGb} GB` : 'Unavailable'}
          </div>
          <div className="text-[11px] text-slate-500 mt-1 font-mono">
            {res && res.disk.freeGb > 0 ? `${res.disk.freeGb} GB available on /` : 'Mount query'}
          </div>
        </div>

        {/* Real Environment & Virtualization */}
        <div className="p-4 rounded-xl bg-[#111219] border border-white/5">
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-rose-400" />
            Virtualization Type
          </div>
          <div className="text-base font-bold text-slate-100 truncate">
            {res?.environment.virtualization || 'Linux Environment'}
          </div>
          <div className="text-[11px] text-slate-500 mt-1 font-mono truncate">
            {systemStatus?.host.platform} {systemStatus?.host.arch} ({res?.environment.release || ''})
          </div>
        </div>
      </div>

      {/* Real Virtual Machine Fleet Status */}
      <div className="p-5 rounded-2xl bg-[#111219] border border-white/5 space-y-4">
        <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider">
          Actual Virtual Machine Allocations & Fleet Status
        </h3>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
          <div className="p-3 bg-[#090A0F] border border-white/5 rounded-xl">
            <div className="text-[10px] text-slate-500 uppercase font-semibold">Total VMs</div>
            <div className="text-lg font-bold font-mono text-slate-100">{res?.vmCounts.total ?? 0}</div>
          </div>
          <div className="p-3 bg-[#090A0F] border border-white/5 rounded-xl">
            <div className="text-[10px] text-slate-500 uppercase font-semibold">Running VMs</div>
            <div className="text-lg font-bold font-mono text-emerald-400">{res?.vmCounts.running ?? 0}</div>
          </div>
          <div className="p-3 bg-[#090A0F] border border-white/5 rounded-xl">
            <div className="text-[10px] text-slate-500 uppercase font-semibold">Stopped VMs</div>
            <div className="text-lg font-bold font-mono text-slate-400">{res?.vmCounts.stopped ?? 0}</div>
          </div>
          <div className="p-3 bg-[#090A0F] border border-white/5 rounded-xl">
            <div className="text-[10px] text-slate-500 uppercase font-semibold">Allocated vCPUs</div>
            <div className="text-lg font-bold font-mono text-rose-300">{res?.cpu.allocatedCores ?? 0} Cores</div>
          </div>
        </div>
      </div>
    </div>
  );
};
