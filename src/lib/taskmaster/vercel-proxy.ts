import type { NextRequest } from 'next/server';
import { randomUUID } from 'node:crypto';

const TOKEN_EXCHANGE_URL = 'https://sts.googleapis.com/v1/token';
export const CLOUD_RUN_SERVICE_ORIGIN = 'https://sitepilot-taskmaster-613863688083.asia-southeast2.run.app';

const WORKLOAD_ID_PATTERN = /^[a-z][a-z0-9-]{2,31}$/;
const SERVICE_ACCOUNT_EMAIL_PATTERN = /^[a-z0-9][a-z0-9-]*@[a-z0-9][a-z0-9-]*\.iam\.gserviceaccount\.com$/i;

function apiUrl(path: string): string {
  const base = process.env.TASKMASTER_API_URL;
  if (!base) throw new Error('Taskmaster API is not configured.');
  if (!path.startsWith('/') || path.startsWith('//')) throw new Error('Taskmaster API request path is invalid.');
  try {
    const origin = new URL(base);
    if (origin.protocol !== 'https:' || origin.username || origin.password || origin.search || origin.hash || origin.pathname !== '/') {
      throw new Error('invalid Taskmaster API origin');
    }
    return new URL(path, origin).toString();
  } catch {
    throw new Error('Taskmaster API configuration is invalid.');
  }
}

async function getCloudRunIdToken(request: NextRequest): Promise<string> {
  const subjectToken = request.headers.get('x-vercel-oidc-token') || process.env.VERCEL_OIDC_TOKEN;
  const projectNumber = process.env.GCP_PROJECT_NUMBER;
  const pool = process.env.GCP_WORKLOAD_IDENTITY_POOL_ID || 'vercel';
  const provider = process.env.GCP_WORKLOAD_IDENTITY_PROVIDER_ID || 'vercel';
  const serviceAccount = process.env.GCP_VERCEL_API_SERVICE_ACCOUNT;
  if (!subjectToken || !projectNumber || !serviceAccount) throw new Error('Secure Google Cloud proxy credentials are unavailable.');
  if (!/^\d+$/.test(projectNumber) || !WORKLOAD_ID_PATTERN.test(pool) || !WORKLOAD_ID_PATTERN.test(provider) || !SERVICE_ACCOUNT_EMAIL_PATTERN.test(serviceAccount)) {
    throw new Error('Secure Google Cloud proxy configuration is invalid.');
  }
  const audience = `//iam.googleapis.com/projects/${projectNumber}/locations/global/workloadIdentityPools/${pool}/providers/${provider}`;
  let exchange: Response;
  try {
    exchange = await fetch(TOKEN_EXCHANGE_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:token-exchange',
        audience,
        scope: 'https://www.googleapis.com/auth/cloud-platform',
        requested_token_type: 'urn:ietf:params:oauth:token-type:access_token',
        subject_token_type: 'urn:ietf:params:oauth:token-type:jwt',
        subject_token: subjectToken,
      }),
      cache: 'no-store',
    });
  } catch {
    throw new Error('Secure Google Cloud token exchange failed.');
  }
  if (!exchange.ok) throw new Error('Secure Google Cloud token exchange failed.');
  const exchanged = await exchange.json().catch(() => ({})) as { access_token?: string };
  if (!exchanged.access_token) throw new Error('Secure Google Cloud token exchange returned no access token.');
  let generated: Response;
  try {
    generated = await fetch(`https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/${encodeURIComponent(serviceAccount)}:generateIdToken`, {
      method: 'POST',
      headers: { authorization: `Bearer ${exchanged.access_token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ audience: CLOUD_RUN_SERVICE_ORIGIN }),
      cache: 'no-store',
    });
  } catch {
    throw new Error('Secure Google Cloud service identity exchange failed.');
  }
  if (!generated.ok) throw new Error('Secure Google Cloud service identity exchange failed.');
  const token = await generated.json().catch(() => ({})) as { token?: string };
  if (!token.token) throw new Error('Secure Google Cloud service identity exchange returned no ID token.');
  return token.token;
}

/** Server-only proxy used by same-origin Vercel routes; the browser never sees
 * the WIF subject token, STS access token, or Cloud Run ID token. */
export async function proxyTaskmasterRequest(request: NextRequest, path: string, init: RequestInit = {}): Promise<Response> {
  const url = apiUrl(path);
  const token = await getCloudRunIdToken(request);
  const headers = new Headers(init.headers);
  headers.set('authorization', `Bearer ${token}`);
  headers.set('x-sitepilot-correlation-id', request.headers.get('x-sitepilot-correlation-id') || randomUUID());
  const session = request.headers.get('x-sitepilot-session');
  if (session) headers.set('x-sitepilot-session', session);
  try {
    return await fetch(url, { ...init, headers, cache: 'no-store' });
  } catch {
    throw new Error('Private Taskmaster request failed.');
  }
}

export function taskmasterApiEnabled(): boolean {
  return Boolean(process.env.TASKMASTER_API_URL) && process.env.TASKMASTER_API_MODE !== 'true';
}

export function apiModeEnabled(): boolean {
  return process.env.TASKMASTER_API_MODE === 'true';
}
