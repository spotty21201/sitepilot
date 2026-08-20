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
      headers: { 
        'Content-Type': 'application/json',
        'Origin': 'http://localhost:3000',
        'Host': 'localhost:3000'
      },
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
        'Authorization': 'Bearer sitepilot-internal-auth-token-2026'
      },
      body: JSON.stringify(validScenarioBPayload)
    });

    const res = await POST(req);
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toContain('Unauthorized');
  });

  // Test 3: Missing Origin on browser path returns 401
  it('3. rejects browser requests when Origin header is completely missing', async () => {
    process.env.SITEPILOT_SERVER_SECRET = 'strong-secret-prod-2026-xyz';

    const req = new NextRequest('http://localhost:3000/api/assessment', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
        // No Origin and no Authorization
      },
      body: JSON.stringify(validScenarioBPayload)
    });

    const res = await POST(req);
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toContain('Missing Origin header');
  });

  // Test 4: Origin: https://attacker.vercel.app is rejected
  it('4. rejects requests with spoofed Origin: https://attacker.vercel.app', async () => {
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

  // Test 5: Spoofed .run.app and Referer values do not authorize requests
  it('5. rejects spoofed .run.app and Referer headers without authorized token', async () => {
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

  // Test 6: Rejected requests do not invoke Cloud Run or fetch()
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
  it('7. sends authorized server-to-server request with Bearer secret to Cloud Run /analyze and forwards provenance', async () => {
    process.env.SITEPILOT_SERVER_SECRET = 'strong-server-secret-prod-999';
    process.env.CLOUDRUN_SERVICE_URL = 'https://sitepilot-vertex-chad5h6gwa-et.a.run.app';

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        model: 'gemini-3.7-flash',
        ok: true,
        project: 'project-528f858c-325a-45aa-ac0',
        vertexLocation: 'global',
        revision: 'sitepilot-vertex-00002-v60',
        correlationId: 'test-corr-id-12345',
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
    
    // Check provenance
    expect(data.model).toContain('gemini-3.7-flash (Cloud Run / Vertex AI)');
    expect(data.accessPath).toBe('authorized_server');
    expect(data.userAuthenticated).toBe(false);
    expect(data.backendAuthenticated).toBe(true);
    expect(data.provenance?.correlationId).toBe('test-corr-id-12345');
    expect(data.provenance?.revision).toBe('sitepilot-vertex-00002-v60');
  });

  // Test 8: Browser request path returns correct access provenance
  it('8. reports accessPath as same_origin_browser and userAuthenticated as false for browser calls', async () => {
    delete process.env.CLOUDRUN_SERVICE_URL;

    const req = new NextRequest('http://localhost:3000/api/assessment', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': 'http://localhost:3000',
        'Host': 'localhost:3000'
      },
      body: JSON.stringify(validScenarioBPayload)
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();

    expect(data.accessPath).toBe('same_origin_browser');
    expect(data.userAuthenticated).toBe(false);
    expect(data.backendAuthenticated).toBe(false);
  });

  // Test 9: Malformed and non-finite numeric inputs return 400 (including position & dimensions)
  it('9. rejects non-finite, negative, or malformed geometry fields with HTTP 400', async () => {
    const invalidPayloads = [
      { ...validScenarioBPayload, grossSiteArea: -100 },
      { ...validScenarioBPayload, grossSiteArea: NaN },
      { ...validScenarioBPayload, setbacks: { front: 'invalid', rear: 6, sideLeft: 5, sideRight: 5 } },
      { ...validScenarioBPayload, masses: [] },
      { ...validScenarioBPayload, masses: [{ ...validScenarioBPayload.masses[0], floors: -2 }] },
      { ...validScenarioBPayload, masses: [{ ...validScenarioBPayload.masses[0], height: Infinity }] },
      { ...validScenarioBPayload, masses: [{ ...validScenarioBPayload.masses[0], position: { x: NaN, y: 0, z: 0 } }] },
      { ...validScenarioBPayload, masses: [{ ...validScenarioBPayload.masses[0], dimensions: { width: -10, length: 20, height: 15 } }] }
    ];

    for (const invalidPayload of invalidPayloads) {
      const req = new NextRequest('http://localhost:3000/api/assessment', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Origin': 'http://localhost:3000',
          'Host': 'localhost:3000'
        },
        body: JSON.stringify(invalidPayload)
      });

      const res = await POST(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain('Validation error');
    }
  });

  // Test 10: Regression test: Height 31m against 32m cap is compliant and says 31.0m
  it('10. verifies height 31.0m against 32.0m cap is compliant and reports 31.0m', async () => {
    const payload31m = {
      scenarioId: 'scen-test-31m',
      scenarioName: 'Test 31m Scheme',
      grossSiteArea: 16850,
      setbacks: { front: 10, rear: 6, sideLeft: 5, sideRight: 5 },
      masses: [
        {
          id: 'mass-31m',
          name: 'Compliant 31m Tower',
          type: 'GENERAL' as const,
          footprintArea: 2000,
          floors: 8,
          floorToFloorHeight: 3.875,
          height: 31.0,
          gfa: 16000,
          program: 'RESIDENTIAL' as const,
          position: { x: 0, y: 0, z: 0 },
          dimensions: { width: 40, length: 50, height: 31.0 }
        }
      ]
    };

    const req = new NextRequest('http://localhost:3000/api/assessment', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': 'http://localhost:3000',
        'Host': 'localhost:3000'
      },
      body: JSON.stringify(payload31m)
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();

    expect(data.status).toBe('COMPLIANT');
    expect(data.decision).toContain('31.0m');
    expect(data.decision).toContain('Compliant');
  });

  // Test 11: Regression test: Height 33m against 32m cap is non-compliant by exactly +1.0m
  it('11. verifies height 33.0m against 32.0m cap is non-compliant by exactly +1.0m', async () => {
    const payload33m = {
      scenarioId: 'scen-test-33m',
      scenarioName: 'Test 33m Scheme',
      grossSiteArea: 16850,
      setbacks: { front: 10, rear: 6, sideLeft: 5, sideRight: 5 },
      masses: [
        {
          id: 'mass-33m',
          name: 'Non-compliant 33m Tower',
          type: 'GENERAL' as const,
          footprintArea: 2000,
          floors: 9,
          floorToFloorHeight: 3.667,
          height: 33.0,
          gfa: 18000,
          program: 'RESIDENTIAL' as const,
          position: { x: 0, y: 0, z: 0 },
          dimensions: { width: 40, length: 50, height: 33.0 }
        }
      ]
    };

    const req = new NextRequest('http://localhost:3000/api/assessment', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': 'http://localhost:3000',
        'Host': 'localhost:3000'
      },
      body: JSON.stringify(payload33m)
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();

    expect(data.status).toBe('NON_COMPLIANT_HEIGHT');
    expect(data.decision).toContain('+1.0m');
    expect(data.decision).toContain('33.0m');
  });

  // Test 12: Regression test: FAR violation above 3.20x with compliant height is NON_COMPLIANT_FAR
  it('12. verifies FAR above 3.20x while height remains compliant returns NON_COMPLIANT_FAR', async () => {
    // Height: 24m (6 floors * 4m), GFA: 60,000 m² on 16,850 m² site -> FAR = 3.56x > 3.20x
    const payloadHighFar = {
      scenarioId: 'scen-test-far',
      scenarioName: 'High FAR Scheme',
      grossSiteArea: 16850,
      setbacks: { front: 10, rear: 6, sideLeft: 5, sideRight: 5 },
      masses: [
        {
          id: 'mass-fat',
          name: 'Wide Low-Rise Block',
          type: 'GENERAL' as const,
          footprintArea: 8000,
          floors: 6,
          floorToFloorHeight: 4.0,
          height: 24.0,
          gfa: 60000, // FAR = 60000 / 16850 = 3.56x
          program: 'COMMERCIAL' as const,
          position: { x: 0, y: 0, z: 0 },
          dimensions: { width: 80, length: 100, height: 24.0 }
        }
      ]
    };

    const req = new NextRequest('http://localhost:3000/api/assessment', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': 'http://localhost:3000',
        'Host': 'localhost:3000'
      },
      body: JSON.stringify(payloadHighFar)
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();

    expect(data.status).toBe('NON_COMPLIANT_FAR');
    expect(data.decision).toContain('Floor Area Ratio');
    expect(data.decision).toContain('3.56x');
  });

  // Test 13: Regression test: KDB Coverage violation above 55% returns NON_COMPLIANT_COVERAGE
  it('13. verifies Site Coverage above 55% returns NON_COMPLIANT_COVERAGE', async () => {
    // Footprint: 10,000 m² on 16,850 m² site -> Coverage = 59.3% > 55%
    const payloadHighKdb = {
      scenarioId: 'scen-test-kdb',
      scenarioName: 'High Coverage Scheme',
      grossSiteArea: 16850,
      setbacks: { front: 10, rear: 6, sideLeft: 5, sideRight: 5 },
      masses: [
        {
          id: 'mass-kdb',
          name: 'Sprawling Podium',
          type: 'PODIUM' as const,
          footprintArea: 10000,
          floors: 3,
          floorToFloorHeight: 4.0,
          height: 12.0,
          gfa: 30000,
          program: 'RETAIL' as const,
          position: { x: 0, y: 0, z: 0 },
          dimensions: { width: 100, length: 100, height: 12.0 }
        }
      ]
    };

    const req = new NextRequest('http://localhost:3000/api/assessment', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': 'http://localhost:3000',
        'Host': 'localhost:3000'
      },
      body: JSON.stringify(payloadHighKdb)
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();

    expect(data.status).toBe('NON_COMPLIANT_COVERAGE');
    expect(data.decision).toContain('coverage');
    expect(data.decision).toContain('59.3%');
  });

  // Test 14: Regression test: Scenario A output must NOT recommend "Lock Scenario B"
  it('14. verifies Scenario A evaluation does not hardcode Scenario B recommendation', async () => {
    const payloadScenarioA = {
      scenarioId: GOLDEN_PROJECT.scenarios[0].id,
      scenarioName: GOLDEN_PROJECT.scenarios[0].name,
      grossSiteArea: GOLDEN_PROJECT.site.grossSiteArea,
      setbacks: GOLDEN_PROJECT.scenarios[0].assumptionsUsed.setbacks,
      masses: GOLDEN_PROJECT.scenarios[0].masses
    };

    const req = new NextRequest('http://localhost:3000/api/assessment', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': 'http://localhost:3000',
        'Host': 'localhost:3000'
      },
      body: JSON.stringify(payloadScenarioA)
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();

    expect(data.recommendedAction).not.toContain('Lock Scenario B');
    expect(data.recommendedAction).toContain('Scenario A');
  });

  // Test 15: Scenario C geometry-derived math: 43.2m height vs 32.0m cap gives exactly +11.2m overrun
  it('15. verifies Scenario C math: for 43.2m height against 32.0m cap, overrun is exactly +11.2m', async () => {
    const req = new NextRequest('http://localhost:3000/api/assessment', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': 'http://localhost:3000',
        'Host': 'localhost:3000'
      },
      body: JSON.stringify(validScenarioCPayload)
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();

    expect(data.scenarioId).toBe('scen-003');
    expect(data.status).toBe('NON_COMPLIANT_HEIGHT');
    expect(data.decision).toContain('+11.2m');
    expect(data.decision).toContain('43.2m');
  });
});
