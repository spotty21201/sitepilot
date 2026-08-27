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
    vi.restoreAllMocks();
  });

  it('rejects unauthorized external requests without authorization token or same-origin', async () => {
    const req = new NextRequest('http://localhost:3000/api/assessment', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'origin': 'https://malicious-external-site.com',
        'host': 'sitepilot.vercel.app'
      },
      body: JSON.stringify({
        scenarioId: GOLDEN_PROJECT.scenarios[1].id,
        scenarioName: GOLDEN_PROJECT.scenarios[1].name,
        grossSiteArea: GOLDEN_PROJECT.site.grossSiteArea,
        frontageLength: GOLDEN_PROJECT.site.frontageLength,
        hasZoningEvidence: GOLDEN_PROJECT.site.hasZoningEvidence,
        zoningLimits: GOLDEN_PROJECT.zoningLimits,
        setbacks: GOLDEN_PROJECT.scenarios[1].assumptionsUsed.setbacks,
        masses: GOLDEN_PROJECT.scenarios[1].masses
      })
    });

    const res = await POST(req);
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toContain('Unauthorized');
  });

  it('accepts authorized same-origin requests and returns structured planning assessment', async () => {
    const req = new NextRequest('http://localhost:3000/api/assessment', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'origin': 'http://localhost:3000',
        'host': 'localhost:3000'
      },
      body: JSON.stringify({
        scenarioId: GOLDEN_PROJECT.scenarios[1].id,
        scenarioName: GOLDEN_PROJECT.scenarios[1].name,
        grossSiteArea: GOLDEN_PROJECT.site.grossSiteArea,
        frontageLength: GOLDEN_PROJECT.site.frontageLength,
        hasZoningEvidence: GOLDEN_PROJECT.site.hasZoningEvidence,
        zoningLimits: GOLDEN_PROJECT.zoningLimits,
        setbacks: GOLDEN_PROJECT.scenarios[1].assumptionsUsed.setbacks,
        masses: GOLDEN_PROJECT.scenarios[1].masses
      })
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.scenarioId).toBe('scen-002');
    expect(body.status).toBe('WITHIN_SUPPLIED_STUDY_ENVELOPE');
    expect(body.decision).toContain('Statutory status not yet confirmed');
    expect(body.decision).toBeDefined();
    expect(body.supportingEvidence.length).toBeGreaterThan(0);
    expect(body.identifiedRisks.length).toBeGreaterThan(0);
    expect(body.recommendedAction).toBeDefined();
    expect(body.accessPath).toBe('same_origin_browser');
    expect(body.userAuthenticated).toBe(false);
  });

  it('correctly assesses non-compliant height overrun scenario (Scenario C: 12 Storeys)', async () => {
    const req = new NextRequest('http://localhost:3000/api/assessment', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'origin': 'http://localhost:3000',
        'host': 'localhost:3000'
      },
      body: JSON.stringify({
        scenarioId: GOLDEN_PROJECT.scenarios[2].id,
        scenarioName: GOLDEN_PROJECT.scenarios[2].name,
        grossSiteArea: GOLDEN_PROJECT.site.grossSiteArea,
        frontageLength: GOLDEN_PROJECT.site.frontageLength,
        hasZoningEvidence: GOLDEN_PROJECT.site.hasZoningEvidence,
        zoningLimits: GOLDEN_PROJECT.zoningLimits,
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
    expect(body.decision).toContain('43.2m');
  });

  it('recomputes all three schemes before accepting advisory structured output', async () => {
    process.env.SITEPILOT_SERVER_SECRET = 'synthetic-secret';
    process.env.CLOUDRUN_SERVICE_URL = 'https://private-taskmaster.run.app';
    const scenarios = GOLDEN_PROJECT.scenarios.slice(0, 3).map((scenario) => ({
      scenarioId: scenario.id,
      scenarioName: scenario.name,
      setbacks: scenario.assumptionsUsed.setbacks,
      masses: scenario.masses,
      sourceRevisionId: scenario.canonicalRevision?.revisionId || `rev-${scenario.id}`,
      proposal: scenario.proposal,
    }));
    const comments = scenarios.map((scenario) => ({
      schemeId: scenario.scenarioId,
      schemePoint: 'A distinct strategic purpose.', principalStrength: 'Grounded in achieved geometry.',
      principalWeakness: 'Planning evidence remains incomplete.', bestSuitedFor: 'Its stated decision criterion.',
      evidenceReferences: [`${scenario.scenarioId}.achievedGFA`, `${scenario.scenarioId}.far`], confidence: 'MEDIUM',
      confidenceReason: 'Calculated evidence is available.', informationNeeded: ['Statutory evidence'], sourceRevisionId: scenario.sourceRevisionId,
    }));
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true, status: 200,
      json: async () => ({
        ok: true, authenticated: true, model: 'gemini-3.7-flash', project: 'project-528f858c-325a-45aa-ac0',
        vertexLocation: 'global', revision: 'synthetic-revision', correlationId: 'corr-assessment',
        usage: { promptTokens: 10, candidateTokens: 20, totalTokens: 30 },
        response: JSON.stringify({
          schemeComments: comments,
          activeSchemeAssessment: {
            executiveInterpretation: 'Advisory only.', strengths: ['Calculated yield.'], weaknesses: ['Missing evidence.'],
            planningPhysicalRisks: ['Unverified status.'], commercialImplications: ['No return conclusion.'], criticalUnknowns: ['Planning certificate'],
            targetAchievedExplanation: 'The achieved result differs because of whole-storey geometry.',
            alternativeMoves: ['Reduce storeys and simulate again.'], recommendedNextAction: 'Confirm evidence.',
            conditionalRecommendation: 'Prefer only under the stated criterion.', decisionCriteriaUsed: ['Achieved yield', 'Planning risk'],
            sensitivityStatement: 'Another scheme becomes preferable if continuity is weighted more heavily.', confidence: 'MEDIUM',
            confidenceReason: 'Geometry is calculated but statutory evidence is missing.',
            evidenceReferences: [`${scenarios[1].scenarioId}.achievedGFA`, `${scenarios[1].scenarioId}.far`],
          },
        }),
      }),
    } as Response);
    const req = new NextRequest('http://localhost:3000/api/assessment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', origin: 'http://localhost:3000', host: 'localhost:3000' },
      body: JSON.stringify({
        ...scenarios[1], scenarios, activeSchemeId: scenarios[1].scenarioId,
        grossSiteArea: GOLDEN_PROJECT.site.grossSiteArea, frontageLength: GOLDEN_PROJECT.site.frontageLength,
        hasZoningEvidence: false, zoningLimits: GOLDEN_PROJECT.zoningLimits,
      }),
    });
    const response = await POST(req);
    expect(response.status).toBe(200);
    const result = await response.json();
    expect(result.deterministicAssessment.authoritative).toBe(true);
    expect(result.deterministicAssessment.schemes).toHaveLength(3);
    expect(result.aiAssessment.modelCalled).toBe(true);
    expect(result.aiAssessment.modelOutputsSchemaAccepted).toBe(1);
    expect(result.aiAssessment.totalTokens).toBe(30);
    expect(result.status).toBe(result.deterministicAssessment.schemes[1].status);
  });

  it('makes zero provider requests for an explicit deterministic assessment fallback', async () => {
    process.env.CLOUDRUN_SERVICE_URL = 'https://private-taskmaster.run.app';
    process.env.ASSESSMENT_FORCE_FALLBACK = 'true';
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const scenario = GOLDEN_PROJECT.scenarios[0];
    const request = new NextRequest('http://localhost:3000/api/assessment', {
      method: 'POST', headers: { 'Content-Type': 'application/json', origin: 'http://localhost:3000', host: 'localhost:3000' },
      body: JSON.stringify({
        scenarioId: scenario.id, scenarioName: scenario.name, grossSiteArea: GOLDEN_PROJECT.site.grossSiteArea,
        frontageLength: GOLDEN_PROJECT.site.frontageLength, setbacks: scenario.assumptionsUsed.setbacks, masses: scenario.masses,
      }),
    });
    const response = await POST(request);
    expect(response.status).toBe(200);
    const result = await response.json();
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(result.aiAssessment).toMatchObject({ modelCalled: false, providerRequests: 0, providerResponses: 0, totalTokens: 0 });
    expect(result.aiAssessment.disclosure).toBe('Deterministic study summary — no model request made');
  });
});
