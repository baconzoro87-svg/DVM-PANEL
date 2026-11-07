import React, { useState, useEffect } from 'react';
import {
  Server,
  Play,
  Square,
  RotateCw,
  Trash2,
  Plus,
  RefreshCw,
  Terminal,
  Cpu,
  HardDrive,
  Copy,
  Check,
  AlertCircle,
  ExternalLink
} from 'lucide-react';
import type { VirtualMachineItem, OsImageItem } from '../types/index.ts';
import { ConfirmationModal } from '../components/ConfirmationModal.tsx';
import { CreateVmModal } from '../components/CreateVmModal.tsx';

interface VmListProps {
  images: OsImageItem[];
  onOpenCreateVm: () => void;
  isCreateVmOpen: boolean;
  onCloseCreateVm: () => void;
}

export const VmList: React.FC<VmListProps> = ({
  images,
  onOpenCreateVm,
  isCreateVmOpen,
  onCloseCreateVm,
}) => {
  const [vms, setVms] = useState<VirtualMachineItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [actionVm, setActionVm] = useState<{ type: 'start' | 'stop' | 'restart' | 'delete'; vm: VirtualMachineItem } | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchVms = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/v1/vms');
      const json = await res.json();
      if (res.ok && json.success) {
        setVms(json.data);
      }
    } catch (err) {
      console.error('Failed to fetch VMs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVms();
  }, []);

  const handleCopySsh = async (vm: VirtualMachineItem) => {
    const cmd = `ssh root@${vm.ip_address} -p ${vm.ssh_port}`;
    try {
      await navigator.clipboard.writeText(cmd);
      setCopiedId(vm.id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (e) {
      console.error(e);
    }
  };

  const handleQuickAction = async (type: 'start' | 'stop' | 'restart', vm: VirtualMachineItem) => {
    try {
      const res = await fetch(`/api/v1/vms/${vm.id}/${type}`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error?.message || `Failed to ${type} VM`);
      }
      await fetchVms();
    } catch (err: any) {
      alert(err.message || 'Action failed');
    }
  };

  const executeDelete = async () => {
    if (!actionVm || actionVm.type !== 'delete') return;
    setActionLoading(true);
    try {
      const res = await fetch(`/api/v1/vms/${actionVm.vm.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error?.message || 'Failed to delete VM');
      }
      await fetchVms();
      setActionVm(null);
    } catch (err: any) {
      alert(err.message || 'Delete failed');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="p-4 lg:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <span>Containerized Virtual Machines</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-rose-950 text-rose-300 border border-rose-900/50 font-mono">
              {vms.length} Instances
            </span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Isolated Docker micro-VMs with dedicated OpenSSH ports, cgroup limits, and custom disk allocations.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchVms}
            className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-slate-200 transition-colors"
            title="Refresh Fleet"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-rose-400' : ''}`} />
          </button>
          <button
            onClick={onOpenCreateVm}
            className="px-4 py-2 text-xs font-semibold rounded-xl bg-gradient-to-r from-rose-800 to-rose-700 hover:from-rose-700 hover:to-rose-600 text-white shadow-lg shadow-rose-950/40 flex items-center gap-2 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Deploy VM</span>
          </button>
        </div>
      </div>

      {/* Grid of VMs */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {vms.length === 0 ? (
          <div className="col-span-full p-12 text-center bg-[#111219] border border-white/5 rounded-2xl">
            <Server className="w-10 h-10 text-slate-600 mx-auto mb-3" />
            <h3 className="text-sm font-semibold text-slate-300">No Virtual Machines Deployed</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              Deploy your first containerized VM instance running Ubuntu 24.04, Debian 12, or Alpine Linux.
            </p>
            <button
              onClick={onOpenCreateVm}
              className="mt-4 px-4 py-2 text-xs font-semibold rounded-xl bg-rose-700 hover:bg-rose-600 text-white"
            >
              Deploy First VM
            </button>
          </div>
        ) : (
          vms.map((vm) => {
            const isRunning = vm.status === 'running';
            const isStopped = vm.status === 'stopped';
            const isRestarting = vm.status === 'restarting';

            return (
              <div
                key={vm.id}
                className="p-5 rounded-2xl bg-[#111219] border border-white/5 hover:border-rose-950/60 transition-all flex flex-col justify-between shadow-lg"
              >
                <div>
                  {/* Top Bar: Name & Status */}
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-slate-100">{vm.name}</span>
                      </div>
                      <div className="text-[11px] font-mono text-slate-400 mt-0.5">{vm.image}</div>
                    </div>

                    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                      isRunning ? 'bg-emerald-950 text-emerald-400 border border-emerald-900/60' :
                      isRestarting ? 'bg-amber-950 text-amber-400 border border-amber-900/60 animate-pulse' :
                      'bg-slate-900 text-slate-400 border border-slate-800'
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${isRunning ? 'bg-emerald-400' : isRestarting ? 'bg-amber-400' : 'bg-slate-500'}`} />
                      {vm.status}
                    </span>
                  </div>

                  {/* Hardware Specs Grid */}
                  <div className="grid grid-cols-3 gap-2 p-2.5 bg-[#090A0F] border border-white/5 rounded-xl mb-4 text-center">
                    <div>
                      <div className="text-[10px] text-slate-500 uppercase font-semibold">vCPU</div>
                      <div className="text-xs font-mono font-bold text-slate-200">{vm.cpu} Core{vm.cpu > 1 ? 's' : ''}</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-slate-500 uppercase font-semibold">RAM</div>
                      <div className="text-xs font-mono font-bold text-slate-200">
                        {vm.ram_mb >= 1024 ? `${(vm.ram_mb / 1024).toFixed(1)} GB` : `${vm.ram_mb} MB`}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] text-slate-500 uppercase font-semibold">SSD</div>
                      <div className="text-xs font-mono font-bold text-slate-200">
                        {vm.disk_gb >= 1024 ? `${(vm.disk_gb / 1024).toFixed(1)} TB` : `${vm.disk_gb} GB`}
                      </div>
                    </div>
                  </div>

                  {/* Network details */}
                  <div className="space-y-1.5 mb-4 text-xs font-mono">
                    <div className="flex items-center justify-between text-slate-400">
                      <span>IP Address:</span>
                      <span className={`text-slate-200 ${vm.ip_address === 'Not detected' || vm.ip_address === 'Unavailable' ? 'text-amber-400 italic' : ''}`}>
                        {vm.ip_address}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-slate-400">
                      <span>SSH Host Port:</span>
                      <span className="text-rose-300 font-bold">{vm.ssh_port}</span>
                    </div>
                  </div>

                  {/* Quick SSH Helper */}
                  {vm.ip_address && vm.ip_address !== 'Not detected' && vm.ip_address !== 'Unavailable' ? (
                    <div className="p-2 bg-black/40 border border-white/5 rounded-lg flex items-center justify-between text-[11px] font-mono text-slate-300 mb-4">
                      <span className="truncate">ssh root@{vm.ip_address} -p {vm.ssh_port}</span>
                      <button
                        onClick={() => handleCopySsh(vm)}
                        className="ml-2 text-slate-400 hover:text-white p-1 shrink-0"
                        title="Copy SSH Command"
                      >
                        {copiedId === vm.id ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  ) : (
                    <div className="p-2 bg-black/20 border border-white/5 rounded-lg text-[11px] font-mono text-slate-500 mb-4 flex items-center justify-between">
                      <span>SSH: Port {vm.ssh_port} mapped to guest :22</span>
                    </div>
                  )}
                </div>

                {/* VM Controls */}
                <div className="pt-3 border-t border-white/5 flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    {isRunning ? (
                      <button
                        onClick={() => handleQuickAction('stop', vm)}
                        className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white transition-colors"
                        title="Stop VM"
                      >
                        <Square className="w-3.5 h-3.5" />
                      </button>
                    ) : (
                      <button
                        onClick={() => handleQuickAction('start', vm)}
                        className="p-1.5 rounded-lg bg-emerald-950/60 hover:bg-emerald-900 text-emerald-300 border border-emerald-800/40 transition-colors"
                        title="Start VM"
                      >
                        <Play className="w-3.5 h-3.5" />
                      </button>
                    )}

                    <button
                      onClick={() => handleQuickAction('restart', vm)}
                      className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white transition-colors"
                      title="Restart VM"
                    >
                      <RotateCw className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <button
                    onClick={() => setActionVm({ type: 'delete', vm })}
                    className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-950/30 transition-colors"
                    title="Destroy VM"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {actionVm && actionVm.type === 'delete' && (
        <ConfirmationModal
          isOpen={true}
          title={`Destroy Virtual Machine: ${actionVm.vm.name}?`}
          message={`This will permanently terminate the container instance, release SSH port ${actionVm.vm.ssh_port}, and unmount root NVMe disk data. This cannot be undone.`}
          confirmLabel="Destroy VM Permanently"
          isDestructive={true}
          isLoading={actionLoading}
          onConfirm={executeDelete}
          onCancel={() => setActionVm(null)}
        />
      )}

      {/* Deploy Modal */}
      <CreateVmModal
        isOpen={isCreateVmOpen}
        images={images}
        onClose={onCloseCreateVm}
        onVmCreated={fetchVms}
      />
    </div>
  );
};
