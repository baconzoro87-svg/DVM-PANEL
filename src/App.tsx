import React, { useState, useEffect } from 'react';
import { Sidebar, type ActiveTab } from './components/Sidebar.tsx';
import { Header } from './components/Header.tsx';
import { VmList } from './pages/VmList.tsx';
import { ImagesList } from './pages/ImagesList.tsx';
import { ApiIntegration } from './pages/ApiIntegration.tsx';
import { Diagnostics } from './pages/Diagnostics.tsx';
import { InstallGuide } from './pages/InstallGuide.tsx';
import { CreateVmModal } from './components/CreateVmModal.tsx';
import type { SystemStatusData, OsImageItem } from './types/index.ts';

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('vms');
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [systemStatus, setSystemStatus] = useState<SystemStatusData | null>(null);
  const [images, setImages] = useState<OsImageItem[]>([]);
  const [isCreateVmOpen, setIsCreateVmOpen] = useState(false);

  const fetchStatus = async () => {
    try {
      const res = await fetch('/api/v1/status');
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
      const res = await fetch('/api/v1/images');
      const json = await res.json();
      if (res.ok && json.success) {
        setImages(json.data);
      }
    } catch (err) {
      console.error('Failed to load images:', err);
    }
  };

  useEffect(() => {
    fetchStatus();
    fetchImages();
  }, []);

  const handleDeployFromImage = (_tag: string) => {
    setIsCreateVmOpen(true);
  };

  return (
    <div className="min-h-screen bg-[#090A0F] text-slate-100 flex flex-col antialiased selection:bg-rose-900 selection:text-white">
      {/* Sidebar */}
      <Sidebar
        activeTab={activeTab}
        onTabChange={(tab) => setActiveTab(tab)}
        isOpenMobile={isMobileSidebarOpen}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
      />

      {/* Main Viewport Container */}
      <div className="flex-1 lg:pl-64 flex flex-col min-h-screen">
        <Header
          activeTab={activeTab}
          onOpenMobileSidebar={() => setIsMobileSidebarOpen(true)}
          systemStatus={systemStatus}
          onOpenCreateVm={() => setIsCreateVmOpen(true)}
        />

        <main className="flex-1 pb-12">
          {activeTab === 'vms' && (
            <VmList
              images={images}
              onOpenCreateVm={() => setIsCreateVmOpen(true)}
              isCreateVmOpen={isCreateVmOpen}
              onCloseCreateVm={() => setIsCreateVmOpen(false)}
            />
          )}

          {activeTab === 'images' && (
            <ImagesList
              images={images}
              onDeployImage={handleDeployFromImage}
            />
          )}

          {activeTab === 'api_integration' && <ApiIntegration />}

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
        onClose={() => setIsCreateVmOpen(false)}
        onVmCreated={() => {
          fetchStatus();
          setActiveTab('vms');
        }}
      />
    </div>
  );
}
