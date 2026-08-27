import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CLOUD_RUN_SERVICE_ORIGIN,
  apiModeEnabled,
  proxyTaskmasterRequest,
  sameOriginBrowserReadAllowed,
  taskmasterApiEnabled,
} from '@/lib/taskmaster/vercel-proxy';
import { GET as getTaskmasterRun } from '@/app/api/taskmaster/runs/[runId]/route';

const TASKMASTER_API_ORIGIN = 'https://sitepilot-taskmaster-chad5h6gwa-et.a.run.app';
const SUBJECT_TOKEN = 'vercel.header.payload.signature';
const STS_ACCESS_TOKEN = 'sts-access-token-sensitive';
const CLOUD_RUN_ID_TOKEN = 'cloud-run.header.payload.signature';

function request(path = '/api/taskmaster/runs/run-123') {
  return new NextRequest(`https://sitepilot-preview.example${path}`, {
    headers: {
      'x-vercel-oidc-token': SUBJECT_TOKEN,
      'x-sitepilot-correlation-id': 'corr-proxy-test',
      'x-sitepilot-session': 'session-proxy-test',
    },
  });
}

function successfulFetchMock() {
  return vi.fn()
    .mockResolvedValueOnce(new Response(JSON.stringify({ access_token: STS_ACCESS_TOKEN }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }))
    .mockResolvedValueOnce(new Response(JSON.stringify({ token: CLOUD_RUN_ID_TOKEN }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }))
    .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }));
}

describe('Vercel private Cloud Run proxy', () => {
  beforeEach(() => {
    vi.stubEnv('TASKMASTER_API_URL', TASKMASTER_API_ORIGIN);
    vi.stubEnv('GCP_PROJECT_NUMBER', '613863688083');
    vi.stubEnv('GCP_WORKLOAD_IDENTITY_POOL_ID', 'vercel');
    vi.stubEnv('GCP_WORKLOAD_IDENTITY_PROVIDER_ID', 'vercel');
    vi.stubEnv('GCP_VERCEL_API_SERVICE_ACCOUNT', 'sitepilot-vercel-api@project-528f858c-325a-45aa-ac0.iam.gserviceaccount.com');
    vi.stubEnv('TASKMASTER_API_MODE', 'false');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('generates an audience-bound ID token and sends it to the private Cloud Run origin', async () => {
    const fetchMock = successfulFetchMock();
    vi.stubGlobal('fetch', fetchMock);

    const response = await proxyTaskmasterRequest(request(), '/api/taskmaster/runs/run-123');

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    const [identityUrl, identityInit] = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(identityUrl).toContain(':generateIdToken');
    expect(identityUrl).not.toContain(':generateAccessToken');
    expect(JSON.parse(String(identityInit.body))).toEqual({ audience: CLOUD_RUN_SERVICE_ORIGIN });

    const [cloudRunUrl, cloudRunInit] = fetchMock.mock.calls[2] as [string, RequestInit];
    expect(cloudRunUrl).toBe(`${TASKMASTER_API_ORIGIN}/api/taskmaster/runs/run-123`);
    expect(new Headers(cloudRunInit.headers).get('authorization')).toBe(`Bearer ${CLOUD_RUN_ID_TOKEN}`);
  });

  it('keeps the Cloud Run audience fixed when the proxied request path changes', async () => {
    const fetchMock = successfulFetchMock();
    vi.stubGlobal('fetch', fetchMock);

    await proxyTaskmasterRequest(request('/api/taskmaster/runs/another-run/retry'), '/api/taskmaster/runs/another-run/retry', { method: 'POST' });

    const identityBody = JSON.parse(String((fetchMock.mock.calls[1][1] as RequestInit).body));
    expect(identityBody.audience).toBe('https://sitepilot-taskmaster-613863688083.asia-southeast2.run.app');
    expect(identityBody.audience).not.toContain('/api/taskmaster');
    expect(identityBody.audience).not.toContain('sitepilot-preview');
  });

  it('does not expose tokens or upstream response details through errors or logs', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ access_token: STS_ACCESS_TOKEN }), { status: 200 }))
      .mockResolvedValueOnce(new Response(`permission denied: ${SUBJECT_TOKEN} ${STS_ACCESS_TOKEN}`, { status: 403 }));
    vi.stubGlobal('fetch', fetchMock);

    const failure = await proxyTaskmasterRequest(request(), '/api/taskmaster/runs/run-123').catch((caught: unknown) => caught);

    expect(failure).toBeInstanceOf(Error);
    expect((failure as Error).message).toBe('Secure Google Cloud service identity exchange failed.');
    expect((failure as Error).message).not.toContain(SUBJECT_TOKEN);
    expect((failure as Error).message).not.toContain(STS_ACCESS_TOKEN);
    expect((failure as Error).message).not.toContain(TASKMASTER_API_ORIGIN);
    expect(log).not.toHaveBeenCalled();
    expect(warn).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
  });

  it('sanitizes rejected identity requests without exposing tokens or service-account configuration', async () => {
    const serviceAccount = process.env.GCP_VERCEL_API_SERVICE_ACCOUNT!;
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ access_token: STS_ACCESS_TOKEN }), { status: 200 }))
      .mockRejectedValueOnce(new Error(`request failed for ${serviceAccount} with ${STS_ACCESS_TOKEN}`));
    vi.stubGlobal('fetch', fetchMock);

    const failure = await proxyTaskmasterRequest(request(), '/api/taskmaster/runs/run-123').catch((caught: unknown) => caught);

    expect(failure).toBeInstanceOf(Error);
    expect((failure as Error).message).toBe('Secure Google Cloud service identity exchange failed.');
    expect((failure as Error).message).not.toContain(serviceAccount);
    expect((failure as Error).message).not.toContain(STS_ACCESS_TOKEN);
  });

  it.each([
    ['missing project number', 'GCP_PROJECT_NUMBER', undefined],
    ['malformed project number', 'GCP_PROJECT_NUMBER', 'project-number'],
    ['malformed workload pool', 'GCP_WORKLOAD_IDENTITY_POOL_ID', '../vercel'],
    ['malformed service account', 'GCP_VERCEL_API_SERVICE_ACCOUNT', 'not-a-service-account'],
    ['malformed API origin', 'TASKMASTER_API_URL', 'https://user:password@example.com'],
  ])('fails safely for %s', async (_label, key, value) => {
    if (value === undefined) delete process.env[key];
    else vi.stubEnv(key, value);
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const failure = await proxyTaskmasterRequest(request(), '/api/taskmaster/runs/run-123').catch((caught: unknown) => caught);

    expect(failure).toBeInstanceOf(Error);
    expect((failure as Error).message).toMatch(/^(Taskmaster API|Secure Google Cloud proxy)/);
    expect((failure as Error).message).not.toContain(String(value));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('keeps the non-proxy fallback boundary intact when the Taskmaster API is not configured', () => {
    delete process.env.TASKMASTER_API_URL;
    expect(taskmasterApiEnabled()).toBe(false);
    expect(apiModeEnabled()).toBe(false);
  });

  it('allows browser-owned same-origin GET polling when the browser omits Origin', () => {
    const browserPoll = new NextRequest('https://sitepilot-preview.example/api/taskmaster/runs/run-123', {
      headers: { 'sec-fetch-site': 'same-origin' },
    });

    expect(browserPoll.headers.get('origin')).toBeNull();
    expect(sameOriginBrowserReadAllowed(browserPoll)).toBe(true);
  });

  it('proxies a browser-owned polling GET that omits Origin', async () => {
    const fetchMock = successfulFetchMock();
    vi.stubGlobal('fetch', fetchMock);
    const browserPoll = new NextRequest('https://sitepilot-preview.example/api/taskmaster/runs/run-123', {
      headers: {
        'sec-fetch-site': 'same-origin',
        'x-vercel-oidc-token': SUBJECT_TOKEN,
      },
    });

    const response = await getTaskmasterRun(browserPoll, { params: Promise.resolve({ runId: 'run-123' }) });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('keeps missing, malformed, and cross-origin polling requests outside the browser boundary', () => {
    const missingSignals = new NextRequest('https://sitepilot-preview.example/api/taskmaster/runs/run-123');
    const crossSite = new NextRequest('https://sitepilot-preview.example/api/taskmaster/runs/run-123', {
      headers: { 'sec-fetch-site': 'cross-site' },
    });
    const mismatchedOrigin = new NextRequest('https://sitepilot-preview.example/api/taskmaster/runs/run-123', {
      headers: {
        origin: 'https://untrusted.example',
        'sec-fetch-site': 'same-origin',
      },
    });

    expect(sameOriginBrowserReadAllowed(missingSignals)).toBe(false);
    expect(sameOriginBrowserReadAllowed(crossSite)).toBe(false);
    expect(sameOriginBrowserReadAllowed(mismatchedOrigin)).toBe(false);
  });
});
