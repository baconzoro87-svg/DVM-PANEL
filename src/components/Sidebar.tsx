import React from 'react';
import {
  Server,
  Layers,
  KeyRound,
  ShieldCheck,
  FileText,
  Activity,
  Sliders,
  Terminal,
  BookOpen,
  Cpu,
  BarChart3,
  Users,
  Zap,
  LogOut,
  Shield
} from 'lucide-react';
import type { UserItem } from '../types/index.ts';

export type ActiveTab =
  | 'vms'
  | 'autodeploy'
  | 'users'
  | 'images'
  | 'api_integration'
  | 'diagnostics'
  | 'install_guide';

interface SidebarProps {
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
  isOpenMobile: boolean;
  onCloseMobile: () => void;
  currentUser?: UserItem | null;
  onLogout?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onTabChange,
  isOpenMobile,
  onCloseMobile,
  currentUser,
  onLogout
}) => {
  const isAdmin = currentUser?.role === 'admin';

  const handleNav = (tab: ActiveTab) => {
    onTabChange(tab);
    onCloseMobile();
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpenMobile && (
        <div
          onClick={onCloseMobile}
          className="fixed inset-0 z-40 bg-black/80 lg:hidden backdrop-blur-sm"
        />
      )}

      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 w-64 bg-[#090A0F] border-r border-rose-950/40 flex flex-col transition-transform duration-300 ease-in-out lg:translate-x-0 ${
          isOpenMobile ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brand Lockup */}
        <div className="h-16 px-5 border-b border-rose-950/40 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-rose-700 via-rose-900 to-black p-0.5 shadow-lg shadow-rose-950/50 flex items-center justify-center">
              <Server className="w-4 h-4 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-extrabold text-base tracking-tight text-white">DVM Panel</span>
                <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-rose-950 text-rose-300 border border-rose-800/40">
                  {isAdmin ? 'ADMIN' : 'USER'}
                </span>
              </div>
              <div className="text-[11px] font-semibold text-rose-400 tracking-wide">BusterNodes</div>
            </div>
          </div>
        </div>

        {/* User Identity Pill */}
        {currentUser && (
          <div className="px-4 py-3 bg-[#0D0F17] border-b border-rose-950/30 flex items-center justify-between">
            <div className="flex items-center gap-2.5 overflow-hidden">
              <div className="w-7 h-7 rounded-full bg-rose-950 border border-rose-800/50 flex items-center justify-center text-xs font-bold text-rose-300 shrink-0">
                {currentUser.username[0]?.toUpperCase() || 'U'}
              </div>
              <div className="truncate">
                <div className="text-xs font-bold text-white truncate flex items-center gap-1">
                  <span>{currentUser.username}</span>
                  {isAdmin && <Shield className="w-3 h-3 text-rose-400 inline" />}
                </div>
                <div className="text-[10px] text-slate-400 font-mono truncate">{currentUser.email}</div>
              </div>
            </div>

            {onLogout && (
              <button
                type="button"
                onClick={onLogout}
                title="Sign Out"
                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-950/40 transition-colors cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}

        {/* Navigation Items */}
        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
          {/* Section: Virtualization */}
          <div>
            <div className="px-3 mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Virtualization Fleet
            </div>
            <div className="space-y-1">
              <button
                onClick={() => handleNav('vms')}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium transition-colors cursor-pointer ${
                  activeTab === 'vms'
                    ? 'bg-rose-950/60 text-rose-200 border border-rose-900/60 shadow-sm'
                    : 'text-slate-400 hover:text-slate-100 hover:bg-white/[0.03]'
                }`}
              >
                <Server className="w-4 h-4 shrink-0 text-rose-400" />
                <span className="truncate">{isAdmin ? 'Fleet Virtual Machines' : 'My Virtual Machines'}</span>
              </button>

              <button
                onClick={() => handleNav('images')}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium transition-colors cursor-pointer ${
                  activeTab === 'images'
                    ? 'bg-rose-950/60 text-rose-200 border border-rose-900/60 shadow-sm'
                    : 'text-slate-400 hover:text-slate-100 hover:bg-white/[0.03]'
                }`}
              >
                <Layers className="w-4 h-4 shrink-0 text-slate-400" />
                <span className="truncate">OS Templates & Images</span>
              </button>
            </div>
          </div>

          {/* Section: Admin Controls (Only if role === 'admin') */}
          {isAdmin && (
            <div>
              <div className="px-3 mb-2 flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-rose-400">
                  Admin Subsystems
                </span>
                <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-rose-950/80 text-rose-300 border border-rose-800/30">
                  Control
                </span>
              </div>
              <div className="space-y-1">
                <button
                  onClick={() => handleNav('autodeploy')}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium transition-colors cursor-pointer ${
                    activeTab === 'autodeploy'
                      ? 'bg-rose-950/60 text-rose-200 border border-rose-900/60 shadow-sm'
                      : 'text-slate-400 hover:text-slate-100 hover:bg-white/[0.03]'
                  }`}
                >
                  <Zap className="w-4 h-4 shrink-0 text-rose-400" />
                  <span className="truncate">AutoDeploy System</span>
                </button>

                <button
                  onClick={() => handleNav('users')}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium transition-colors cursor-pointer ${
                    activeTab === 'users'
                      ? 'bg-rose-950/60 text-rose-200 border border-rose-900/60 shadow-sm'
                      : 'text-slate-400 hover:text-slate-100 hover:bg-white/[0.03]'
                  }`}
                >
                  <Users className="w-4 h-4 shrink-0 text-rose-400" />
                  <span className="truncate">User Management</span>
                </button>

                <button
                  onClick={() => handleNav('api_integration')}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium transition-colors cursor-pointer ${
                    activeTab === 'api_integration'
                      ? 'bg-rose-950/60 text-rose-200 border border-rose-900/60 shadow-sm'
                      : 'text-slate-400 hover:text-slate-100 hover:bg-white/[0.03]'
                  }`}
                >
                  <KeyRound className="w-4 h-4 shrink-0 text-rose-400" />
                  <span className="truncate">API Integration & Bot Key</span>
                </button>
              </div>
            </div>
          )}

          {/* Section: System & No-Systemd Deployment */}
          <div>
            <div className="px-3 mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">
              System & Architecture
            </div>
            <div className="space-y-1">
              <button
                onClick={() => handleNav('diagnostics')}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium transition-colors cursor-pointer ${
                  activeTab === 'diagnostics'
                    ? 'bg-rose-950/60 text-rose-200 border border-rose-900/60 shadow-sm'
                    : 'text-slate-400 hover:text-slate-100 hover:bg-white/[0.03]'
                }`}
              >
                <Cpu className="w-4 h-4 shrink-0 text-slate-400" />
                <span className="truncate">Host & Docker Diagnostics</span>
              </button>

              <button
                onClick={() => handleNav('install_guide')}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium transition-colors cursor-pointer ${
                  activeTab === 'install_guide'
                    ? 'bg-rose-950/60 text-rose-200 border border-rose-900/60 shadow-sm'
                    : 'text-slate-400 hover:text-slate-100 hover:bg-white/[0.03]'
                }`}
              >
                <Terminal className="w-4 h-4 shrink-0 text-slate-400" />
                <span className="truncate">No-Systemd Deployment</span>
              </button>
            </div>
          </div>
        </div>

        {/* Footer Credit */}
        <div className="p-4 border-t border-rose-950/40 bg-[#08090D]">
          <div className="text-[11px] text-slate-400 flex items-center justify-between">
            <span className="font-semibold text-slate-200">BusterNodes DVM</span>
            <span className="text-rose-400 font-mono text-[10px]">v1.4.2</span>
          </div>
          <div className="text-[10px] text-slate-500 mt-1 flex items-center justify-between">
            <span>Developer</span>
            <span className="text-slate-300 font-medium">Made by Azmal</span>
          </div>
        </div>
      </aside>
    </>
  );
};
