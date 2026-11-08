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
  Radio,
  FileText,
  RotateCcw,
  User,
  Shield,
  Layers,
  Info
} from 'lucide-react';
import type { VirtualMachineItem, OsImageItem, UserItem, UserDeployStatus } from '../types/index.ts';
import { ConfirmationModal } from '../components/ConfirmationModal.tsx';
import { CreateVmModal } from '../components/CreateVmModal.tsx';
import { TerminalConsole } from '../components/TerminalConsole.tsx';

interface VmListProps {
  images: OsImageItem[];
  currentUser?: UserItem | null;
  onOpenCreateVm: () => void;
  isCreateVmOpen: boolean;
  onCloseCreateVm: () => void;
}

export const VmList: React.FC<VmListProps> = ({
  images,
  currentUser,
  onOpenCreateVm,
  isCreateVmOpen,
  onCloseCreateVm,
}) => {
  const [vms, setVms] = useState<(VirtualMachineItem & { owner_email?: string; owner_username?: string })[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [actionVm, setActionVm] = useState<{ type: 'start' | 'stop' | 'restart' | 'delete' | 'reinstall'; vm: VirtualMachineItem } | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [consoleVm, setConsoleVm] = useState<VirtualMachineItem | null>(null);
  const [logsVm, setLogsVm] = useState<VirtualMachineItem | null>(null);
  const [containerLogs, setContainerLogs] = useState<string>('');
  const [logsLoading, setLogsLoading] = useState(false);
  const [reinstallImage, setReinstallImage] = useState<string>('ubuntu:24.04');
  const [slotStatus, setSlotStatus] = useState<UserDeployStatus | null>(null);

  const fetchVms = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('dvm_token');
      // If admin, fetch all fleet VMs via /admin/vms or /vms
      const endpoint = currentUser?.role === 'admin' ? '/api/v1/admin/vms' : '/api/v1/vms';
      const res = await fetch(endpoint, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
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

  const fetchSlotStatus = async () => {
    try {
      const token = localStorage.getItem('dvm_token');
      const res = await fetch('/api/v1/autodeploy', {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSlotStatus(data.data.user_deployment);
      }
    } catch {}
  };

  useEffect(() => {
    fetchVms();
    fetchSlotStatus();
  }, [currentUser?.role]);

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
      const token = localStorage.getItem('dvm_token');
      const res = await fetch(`/api/v1/vms/${vm.id}/${type}`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
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
      const token = localStorage.getItem('dvm_token');
      const res = await fetch(`/api/v1/vms/${actionVm.vm.id}`, {
        method: 'DELETE',
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error?.message || 'Failed to delete VM');
      }
      await fetchVms();
      await fetchSlotStatus();
      setActionVm(null);
    } catch (err: any) {
      alert(err.message || 'Delete failed');
    } finally {
      setActionLoading(false);
    }
  };

  const executeReinstall = async () => {
    if (!actionVm || actionVm.type !== 'reinstall') return;
    setActionLoading(true);
    try {
      const token = localStorage.getItem('dvm_token');
      const res = await fetch(`/api/v1/vms/${actionVm.vm.id}/reinstall`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ image: reinstallImage })
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error?.message || 'Reinstall failed');
      }
      await fetchVms();
      setActionVm(null);
    } catch (err: any) {
      alert(err.message || 'Reinstall failed');
    } finally {
      setActionLoading(false);
    }
  };

  const fetchLogs = async (vm: VirtualMachineItem) => {
    setLogsVm(vm);
    setLogsLoading(true);
    try {
      const token = localStorage.getItem('dvm_token');
      const res = await fetch(`/api/v1/vms/${vm.id}/logs`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setContainerLogs(data.data.logs || 'No logs captured yet.');
      } else {
        setContainerLogs(data.error?.message || 'Could not retrieve logs.');
      }
    } catch (err: any) {
      setContainerLogs('Error fetching logs: ' + err.message);
    } finally {
      setLogsLoading(false);
    }
  };

  return (
    <div className="p-4 lg:p-8 space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
              <span>{currentUser?.role === 'admin' ? 'Fleet Virtual Machines' : 'My Virtual Machines'}</span>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-rose-950 text-rose-300 border border-rose-900/50 font-mono">
                {vms.length} Instances
              </span>
            </h2>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            High-density containerized Linux virtual instances with root console, dedicated SSH ports, and cgroup isolation.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* User Slot Status Display */}
          {currentUser?.role !== 'admin' && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#0F111A] border border-rose-950 text-xs font-mono">
              <span className="text-slate-400">Status:</span>
              <span className={vms.length > 0 ? "text-emerald-400 font-bold" : "text-amber-400 font-bold"}>
                {vms.length > 0 ? "1/1 VPS Active" : "No VPS Provisioned"}
              </span>
            </div>
          )}

          <button
            onClick={() => {
              fetchVms();
              fetchSlotStatus();
            }}
            className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
            title="Refresh Fleet"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-rose-400' : ''}`} />
          </button>

          {currentUser?.role === 'admin' && (
            <button
              onClick={onOpenCreateVm}
              className="px-4 py-2 text-xs font-semibold rounded-xl bg-gradient-to-r from-rose-800 to-rose-700 hover:from-rose-700 hover:to-rose-600 text-white shadow-lg shadow-rose-950/40 flex items-center gap-2 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Deploy VPS</span>
            </button>
          )}
        </div>
      </div>

      {/* User Information Banner for Standard Users */}
      {currentUser?.role !== 'admin' && vms.length === 0 && (
        <div className="p-4 rounded-2xl bg-amber-950/20 border border-amber-800/40 text-amber-200 text-xs flex items-start gap-3">
          <Info className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-amber-300">No VPS Instance Allocated</p>
            <p className="text-slate-400 mt-0.5">
              VPS provisioning on this BusterNodes cluster is strictly managed by administrators. Please contact your system administrator (<code className="text-amber-300">admin@dvm.io</code>) to allocate and deploy your VPS instance.
            </p>
          </div>
        </div>
      )}

      {currentUser?.role !== 'admin' && vms.length >= 1 && (
        <div className="p-3.5 rounded-xl bg-rose-950/20 border border-rose-900/40 text-rose-300 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Active Instance Allocated — 1/1 VPS Limit Reached</span>
          </div>
          <span className="text-[11px] text-slate-500 font-mono">Strict 1 VPS Policy</span>
        </div>
      )}

      {/* Grid of VMs */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {vms.length === 0 ? (
          <div className="col-span-full p-12 text-center bg-[#0F111A] border border-rose-950/60 rounded-2xl">
            <Server className="w-12 h-12 text-rose-900/60 mx-auto mb-3" />
            <h3 className="text-sm font-semibold text-slate-200">No Virtual Machines Assigned</h3>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
              {currentUser?.role === 'admin'
                ? 'No instances active in this BusterNodes host cluster. Click "Deploy VPS" above to provision an instance.'
                : 'You do not have an active VPS instance provisioned. Please contact your administrator to allocate your container instance.'}
            </p>
            {currentUser?.role === 'admin' && (
              <button
                onClick={onOpenCreateVm}
                className="mt-4 px-4 py-2 text-xs font-semibold rounded-xl bg-gradient-to-r from-rose-600 to-pink-700 hover:from-rose-500 text-white shadow-lg cursor-pointer"
              >
                Deploy First VPS
              </button>
            )}
          </div>
        ) : (
          vms.map((vm) => {
            const isRunning = vm.status === 'running';
            const isRestarting = vm.status === 'restarting';

            return (
              <div
                key={vm.id}
                className="p-5 rounded-2xl bg-[#0F111A] border border-rose-950/70 hover:border-rose-800/60 transition-all flex flex-col justify-between shadow-xl relative overflow-hidden"
              >
                <div>
                  {/* Top Bar: Name, Owner (if admin), and Status */}
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-white">{vm.name}</span>
                        {currentUser?.role === 'admin' && vm.owner_username && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] bg-slate-900 text-slate-400 border border-slate-800 font-mono">
                            @{vm.owner_username}
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] font-mono text-slate-400 mt-0.5 flex items-center gap-1.5">
                        <span className="text-rose-400">{vm.image}</span>
                        <span>&bull;</span>
                        <span className="text-slate-500">{vm.id}</span>
                      </div>
                    </div>

                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider ${
                        isRunning
                          ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-800/60'
                          : isRestarting
                          ? 'bg-amber-950/80 text-amber-300 border border-amber-800/60 animate-pulse'
                          : 'bg-slate-900 text-slate-400 border border-slate-800'
                      }`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          isRunning ? 'bg-emerald-400' : isRestarting ? 'bg-amber-400' : 'bg-slate-500'
                        }`}
                      />
                      {vm.status}
                    </span>
                  </div>

                  {/* Hardware Specs Grid */}
                  <div className="grid grid-cols-3 gap-2 p-2.5 bg-[#07080C] border border-slate-800/80 rounded-xl mb-4 text-center">
                    <div>
                      <div className="text-[10px] text-slate-500 uppercase font-semibold">vCPU</div>
                      <div className="text-xs font-mono font-bold text-slate-200">
                        {vm.cpu} Core{vm.cpu > 1 ? 's' : ''}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] text-slate-500 uppercase font-semibold">RAM</div>
                      <div className="text-xs font-mono font-bold text-slate-200">
                        {vm.ram_mb >= 1024 ? `${(vm.ram_mb / 1024).toFixed(1)} GB` : `${vm.ram_mb} MB`}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] text-slate-500 uppercase font-semibold">SSD Disk</div>
                      <div className="text-xs font-mono font-bold text-slate-200">
                        {vm.disk_gb >= 1024 ? `${(vm.disk_gb / 1024).toFixed(1)} TB` : `${vm.disk_gb} GB`}
                      </div>
                    </div>
                  </div>

                  {/* Network details */}
                  <div className="space-y-1.5 mb-4 text-xs font-mono">
                    <div className="flex items-center justify-between text-slate-400">
                      <span>IP Address:</span>
                      <span className="text-slate-200">{vm.ip_address || 'Unavailable'}</span>
                    </div>
                    <div className="flex items-center justify-between text-slate-400">
                      <span>SSH Host Port:</span>
                      <span className="text-rose-300 font-bold">{vm.ssh_port}</span>
                    </div>
                  </div>

                  {/* Quick SSH Helper */}
                  {vm.ip_address && vm.ip_address !== 'Not detected' && vm.ip_address !== 'Unavailable' ? (
                    <div className="p-2 bg-[#07080C] border border-slate-800/80 rounded-lg flex items-center justify-between text-[11px] font-mono text-slate-300 mb-4">
                      <span className="truncate">ssh root@{vm.ip_address} -p {vm.ssh_port}</span>
                      <button
                        onClick={() => handleCopySsh(vm)}
                        className="ml-2 text-slate-400 hover:text-white p-1 shrink-0 cursor-pointer"
                        title="Copy SSH Command"
                      >
                        {copiedId === vm.id ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  ) : null}
                </div>

                {/* Primary Interactive Console & SSHX Launcher */}
                <div className="grid grid-cols-2 gap-2 mb-3">
                  <button
                    type="button"
                    onClick={() => setConsoleVm(vm)}
                    className="py-2 px-3 rounded-xl bg-gradient-to-r from-rose-950/80 to-pink-950/80 hover:from-rose-900 hover:to-pink-900 border border-rose-800/60 text-xs font-semibold text-rose-200 flex items-center justify-center gap-1.5 transition-all shadow-sm cursor-pointer"
                  >
                    <Terminal className="w-3.5 h-3.5 text-rose-400" />
                    <span>Web Console</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setConsoleVm(vm)}
                    className="py-2 px-3 rounded-xl bg-[#07080C] hover:bg-slate-800 border border-slate-800 text-xs font-semibold text-slate-300 hover:text-white flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                  >
                    <Radio className="w-3.5 h-3.5 text-rose-400" />
                    <span>SSHX Session</span>
                  </button>
                </div>

                {/* VM Controls Footer */}
                <div className="pt-3 border-t border-rose-950/60 flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    {isRunning ? (
                      <button
                        onClick={() => handleQuickAction('stop', vm)}
                        className="p-1.5 rounded-lg bg-[#07080C] hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white transition-colors cursor-pointer"
                        title="Stop VM"
                      >
                        <Square className="w-3.5 h-3.5" />
                      </button>
                    ) : (
                      <button
                        onClick={() => handleQuickAction('start', vm)}
                        className="p-1.5 rounded-lg bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-800/50 text-emerald-300 transition-colors cursor-pointer"
                        title="Start VM"
                      >
                        <Play className="w-3.5 h-3.5" />
                      </button>
                    )}

                    <button
                      onClick={() => handleQuickAction('restart', vm)}
                      className="p-1.5 rounded-lg bg-[#07080C] hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white transition-colors cursor-pointer"
                      title="Restart VM"
                    >
                      <RotateCw className="w-3.5 h-3.5" />
                    </button>

                    <button
                      onClick={() => fetchLogs(vm)}
                      className="p-1.5 rounded-lg bg-[#07080C] hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white transition-colors cursor-pointer"
                      title="Container Logs"
                    >
                      <FileText className="w-3.5 h-3.5" />
                    </button>

                    <button
                      onClick={() => {
                        setReinstallImage(vm.image);
                        setActionVm({ type: 'reinstall', vm });
                      }}
                      className="p-1.5 rounded-lg bg-[#07080C] hover:bg-rose-950/40 border border-slate-800 text-slate-400 hover:text-rose-300 transition-colors cursor-pointer"
                      title="Reinstall Operating System"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <button
                    onClick={() => setActionVm({ type: 'delete', vm })}
                    className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-950/40 transition-colors cursor-pointer"
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

      {/* Terminal Console Modal */}
      {consoleVm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-md">
          <div className="w-full max-w-4xl bg-[#0A0B10] border border-rose-800/70 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
            <div className="flex items-center justify-between px-5 py-3.5 bg-[#0E1017] border-b border-rose-950/80">
              <div className="flex items-center gap-2.5">
                <Terminal className="w-4 h-4 text-rose-400" />
                <h3 className="text-sm font-bold text-white">
                  Console & SSHX: <span className="text-rose-300">{consoleVm.name}</span>
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setConsoleVm(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 text-xs cursor-pointer"
              >
                ✕ Close
              </button>
            </div>

            <div className="p-3 sm:p-5 overflow-y-auto">
              <TerminalConsole vm={consoleVm} onRefreshVm={fetchVms} />
            </div>
          </div>
        </div>
      )}

      {/* Container Logs Modal */}
      {logsVm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="w-full max-w-3xl bg-[#0F111A] border border-rose-800/60 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between px-5 py-3.5 bg-[#090A0F] border-b border-rose-950/80">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-rose-400" />
                <h3 className="text-sm font-bold text-white">
                  Container Logs: <span className="text-rose-300">{logsVm.name}</span>
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => fetchLogs(logsVm)}
                  className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
                  title="Refresh Logs"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${logsLoading ? 'animate-spin text-rose-400' : ''}`} />
                </button>
                <button
                  onClick={() => setLogsVm(null)}
                  className="text-slate-400 hover:text-white text-xs cursor-pointer px-2 py-1"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="p-4 bg-[#07080C] overflow-y-auto font-mono text-xs text-slate-300 leading-relaxed whitespace-pre-wrap flex-1 max-h-[60vh]">
              {logsLoading ? 'Fetching container daemon logs...' : containerLogs}
            </div>
          </div>
        </div>
      )}

      {/* Reinstall OS Confirmation Modal */}
      {actionVm && actionVm.type === 'reinstall' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-md bg-[#0F111A] border border-rose-800/70 rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 pb-3 border-b border-rose-950/60">
              <div className="w-10 h-10 rounded-xl bg-rose-600/20 border border-rose-600/40 flex items-center justify-center text-rose-400 shrink-0">
                <RotateCcw className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Reinstall OS: {actionVm.vm.name}</h3>
                <p className="text-xs text-slate-400 mt-0.5">Wipes container disk while preserving SSH port & specs</p>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-800/50 text-xs text-rose-200">
              Warning: All files inside the container root filesystem will be permanently deleted. Your assigned IP and SSH port ({actionVm.vm.ssh_port}) will remain identical.
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Target Operating System
              </label>
              <select
                value={reinstallImage}
                onChange={(e) => setReinstallImage(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-[#07080C] border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-rose-500"
              >
                {images.map((img) => (
                  <option key={img.tag} value={img.tag}>
                    {img.name} ({img.tag})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setActionVm(null)}
                className="flex-1 py-2.5 rounded-xl text-xs text-slate-400 bg-slate-900 border border-slate-800 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={executeReinstall}
                disabled={actionLoading}
                className="flex-1 py-2.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-rose-600 to-pink-700 hover:from-rose-500 transition-all cursor-pointer disabled:opacity-50"
              >
                {actionLoading ? 'Reinstalling...' : 'Confirm Reinstall'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {actionVm && actionVm.type === 'delete' && (
        <ConfirmationModal
          isOpen={true}
          title={`Destroy Virtual Machine: ${actionVm.vm.name}?`}
          message={`This will permanently terminate the container instance, release SSH port ${actionVm.vm.ssh_port}, and unmount root disk data. This cannot be undone.`}
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
        onVmCreated={() => {
          fetchVms();
          fetchSlotStatus();
        }}
      />
    </div>
  );
};
