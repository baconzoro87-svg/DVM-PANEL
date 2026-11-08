import React, { useState, useEffect } from 'react';
import { Sidebar, type ActiveTab } from './components/Sidebar.tsx';
import { Header } from './components/Header.tsx';
import { VmList } from './pages/VmList.tsx';
import { ImagesList } from './pages/ImagesList.tsx';
import { ApiIntegration } from './pages/ApiIntegration.tsx';
import { Diagnostics } from './pages/Diagnostics.tsx';
import { InstallGuide } from './pages/InstallGuide.tsx';
import { AutoDeploySettings } from './pages/AutoDeploySettings.tsx';
import { AdminUsers } from './pages/AdminUsers.tsx';
import { Login } from './pages/Login.tsx';
import { Signup } from './pages/Signup.tsx';
import { ChangePasswordModal } from './components/ChangePasswordModal.tsx';
import { CreateVmModal } from './components/CreateVmModal.tsx';
import type { SystemStatusData, OsImageItem, UserItem } from './types/index.ts';

export default function App() {
  const [currentUser, setCurrentUser] = useState<UserItem | null>(null);
  const [authChecking, setAuthChecking] = useState(true);
  const [authView, setAuthView] = useState<'login' | 'signup'>('login');

  const [activeTab, setActiveTab] = useState<ActiveTab>('vms');
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [systemStatus, setSystemStatus] = useState<SystemStatusData | null>(null);
  const [images, setImages] = useState<OsImageItem[]>([]);
  const [isCreateVmOpen, setIsCreateVmOpen] = useState(false);

  const checkCurrentUser = async () => {
    const token = localStorage.getItem('dvm_token');
    if (!token) {
      setAuthChecking(false);
      return;
    }

    try {
      const res = await fetch('/api/v1/auth/me', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok && data.success && data.data) {
        setCurrentUser(data.data);
      } else {
        localStorage.removeItem('dvm_token');
        setCurrentUser(null);
      }
    } catch {
      setCurrentUser(null);
    } finally {
      setAuthChecking(false);
    }
  };

  const fetchStatus = async () => {
    try {
      const token = localStorage.getItem('dvm_token');
      const res = await fetch('/api/v1/status', {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      const json = await res.json();
      if (res.ok && json.success) {
        setSystemStatus(json.data);
      }
    } catch (err) {
      console.error('Failed to load system status:', err);
    }
  };

  const fetchImages = async () => {
    try {
      const token = localStorage.getItem('dvm_token');
      const res = await fetch('/api/v1/images', {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      const json = await res.json();
      if (res.ok && json.success) {
        setImages(json.data);
      }
    } catch (err) {
      console.error('Failed to load images:', err);
    }
  };

  useEffect(() => {
    checkCurrentUser();
    fetchStatus();
    fetchImages();
  }, []);

  const handleLoginSuccess = (user: UserItem, _token: string) => {
    setCurrentUser(user);
    fetchStatus();
    fetchImages();
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/v1/auth/logout', { method: 'POST' });
    } catch {}
    localStorage.removeItem('dvm_token');
    setCurrentUser(null);
    setActiveTab('vms');
  };

  const handleDeployFromImage = (_tag: string) => {
    setIsCreateVmOpen(true);
  };

  if (authChecking) {
    return (
      <div className="min-h-screen bg-[#07080C] flex flex-col items-center justify-center text-slate-400">
        <div className="w-8 h-8 border-2 border-rose-500/20 border-t-rose-500 rounded-full animate-spin mb-3" />
        <p className="text-xs font-mono">Initializing BusterNodes DVM Panel...</p>
      </div>
    );
  }

  // If not logged in, show Login or Signup
  if (!currentUser) {
    if (authView === 'signup') {
      return (
        <Signup
          onSignupSuccess={handleLoginSuccess}
          onSwitchToLogin={() => setAuthView('login')}
        />
      );
    }
    return (
      <Login
        onLoginSuccess={handleLoginSuccess}
        onSwitchToSignup={() => setAuthView('signup')}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#090A0F] text-slate-100 flex flex-col antialiased selection:bg-rose-900 selection:text-white">
      {/* Mandatory Change Password Modal if must_change_password */}
      {currentUser.must_change_password && (
        <ChangePasswordModal
          mandatory={true}
          onPasswordChanged={() => {
            setCurrentUser({ ...currentUser, must_change_password: false });
          }}
        />
      )}

      {/* Sidebar */}
      <Sidebar
        activeTab={activeTab}
        onTabChange={(tab) => setActiveTab(tab)}
        isOpenMobile={isMobileSidebarOpen}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
        currentUser={currentUser}
        onLogout={handleLogout}
      />

      {/* Main Viewport Container */}
      <div className="flex-1 lg:pl-64 flex flex-col min-h-screen">
        <Header
          activeTab={activeTab}
          onOpenMobileSidebar={() => setIsMobileSidebarOpen(true)}
          systemStatus={systemStatus}
          onOpenCreateVm={() => setIsCreateVmOpen(true)}
          currentUser={currentUser}
          onLogout={handleLogout}
        />

        <main className="flex-1 pb-12">
          {activeTab === 'vms' && (
            <VmList
              images={images}
              currentUser={currentUser}
              onOpenCreateVm={() => setIsCreateVmOpen(true)}
              isCreateVmOpen={isCreateVmOpen}
              onCloseCreateVm={() => setIsCreateVmOpen(false)}
            />
          )}

          {activeTab === 'autodeploy' && currentUser.role === 'admin' && (
            <AutoDeploySettings />
          )}

          {activeTab === 'users' && currentUser.role === 'admin' && (
            <AdminUsers />
          )}

          {activeTab === 'images' && (
            <ImagesList
              images={images}
              currentUser={currentUser}
              onDeployImage={handleDeployFromImage}
            />
          )}

          {activeTab === 'api_integration' && currentUser.role === 'admin' && (
            <ApiIntegration />
          )}

          {activeTab === 'diagnostics' && (
            <Diagnostics
              systemStatus={systemStatus}
              onRefresh={fetchStatus}
            />
          )}

          {activeTab === 'install_guide' && <InstallGuide />}
        </main>
      </div>

      {/* Deploy VM Modal */}
      <CreateVmModal
        isOpen={isCreateVmOpen}
        images={images}
        hostResources={systemStatus?.resources}
        currentUser={currentUser}
        onClose={() => setIsCreateVmOpen(false)}
        onVmCreated={() => {
          fetchStatus();
          setActiveTab('vms');
        }}
      />
    </div>
  );
}
