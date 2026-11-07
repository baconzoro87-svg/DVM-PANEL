import React, { useState } from 'react';
import { KeyRound, Copy, Check, ShieldAlert, CheckCircle2 } from 'lucide-react';

interface CopyKeyModalProps {
  isOpen: boolean;
  keyName: string;
  rawKey: string;
  onClose: () => void;
}

export const CopyKeyModal: React.FC<CopyKeyModalProps> = ({
  isOpen,
  keyName,
  rawKey,
  onClose,
}) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(rawKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch (err) {
      console.error('Failed to copy key:', err);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
      <div className="relative w-full max-w-lg bg-[#111219] border border-rose-900/50 rounded-2xl shadow-2xl p-6 text-slate-100">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-3 rounded-xl bg-gradient-to-br from-rose-950 to-rose-900 text-rose-300 border border-rose-800/40">
            <KeyRound className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-100">API Key Created Successfully</h3>
            <p className="text-xs text-slate-400 mt-0.5">Key Name: <span className="text-rose-300 font-medium">{keyName}</span></p>
          </div>
        </div>

        {/* Security Warning Banner */}
        <div className="mb-5 p-3.5 rounded-xl bg-rose-950/40 border border-rose-900/60 flex items-start gap-3">
          <ShieldAlert className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
          <div className="text-xs text-rose-200/90 leading-relaxed">
            <span className="font-semibold text-rose-300">One-Time Token Disclosure:</span> Make sure to copy this API key now. For your security, this key is hashed in the database and <strong className="text-white underline">will never be shown again</strong>.
          </div>
        </div>

        {/* Key Display Container */}
        <div className="mb-5">
          <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
            Your Secret Token
          </label>
          <div className="flex items-center gap-2 p-3 bg-[#090A0F] border border-white/10 rounded-xl">
            <input
              type="text"
              readOnly
              value={rawKey}
              className="bg-transparent font-mono text-sm text-rose-200 w-full focus:outline-none selection:bg-rose-900 selection:text-white"
            />
            <button
              onClick={handleCopy}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all shrink-0 ${
                copied
                  ? 'bg-emerald-900/60 text-emerald-300 border border-emerald-700/50'
                  : 'bg-rose-900/50 hover:bg-rose-800 text-rose-200 border border-rose-700/40'
              }`}
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy Key</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* cURL Usage Hint */}
        <div className="mb-6 p-3 bg-white/[0.02] border border-white/5 rounded-xl">
          <div className="text-xs text-slate-400 mb-1.5 font-medium">Quick Authenticated cURL Request:</div>
          <div className="font-mono text-xs text-slate-300 bg-black/60 p-2.5 rounded-lg overflow-x-auto selection:bg-rose-900">
            curl -H &quot;Authorization: Bearer {rawKey.slice(0, 16)}...&quot; /api/v1/status
          </div>
        </div>

        <div className="flex items-center justify-end pt-3 border-t border-white/5">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-rose-800 to-rose-700 hover:from-rose-700 hover:to-rose-600 rounded-xl transition-all shadow-lg shadow-rose-950/40 flex items-center gap-2"
          >
            <CheckCircle2 className="w-4 h-4" />
            I Have Saved This Key Securely
          </button>
        </div>
      </div>
    </div>
  );
};
