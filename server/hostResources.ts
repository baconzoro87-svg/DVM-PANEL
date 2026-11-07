import os from 'os';
import fs from 'fs';
import { Database } from './db.ts';

export interface HostResourceInfo {
  cpu: {
    cores: number;
    model: string;
    speedMhz: number;
    allocatedCores: number;
    runningAllocatedCores: number;
    availableCores: number;
  };
  ram: {
    totalMb: number;
    freeMb: number;
    usedMb: number;
    allocatedMb: number;
    runningAllocatedMb: number;
    availableMb: number;
  };
  disk: {
    totalGb: number;
    freeGb: number;
    usedGb: number;
    allocatedGb: number;
    availableGb: number;
    mountPoint: string;
  };
  environment: {
    virtualization: string;
    isContainer: boolean;
    platform: string;
    arch: string;
    release: string;
    hostname: string;
    uptimeSeconds: number;
  };
  vmCounts: {
    total: number;
    running: number;
    stopped: number;
    restarting: number;
  };
}

export function detectEnvironmentType(): { virtualization: string; isContainer: boolean } {
  const isDocker = fs.existsSync('/.dockerenv');
  let cgroupContent = '';
  try {
    if (fs.existsSync('/proc/1/cgroup')) {
      cgroupContent = fs.readFileSync('/proc/1/cgroup', 'utf8');
    }
  } catch {}

  const isLxc = cgroupContent.includes('/lxc/') || fs.existsSync('/proc/1/environ') && fs.readFileSync('/proc/1/environ', 'utf8').includes('container=lxc');
  const isContainer = isDocker || isLxc || cgroupContent.includes('/container') || cgroupContent.includes('/docker/');

  let virtualization = 'Physical Bare Metal / KVM';
  if (isDocker) {
    virtualization = 'Docker Container Host';
  } else if (isLxc) {
    virtualization = 'LXC Container (Linux Containers)';
  } else if (isContainer) {
    virtualization = 'Isolated Container Runtime';
  }

  return { virtualization, isContainer };
}

export function getRealHostDiskStats(): { totalGb: number; freeGb: number; usedGb: number } {
  try {
    // fs.statfsSync provides real kernel filesystem blocks
    const stat = fs.statfsSync('/');
    const bsize = stat.bsize;
    const totalBytes = Number(stat.blocks) * bsize;
    const freeBytes = Number(stat.bavail) * bsize;
    const totalGb = Math.round((totalBytes / (1024 * 1024 * 1024)) * 10) / 10;
    const freeGb = Math.round((freeBytes / (1024 * 1024 * 1024)) * 10) / 10;
    const usedGb = Math.round(Math.max(0, totalGb - freeGb) * 10) / 10;
    return { totalGb, freeGb, usedGb };
  } catch (err) {
    return { totalGb: 0, freeGb: 0, usedGb: 0 };
  }
}

export function getHostResourceInfo(): HostResourceInfo {
  const cpus = os.cpus();
  const hostCores = Math.max(cpus.length, 1);
  const cpuModel = cpus[0]?.model || 'Host CPU Architecture';
  const cpuSpeed = cpus[0]?.speed || 0;

  const totalRamBytes = os.totalmem();
  const freeRamBytes = os.freemem();
  const totalRamMb = Math.round(totalRamBytes / (1024 * 1024));
  const freeRamMb = Math.round(freeRamBytes / (1024 * 1024));
  const usedRamMb = Math.max(0, totalRamMb - freeRamMb);

  const disk = getRealHostDiskStats();
  const env = detectEnvironmentType();

  // Query actual database allocations
  const db = Database.raw();
  const vmsSummary = db.prepare(`
    SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN status = 'running' THEN 1 ELSE 0 END) as running,
      SUM(CASE WHEN status = 'stopped' THEN 1 ELSE 0 END) as stopped,
      SUM(CASE WHEN status = 'restarting' THEN 1 ELSE 0 END) as restarting,
      COALESCE(SUM(cpu), 0) as total_cpu,
      COALESCE(SUM(CASE WHEN status = 'running' THEN cpu ELSE 0 END), 0) as running_cpu,
      COALESCE(SUM(ram_mb), 0) as total_ram,
      COALESCE(SUM(CASE WHEN status = 'running' THEN ram_mb ELSE 0 END), 0) as running_ram,
      COALESCE(SUM(disk_gb), 0) as total_disk
    FROM vms
  `).get() as any;

  const allocatedCores = Number(vmsSummary?.total_cpu || 0);
  const runningAllocatedCores = Number(vmsSummary?.running_cpu || 0);
  const availableCores = Math.max(0, hostCores - runningAllocatedCores);

  const allocatedRamMb = Number(vmsSummary?.total_ram || 0);
  const runningAllocatedRamMb = Number(vmsSummary?.running_ram || 0);
  const availableRamMb = freeRamMb;

  const allocatedDiskGb = Number(vmsSummary?.total_disk || 0);
  const availableDiskGb = disk.freeGb;

  return {
    cpu: {
      cores: hostCores,
      model: cpuModel,
      speedMhz: cpuSpeed,
      allocatedCores,
      runningAllocatedCores,
      availableCores,
    },
    ram: {
      totalMb: totalRamMb,
      freeMb: freeRamMb,
      usedMb: usedRamMb,
      allocatedMb: allocatedRamMb,
      runningAllocatedMb: runningAllocatedRamMb,
      availableMb: availableRamMb,
    },
    disk: {
      totalGb: disk.totalGb,
      freeGb: disk.freeGb,
      usedGb: disk.usedGb,
      allocatedGb: allocatedDiskGb,
      availableGb: availableDiskGb,
      mountPoint: '/',
    },
    environment: {
      virtualization: env.virtualization,
      isContainer: env.isContainer,
      platform: os.platform(),
      arch: os.arch(),
      release: os.release(),
      hostname: os.hostname(),
      uptimeSeconds: Math.floor(os.uptime()),
    },
    vmCounts: {
      total: Number(vmsSummary?.total || 0),
      running: Number(vmsSummary?.running || 0),
      stopped: Number(vmsSummary?.stopped || 0),
      restarting: Number(vmsSummary?.restarting || 0),
    }
  };
}

export function validateHostCapacity(requested: {
  cpu: number;
  ramMb: number;
  diskGb: number;
}): { valid: boolean; error?: string } {
  const host = getHostResourceInfo();
  const allowOvercommit = Database.getSetting('allow_resource_overcommit', 'false') === 'true';

  // Check CPU
  if (!allowOvercommit && requested.cpu > host.cpu.cores) {
    return {
      valid: false,
      error: `Requested CPU allocation (${requested.cpu} vCPUs) exceeds host physical capacity of ${host.cpu.cores} cores. Configure overcommit in settings if deliberate.`,
    };
  }

  // Check RAM
  if (requested.ramMb > host.ram.totalMb) {
    const totalGb = (host.ram.totalMb / 1024).toFixed(1);
    const reqGb = (requested.ramMb / 1024).toFixed(1);
    return {
      valid: false,
      error: `Requested RAM allocation (${reqGb} GB / ${requested.ramMb} MB) exceeds total host memory (${totalGb} GB / ${host.ram.totalMb} MB).`,
    };
  }

  // Check Disk
  if (requested.diskGb > host.disk.freeGb && host.disk.freeGb > 0) {
    return {
      valid: false,
      error: `Requested SSD storage (${requested.diskGb} GB) exceeds available host disk space (${host.disk.freeGb} GB free out of ${host.disk.totalGb} GB).`,
    };
  }

  return { valid: true };
}
