import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { POST } from '@/app/api/assessment/route';
import { NextRequest } from 'next/server';
import { GOLDEN_PROJECT } from '@/lib/mock-data/golden-project';

describe('AI Planning Assessment API & Security Suite', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('rejects unauthorized external requests without authorization token or same-origin', async () => {
    const req = new NextRequest('http://localhost:3000/api/assessment', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'origin': 'https://malicious-external-site.com'
      },
      body: JSON.stringify({
        scenarioId: GOLDEN_PROJECT.scenarios[1].id,
        scenarioName: GOLDEN_PROJECT.scenarios[1].name,
        grossSiteArea: GOLDEN_PROJECT.site.grossSiteArea,
        setbacks: GOLDEN_PROJECT.scenarios[1].assumptionsUsed.setbacks,
        masses: GOLDEN_PROJECT.scenarios[1].masses
      })
    });

    const res = await POST(req);
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toContain('Unauthorized');
  });

  it('accepts authorized requests and returns structured planning assessment', async () => {
    const req = new NextRequest('http://localhost:3000/api/assessment', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        scenarioId: GOLDEN_PROJECT.scenarios[1].id,
        scenarioName: GOLDEN_PROJECT.scenarios[1].name,
        grossSiteArea: GOLDEN_PROJECT.site.grossSiteArea,
        setbacks: GOLDEN_PROJECT.scenarios[1].assumptionsUsed.setbacks,
        masses: GOLDEN_PROJECT.scenarios[1].masses
      })
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.scenarioId).toBe('scen-002');
    expect(body.status).toBe('COMPLIANT');
    expect(body.decision).toBeDefined();
    expect(body.supportingEvidence.length).toBeGreaterThan(0);
    expect(body.identifiedRisks.length).toBeGreaterThan(0);
    expect(body.recommendedAction).toBeDefined();
    expect(body.model).toContain('gemini-3.7-flash');
    expect(body.authenticated).toBe(true);
  });

  it('correctly assesses non-compliant height overrun scenario (Scenario C: 12 Storeys)', async () => {
    const req = new NextRequest('http://localhost:3000/api/assessment', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        scenarioId: GOLDEN_PROJECT.scenarios[2].id,
        scenarioName: GOLDEN_PROJECT.scenarios[2].name,
        grossSiteArea: GOLDEN_PROJECT.site.grossSiteArea,
        setbacks: GOLDEN_PROJECT.scenarios[2].assumptionsUsed.setbacks,
        masses: GOLDEN_PROJECT.scenarios[2].masses
      })
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.scenarioId).toBe('scen-003');
    expect(body.status).toBe('NON_COMPLIANT_HEIGHT');
    expect(body.decision).toContain('Non-compliant');
    expect(body.decision).toContain('+11.2m');
  });
});
