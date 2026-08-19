import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { POST } from '@/app/api/assessment/route';
import { NextRequest } from 'next/server';

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
        scenarioId: 'scen-002',
        scenarioName: 'Scenario B: 8-Storey Residential',
        floors: 8,
        heightMeters: 30.0,
        heightCap: 32.0,
        heightOverrun: 0,
        far: 2.4,
        gfa: 40400,
        siteCoverage: 47.4,
        openSpace: 8870,
        setbacks: { front: 10, rear: 6, sideLeft: 5, sideRight: 5 },
        isOverridden: false
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
        'Content-Type': 'application/json',
        'origin': 'http://localhost:3000'
      },
      body: JSON.stringify({
        scenarioId: 'scen-002',
        scenarioName: 'Scenario B: 8-Storey Residential (Preferred)',
        floors: 8,
        heightMeters: 30.0,
        heightCap: 32.0,
        heightOverrun: 0,
        far: 2.4,
        gfa: 40400,
        siteCoverage: 47.4,
        openSpace: 8870,
        setbacks: { front: 10, rear: 6, sideLeft: 5, sideRight: 5 },
        isOverridden: false,
        hasCollision: false,
        encroachments: []
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

  it('correctly assesses non-compliant height overrun scenario', async () => {
    const req = new NextRequest('http://localhost:3000/api/assessment', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'origin': 'http://localhost:3000'
      },
      body: JSON.stringify({
        scenarioId: 'scen-003',
        scenarioName: 'Scenario C: 12-Storey Height Overrun',
        floors: 12,
        heightMeters: 44.0,
        heightCap: 32.0,
        heightOverrun: 12.0,
        far: 3.59,
        gfa: 60480,
        siteCoverage: 47.4,
        openSpace: 8870,
        setbacks: { front: 10, rear: 6, sideLeft: 5, sideRight: 5 },
        isOverridden: false,
        hasCollision: false,
        encroachments: []
      })
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.scenarioId).toBe('scen-003');
    expect(body.status).toBe('NON_COMPLIANT_HEIGHT');
    expect(body.decision).toContain('Non-compliant');
    expect(body.recommendedAction).toContain('8 floors');
  });
});
