import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const proxy = vi.hoisted(() => vi.fn());

vi.mock('@/lib/taskmaster/vercel-proxy', () => ({
  apiModeEnabled: () => false,
  taskmasterApiEnabled: () => true,
  proxyTaskmasterRequest: proxy,
}));

import { POST } from '@/app/api/taskmaster/runs/route';

describe('Taskmaster private proxy session binding', () => {
  beforeEach(() => {
    proxy.mockReset();
    proxy.mockResolvedValue(new Response(JSON.stringify({ ok: true }), {
      status: 202,
      headers: { 'content-type': 'application/json' },
    }));
  });

  it('forwards and stores the same server-generated anonymous session identifier', async () => {
    const request = new NextRequest('https://sitepilot.example/api/taskmaster/runs', {
      method: 'POST',
      headers: { origin: 'https://sitepilot.example', host: 'sitepilot.example', 'content-type': 'application/json' },
      body: '{}',
    });

    const response = await POST(request);
    const forwarded = new Headers(proxy.mock.calls[0][2].headers).get('x-sitepilot-session');

    expect(forwarded).toMatch(/^[0-9a-f-]{36}$/);
    expect(response.cookies.get('sitepilot_session')?.value).toBe(forwarded);
  });

  it('ignores a browser-supplied session header and reuses the httpOnly cookie', async () => {
    const request = new NextRequest('https://sitepilot.example/api/taskmaster/runs', {
      method: 'POST',
      headers: {
        origin: 'https://sitepilot.example',
        host: 'sitepilot.example',
        'content-type': 'application/json',
        cookie: 'sitepilot_session=trusted-cookie-session',
        'x-sitepilot-session': 'browser-controlled-session',
      },
      body: '{}',
    });

    const response = await POST(request);
    const forwarded = new Headers(proxy.mock.calls[0][2].headers).get('x-sitepilot-session');

    expect(forwarded).toBe('trusted-cookie-session');
    expect(response.cookies.get('sitepilot_session')).toBeUndefined();
  });
});
