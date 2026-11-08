import React, { useEffect, useRef, useState } from 'react';
import { Terminal } from 'xterm';
import { FitAddon } from '@xterm/addon-fit';
import 'xterm/css/xterm.css';
import {
  Terminal as TerminalIcon,
  RefreshCw,
  Trash2,
  Maximize2,
  Minimize2,
  Share2,
  ExternalLink,
  Copy,
  Check,
  StopCircle,
  AlertTriangle,
  Radio
} from 'lucide-react';
import type { VirtualMachineItem } from '../types/index.ts';

interface TerminalConsoleProps {
  vm: VirtualMachineItem;
  onRefreshVm?: () => void;
}

export const TerminalConsole: React.FC<TerminalConsoleProps> = ({ vm, onRefreshVm }) => {
  const terminalRef = useRef<HTMLDivElement>(null);
  const termInstance = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const socketRef = useRef<WebSocket | null>(null);

  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected'>('disconnected');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [sshxUrl, setSshxUrl] = useState<string | null>(null);
  const [sshxLoading, setSshxLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Check active SSHX session on mount
  useEffect(() => {
    checkActiveSshx();
  }, [vm.id]);

  const checkActiveSshx = async () => {
    try {
      const token = localStorage.getItem('dvm_token');
      const res = await fetch(`/api/v1/vms/${vm.id}/sshx`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      const data = await res.json();
      if (res.ok && data.success && data.data?.active && data.data?.url) {
        setSshxUrl(data.data.url);
      } else {
        setSshxUrl(null);
      }
    } catch {}
  };

  const connectTerminal = () => {
    if (!terminalRef.current) return;

    // Teardown previous socket & terminal
    if (socketRef.current) {
      socketRef.current.close();
      socketRef.current = null;
    }
    if (termInstance.current) {
      termInstance.current.dispose();
      termInstance.current = null;
    }

    setConnectionStatus('connecting');
    setErrorMsg(null);

    // Initialize xterm with BusterNodes dark maroon theme
    const term = new Terminal({
      cursorBlink: true,
      cursorStyle: 'block',
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
      fontSize: 13,
      lineHeight: 1.25,
      theme: {
        background: '#07080C',
        foreground: '#F1F5F9',
        cursor: '#FB7185',
        cursorAccent: '#07080C',
        selectionBackground: 'rgba(225, 29, 72, 0.4)',
        black: '#0F111A',
        red: '#F43F5E',
        green: '#10B981',
        yellow: '#F59E0B',
        blue: '#38BDF8',
        magenta: '#EC4899',
        cyan: '#06B6D4',
        white: '#E2E8F0',
        brightBlack: '#64748B',
        brightRed: '#FB7185',
        brightGreen: '#34D399',
        brightYellow: '#FBBF24',
        brightBlue: '#60A5FA',
        brightMagenta: '#F472B6',
        brightCyan: '#22D3EE',
        brightWhite: '#FFFFFF'
      }
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(terminalRef.current);
    fitAddon.fit();

    termInstance.current = term;
    fitAddonRef.current = fitAddon;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const token = localStorage.getItem('dvm_token') || '';
    const wsUrl = `${protocol}//${window.location.host}/ws/console/${vm.id}?token=${encodeURIComponent(token)}`;

    const ws = new WebSocket(wsUrl);
    socketRef.current = ws;

    ws.onopen = () => {
      setConnectionStatus('connected');
      // Send initial resize
      if (term.cols && term.rows) {
        ws.send(JSON.stringify({ type: 'resize', cols: term.cols, rows: term.rows }));
      }
    };

    ws.onmessage = (event) => {
      term.write(event.data);
    };

    ws.onerror = () => {
      setConnectionStatus('disconnected');
      setErrorMsg('WebSocket connection encountered an error.');
    };

    ws.onclose = () => {
      setConnectionStatus('disconnected');
    };

    term.onData((data) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(data);
      }
    });

    const handleResize = () => {
      try {
        fitAddon.fit();
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'resize', cols: term.cols, rows: term.rows }));
        }
      } catch {}
    };

    window.addEventListener('resize', handleResize);
  };

  useEffect(() => {
    connectTerminal();

    return () => {
      if (socketRef.current) {
        socketRef.current.close();
      }
      if (termInstance.current) {
        termInstance.current.dispose();
      }
    };
  }, [vm.id]);

  const handleClear = () => {
    termInstance.current?.clear();
  };

  const handleStartSshx = async () => {
    setSshxLoading(true);
    setErrorMsg(null);
    try {
      const token = localStorage.getItem('dvm_token');
      const res = await fetch(`/api/v1/vms/${vm.id}/sshx/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        }
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error?.message || 'Failed to start SSHX session in container.');
      }
      setSshxUrl(data.data.url);
    } catch (err: any) {
      setErrorMsg(err.message || 'Error initiating SSHX.');
    } finally {
      setSshxLoading(false);
    }
  };

  const handleStopSshx = async () => {
    try {
      const token = localStorage.getItem('dvm_token');
      await fetch(`/api/v1/vms/${vm.id}/sshx/stop`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      setSshxUrl(null);
    } catch {}
  };

  const handleCopySshx = () => {
    if (!sshxUrl) return;
    navigator.clipboard.writeText(sshxUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={`flex flex-col rounded-2xl border border-rose-950/80 bg-[#0A0B10] overflow-hidden ${
      isFullscreen ? 'fixed inset-4 z-50 shadow-2xl' : 'relative'
    }`}>
      {/* Top Console Bar */}
      <div className="flex items-center justify-between px-4 py-3 bg-[#0E1017] border-b border-rose-950/60">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-rose-600/80" />
            <div className="w-3 h-3 rounded-full bg-amber-600/80" />
            <div className="w-3 h-3 rounded-full bg-emerald-600/80" />
          </div>
          <div className="h-4 w-px bg-slate-800" />
          <div className="flex items-center gap-2 text-xs font-mono text-slate-300">
            <TerminalIcon className="w-3.5 h-3.5 text-rose-400" />
            <span>root@{vm.name}:~#</span>
          </div>
        </div>

        {/* Right Status & Actions */}
        <div className="flex items-center gap-2">
          {/* Connection Status Badge */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#07080C] border border-slate-800 text-[11px] font-mono">
            <span
              className={`w-2 h-2 rounded-full ${
                connectionStatus === 'connected'
                  ? 'bg-emerald-400 shadow-sm shadow-emerald-400/50 animate-pulse'
                  : connectionStatus === 'connecting'
                  ? 'bg-amber-400 animate-spin'
                  : 'bg-rose-500'
              }`}
            />
            <span className="text-slate-400 capitalize">{connectionStatus}</span>
          </div>

          <button
            onClick={connectTerminal}
            title="Reconnect Shell"
            className="p-1.5 rounded-lg bg-[#07080C] hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={handleClear}
            title="Clear Console"
            className="p-1.5 rounded-lg bg-[#07080C] hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={() => {
              setIsFullscreen(!isFullscreen);
              setTimeout(() => fitAddonRef.current?.fit(), 100);
            }}
            title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
            className="p-1.5 rounded-lg bg-[#07080C] hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Terminal Viewport Container */}
      <div
        ref={terminalRef}
        className={`w-full bg-[#07080C] p-3 overflow-hidden ${
          isFullscreen ? 'flex-1' : 'h-[380px] sm:h-[420px]'
        }`}
      />

      {/* SSHX Terminal Integration Section */}
      <div className="p-4 bg-[#0E1017] border-t border-rose-950/60">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-rose-950/40 border border-rose-800/40 flex items-center justify-center text-rose-400 shrink-0">
              <Radio className="w-4 h-4 text-rose-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-white tracking-wide">SSHX Root Session Sharing</span>
                {sshxUrl && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-emerald-950/60 text-emerald-300 border border-emerald-800/60">
                    Live Session Active
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Launch an encrypted, instant web-accessible root console via sshx.io inside this container.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {!sshxUrl ? (
              <button
                type="button"
                onClick={handleStartSshx}
                disabled={sshxLoading || vm.status !== 'running'}
                className="px-3.5 py-2 rounded-xl text-xs font-semibold text-white bg-gradient-to-r from-rose-600 to-pink-700 hover:from-rose-500 hover:to-pink-600 disabled:opacity-50 transition-all shadow-md shadow-rose-950/50 flex items-center gap-2 cursor-pointer"
              >
                {sshxLoading ? (
                  <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <Share2 className="w-3.5 h-3.5" />
                    <span>Launch SSHX</span>
                  </>
                )}
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCopySshx}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium bg-[#07080C] hover:bg-slate-800 text-rose-300 border border-rose-800/50 flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Copied URL' : 'Copy URL'}</span>
                </button>

                <a
                  href={sshxUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="px-3 py-1.5 rounded-lg text-xs font-medium bg-rose-600 hover:bg-rose-500 text-white flex items-center gap-1.5 transition-colors shadow-sm"
                >
                  <span>Open Console</span>
                  <ExternalLink className="w-3 h-3" />
                </a>

                <button
                  type="button"
                  onClick={handleStopSshx}
                  title="Terminate SSHX Session"
                  className="p-1.5 rounded-lg bg-slate-900 hover:bg-rose-950/50 text-slate-400 hover:text-rose-400 border border-slate-800 transition-colors cursor-pointer"
                >
                  <StopCircle className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>

        {sshxUrl && (
          <div className="mt-3 p-2.5 rounded-xl bg-[#07080C] border border-rose-950 flex items-center justify-between gap-3 text-xs font-mono">
            <span className="text-slate-400 truncate">{sshxUrl}</span>
            <span className="text-[10px] text-rose-400 shrink-0 font-sans">Shareable Root Link</span>
          </div>
        )}

        {errorMsg && (
          <div className="mt-2 text-xs text-rose-400 flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}
      </div>
    </div>
  );
};
