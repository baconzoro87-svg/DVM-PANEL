import React, { useState } from 'react';
import { Server, Lock, Mail, ArrowRight, AlertCircle } from 'lucide-react';
import type { UserItem } from '../types/index.ts';

interface LoginProps {
  onLoginSuccess: (user: UserItem, token: string) => void;
  onSwitchToSignup: () => void;
}

export const Login: React.FC<LoginProps> = ({ onLoginSuccess, onSwitchToSignup }) => {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: identifier,
          password
        })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error?.message || 'Login failed. Please check your credentials.');
      }

      localStorage.setItem('dvm_token', data.data.token);
      onLoginSuccess(data.data.user, data.data.token);
    } catch (err: any) {
      setError(err.message || 'An unexpected authentication error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#07080C] flex flex-col justify-center items-center px-4 relative overflow-hidden selection:bg-rose-900 selection:text-white">
      {/* Background glow effects */}
      <div className="absolute top-1/4 -left-20 w-96 h-96 bg-rose-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 -right-20 w-96 h-96 bg-pink-600/10 rounded-full blur-3xl pointer-events-none" />

      {/* Brand Header */}
      <div className="text-center mb-8 relative z-10">
        <div className="inline-flex items-center gap-3 px-4 py-1.5 rounded-full bg-rose-950/40 border border-rose-800/40 text-rose-300 text-xs font-mono tracking-wider uppercase mb-4 shadow-inner">
          <Server className="w-3.5 h-3.5 text-rose-400" />
          <span>BusterNodes Infrastructure</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white mb-2">
          DVM <span className="bg-gradient-to-r from-rose-400 via-pink-400 to-rose-300 bg-clip-text text-transparent">Panel</span>
        </h1>
        <p className="text-sm text-slate-400 max-w-sm mx-auto">
          Enterprise Container Virtualization & Fleet VPS Management
        </p>
      </div>

      {/* Login Card */}
      <div className="w-full max-w-md bg-[#0F111A]/95 border border-rose-950/80 rounded-2xl p-7 sm:p-8 shadow-2xl backdrop-blur-xl relative z-10">
        <div className="flex items-center justify-between pb-6 mb-6 border-b border-rose-950/60">
          <div>
            <h2 className="text-lg font-bold text-white">Sign In</h2>
            <p className="text-xs text-slate-400 mt-0.5">Access your virtualization environment</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-rose-600/20 to-pink-900/40 border border-rose-700/30 flex items-center justify-center text-rose-400">
            <Lock className="w-5 h-5" />
          </div>
        </div>

        {error && (
          <div className="mb-6 p-3.5 rounded-xl bg-rose-950/70 border border-rose-700/50 flex items-start gap-3 text-rose-200 text-xs leading-relaxed animate-in fade-in duration-200">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-rose-300">Authentication Error</p>
              <p>{error}</p>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Email or Username
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                required
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="admin@dvm.io or user"
                className="w-full pl-10 pr-4 py-2.5 bg-[#090A0F] border border-slate-800 rounded-xl text-sm text-white placeholder-slate-600 focus:outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500 transition-colors"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-medium text-slate-300">
                Password
              </label>
            </div>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full pl-10 pr-4 py-2.5 bg-[#090A0F] border border-slate-800 rounded-xl text-sm text-white placeholder-slate-600 focus:outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500 transition-colors"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 py-3 px-4 rounded-xl font-medium text-sm text-white bg-gradient-to-r from-rose-600 via-rose-700 to-pink-700 hover:from-rose-500 hover:to-pink-600 focus:outline-none focus:ring-2 focus:ring-rose-500/50 shadow-lg shadow-rose-950/50 flex items-center justify-center gap-2 transition-all disabled:opacity-60 cursor-pointer"
          >
            {loading ? (
              <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <span>Sign In to Panel</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/* Switch to Signup */}
        <div className="mt-5 text-center">
          <p className="text-xs text-slate-400">
            Don't have an account?{' '}
            <button
              type="button"
              onClick={onSwitchToSignup}
              className="text-rose-400 hover:text-rose-300 font-semibold cursor-pointer underline"
            >
              Register here
            </button>
          </p>
        </div>
      </div>

      {/* Footer Branding */}
      <footer className="mt-8 text-center text-xs text-slate-500 relative z-10 flex flex-col items-center gap-1">
        <div>BusterNodes DVM Panel &bull; Made by Azmal</div>
        <div className="text-[11px] text-slate-600">Enterprise High-Density Virtualization Node</div>
      </footer>
    </div>
  );
};
