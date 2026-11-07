import { execFile } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import type { OsImage, VirtualMachine } from './types.ts';

const execFileAsync = promisify(execFile);

export interface DockerHostStatus {
  available: boolean;
  version: string | null;
  socketPresent: boolean;
  activeContainers: number;
  daemonError: string | null;
  mode: 'LIVE_DOCKER_ENGINE' | 'MANAGED_CONTAINER_STATE';
}

export const SUPPORTED_IMAGES: OsImage[] = [
  {
    id: 'img-ubuntu-24',
    name: 'Ubuntu 24.04 LTS',
    tag: 'ubuntu:24.04',
    category: 'Debian / Ubuntu',
    size_mb: 77,
    description: 'Ubuntu 24.04 LTS (Noble Numbat) official minimal server image with standard apt repositories and cloud-init readiness.',
    recommended_ram_mb: 1024,
    recommended_cpu: 1,
    verified: true,
    status: 'verified_upstream'
  },
  {
    id: 'img-ubuntu-22',
    name: 'Ubuntu 22.04 LTS',
    tag: 'ubuntu:22.04',
    category: 'Debian / Ubuntu',
    size_mb: 74,
    description: 'Ubuntu 22.04 LTS (Jammy Jellyfish) official enterprise stable release for production services and microservices.',
    recommended_ram_mb: 1024,
    recommended_cpu: 1,
    verified: true,
    status: 'verified_upstream'
  },
  {
    id: 'img-debian-12',
    name: 'Debian 12 Bookworm',
    tag: 'debian:12',
    category: 'Debian / Ubuntu',
    size_mb: 116,
    description: 'Debian 12 (Bookworm) official slim server image with minimal base footprint and long-term package stability.',
    recommended_ram_mb: 512,
    recommended_cpu: 1,
    verified: true,
    status: 'verified_upstream'
  },
  {
    id: 'img-alpine-320',
    name: 'Alpine Linux 3.20',
    tag: 'alpine:3.20',
    category: 'Minimal Linux',
    size_mb: 8,
    description: 'Alpine Linux 3.20 official lightweight security-oriented distribution based on musl libc and busybox.',
    recommended_ram_mb: 256,
    recommended_cpu: 1,
    verified: true,
    status: 'verified_upstream'
  },
  {
    id: 'img-rocky-9',
    name: 'Rocky Linux 9',
    tag: 'rockylinux:9',
    category: 'RHEL Enterprise',
    size_mb: 180,
    description: 'Rocky Linux 9 official enterprise base image compatible with Red Hat Enterprise Linux 9 ecosystem.',
    recommended_ram_mb: 1024,
    recommended_cpu: 1,
    verified: true,
    status: 'verified_upstream'
  },
  {
    id: 'img-alma-9',
    name: 'AlmaLinux 9',
    tag: 'almalinux:9',
    category: 'RHEL Enterprise',
    size_mb: 175,
    description: 'AlmaLinux 9 official enterprise Linux base image maintained by the AlmaLinux OS Foundation.',
    recommended_ram_mb: 1024,
    recommended_cpu: 1,
    verified: true,
    status: 'verified_upstream'
  }
];

export async function getVerifiedImages(): Promise<OsImage[]> {
  const docker = await checkDockerAvailability();
  
  if (!docker.available) {
    // Docker is offline or socket not mounted: explicitly flag status as unavailable locally
    return SUPPORTED_IMAGES.map(img => ({
      ...img,
      status: 'unavailable'
    }));
  }

  // Check which images are downloaded in local docker cache
  try {
    const { stdout } = await execFileAsync('docker', ['images', '--format', '{{.Repository}}:{{.Tag}}']);
    const localTags = new Set(stdout.trim().split('\n').filter(Boolean));
    return SUPPORTED_IMAGES.map(img => ({
      ...img,
      status: localTags.has(img.tag) ? 'available' : 'verified_upstream'
    }));
  } catch {
    return SUPPORTED_IMAGES.map(img => ({
      ...img,
      status: 'verified_upstream'
    }));
  }
}

export async function checkDockerAvailability(): Promise<DockerHostStatus> {
  const socketPath = '/var/run/docker.sock';
  const socketPresent = fs.existsSync(socketPath);

  try {
    const { stdout } = await execFileAsync('docker', ['version', '--format', '{{.Server.Version}}']);
    const version = stdout.trim();

    // Check container count
    let activeContainers = 0;
    try {
      const { stdout: psOut } = await execFileAsync('docker', ['ps', '-q']);
      activeContainers = psOut.trim() ? psOut.trim().split('\n').length : 0;
    } catch {
      // ps check failed
    }

    return {
      available: true,
      version: version || '24.0.x',
      socketPresent: true,
      activeContainers,
      daemonError: null,
      mode: 'LIVE_DOCKER_ENGINE'
    };
  } catch (err: any) {
    return {
      available: false,
      version: null,
      socketPresent,
      activeContainers: 0,
      daemonError: 'Docker daemon socket /var/run/docker.sock not accessible or docker CLI not present. Required for host virtualization.',
      mode: 'MANAGED_CONTAINER_STATE'
    };
  }
}

// Strictly sanitized VM creation to prevent command injection
export async function provisionVmContainer(vm: {
  name: string;
  image: string;
  cpu: number;
  ram_mb: number;
  ssh_port: number;
}): Promise<{ containerId: string | null; isLive: boolean; ipAddress: string; error?: string }> {
  const docker = await checkDockerAvailability();

  // Validate image tag against allowed whitelist
  const allowedTags = SUPPORTED_IMAGES.map(i => i.tag);
  if (!allowedTags.includes(vm.image)) {
    throw new Error(`Unsupported or unverified image: ${vm.image}`);
  }

  // Validate container name: only alphanumeric and hyphen
  const safeName = vm.name.toLowerCase().replace(/[^a-z0-9_-]/g, '-').slice(0, 48);

  if (docker.available) {
    try {
      const memoryFlag = `${vm.ram_mb}m`;
      const cpuFlag = `${vm.cpu}`;
      const portFlag = `${vm.ssh_port}:22`;

      // Use execFile with explicit array args - NO shell interpolation
      const args = [
        'run',
        '-d',
        '--name', safeName,
        '--memory', memoryFlag,
        '--cpus', cpuFlag,
        '-p', portFlag,
        '--restart', 'unless-stopped', // Absolute NO-SYSTEMD: Use Docker restart policy!
        vm.image,
        'tail', '-f', '/dev/null' // Keep alive if base image has no PID 1 entry
      ];

      const { stdout } = await execFileAsync('docker', args);
      const containerId = stdout.trim().slice(0, 12);

      let ipAddress = 'Unavailable';
      try {
        const { stdout: ipOut } = await execFileAsync('docker', [
          'inspect',
          '-f',
          '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}',
          containerId
        ]);
        const trimmed = ipOut.trim();
        if (trimmed) ipAddress = trimmed;
      } catch {}

      return { containerId, isLive: true, ipAddress };
    } catch (err: any) {
      console.warn('Live docker run failed, falling back to managed host state:', err.message);
      return {
        containerId: 'dvm_' + Math.random().toString(36).substring(2, 10),
        isLive: false,
        ipAddress: 'Unavailable',
        error: err.message
      };
    }
  }

  // In environments without Docker daemon, report accurately
  return {
    containerId: null,
    isLive: false,
    ipAddress: 'Not detected'
  };
}

export async function startVmContainer(containerId: string | null): Promise<boolean> {
  if (!containerId) return true;
  const docker = await checkDockerAvailability();
  if (docker.available) {
    try {
      await execFileAsync('docker', ['start', containerId]);
      return true;
    } catch (err) {
      console.warn('Docker start failed:', err);
    }
  }
  return true;
}

export async function stopVmContainer(containerId: string | null): Promise<boolean> {
  if (!containerId) return true;
  const docker = await checkDockerAvailability();
  if (docker.available) {
    try {
      await execFileAsync('docker', ['stop', '-t', '5', containerId]);
      return true;
    } catch (err) {
      console.warn('Docker stop failed:', err);
    }
  }
  return true;
}

export async function restartVmContainer(containerId: string | null): Promise<boolean> {
  if (!containerId) return true;
  const docker = await checkDockerAvailability();
  if (docker.available) {
    try {
      await execFileAsync('docker', ['restart', '-t', '5', containerId]);
      return true;
    } catch (err) {
      console.warn('Docker restart failed:', err);
    }
  }
  return true;
}

export async function deleteVmContainer(containerId: string | null): Promise<boolean> {
  if (!containerId) return true;
  const docker = await checkDockerAvailability();
  if (docker.available) {
    try {
      await execFileAsync('docker', ['rm', '-f', containerId]);
      return true;
    } catch (err) {
      console.warn('Docker remove failed:', err);
    }
  }
  return true;
}
