import React from 'react';
import { Menu, Plus, KeyRound, Server, CheckCircle2, AlertCircle, LogOut, Shield } from 'lucide-react';
import type { ActiveTab } from './Sidebar.tsx';
import type { SystemStatusData, UserItem } from '../types/index.ts';

interface HeaderProps {
  activeTab: ActiveTab;
  onOpenMobileSidebar: () => void;
  systemStatus: SystemStatusData | null;
  onOpenCreateVm: () => void;
  currentUser?: UserItem | null;
  onLogout?: () => void;
}

const TAB_TITLES: Record<ActiveTab, { section: string; title: string }> = {
  vms: { section: 'Virtualization Fleet', title: 'Virtual Machines' },
  autodeploy: { section: 'Admin Subsystems', title: 'AutoDeploy & Slot Policy' },
  users: { section: 'Admin Subsystems', title: 'User Account Management' },
  images: { section: 'Virtualization Fleet', title: 'OS Templates & Images' },
  api_integration: { section: 'Admin Subsystems', title: 'API Integration & Bot Key' },
  diagnostics: { section: 'System & Architecture', title: 'Host & Docker Diagnostics' },
  install_guide: { section: 'System & Architecture', title: 'No-Systemd Deployment Guide' },
};

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  onOpenMobileSidebar,
  systemStatus,
  onOpenCreateVm,
  currentUser,
  onLogout
}) => {
  const current = TAB_TITLES[activeTab] || { section: 'Dashboard', title: 'Overview' };
  const isDockerLive = systemStatus?.docker.available;

  return (
    <header className="h-16 px-4 lg:px-8 border-b border-rose-950/40 bg-[#090A0F]/80 backdrop-blur-md sticky top-0 z-30 flex items-center justify-between">
      {/* Left zone: Mobile toggle + Breadcrumbs */}
      <div className="flex items-center gap-3">
        <button
          onClick={onOpenMobileSidebar}
          className="lg:hidden p-2 text-slate-400 hover:text-white rounded-lg hover:bg-white/5 cursor-pointer"
          aria-label="Open Navigation Menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2 text-xs">
          <span className="text-slate-500 hidden sm:inline">{current.section}</span>
          <span className="text-slate-600 hidden sm:inline">/</span>
          <h1 className="font-bold text-sm sm:text-base text-slate-100">{current.title}</h1>
        </div>
      </div>

      {/* Right zone: Docker status badge, Azmal credit, Action buttons */}
      <div className="flex items-center gap-2.5 sm:gap-4 shrink-0">
        {/* Docker Engine status pill */}
        <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-black/40 border border-white/5 text-[11px]">
          {isDockerLive ? (
            <>
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-slate-300">Docker {systemStatus?.docker.version || 'Live'}</span>
            </>
          ) : (
            <>
              <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-slate-400">Docker Standby</span>
            </>
          )}
        </div>

        {/* Developer Credit Tag */}
        <div className="hidden xl:flex items-center px-2.5 py-1 rounded-lg bg-rose-950/30 border border-rose-900/40 text-[11px] text-rose-300">
          <span>Made by Azmal</span>
        </div>

        {/* Action Button: Deploy VM (Admin Only) */}
        {currentUser?.role === 'admin' && (
          <button
            onClick={onOpenCreateVm}
            className="px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-gradient-to-r from-rose-700 to-pink-700 hover:from-rose-600 hover:to-pink-600 text-white transition-all flex items-center gap-1.5 shadow-md shadow-rose-950/40 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Deploy VPS</span>
            <span className="sm:hidden">Deploy</span>
          </button>
        )}

        {/* User profile / Logout */}
        {currentUser && onLogout && (
          <button
            onClick={onLogout}
            title="Sign Out"
            className="p-1.5 text-slate-400 hover:text-rose-400 rounded-lg hover:bg-white/5 transition-colors cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
          </button>
        )}
      </div>
    </header>
  );
};
