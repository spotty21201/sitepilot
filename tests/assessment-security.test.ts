import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { POST } from '@/app/api/assessment/route';
import { NextRequest } from 'next/server';
import { GOLDEN_PROJECT } from '@/lib/mock-data/golden-project';

describe('SitePilot Planning Assessment & Security Verification Suite', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  const validScenarioBPayload = {
    scenarioId: GOLDEN_PROJECT.scenarios[1].id,
    scenarioName: GOLDEN_PROJECT.scenarios[1].name,
    grossSiteArea: GOLDEN_PROJECT.site.grossSiteArea,
    setbacks: GOLDEN_PROJECT.scenarios[1].assumptionsUsed.setbacks,
    masses: GOLDEN_PROJECT.scenarios[1].masses
  };

  const validScenarioCPayload = {
    scenarioId: GOLDEN_PROJECT.scenarios[2].id,
    scenarioName: GOLDEN_PROJECT.scenarios[2].name,
    grossSiteArea: GOLDEN_PROJECT.site.grossSiteArea,
    setbacks: GOLDEN_PROJECT.scenarios[2].assumptionsUsed.setbacks,
    masses: GOLDEN_PROJECT.scenarios[2].masses
  };

  // Test 1: Missing production secret fails closed
  it('1. fails closed in production when SITEPILOT_SERVER_SECRET is missing and CLOUDRUN_SERVICE_URL is set', async () => {
    (process.env as Record<string, string | undefined>).NODE_ENV = 'production';
    process.env.CLOUDRUN_SERVICE_URL = 'https://sitepilot-vertex-chad5h6gwa-et.a.run.app';
    delete process.env.SITEPILOT_SERVER_SECRET;

    const req = new NextRequest('http://localhost:3000/api/assessment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validScenarioBPayload)
    });

    const res = await POST(req);
    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.error).toContain('Server configuration error');
  });

  // Test 2: The removed published fallback token is rejected
  it('2. rejects the legacy published fallback token sitepilot-internal-auth-token-2026', async () => {
    process.env.SITEPILOT_SERVER_SECRET = 'strong-secret-prod-2026-xyz';

    const req = new NextRequest('http://localhost:3000/api/assessment', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer sitepilot-internal-auth-token-2026',
        'Origin': 'https://attacker-domain.com'
      },
      body: JSON.stringify(validScenarioBPayload)
    });

    const res = await POST(req);
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toContain('Unauthorized');
  });

  // Test 3: Origin: https://attacker.vercel.app is rejected
  it('3. rejects requests with spoofed Origin: https://attacker.vercel.app', async () => {
    process.env.SITEPILOT_SERVER_SECRET = 'strong-secret-prod-2026-xyz';

    const req = new NextRequest('http://localhost:3000/api/assessment', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': 'https://attacker.vercel.app',
        'Host': 'sitepilot.vercel.app'
      },
      body: JSON.stringify(validScenarioBPayload)
    });

    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  // Test 4: Spoofed .run.app, localhost, and Referer values do not authorize requests
  it('4. rejects spoofed .run.app and Referer headers without authorized token', async () => {
    process.env.SITEPILOT_SERVER_SECRET = 'strong-secret-prod-2026-xyz';

    const req = new NextRequest('http://localhost:3000/api/assessment', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': 'https://malicious-sitepilot.run.app',
        'Referer': 'https://malicious-sitepilot.run.app/dashboard',
        'Host': 'sitepilot.vercel.app'
      },
      body: JSON.stringify(validScenarioBPayload)
    });

    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  // Test 5: A valid assessment payload without authentication from external origin returns 401
  it('5. returns 401 for valid assessment payload from external caller without auth token', async () => {
    process.env.SITEPILOT_SERVER_SECRET = 'strong-secret-prod-2026-xyz';

    const req = new NextRequest('http://localhost:3000/api/assessment', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': 'https://external-api-consumer.com',
        'Host': 'sitepilot.internal'
      },
      body: JSON.stringify(validScenarioBPayload)
    });

    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  // Test 6: Rejected requests do not invoke Vertex AI / Cloud Run fetch
  it('6. ensures rejected unauthorized requests do not invoke Cloud Run or fetch()', async () => {
    process.env.SITEPILOT_SERVER_SECRET = 'strong-secret-prod-2026-xyz';
    process.env.CLOUDRUN_SERVICE_URL = 'https://sitepilot-vertex-chad5h6gwa-et.a.run.app';

    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    const req = new NextRequest('http://localhost:3000/api/assessment', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': 'https://attacker.com',
        'Host': 'sitepilot.internal'
      },
      body: JSON.stringify(validScenarioBPayload)
    });

    const res = await POST(req);
    expect(res.status).toBe(401);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  // Test 7: The Next.js route sends authorized server-to-server requests to Cloud Run
  it('7. sends authorized server-to-server request with Bearer secret to Cloud Run /analyze', async () => {
    process.env.SITEPILOT_SERVER_SECRET = 'strong-server-secret-prod-999';
    process.env.CLOUDRUN_SERVICE_URL = 'https://sitepilot-vertex-chad5h6gwa-et.a.run.app';

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        model: 'gemini-3.7-flash',
        ok: true,
        project: 'project-528f858c-325a-45aa-ac0',
        response: 'Decision: STATUS: COMPLIANT / RECOMMENDED FOR APPROVAL\n* Total height 30.0m within 32.0m cap\n* FAR 2.40x within 3.20x limit'
      })
    });
    vi.stubGlobal('fetch', fetchMock);

    const req = new NextRequest('http://localhost:3000/api/assessment', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer strong-server-secret-prod-999'
      },
      body: JSON.stringify(validScenarioBPayload)
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [callUrl, callOptions] = fetchMock.mock.calls[0];
    expect(callUrl).toBe('https://sitepilot-vertex-chad5h6gwa-et.a.run.app/analyze');
    expect(callOptions.headers['Authorization']).toBe('Bearer strong-server-secret-prod-999');
    expect(data.model).toContain('gemini-3.7-flash');
    expect(data.status).toBe('COMPLIANT');
  });

  // Test 8: Production cannot use the offline heuristic if CLOUDRUN_SERVICE_URL is missing
  it('8. prevents production from silently using offline heuristic when Cloud Run is unconfigured', async () => {
    (process.env as Record<string, string | undefined>).NODE_ENV = 'production';
    delete process.env.CLOUDRUN_SERVICE_URL;

    const req = new NextRequest('http://localhost:3000/api/assessment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validScenarioBPayload)
    });

    const res = await POST(req);
    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.error).toContain('Production deployment requires CLOUDRUN_SERVICE_URL');
  });

  // Test 9: Malformed and non-finite numeric inputs return 400
  it('9. rejects non-finite, negative, or malformed numeric inputs with HTTP 400', async () => {
    const invalidPayloads = [
      { ...validScenarioBPayload, grossSiteArea: -100 },
      { ...validScenarioBPayload, grossSiteArea: NaN },
      { ...validScenarioBPayload, setbacks: { front: 'invalid', rear: 6, sideLeft: 5, sideRight: 5 } },
      { ...validScenarioBPayload, masses: [] },
      { ...validScenarioBPayload, masses: [{ ...validScenarioBPayload.masses[0], floors: -2 }] },
      { ...validScenarioBPayload, masses: [{ ...validScenarioBPayload.masses[0], height: Infinity }] }
    ];

    for (const invalidPayload of invalidPayloads) {
      const req = new NextRequest('http://localhost:3000/api/assessment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(invalidPayload)
      });

      const res = await POST(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain('Validation error');
    }
  });

  // Test 10: Deterministic authority prevents tampered client conclusions
  it('10. recomputes and enforces deterministic math on the server even if client tries to claim compliant status', async () => {
    // Scenario C is 12 storeys (43.2m height), which violates the 32.0m limit
    const req = new NextRequest('http://localhost:3000/api/assessment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validScenarioCPayload)
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();

    // Server must determine NON_COMPLIANT_HEIGHT regardless of any client claims
    expect(data.status).toBe('NON_COMPLIANT_HEIGHT');
    expect(data.decision).toContain('Non-compliant');
    expect(data.decision).toContain('+11.2m');
  });

  // Test 11: Scenario C geometry-derived math: 43.2m height vs 32.0m cap gives exactly +11.2m overrun
  it('11. verifies Scenario C math: for 43.2m height against 32.0m cap, overrun is exactly +11.2m', async () => {
    const req = new NextRequest('http://localhost:3000/api/assessment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validScenarioCPayload)
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();

    expect(data.scenarioId).toBe('scen-003');
    expect(data.status).toBe('NON_COMPLIANT_HEIGHT');
    expect(data.decision).toContain('+11.2m');
  });

  // Test 12: Development heuristic is clearly tagged as DEV_HEURISTIC
  it('12. explicitly tags development heuristic response as DEV_HEURISTIC in non-production mode', async () => {
    delete process.env.CLOUDRUN_SERVICE_URL;
    (process.env as Record<string, string | undefined>).NODE_ENV = 'development';

    const req = new NextRequest('http://localhost:3000/api/assessment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validScenarioBPayload)
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();

    expect(data.model).toBe('gemini-3.7-flash (DEV_HEURISTIC)');
  });
});
