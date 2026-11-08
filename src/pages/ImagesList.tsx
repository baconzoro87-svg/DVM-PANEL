import React from 'react';
import { Layers, HardDrive, Cpu, CheckCircle2, Plus, Download } from 'lucide-react';
import type { OsImageItem, UserItem } from '../types/index.ts';

interface ImagesListProps {
  images: OsImageItem[];
  currentUser?: UserItem | null;
  onDeployImage: (tag: string) => void;
}

export const ImagesList: React.FC<ImagesListProps> = ({
  images,
  currentUser,
  onDeployImage,
}) => {
  return (
    <div className="p-4 lg:p-8 space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
          <span>Certified Operating System Templates</span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-rose-950 text-rose-300 border border-rose-900/50 font-mono">
            {images.length} Images
          </span>
        </h2>
        <p className="text-xs text-slate-400 mt-1 max-w-2xl">
          Pre-hardened Linux container images tested for high density, instantaneous initialization, OpenSSH readiness, and compatibility with BusterNodes virtualization.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {images.map((img) => (
          <div
            key={img.id}
            className="p-5 rounded-2xl bg-[#111219] border border-white/5 hover:border-rose-950/60 transition-all flex flex-col justify-between shadow-lg"
          >
            <div>
              <div className="flex items-start justify-between gap-3 mb-2">
                <div>
                  <h3 className="font-bold text-sm text-slate-100">{img.name}</h3>
                  <div className="text-[11px] font-mono text-rose-300 mt-0.5">{img.tag}</div>
                </div>

                <div className="text-right">
                  <div className="text-[11px] text-slate-400 font-medium">{img.category}</div>
                  <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                    {img.status === 'available' ? (
                      <span className="text-emerald-400 font-medium">Docker Cached</span>
                    ) : img.status === 'unavailable' ? (
                      <span className="text-amber-400">Daemon Offline</span>
                    ) : (
                      <span className="text-slate-400">Verified Upstream</span>
                    )}
                  </div>
                </div>
              </div>

              <p className="text-xs text-slate-400 leading-relaxed mb-4">
                {img.description}
              </p>

              <div className="grid grid-cols-2 gap-2 p-2.5 bg-[#090A0F] border border-white/5 rounded-xl text-center text-xs font-mono mb-4">
                <div>
                  <div className="text-[10px] text-slate-500 uppercase">Base Size</div>
                  <div className="text-slate-200 font-bold">{img.size_mb} MB</div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-500 uppercase">Min Memory</div>
                  <div className="text-slate-200 font-bold">
                    {img.recommended_ram_mb >= 1024 ? `${img.recommended_ram_mb / 1024} GB` : `${img.recommended_ram_mb} MB`}
                  </div>
                </div>
              </div>
            </div>

            {currentUser?.role === 'admin' ? (
              <button
                onClick={() => onDeployImage(img.tag)}
                className="w-full py-2 px-3 rounded-xl bg-white/5 hover:bg-rose-900/50 hover:border-rose-700/50 text-slate-200 hover:text-white border border-white/10 text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Deploy from Template</span>
              </button>
            ) : (
              <div className="w-full py-2 px-3 rounded-xl bg-white/[0.02] border border-white/5 text-[11px] text-slate-500 text-center font-mono">
                Admin-Controlled Template
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
