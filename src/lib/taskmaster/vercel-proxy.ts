import type { NextRequest } from 'next/server';
import { randomUUID } from 'node:crypto';

const TOKEN_EXCHANGE_URL = 'https://sts.googleapis.com/v1/token';

function apiUrl(path: string): string {
  const base = process.env.TASKMASTER_API_URL;
  if (!base) throw new Error('Taskmaster API is not configured.');
  return new URL(path, base.endsWith('/') ? base : `${base}/`).toString();
}

async function getVercelAccessToken(request: NextRequest): Promise<string> {
  const subjectToken = request.headers.get('x-vercel-oidc-token') || process.env.VERCEL_OIDC_TOKEN;
  const projectNumber = process.env.GCP_PROJECT_NUMBER;
  const pool = process.env.GCP_WORKLOAD_IDENTITY_POOL_ID || 'vercel';
  const provider = process.env.GCP_WORKLOAD_IDENTITY_PROVIDER_ID || 'vercel';
  const serviceAccount = process.env.GCP_VERCEL_API_SERVICE_ACCOUNT;
  if (!subjectToken || !projectNumber || !serviceAccount) throw new Error('Secure Google Cloud proxy credentials are unavailable.');
  const audience = `//iam.googleapis.com/projects/${projectNumber}/locations/global/workloadIdentityPools/${pool}/providers/${provider}`;
  const exchange = await fetch(TOKEN_EXCHANGE_URL, {
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
  if (!exchange.ok) throw new Error('Secure Google Cloud token exchange failed.');
  const exchanged = await exchange.json() as { access_token?: string };
  if (!exchanged.access_token) throw new Error('Secure Google Cloud token exchange returned no access token.');
  const generated = await fetch(`https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/${encodeURIComponent(serviceAccount)}:generateAccessToken`, {
    method: 'POST',
    headers: { authorization: `Bearer ${exchanged.access_token}`, 'content-type': 'application/json' },
    body: JSON.stringify({ scope: ['https://www.googleapis.com/auth/cloud-platform'] }),
    cache: 'no-store',
  });
  if (!generated.ok) throw new Error('Secure Google Cloud service identity exchange failed.');
  const token = await generated.json() as { accessToken?: string };
  if (!token.accessToken) throw new Error('Secure Google Cloud service identity exchange returned no access token.');
  return token.accessToken;
}

/** Server-only proxy used by same-origin Vercel routes; the browser never sees
 * the WIF subject token or a Google access token. */
export async function proxyTaskmasterRequest(request: NextRequest, path: string, init: RequestInit = {}): Promise<Response> {
  const token = await getVercelAccessToken(request);
  const headers = new Headers(init.headers);
  headers.set('authorization', `Bearer ${token}`);
  headers.set('x-sitepilot-correlation-id', request.headers.get('x-sitepilot-correlation-id') || randomUUID());
  const session = request.headers.get('x-sitepilot-session');
  if (session) headers.set('x-sitepilot-session', session);
  return fetch(apiUrl(path), { ...init, headers, cache: 'no-store' });
}

export function taskmasterApiEnabled(): boolean {
  return Boolean(process.env.TASKMASTER_API_URL) && process.env.TASKMASTER_API_MODE !== 'true';
}

export function apiModeEnabled(): boolean {
  return process.env.TASKMASTER_API_MODE === 'true';
}
