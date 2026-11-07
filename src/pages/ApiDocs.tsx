import React, { useState } from 'react';
import {
  BookOpen,
  Download,
  Copy,
  Check,
  Play,
  Lock,
  Code2,
  Terminal,
  Server,
  Layers,
  KeyRound,
  Shield,
  Activity,
  CheckCircle2,
  ChevronDown,
  ChevronRight
} from 'lucide-react';
import { OPENAPI_SPEC } from '../../server/openapi.ts';

interface DocEndpoint {
  method: 'GET' | 'POST' | 'DELETE' | 'PUT';
  path: string;
  summary: string;
  description: string;
  permission: string | null;
  sampleBody?: any;
}

const ENDPOINTS: DocEndpoint[] = [
  {
    method: 'GET',
    path: '/api/v1/status',
    summary: 'System & Docker Virtualization Status',
    description: 'Returns host system statistics, CPU/RAM telemetry, BusterNodes version, and Docker virtualization daemon state.',
    permission: null,
  },
  {
    method: 'GET',
    path: '/api/v1/usage',
    summary: 'API Usage & Rate Limit Quotas',
    description: 'Retrieves current API token rate limit statistics, consumption, and requests per minute.',
    permission: 'usage.read',
  },
  {
    method: 'GET',
    path: '/api/v1/vms',
    summary: 'List Virtual Machines',
    description: 'Returns all virtual machine containers owned by the authenticated user.',
    permission: 'vms.read',
  },
  {
    method: 'POST',
    path: '/api/v1/vms',
    summary: 'Provision Virtual Machine',
    description: 'Deploys a new Docker container virtual machine with specified CPU, RAM, disk, and SSH port.',
    permission: 'vms.create',
    sampleBody: {
      name: 'dvm-microservice-node',
      image: 'ubuntu:24.04',
      cpu: 2,
      ram_mb: 4096,
      disk_gb: 40,
      notes: 'Production container worker'
    }
  },
  {
    method: 'GET',
    path: '/api/v1/vms/:id',
    summary: 'Get Virtual Machine By ID',
    description: 'Returns hardware specifications, networking port mappings, and running status of a single VM. IDOR protected.',
    permission: 'vms.read',
  },
  {
    method: 'POST',
    path: '/api/v1/vms/:id/start',
    summary: 'Start Virtual Machine',
    description: 'Powers on a stopped virtual machine instance.',
    permission: 'vms.start',
  },
  {
    method: 'POST',
    path: '/api/v1/vms/:id/stop',
    summary: 'Stop Virtual Machine',
    description: 'Sends graceful ACPI / SIGTERM shutdown signal to virtual machine.',
    permission: 'vms.stop',
  },
  {
    method: 'POST',
    path: '/api/v1/vms/:id/restart',
    summary: 'Restart Virtual Machine',
    description: 'Reboots virtual machine instance safely.',
    permission: 'vms.restart',
  },
  {
    method: 'DELETE',
    path: '/api/v1/vms/:id',
    summary: 'Destroy Virtual Machine',
    description: 'Permanently removes the virtual machine and terminates container execution.',
    permission: 'vms.delete',
  },
  {
    method: 'GET',
    path: '/api/v1/images',
    summary: 'List Supported OS Images',
    description: 'Returns supported Linux operating systems (Ubuntu 24.04/22.04, Debian 12, Alpine 3.20, Rocky 9, AlmaLinux 9).',
    permission: 'images.read',
  },
  {
    method: 'GET',
    path: '/api/v1/api-keys',
    summary: 'List API Keys',
    description: 'Retrieves all API keys configured on your account. Raw secrets are never revealed.',
    permission: 'api.keys.read',
  },
  {
    method: 'POST',
    path: '/api/v1/api-keys',
    summary: 'Generate API Key',
    description: 'Generates a new API token. The raw secret is returned ONCE in the response.',
    permission: 'api.keys.manage',
    sampleBody: {
      name: 'CI/CD Pipeline Key',
      permissions: ['vms.read', 'vms.create', 'images.read'],
      expires_in_days: 90,
      description: 'Automated runner token'
    }
  },
  {
    method: 'GET',
    path: '/api/v1/logs',
    summary: 'Query Request Activity Logs',
    description: 'Returns filterable HTTP request audit records for your account.',
    permission: 'api.keys.read',
  }
];

export const ApiDocs: React.FC = () => {
  const [selectedEndpoint, setSelectedEndpoint] = useState<DocEndpoint>(ENDPOINTS[0]);
  const [testApiKey, setTestApiKey] = useState('dvm_live_busternodes_master_key_99x');
  const [paramId, setParamId] = useState('vm-bn-01');
  const [testBody, setTestBody] = useState('');
  const [isExecuting, setIsExecuting] = useState(false);
  const [testResponse, setTestResponse] = useState<any>(null);
  const [activeCodeLang, setActiveCodeLang] = useState<'curl' | 'js' | 'python'>('curl');
  const [copiedCode, setCopiedCode] = useState(false);

  const handleSelectEndpoint = (ep: DocEndpoint) => {
    setSelectedEndpoint(ep);
    setTestResponse(null);
    if (ep.sampleBody) {
      setTestBody(JSON.stringify(ep.sampleBody, null, 2));
    } else {
      setTestBody('');
    }
  };

  const executeLiveRequest = async () => {
    setIsExecuting(true);
    setTestResponse(null);

    let resolvedPath = selectedEndpoint.path;
    if (resolvedPath.includes(':id')) {
      resolvedPath = resolvedPath.replace(':id', paramId || 'vm-bn-01');
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };
    if (testApiKey.trim()) {
      headers['Authorization'] = `Bearer ${testApiKey.trim()}`;
    }

    const startTime = performance.now();
    try {
      const options: RequestInit = {
        method: selectedEndpoint.method,
        headers
      };

      if (['POST', 'PUT'].includes(selectedEndpoint.method) && testBody.trim()) {
        options.body = testBody.trim();
      }

      const res = await fetch(resolvedPath, options);
      const durationMs = Math.round(performance.now() - startTime);
      const json = await res.json();

      setTestResponse({
        status: res.status,
        statusText: res.statusText,
        durationMs,
        headers: {
          'x-ratelimit-limit': res.headers.get('x-ratelimit-limit'),
          'x-ratelimit-remaining': res.headers.get('x-ratelimit-remaining'),
          'x-ratelimit-reset': res.headers.get('x-ratelimit-reset'),
          'content-type': res.headers.get('content-type')
        },
        body: json
      });
    } catch (err: any) {
      setTestResponse({
        status: 0,
        statusText: 'Network Error',
        durationMs: Math.round(performance.now() - startTime),
        body: { error: err.message }
      });
    } finally {
      setIsExecuting(false);
    }
  };

  // Generate code snippet
  const getCodeSnippet = () => {
    let targetUrl = `${window.location.origin}${selectedEndpoint.path.replace(':id', paramId || 'vm-bn-01')}`;
    const token = testApiKey || 'YOUR_API_KEY';

    if (activeCodeLang === 'curl') {
      let cmd = `curl -X ${selectedEndpoint.method} "${targetUrl}" \\\n  -H "Authorization: Bearer ${token}" \\\n  -H "Content-Type: application/json"`;
      if (['POST', 'PUT'].includes(selectedEndpoint.method) && testBody.trim()) {
        cmd += ` \\\n  -d '${testBody.replace(/'/g, "'\\''")}'`;
      }
      return cmd;
    }

    if (activeCodeLang === 'js') {
      let code = `const res = await fetch("${targetUrl}", {\n  method: "${selectedEndpoint.method}",\n  headers: {\n    "Authorization": "Bearer ${token}",\n    "Content-Type": "application/json"\n  }`;
      if (['POST', 'PUT'].includes(selectedEndpoint.method) && testBody.trim()) {
        code += `,\n  body: JSON.stringify(${testBody.trim()})`;
      }
      code += `\n});\nconst data = await res.json();\nconsole.log(data);`;
      return code;
    }

    if (activeCodeLang === 'python') {
      let code = `import requests\n\nurl = "${targetUrl}"\nheaders = {\n    "Authorization": "Bearer ${token}",\n    "Content-Type": "application/json"\n}\n`;
      if (['POST', 'PUT'].includes(selectedEndpoint.method) && testBody.trim()) {
        code += `payload = ${testBody.trim()}\nresponse = requests.${selectedEndpoint.method.toLowerCase()}(url, json=payload, headers=headers)\n`;
      } else {
        code += `response = requests.${selectedEndpoint.method.toLowerCase()}(url, headers=headers)\n`;
      }
      code += `print(response.json())`;
      return code;
    }

    return '';
  };

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(getCodeSnippet());
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="p-4 lg:p-8 space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <span>BusterNodes REST API Documentation</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-rose-950 text-rose-300 border border-rose-900/50 font-mono">
              OpenAPI 3.0
            </span>
          </h2>
          <p className="text-xs text-slate-400 mt-1 max-w-2xl">
            Interactive Swagger reference and live API playground. Test endpoints in real time with bearer authorization.
          </p>
        </div>

        <a
          href="/api/v1/openapi.json"
          target="_blank"
          rel="noopener noreferrer"
          className="px-3.5 py-2 text-xs font-semibold rounded-xl bg-white/5 hover:bg-white/10 text-slate-200 border border-white/10 flex items-center gap-2 self-start sm:self-auto transition-all"
        >
          <Download className="w-4 h-4 text-rose-400" />
          <span>Download OpenAPI JSON</span>
        </a>
      </div>

      {/* Main Documentation Split */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Navigation: Endpoints List (4 cols) */}
        <div className="lg:col-span-4 space-y-2">
          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
            Endpoints Directory
          </div>

          <div className="bg-[#111219] border border-white/5 rounded-2xl p-2 space-y-1 max-h-[700px] overflow-y-auto">
            {ENDPOINTS.map((ep, i) => {
              const isSelected = selectedEndpoint.path === ep.path && selectedEndpoint.method === ep.method;
              return (
                <button
                  key={i}
                  onClick={() => handleSelectEndpoint(ep)}
                  className={`w-full text-left p-2.5 rounded-xl transition-all flex items-center justify-between ${
                    isSelected
                      ? 'bg-[#180A10] border border-rose-700/70 text-slate-100 shadow-md'
                      : 'hover:bg-white/[0.03] text-slate-400 border border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-2 truncate">
                    <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded shrink-0 ${
                      ep.method === 'GET' ? 'bg-emerald-950 text-emerald-400 border border-emerald-900/50' :
                      ep.method === 'POST' ? 'bg-blue-950 text-blue-400 border border-blue-900/50' :
                      'bg-rose-950 text-rose-400 border border-rose-900/50'
                    }`}>
                      {ep.method}
                    </span>
                    <span className="font-mono text-xs text-slate-300 truncate">{ep.path}</span>
                  </div>

                  {ep.permission && (
                    <Lock className="w-3 h-3 text-rose-400 shrink-0 ml-1" />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Right Area: Selected Endpoint Details & Live Playground (8 cols) */}
        <div className="lg:col-span-8 space-y-5">
          {/* Endpoint Header Banner */}
          <div className="p-5 rounded-2xl bg-[#111219] border border-white/5 space-y-3">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className={`text-xs font-mono font-bold px-2 py-1 rounded ${
                selectedEndpoint.method === 'GET' ? 'bg-emerald-950 text-emerald-400 border border-emerald-900/60' :
                selectedEndpoint.method === 'POST' ? 'bg-blue-950 text-blue-400 border border-blue-900/60' :
                'bg-rose-950 text-rose-400 border border-rose-900/60'
              }`}>
                {selectedEndpoint.method}
              </span>
              <span className="font-mono font-bold text-sm text-slate-100">{selectedEndpoint.path}</span>
              {selectedEndpoint.permission ? (
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-rose-950/70 text-rose-300 border border-rose-900/50 flex items-center gap-1">
                  <Lock className="w-2.5 h-2.5" />
                  Requires: {selectedEndpoint.permission}
                </span>
              ) : (
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/5 text-slate-400">
                  Public / Unrestricted
                </span>
              )}
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              {selectedEndpoint.description}
            </p>
          </div>

          {/* Interactive Live Playground */}
          <div className="p-5 rounded-2xl bg-[#111219] border border-rose-950/40 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-white/5">
              <div className="flex items-center gap-2">
                <Play className="w-4 h-4 text-rose-400" />
                <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">Live API Playground</h3>
              </div>
              <span className="text-[11px] text-slate-500 font-mono">Real server execution</span>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                  Authorization Bearer Token
                </label>
                <input
                  type="text"
                  value={testApiKey}
                  onChange={(e) => setTestApiKey(e.target.value)}
                  placeholder="dvm_live_..."
                  className="w-full px-3 py-2 bg-[#090A0F] border border-white/10 rounded-xl text-xs font-mono text-rose-200 focus:outline-none focus:border-rose-600"
                />
              </div>

              {selectedEndpoint.path.includes(':id') && (
                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                    Path Parameter (:id)
                  </label>
                  <input
                    type="text"
                    value={paramId}
                    onChange={(e) => setParamId(e.target.value)}
                    placeholder="vm-bn-01"
                    className="w-full px-3 py-2 bg-[#090A0F] border border-white/10 rounded-xl text-xs font-mono text-slate-200 focus:outline-none focus:border-rose-600"
                  />
                </div>
              )}

              {['POST', 'PUT'].includes(selectedEndpoint.method) && (
                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                    JSON Request Body
                  </label>
                  <textarea
                    rows={5}
                    value={testBody}
                    onChange={(e) => setTestBody(e.target.value)}
                    className="w-full p-3 bg-[#090A0F] border border-white/10 rounded-xl text-xs font-mono text-slate-200 focus:outline-none focus:border-rose-600"
                  />
                </div>
              )}

              <button
                onClick={executeLiveRequest}
                disabled={isExecuting}
                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-rose-800 to-rose-700 hover:from-rose-700 hover:to-rose-600 text-white text-xs font-semibold shadow-lg shadow-rose-950/40 flex items-center justify-center gap-2 transition-all"
              >
                <Play className="w-3.5 h-3.5" />
                <span>{isExecuting ? 'Sending Request...' : `Send ${selectedEndpoint.method} Request`}</span>
              </button>
            </div>

            {/* Live Response Output */}
            {testResponse && (
              <div className="pt-3 border-t border-white/5 space-y-2">
                <div className="flex items-center justify-between text-xs font-mono">
                  <div className="flex items-center gap-2">
                    <span className="text-slate-400">HTTP Status:</span>
                    <span className={`px-2 py-0.5 rounded font-bold ${
                      testResponse.status >= 200 && testResponse.status < 300
                        ? 'bg-emerald-950 text-emerald-400 border border-emerald-900/50'
                        : 'bg-rose-950 text-rose-400 border border-rose-900/50'
                    }`}>
                      {testResponse.status} {testResponse.statusText}
                    </span>
                  </div>
                  <span className="text-slate-500">{testResponse.durationMs}ms</span>
                </div>

                <div className="p-3 bg-[#090A0F] border border-white/10 rounded-xl font-mono text-xs text-slate-300 max-h-60 overflow-y-auto">
                  <pre>{JSON.stringify(testResponse.body, null, 2)}</pre>
                </div>
              </div>
            )}
          </div>

          {/* Code Snippets Section */}
          <div className="p-5 rounded-2xl bg-[#111219] border border-white/5 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-white/5">
              <div className="flex items-center gap-2">
                <Code2 className="w-4 h-4 text-rose-400" />
                <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">Client Code Generation</h3>
              </div>

              <div className="flex items-center gap-1 bg-[#090A0F] p-1 rounded-xl border border-white/5">
                {(['curl', 'js', 'python'] as const).map(lang => (
                  <button
                    key={lang}
                    onClick={() => setActiveCodeLang(lang)}
                    className={`px-2.5 py-0.5 text-[11px] font-mono rounded-lg transition-colors ${
                      activeCodeLang === lang ? 'bg-rose-950 text-rose-200 border border-rose-900/50' : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {lang === 'js' ? 'Node.js' : lang.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            <div className="relative">
              <div className="p-3.5 bg-[#090A0F] border border-white/10 rounded-xl font-mono text-xs text-rose-200 overflow-x-auto">
                <pre>{getCodeSnippet()}</pre>
              </div>

              <button
                onClick={copyCode}
                className="absolute top-2.5 right-2.5 px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 text-[11px] font-mono flex items-center gap-1"
              >
                {copiedCode ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                <span>{copiedCode ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
