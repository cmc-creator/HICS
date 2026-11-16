import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import EnterpriseFooter from '../components/EnterpriseFooter';
import { publicAsset } from '../lib/publicAsset';
import { publicApiRequest } from '../lib/apiClient';

interface EndpointStatus {
  label: string;
  path: string;
  method: 'GET' | 'POST';
  status: 'pending' | 'ok' | 'error';
  latencyMs?: number;
  detail?: string;
}

const ENDPOINTS: Omit<EndpointStatus, 'status'>[] = [
  { label: 'Auth Exchange', path: '/api/auth/exchange', method: 'POST' },
  { label: 'Sales Leads', path: '/api/sales/leads', method: 'POST' },
  { label: 'Store Health', path: '/api/health/store', method: 'GET' },
];

interface StoreHealthSummary {
  mode: string;
  redisConfigured: boolean;
  redisKey: string;
  filePath: string;
  fallbackTmpFilePath: string;
  counts: {
    attempts: number;
    events: number;
    progressKeys: number;
    users: number;
    auditLogs: number;
    notifications: number;
    leads: number;
  };
}

// The Auth Exchange probe goes through the API client with the
// configured endpoint, exactly like the real sign-in callback
// (audit S2). The old raw-fetch probe used a hardcoded full path
// and counted anything under 500 as alive, so it reported the
// exchange healthy while real sign-ins 404'd on the doubled
// /api/api path the client was constructing. An empty body must
// fail server-side validation with 400; a 404 means the built
// path is wrong, and a 500 or network error means it is down.
async function probeExchangeEndpoint(): Promise<{ ok: boolean; latencyMs: number; detail: string }> {
  const start = performance.now();
  const endpoint = (import.meta.env.VITE_AUTH_EXCHANGE_ENDPOINT as string | undefined) ?? '';
  if (!endpoint) {
    return { ok: false, latencyMs: 0, detail: 'VITE_AUTH_EXCHANGE_ENDPOINT not set' };
  }
  try {
    await publicApiRequest(endpoint, { method: 'POST', body: JSON.stringify({}) });
    return { ok: true, latencyMs: Math.round(performance.now() - start), detail: 'HTTP 200' };
  } catch (error) {
    const latencyMs = Math.round(performance.now() - start);
    const status = (error as { status?: number })?.status;
    if (status === 400) {
      return { ok: true, latencyMs, detail: 'HTTP 400 (validation, via API client)' };
    }
    return {
      ok: false,
      latencyMs,
      detail: status ? `HTTP ${status}` : (error instanceof Error ? error.message : 'Network error'),
    };
  }
}

async function probeEndpoint(path: string, method: 'GET' | 'POST'): Promise<{ ok: boolean; latencyMs: number; detail: string }> {
  const start = performance.now();
  try {
    const res = await fetch(path, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: method === 'POST' ? JSON.stringify({}) : undefined,
    });
    const latencyMs = Math.round(performance.now() - start);
    // 200, 201, 400, 422 all mean the function is alive
    const live = res.status < 500;
    return { ok: live, latencyMs, detail: `HTTP ${res.status}` };
  } catch (err) {
    const latencyMs = Math.round(performance.now() - start);
    return { ok: false, latencyMs, detail: err instanceof Error ? err.message : 'Network error' };
  }
}

export default function HealthCheckPage() {
  const [checks, setChecks] = useState<EndpointStatus[]>(
    ENDPOINTS.map(e => ({ ...e, status: 'pending' as const }))
  );
  const [ranAt, setRanAt] = useState<string | null>(null);
  const [storeHealth, setStoreHealth] = useState<StoreHealthSummary | null>(null);

  async function runChecks() {
    setRanAt(null);
    setChecks(ENDPOINTS.map(e => ({ ...e, status: 'pending' as const })));

    const results = await Promise.all(
      ENDPOINTS.map(async (e) => {
        const { ok, latencyMs, detail } = e.label === 'Auth Exchange'
          ? await probeExchangeEndpoint()
          : await probeEndpoint(e.path, e.method);
        return { ...e, status: ok ? ('ok' as const) : ('error' as const), latencyMs, detail };
      })
    );

    setChecks(results);

    try {
      // Go through the API client so a signed-in session's token is
      // attached - the store health endpoint requires auth, and a
      // bare fetch always came back 401, hiding the panel below.
      const payload = await publicApiRequest<{ store?: StoreHealthSummary }>('/health/store', { method: 'GET' });
      if (payload?.store) {
        setStoreHealth(payload.store);
      } else {
        setStoreHealth(null);
      }
    } catch {
      setStoreHealth(null);
    }

    setRanAt(new Date().toLocaleTimeString());
  }

  useEffect(() => { runChecks(); }, []);

  const allOk = checks.every(c => c.status === 'ok');
  const anyError = checks.some(c => c.status === 'error');

  return (
    <div className="nyx-app flex flex-col min-h-screen">
      <main className="flex-1 flex flex-col items-center justify-start p-8 pt-16 gap-8">
        <div className="w-full max-w-xl">
          <div className="flex items-center gap-3 mb-6">
            <img src={publicAsset('hicslogo.png')} alt="NyxHICSlab" className="h-8 w-auto" />
            <span className="text-xl font-bold tracking-tight">NyxHICSlab</span>
            <span className="text-sm opacity-50 ml-auto">System Health</span>
          </div>

          <div className="nyx-panel p-6 mb-4">
            <div className="flex items-center justify-between mb-4">
              <h1 className="text-lg font-semibold">API Endpoint Status</h1>
              <span
                className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                  anyError
                    ? 'bg-red-500/20 text-red-400'
                    : allOk
                    ? 'bg-green-500/20 text-green-400'
                    : 'bg-yellow-500/20 text-yellow-400'
                }`}
              >
                {anyError ? 'Degraded' : allOk ? 'All Systems Operational' : 'Checking…'}
              </span>
            </div>

            <ul className="divide-y divide-white/10">
              {checks.map(check => (
                <li key={check.path} className="flex items-center justify-between py-3">
                  <div>
                    <p className="font-medium text-sm">{check.label}</p>
                    <p className="text-xs opacity-50 font-mono">{check.method} {check.path}</p>
                  </div>
                  <div className="text-right">
                    {check.status === 'pending' && (
                      <span className="text-xs opacity-50 animate-pulse">Checking…</span>
                    )}
                    {check.status === 'ok' && (
                      <>
                        <span className="text-xs font-medium text-green-400">Reachable</span>
                        {check.latencyMs !== undefined && (
                          <p className="text-xs opacity-40">{check.latencyMs} ms · {check.detail}</p>
                        )}
                      </>
                    )}
                    {check.status === 'error' && (
                      <>
                        <span className="text-xs font-medium text-red-400">Unreachable</span>
                        <p className="text-xs opacity-40">{check.detail}</p>
                      </>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>

          {storeHealth && (
            <div className="nyx-panel p-5 mb-4">
              <h2 className="text-sm font-semibold mb-3 opacity-70">Durable Store Health</h2>
              <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-1.5 text-xs font-mono">
                <dt className="opacity-50">Mode</dt>
                <dd>{storeHealth.mode}</dd>
                <dt className="opacity-50">Redis Configured</dt>
                <dd>{storeHealth.redisConfigured ? 'yes' : 'no'}</dd>
                <dt className="opacity-50">Redis Key</dt>
                <dd>{storeHealth.redisKey}</dd>
                <dt className="opacity-50">File Path</dt>
                <dd>{storeHealth.filePath}</dd>
                <dt className="opacity-50">Tmp Fallback</dt>
                <dd>{storeHealth.fallbackTmpFilePath}</dd>
                <dt className="opacity-50">Attempts</dt>
                <dd>{storeHealth.counts.attempts}</dd>
                <dt className="opacity-50">Events</dt>
                <dd>{storeHealth.counts.events}</dd>
                <dt className="opacity-50">Progress Keys</dt>
                <dd>{storeHealth.counts.progressKeys}</dd>
                <dt className="opacity-50">Users</dt>
                <dd>{storeHealth.counts.users}</dd>
                <dt className="opacity-50">Audit Logs</dt>
                <dd>{storeHealth.counts.auditLogs}</dd>
                <dt className="opacity-50">Notifications</dt>
                <dd>{storeHealth.counts.notifications}</dd>
                <dt className="opacity-50">Sales Leads</dt>
                <dd>{storeHealth.counts.leads}</dd>
              </dl>
            </div>
          )}

          <div className="flex items-center justify-between text-xs opacity-40 mb-8">
            {ranAt && <span>Last checked: {ranAt}</span>}
            <button
              onClick={runChecks}
              className="ml-auto underline underline-offset-2 hover:opacity-70 transition-opacity"
            >
              Re-run checks
            </button>
          </div>

          <div className="nyx-panel p-5">
            <h2 className="text-sm font-semibold mb-3 opacity-70">Environment</h2>
            <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-1.5 text-xs font-mono">
              <dt className="opacity-50">API Base URL</dt>
              <dd>{import.meta.env.VITE_API_BASE_URL || <span className="opacity-40 italic">not set</span>}</dd>
              <dt className="opacity-50">Auth Exchange</dt>
              <dd>{import.meta.env.VITE_AUTH_EXCHANGE_ENDPOINT || <span className="opacity-40 italic">not set</span>}</dd>
              <dt className="opacity-50">Google Client ID</dt>
              <dd>{import.meta.env.VITE_OIDC_GOOGLE_CLIENT_ID ? '••••' + String(import.meta.env.VITE_OIDC_GOOGLE_CLIENT_ID).slice(-4) : <span className="opacity-40 italic">not set</span>}</dd>
              <dt className="opacity-50">Local Lead Fallback</dt>
              <dd>{import.meta.env.VITE_ALLOW_LOCAL_LEAD_FALLBACK || 'false'}</dd>
            </dl>
          </div>

          <div className="mt-6 flex gap-4 text-sm">
            <Link to="/" className="underline underline-offset-2 opacity-60 hover:opacity-100 transition-opacity">
              Home
            </Link>
            <Link to="/login" className="underline underline-offset-2 opacity-60 hover:opacity-100 transition-opacity">
              Login
            </Link>
          </div>
        </div>
      </main>
      <EnterpriseFooter />
    </div>
  );
}
