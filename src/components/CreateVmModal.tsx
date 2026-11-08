import React, { useState, useEffect } from 'react';
import { X, Server, Cpu, HardDrive, Disc, ShieldAlert, Info, AlertTriangle, UserCheck } from 'lucide-react';
import type { OsImageItem, HostResourceInfo, UserItem } from '../types/index.ts';

interface CreateVmModalProps {
  isOpen: boolean;
  images: OsImageItem[];
  hostResources?: HostResourceInfo | null;
  currentUser?: UserItem | null;
  onClose: () => void;
  onVmCreated: () => void;
}

export const CreateVmModal: React.FC<CreateVmModalProps> = ({
  isOpen,
  images,
  hostResources: propHostResources,
  currentUser,
  onClose,
  onVmCreated,
}) => {
  const [name, setName] = useState('');
  const [selectedImage, setSelectedImage] = useState('nobitaa/ubuntu:24');
  const [targetUserId, setTargetUserId] = useState<string>('');
  const [usersList, setUsersList] = useState<UserItem[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  
  // Custom CPU input
  const [cpu, setCpu] = useState<number>(2);

  // Custom RAM input + unit
  const [ramValue, setRamValue] = useState<number>(2);
  const [ramUnit, setRamUnit] = useState<'MB' | 'GB'>('GB');

  // Custom Disk input + unit
  const [diskValue, setDiskValue] = useState<number>(20);
  const [diskUnit, setDiskUnit] = useState<'GB' | 'TB'>('GB');

  const [sshPort, setSshPort] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [hostResources, setHostResources] = useState<HostResourceInfo | null>(propHostResources || null);

  useEffect(() => {
    if (isOpen) {
      const token = localStorage.getItem('dvm_token');

      fetch('/api/v1/resources', {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      })
        .then(res => res.json())
        .then(data => {
          if (data.success && data.data) {
            setHostResources(data.data);
          }
        })
        .catch(() => {});

      if (currentUser?.role === 'admin') {
        setUsersLoading(true);
        fetch('/api/v1/admin/users', {
          headers: token ? { Authorization: `Bearer ${token}` } : {}
        })
          .then(res => res.json())
          .then(data => {
            if (data.success && Array.isArray(data.data)) {
              setUsersList(data.data);
              if (data.data.length > 0) {
                // Default to first user or currentUser
                const defaultTarget = data.data.find((u: UserItem) => u.id === currentUser.id) || data.data[0];
                setTargetUserId(defaultTarget.id);
              }
            }
          })
          .catch(() => {})
          .finally(() => setUsersLoading(false));
      }
    }
  }, [isOpen, currentUser]);

  if (!isOpen) return null;

  // Convert to canonical MB for RAM and GB for Disk
  const totalRamMb = ramUnit === 'GB' ? Math.round(ramValue * 1024) : Math.round(ramValue);
  const totalDiskGb = diskUnit === 'TB' ? Math.round(diskValue * 1024) : Math.round(diskValue);

  // Host bounds
  const hostCores = hostResources?.cpu.cores || 1;
  const hostAvailCores = hostResources?.cpu.availableCores ?? hostCores;
  const hostTotalRamMb = hostResources?.ram.totalMb || 1024;
  const hostFreeRamMb = hostResources?.ram.freeMb ?? hostTotalRamMb;
  const hostFreeDiskGb = hostResources?.disk.freeGb ?? 20;
  const hostTotalDiskGb = hostResources?.disk.totalGb ?? 20;

  // Real-time capacity warnings
  const isCpuExceeding = hostResources && cpu > hostCores;
  const isRamExceeding = hostResources && totalRamMb > hostTotalRamMb;
  const isDiskExceeding = hostResources && totalDiskGb > hostFreeDiskGb && hostFreeDiskGb > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMsg('Virtual machine name is required');
      return;
    }

    if (cpu < 1 || isNaN(cpu)) {
      setErrorMsg('CPU core count must be at least 1');
      return;
    }

    if (totalRamMb < 128 || isNaN(totalRamMb)) {
      setErrorMsg('RAM allocation must be at least 128 MB');
      return;
    }

    if (totalDiskGb < 1 || isNaN(totalDiskGb)) {
      setErrorMsg('Disk allocation must be at least 1 GB');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      const payload: any = {
        name: name.trim(),
        image: selectedImage,
        cpu,
        ram_mb: totalRamMb,
        disk_gb: totalDiskGb,
        notes: notes.trim(),
        target_user_id: targetUserId || currentUser?.id
      };
      if (sshPort && parseInt(sshPort, 10)) {
        payload.ssh_port = parseInt(sshPort, 10);
      }

      const token = localStorage.getItem('dvm_token');
      const endpoint = currentUser?.role === 'admin' ? '/api/v1/admin/vms' : '/api/v1/vms';
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error?.message || 'Failed to create virtual machine');
      }

      onVmCreated();
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Error occurred while provisioning VM');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-[#111219] border border-rose-950/70 rounded-2xl shadow-2xl p-6 text-slate-100 my-8">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-slate-400 hover:text-slate-200 p-1 rounded-lg hover:bg-white/5 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-rose-950 to-rose-900 border border-rose-800/40 text-rose-300">
            <Server className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-100">Deploy Virtual Machine</h3>
            <p className="text-xs text-slate-400">Customizable hardware allocation backed by real BusterNodes infrastructure</p>
          </div>
        </div>

        {/* Real Host Capacity Header Card */}
        {hostResources && (
          <div className="mb-4 p-3 rounded-xl bg-[#090A0F] border border-white/5 text-xs text-slate-300">
            <div className="flex items-center justify-between font-semibold text-slate-400 mb-1.5 uppercase tracking-wider text-[10px]">
              <span>Real Host Infrastructure Capacity</span>
              <span className="text-rose-400 font-mono">{hostResources.environment.virtualization}</span>
            </div>
            <div className="grid grid-cols-3 gap-2 font-mono text-[11px]">
              <div>
                <span className="text-slate-500">Host CPU:</span>{' '}
                <span className="text-slate-100 font-bold">{hostResources.cpu.cores} Cores</span>{' '}
                <span className="text-slate-500">({hostResources.cpu.allocatedCores} allocated)</span>
              </div>
              <div>
                <span className="text-slate-500">Host RAM:</span>{' '}
                <span className="text-slate-100 font-bold">{(hostResources.ram.totalMb / 1024).toFixed(1)} GB</span>{' '}
                <span className="text-slate-500">({(hostResources.ram.freeMb / 1024).toFixed(1)} GB free)</span>
              </div>
              <div>
                <span className="text-slate-500">Host SSD:</span>{' '}
                <span className="text-slate-100 font-bold">{hostResources.disk.totalGb} GB</span>{' '}
                <span className="text-slate-500">({hostResources.disk.freeGb} GB free)</span>
              </div>
            </div>
          </div>
        )}

        {errorMsg && (
          <div className="mb-4 p-3 rounded-xl bg-rose-950/60 border border-rose-800/70 text-xs text-rose-300 flex items-start gap-2 leading-relaxed">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {currentUser?.role === 'admin' && (
            <div className="p-3 bg-rose-950/20 border border-rose-900/40 rounded-xl">
              <label className="block text-xs font-semibold text-rose-300 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <UserCheck className="w-3.5 h-3.5 text-rose-400" />
                Assign VPS To Registered User <span className="text-rose-500">*</span>
              </label>
              {usersLoading ? (
                <div className="text-xs text-slate-400 py-1">Loading registered user accounts...</div>
              ) : (
                <select
                  value={targetUserId}
                  onChange={(e) => setTargetUserId(e.target.value)}
                  className="w-full px-3 py-2 bg-[#090A0F] border border-rose-900/50 rounded-xl text-xs text-white focus:outline-none focus:border-rose-500 font-medium"
                >
                  {usersList.map(u => (
                    <option key={u.id} value={u.id}>
                      {u.username} ({u.email}) — [{u.role.toUpperCase()}]
                    </option>
                  ))}
                </select>
              )}
              <p className="text-[11px] text-slate-400 mt-1">
                Each user can own at most 1 active VPS. Admin can allocate and deploy on behalf of any registered user.
              </p>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Hostname / VM Identifier <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g. dvm-edge-gateway, dvm-worker-app"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-[#090A0F] border border-white/10 rounded-xl text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-rose-600 transition-colors font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Operating System Template
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-40 overflow-y-auto p-1.5 bg-[#090A0F] border border-white/10 rounded-xl">
              {images.map(img => (
                <div
                  key={img.id}
                  onClick={() => setSelectedImage(img.tag)}
                  className={`p-2.5 rounded-lg border cursor-pointer transition-all ${
                    selectedImage === img.tag
                      ? 'bg-rose-950/50 border-rose-600 text-rose-100'
                      : 'bg-white/[0.02] border-white/5 text-slate-400 hover:border-white/10'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold text-xs text-slate-200">{img.name}</span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {img.category}
                    </span>
                  </div>
                  <div className="font-mono text-[11px] text-slate-400">{img.tag}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Fully Custom CPU Allocation */}
          <div className="p-3.5 bg-[#090A0F] border border-white/10 rounded-xl space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <Cpu className="w-3.5 h-3.5 text-rose-400" />
                Custom vCPU Allocation
              </label>
              <div className="flex items-center gap-1.5 text-xs">
                <span className="text-slate-400">Requested:</span>
                <span className="font-mono font-bold text-rose-300">{cpu} Core{cpu > 1 ? 's' : ''}</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="number"
                min={1}
                step={1}
                required
                value={cpu}
                onChange={(e) => setCpu(Math.max(1, parseInt(e.target.value, 10) || 1))}
                className="w-full px-3 py-2 bg-[#111219] border border-white/10 rounded-xl text-xs font-mono text-slate-100 focus:outline-none focus:border-rose-600"
                placeholder="Enter custom core count (e.g. 1, 2, 4, 8, 16, 32, 64...)"
              />
            </div>

            {/* Quick Presets */}
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              {[1, 2, 4, 8, 16, 32, 64].map(corePreset => (
                <button
                  type="button"
                  key={corePreset}
                  onClick={() => setCpu(corePreset)}
                  className={`px-2 py-0.5 rounded text-[11px] font-mono transition-colors ${
                    cpu === corePreset
                      ? 'bg-rose-950 text-rose-300 border border-rose-700'
                      : 'bg-white/5 hover:bg-white/10 text-slate-400'
                  }`}
                >
                  {corePreset} vCPU
                </button>
              ))}
            </div>

            {isCpuExceeding && (
              <div className="text-[11px] text-amber-400 flex items-center gap-1 mt-1">
                <Info className="w-3.5 h-3.5 shrink-0" />
                <span>Requested CPU exceeds physical host core count ({hostCores} cores). Allowed if host allows overcommit.</span>
              </div>
            )}
          </div>

          {/* Fully Custom RAM Allocation */}
          <div className="p-3.5 bg-[#090A0F] border border-white/10 rounded-xl space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <HardDrive className="w-3.5 h-3.5 text-rose-400" />
                Custom RAM / Memory
              </label>
              <div className="flex items-center gap-1.5 text-xs">
                <span className="text-slate-400">Total:</span>
                <span className="font-mono font-bold text-rose-300">
                  {totalRamMb >= 1024 ? `${(totalRamMb / 1024).toFixed(1)} GB (${totalRamMb} MB)` : `${totalRamMb} MB`}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="number"
                min={1}
                step={ramUnit === 'GB' ? 0.5 : 128}
                required
                value={ramValue}
                onChange={(e) => setRamValue(Math.max(0.1, parseFloat(e.target.value) || 1))}
                className="w-full px-3 py-2 bg-[#111219] border border-white/10 rounded-xl text-xs font-mono text-slate-100 focus:outline-none focus:border-rose-600"
                placeholder="Enter custom RAM value (e.g. 512, 1, 4, 16, 64...)"
              />
              <div className="flex items-center p-0.5 bg-[#111219] border border-white/10 rounded-xl shrink-0">
                <button
                  type="button"
                  onClick={() => setRamUnit('MB')}
                  className={`px-2.5 py-1 text-xs font-mono font-semibold rounded-lg transition-colors ${
                    ramUnit === 'MB' ? 'bg-rose-950 text-rose-300 border border-rose-800' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  MB
                </button>
                <button
                  type="button"
                  onClick={() => setRamUnit('GB')}
                  className={`px-2.5 py-1 text-xs font-mono font-semibold rounded-lg transition-colors ${
                    ramUnit === 'GB' ? 'bg-rose-950 text-rose-300 border border-rose-800' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  GB
                </button>
              </div>
            </div>

            {/* Quick Presets */}
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              {[
                { label: '512 MB', val: 512, unit: 'MB' as const },
                { label: '1 GB', val: 1, unit: 'GB' as const },
                { label: '2 GB', val: 2, unit: 'GB' as const },
                { label: '4 GB', val: 4, unit: 'GB' as const },
                { label: '8 GB', val: 8, unit: 'GB' as const },
                { label: '16 GB', val: 16, unit: 'GB' as const },
                { label: '32 GB', val: 32, unit: 'GB' as const },
                { label: '64 GB', val: 64, unit: 'GB' as const }
              ].map(preset => (
                <button
                  type="button"
                  key={preset.label}
                  onClick={() => { setRamValue(preset.val); setRamUnit(preset.unit); }}
                  className={`px-2 py-0.5 rounded text-[11px] font-mono transition-colors ${
                    ramValue === preset.val && ramUnit === preset.unit
                      ? 'bg-rose-950 text-rose-300 border border-rose-700'
                      : 'bg-white/5 hover:bg-white/10 text-slate-400'
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>

            {isRamExceeding && (
              <div className="text-[11px] text-rose-400 flex items-center gap-1 mt-1">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                <span>Requested RAM exceeds host physical memory ({(hostTotalRamMb / 1024).toFixed(1)} GB). Backend will reject if memory cannot be allocated.</span>
              </div>
            )}
          </div>

          {/* Fully Custom Root Disk Allocation */}
          <div className="p-3.5 bg-[#090A0F] border border-white/10 rounded-xl space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <Disc className="w-3.5 h-3.5 text-rose-400" />
                Custom SSD / Root Disk
              </label>
              <div className="flex items-center gap-1.5 text-xs">
                <span className="text-slate-400">Total:</span>
                <span className="font-mono font-bold text-rose-300">
                  {totalDiskGb >= 1024 ? `${(totalDiskGb / 1024).toFixed(1)} TB (${totalDiskGb} GB)` : `${totalDiskGb} GB NVMe`}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="number"
                min={1}
                step={diskUnit === 'TB' ? 0.1 : 10}
                required
                value={diskValue}
                onChange={(e) => setDiskValue(Math.max(1, parseFloat(e.target.value) || 1))}
                className="w-full px-3 py-2 bg-[#111219] border border-white/10 rounded-xl text-xs font-mono text-slate-100 focus:outline-none focus:border-rose-600"
                placeholder="Enter custom SSD storage (e.g. 20, 50, 100, 250, 500, 1000...)"
              />
              <div className="flex items-center p-0.5 bg-[#111219] border border-white/10 rounded-xl shrink-0">
                <button
                  type="button"
                  onClick={() => setDiskUnit('GB')}
                  className={`px-2.5 py-1 text-xs font-mono font-semibold rounded-lg transition-colors ${
                    diskUnit === 'GB' ? 'bg-rose-950 text-rose-300 border border-rose-800' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  GB
                </button>
                <button
                  type="button"
                  onClick={() => setDiskUnit('TB')}
                  className={`px-2.5 py-1 text-xs font-mono font-semibold rounded-lg transition-colors ${
                    diskUnit === 'TB' ? 'bg-rose-950 text-rose-300 border border-rose-800' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  TB
                </button>
              </div>
            </div>

            {/* Quick Presets */}
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              {[
                { label: '20 GB', val: 20, unit: 'GB' as const },
                { label: '40 GB', val: 40, unit: 'GB' as const },
                { label: '100 GB', val: 100, unit: 'GB' as const },
                { label: '250 GB', val: 250, unit: 'GB' as const },
                { label: '500 GB', val: 500, unit: 'GB' as const },
                { label: '1 TB', val: 1, unit: 'TB' as const }
              ].map(preset => (
                <button
                  type="button"
                  key={preset.label}
                  onClick={() => { setDiskValue(preset.val); setDiskUnit(preset.unit); }}
                  className={`px-2 py-0.5 rounded text-[11px] font-mono transition-colors ${
                    diskValue === preset.val && diskUnit === preset.unit
                      ? 'bg-rose-950 text-rose-300 border border-rose-700'
                      : 'bg-white/5 hover:bg-white/10 text-slate-400'
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>

            {isDiskExceeding && (
              <div className="text-[11px] text-rose-400 flex items-center gap-1 mt-1">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                <span>Requested disk storage exceeds available free host space ({hostFreeDiskGb} GB free).</span>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                Custom SSH Port <span className="text-slate-500 font-normal lowercase">(optional)</span>
              </label>
              <input
                type="number"
                placeholder="Auto-allocated (e.g. 2201)"
                value={sshPort}
                onChange={(e) => setSshPort(e.target.value)}
                className="w-full px-3 py-2 bg-[#090A0F] border border-white/10 rounded-xl text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-rose-600 font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                Instance Description / Notes
              </label>
              <input
                type="text"
                placeholder="e.g. Production microservice"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full px-3 py-2 bg-[#090A0F] border border-white/10 rounded-xl text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-rose-600"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/5">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-slate-200 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2.5 text-xs font-semibold text-white bg-gradient-to-r from-rose-800 to-rose-700 hover:from-rose-700 hover:to-rose-600 rounded-xl transition-all shadow-lg shadow-rose-950/40"
            >
              {isSubmitting ? 'Deploying...' : `Deploy Virtual Machine (${cpu} vCPU, ${totalRamMb >= 1024 ? `${(totalRamMb / 1024).toFixed(1)}GB` : `${totalRamMb}MB`} RAM, ${totalDiskGb}GB SSD)`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
