import { describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '@/app/api/schemes/generate/route';

describe('scheme generation route boundary', () => {
  it('refuses the legacy direct model path and requires the persisted Taskmaster workflow', async () => {
    const response = await POST(new NextRequest('http://localhost:3000/api/schemes/generate', {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: 'http://localhost:3000', host: 'localhost:3000' },
      body: JSON.stringify({
        opportunityId: 'boundary', name: 'Boundary', address: 'Synthetic', objective: 'Three studies',
        siteAreaM2: 12000, frontageMeters: 100, depthMeters: 120,
        planningLimits: { maxFAR: 7, maxCoveragePct: 50, minKDHPct: 25, maxHeightMeters: 180, setbacks: { front: 10, rear: 8, sideLeft: 6, sideRight: 6 } },
        studyVersion: 'Study version 1', inputHash: 'input-boundary',
        priorities: { existingBuildingRetention: 'adapt', developmentYield: 'balanced', publicRealm: 'strong', programMix: 'mixed use', phasing: 'phased', planningRiskTolerance: 'medium', investmentHorizon: 'long', allowNonCompliantStretch: false },
      }),
    }));
    expect(response.status).toBe(409);
    expect((await response.json()).error).toContain('persisted Taskmaster workflow');
  });
});
