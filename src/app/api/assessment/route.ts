import { NextRequest, NextResponse } from 'next/server';
import {
  calculateDevelopmentMetrics,
  calculateMassPairwiseIntersections,
  checkSetbackEncroachments,
  evaluateScenarioCompliance,
} from '@/lib/geometry/engine';
import type { BuildingMass, DeterministicSchemeAssessment, PlanningAssessment, Setbacks } from '@/types';
import { deriveScenarioFloorLimit } from '@/lib/opportunity/canonical-opportunity';
import {
  assessmentPrompt,
  buildSimulationResultHash,
  buildAssessmentQuestionHash,
  createDeterministicAiSummary,
  planningAssessmentResponseSchema,
  validateAiPlanningAssessment,
} from '@/lib/assessment/planning-assessment';
import { apiModeEnabled, proxyTaskmasterRequest, taskmasterApiEnabled } from '@/lib/taskmaster/vercel-proxy';
import { createAiClient, hostedGenerationCompatibility } from '@/lib/ai/gemini';
import { getAiConfig } from '@/lib/ai/config';
import { consumeAssessmentAllowance } from '@/lib/taskmaster/rate-limit';
import type { Schema } from '@google/genai';
import { randomUUID } from 'node:crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const REQUIRED_CLOUD_RUN_MODEL = 'gemini-3.7-flash';
const REQUIRED_CLOUD_RUN_PROJECT = 'project-528f858c-325a-45aa-ac0';
const REQUIRED_CLOUD_RUN_LOCATION = 'global';

interface AssessmentScenarioInput {
  scenarioId: string;
  scenarioName: string;
  setbacks: Setbacks;
  masses: BuildingMass[];
  sourceRevisionId?: string;
  proposal?: {
    targetGFA?: number;
    varianceExplanation?: string;
    schemePoint?: string;
    existingGfaRetainedM2?: number;
    existingGfaRemovedM2?: number;
    programGFAByUse?: Record<string, number>;
    existingAssetDecision?: string;
    publicRealmIntent?: string;
    accessServicingConcept?: string;
    phasingConcept?: string;
    commercialPremise?: string;
    ownerPrioritiesAddressed?: string[];
  };
}

interface AssessmentRequestBody extends AssessmentScenarioInput {
  projectId?: string;
  grossSiteArea: number;
  frontageLength?: number;
  landscapedPermeableAreaM2?: number;
  scenarios?: AssessmentScenarioInput[];
  activeSchemeId?: string;
  opportunityInputHash?: string;
  sourceStudyVersion?: string;
  ownerPriorities?: Record<string, string | boolean>;
  additionalStrategyInstructions?: string;
  generationProvenance?: { provider?: string; model?: string; modelCalled?: boolean };
  hasZoningEvidence?: boolean;
  projectName?: string;
  caseName?: string;
  address?: string;
  userQuery?: string;
  zoningLimits?: { zoneCode?: string; zoneName?: string; maxFAR?: number; maxCoveragePct?: number; minKDHPct?: number; maxHeightMeters?: number; maxFloors?: number };
  existingAsset?: { gfa?: number; floors?: number; description?: string; currentStatus?: string };
  valuation?: { askingPriceAmount?: number; askingPriceCurrency?: string; njopAmount?: number; pricePerM2?: number; valuationBasisNotes?: string };
}

function positive(value: unknown): value is number { return typeof value === 'number' && Number.isFinite(value) && value > 0; }
function nonnegative(value: unknown): value is number { return typeof value === 'number' && Number.isFinite(value) && value >= 0; }
function finite(value: unknown): value is number { return typeof value === 'number' && Number.isFinite(value); }

function validateScenario(scenario: AssessmentScenarioInput): string | null {
  if (!scenario?.scenarioId || !scenario.scenarioName) return 'scenarioId and scenarioName must be non-empty strings.';
  if (!scenario.setbacks || ![scenario.setbacks.front, scenario.setbacks.rear, scenario.setbacks.sideLeft, scenario.setbacks.sideRight].every(nonnegative)) return 'All setback dimensions must be finite non-negative numbers.';
  if (!Array.isArray(scenario.masses) || scenario.masses.length === 0) return 'masses must be a non-empty array of building masses.';
  for (const mass of scenario.masses) {
    if (!mass?.id || !mass.name || !positive(mass.footprintArea) || !positive(mass.floors)
      || !positive(mass.height) || !positive(mass.floorToFloorHeight)
      || !mass.position || !finite(mass.position.x) || !finite(mass.position.y) || !finite(mass.position.z)
      || !mass.dimensions || !positive(mass.dimensions.width) || !positive(mass.dimensions.length) || !positive(mass.dimensions.height)) {
      return `Mass ${mass?.id || 'unknown'} contains missing, non-finite, or negative geometry fields.`;
    }
  }
  return null;
}

function evidence(key: string, label: string, value: string) { return { key, label, value }; }

function recomputeScheme(body: AssessmentRequestBody, scenario: AssessmentScenarioInput): DeterministicSchemeAssessment {
  const metrics = calculateDevelopmentMetrics(body.grossSiteArea, scenario.masses, scenario.setbacks, body.frontageLength, body.landscapedPermeableAreaM2);
  const overlaps = calculateMassPairwiseIntersections(scenario.masses);
  const encroachments = checkSetbackEncroachments(body.grossSiteArea, scenario.setbacks, scenario.masses, body.frontageLength);
  const referenceMass = scenario.masses.reduce((highest, mass) => !highest || mass.height > highest.height ? mass : highest, scenario.masses[0]);
  const floorLimit = deriveScenarioFloorLimit({
    maximumHeightMeters: body.zoningLimits?.maxHeightMeters,
    maximumFAR: body.zoningLimits?.maxFAR,
    maximumCoveragePct: body.zoningLimits?.maxCoveragePct,
    floorToFloorHeight: referenceMass?.floorToFloorHeight || 3.5,
  });
  const compliance = evaluateScenarioCompliance(body.grossSiteArea, scenario.setbacks, scenario.masses, metrics, overlaps, {
    scenarioName: scenario.scenarioName,
    hasZoningEvidence: Boolean(body.hasZoningEvidence),
    maxFAR: body.zoningLimits?.maxFAR,
    maxCoveragePct: body.zoningLimits?.maxCoveragePct,
    minKDHPct: body.zoningLimits?.minKDHPct,
    maxHeightMeters: body.zoningLimits?.maxHeightMeters,
    maxFloors: floorLimit.kind === 'HEIGHT_DERIVED_LEGAL_MAXIMUM' ? floorLimit.floorCount ?? undefined : undefined,
    zoningName: body.zoningLimits?.zoneName || body.zoningLimits?.zoneCode,
    frontageLength: body.frontageLength,
  });
  const targetGFA = scenario.proposal?.targetGFA ?? metrics.totalGFA;
  const varianceGFA = Math.round((metrics.totalGFA - targetGFA) * 100) / 100;
  const varianceExplanation = scenario.proposal?.varianceExplanation || (Math.abs(varianceGFA) <= 1
    ? 'Deterministic massing achieved the strategic target within 1 m².'
    : `SitePilot achieved ${metrics.totalGFA.toLocaleString()} m² against the ${targetGFA.toLocaleString()} m² strategic target; whole-storey geometry and supplied physical limits account for the variance.`);
  const sourceRevisionId = scenario.sourceRevisionId || `unversioned-${scenario.scenarioId}`;
  return {
    schemeId: scenario.scenarioId,
    schemeName: scenario.scenarioName,
    sourceRevisionId,
    status: compliance.assessmentStatus,
    decision: compliance.decisionText,
    targetGFA,
    achievedGFA: metrics.totalGFA,
    varianceGFA,
    varianceExplanation,
    proposalStrategy: {
      schemePoint: scenario.proposal?.schemePoint,
      existingAssetDecision: scenario.proposal?.existingAssetDecision,
      publicRealmIntent: scenario.proposal?.publicRealmIntent,
      accessServicingConcept: scenario.proposal?.accessServicingConcept,
      phasingConcept: scenario.proposal?.phasingConcept,
      commercialPremise: scenario.proposal?.commercialPremise,
      ownerPrioritiesAddressed: scenario.proposal?.ownerPrioritiesAddressed,
    },
    masses: scenario.masses.map((mass) => ({ name: mass.name, role: mass.type, storeys: mass.floors, heightMeters: mass.height, gfaM2: mass.gfa })),
    existingAsset: {
      retainedGfaM2: scenario.proposal?.existingGfaRetainedM2 ?? 0,
      removedGfaM2: scenario.proposal?.existingGfaRemovedM2 ?? 0,
      reconciled: Math.abs((scenario.proposal?.existingGfaRetainedM2 ?? 0) + (scenario.proposal?.existingGfaRemovedM2 ?? 0) - (body.existingAsset?.gfa ?? 0)) <= 0.01,
    },
    achievedProgramGfaByUse: scenario.proposal?.programGFAByUse || {},
    programReconciled: Math.abs(Object.values(scenario.proposal?.programGFAByUse || {}).reduce((sum, value) => sum + value, 0) - metrics.totalGFA) <= 1,
    farKLB: metrics.farKLB,
    coverageKDB: metrics.siteCoveragePercentage,
    heightMeters: metrics.totalHeightMeters,
    kdhDemonstrated: Boolean(metrics.kdhDemonstrated),
    landscapedPermeableAreaM2: metrics.landscapedPermeableAreaM2,
    collisions: overlaps.hasOverlap,
    outOfBoundsAreaM2: metrics.outOfBoundsAreaM2 || 0,
    risks: compliance.identifiedRisks,
    recommendedAction: compliance.recommendedAction,
    evidence: [
      evidence(`${scenario.scenarioId}.achievedGFA`, 'Achieved GFA', `${metrics.totalGFA.toLocaleString()} m²`),
      evidence(`${scenario.scenarioId}.targetGFA`, 'Target GFA', `${targetGFA.toLocaleString()} m²`),
      evidence(`${scenario.scenarioId}.varianceGFA`, 'Target variance', `${varianceGFA > 0 ? '+' : ''}${varianceGFA.toLocaleString()} m²`),
      evidence(`${scenario.scenarioId}.far`, 'Calculated FAR/KLB', `${metrics.farKLB.toFixed(2)}x`),
      evidence(`${scenario.scenarioId}.coverage`, 'Calculated KDB', `${metrics.siteCoveragePercentage.toFixed(1)}%`),
      evidence(`${scenario.scenarioId}.height`, 'Calculated height', `${metrics.totalHeightMeters.toFixed(1)} m`),
      evidence(`${scenario.scenarioId}.kdh`, 'KDH evidence', metrics.kdhDemonstrated ? `${metrics.landscapedPermeableAreaM2?.toLocaleString()} m² landscaped/permeable` : 'KDH not demonstrated'),
      evidence(`${scenario.scenarioId}.collisions`, 'Collisions', overlaps.hasOverlap ? `${overlaps.overlapVolumeM3.toLocaleString()} m³ overlap` : 'None'),
      evidence(`${scenario.scenarioId}.outOfBounds`, 'Out-of-bounds footprint', `${(metrics.outOfBoundsAreaM2 || 0).toLocaleString()} m²`),
      evidence(`${scenario.scenarioId}.setbacks`, 'Setback result', encroachments.length ? encroachments.map((item) => item.description).join('; ') : 'No encroachment'),
    ],
  };
}

function safeJsonCandidate(value: unknown): unknown {
  if (value && typeof value === 'object') return value;
  if (typeof value !== 'string' || !value.trim()) throw new Error('ASSESSMENT_EMPTY_MODEL_OUTPUT');
  try { return JSON.parse(value); } catch { throw new Error('ASSESSMENT_INVALID_MODEL_JSON'); }
}

export async function POST(request: NextRequest) {
  try {
    const apiMode = apiModeEnabled();
    const authHeader = request.headers.get('authorization');
    const serverSecret = process.env.SITEPILOT_SERVER_SECRET;
    const cloudRunUrl = process.env.CLOUDRUN_SERVICE_URL;
    const isServerAuthorized = apiMode || Boolean(serverSecret && authHeader === `Bearer ${serverSecret}`);
    if (!apiMode && authHeader && !isServerAuthorized) return NextResponse.json({ error: 'Unauthorized: Invalid authentication credentials.', ok: false }, { status: 401 });

    let accessPath: PlanningAssessment['accessPath'];
    if (isServerAuthorized) accessPath = 'authorized_server';
    else {
      const origin = request.headers.get('origin');
      const referer = request.headers.get('referer');
      const host = request.headers.get('host') || request.nextUrl?.host || '';
      const secFetchSite = request.headers.get('sec-fetch-site');
      if (!origin) return NextResponse.json({ error: 'Unauthorized: Missing Origin header for browser request path.', ok: false }, { status: 401 });
      try { if (new URL(origin).host !== host) return NextResponse.json({ error: 'Unauthorized: Cross-origin access denied.', ok: false }, { status: 401 }); }
      catch { return NextResponse.json({ error: 'Unauthorized: Malformed Origin header.', ok: false }, { status: 401 }); }
      if (referer) {
        try { if (new URL(referer).host !== host) return NextResponse.json({ error: 'Unauthorized: Mismatched Referer header.', ok: false }, { status: 401 }); }
        catch { return NextResponse.json({ error: 'Unauthorized: Malformed Referer header.', ok: false }, { status: 401 }); }
      }
      if (secFetchSite && !['same-origin', 'same-site', 'none'].includes(secFetchSite)) return NextResponse.json({ error: 'Unauthorized: Cross-site fetch prohibited.', ok: false }, { status: 401 });
      accessPath = 'same_origin_browser';
    }

    if (!apiMode && process.env.NODE_ENV === 'production' && !serverSecret && cloudRunUrl && !taskmasterApiEnabled()) {
      console.error('[SitePilot Assessment API] Missing server authentication configuration.');
      return NextResponse.json({ error: 'Server configuration error: Secure backend authentication is unconfigured.', ok: false }, { status: 500 });
    }

    const bodyText = await request.text();
    if (taskmasterApiEnabled()) {
      const session = request.cookies.get('sitepilot_session')?.value || randomUUID();
      const response = await proxyTaskmasterRequest(request, '/api/assessment', {
        method: 'POST', headers: { 'content-type': 'application/json', 'x-sitepilot-session': session }, body: bodyText,
      });
      const result = new NextResponse(await response.text(), {
        status: response.status,
        headers: { 'content-type': response.headers.get('content-type') || 'application/json' },
      });
      if (!request.cookies.get('sitepilot_session')) result.cookies.set('sitepilot_session', session, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', maxAge: 60 * 60 });
      return result;
    }

    let body: AssessmentRequestBody;
    try { body = JSON.parse(bodyText) as AssessmentRequestBody; } catch { return NextResponse.json({ error: 'Malformed request: Invalid JSON body.', ok: false }, { status: 400 }); }
    if (!body || typeof body !== 'object' || !positive(body.grossSiteArea)) return NextResponse.json({ error: 'Validation error: grossSiteArea must be a finite positive number.', ok: false }, { status: 400 });
    const scenarios = body.scenarios?.length ? body.scenarios : [{ scenarioId: body.scenarioId, scenarioName: body.scenarioName, setbacks: body.setbacks, masses: body.masses, sourceRevisionId: body.sourceRevisionId, proposal: body.proposal }];
    for (const scenario of scenarios) {
      const issue = validateScenario(scenario);
      if (issue) return NextResponse.json({ error: `Validation error: ${issue}`, ok: false }, { status: 400 });
    }

    const deterministicSchemes = scenarios.map((scenario) => recomputeScheme(body, scenario));
    const activeSchemeId = body.activeSchemeId || body.scenarioId;
    const active = deterministicSchemes.find((scheme) => scheme.schemeId === activeSchemeId) || deterministicSchemes[0];
    const generatedAt = new Date().toISOString();
    const simulationResultHash = buildSimulationResultHash(deterministicSchemes);
    const normalizedQuestion = body.userQuery?.trim().replace(/\s+/g, ' ') || '';
    const questionHash = buildAssessmentQuestionHash(normalizedQuestion);
    const fallback = createDeterministicAiSummary(deterministicSchemes, active.schemeId);
    let acceptedAi = fallback;
    let modelCalled = false;
    let providerRequests = 0;
    let providerResponses = 0;
    let modelOutputsReceived = 0;
    let modelOutputsSchemaAccepted = 0;
    let repairRequests = 0;
    let successfulProviderRequests = 0;
    let promptTokens = 0;
    let candidateTokens = 0;
    let toolUsePromptTokens = 0;
    let thoughtTokens = 0;
    let totalTokens = 0;
    let provider = 'LOCAL_DEVELOPMENT';
    let failureClassification: string | undefined;
    let disclosure = 'Deterministic study summary — no model request made';
    let model = 'Template deterministic summary';
    let backendAuthenticated = false;
    let provenance: PlanningAssessment['provenance'];
    const evidencePackage = {
      confirmedOpportunity: {
        name: body.projectName || body.caseName || 'Development Opportunity', address: body.address || 'Site location',
        inputHash: body.opportunityInputHash || 'not-recorded', studyVersion: body.sourceStudyVersion || 'not-recorded',
        ownerPriorities: body.ownerPriorities || {}, additionalStrategyInstructions: body.additionalStrategyInstructions || '',
        planningInputs: body.zoningLimits || {}, existingAsset: body.existingAsset || null, valuationAssumptions: body.valuation || null,
      },
      generationProvenance: body.generationProvenance || null,
      activeSchemeId: active.schemeId,
      schemes: deterministicSchemes,
    };

    const liveAssessmentConfigured = apiMode
      && process.env.ASSESSMENT_FORCE_FALLBACK !== 'true'
      && process.env.TASKMASTER_ALLOW_LIVE_MODEL === 'true'
      && Number(process.env.TASKMASTER_MAX_MODEL_CALLS || 0) > 0
      && getAiConfig().provider !== 'LOCAL_DEVELOPMENT';
    let liveAssessmentAllowed = liveAssessmentConfigured;
    if (liveAssessmentConfigured) {
      try {
        const allowance = await consumeAssessmentAllowance(request.headers.get('x-sitepilot-session') || 'anonymous-session');
        liveAssessmentAllowed = allowance.allowed;
        if (!allowance.allowed) disclosure = allowance.reason || 'The live assessment allowance is exhausted; a deterministic summary was used.';
      } catch {
        liveAssessmentAllowed = false;
        disclosure = 'The live assessment allowance could not be reserved; a deterministic summary was used.';
        console.warn('[SitePilot Assessment API] Live allowance reservation unavailable; deterministic summary used.');
      }
    }

    if (liveAssessmentAllowed) {
      const { ai, model: configuredModel, provider: configuredProvider } = createAiClient();
      // Record the configured provider even when transport or validation fails;
      // modelCalled remains reserved for an accepted model output.
      provider = configuredProvider;
      model = configuredModel;
      const requestConfig = {
        ...hostedGenerationCompatibility(configuredModel),
        responseMimeType: 'application/json',
        responseSchema: planningAssessmentResponseSchema as unknown as Schema,
        ...(Number(process.env.ASSESSMENT_MAX_OUTPUT_TOKENS || 4096) > 0
          ? { maxOutputTokens: Number(process.env.ASSESSMENT_MAX_OUTPUT_TOKENS || 4096) }
          : {}),
      };
      const requestAssessment = async (contents: string) => {
        providerRequests += 1;
        const response = await ai.models.generateContent({ model: configuredModel, contents, config: requestConfig });
        providerResponses += 1;
        successfulProviderRequests += 1;
        const text = response.text;
        if (text?.trim()) modelOutputsReceived += 1;
        promptTokens += response.usageMetadata?.promptTokenCount || 0;
        candidateTokens += response.usageMetadata?.candidatesTokenCount || 0;
        toolUsePromptTokens += response.usageMetadata?.toolUsePromptTokenCount || 0;
        thoughtTokens += response.usageMetadata?.thoughtsTokenCount || 0;
        totalTokens += response.usageMetadata?.totalTokenCount || 0;
        return text;
      };
      try {
        let text = await requestAssessment(assessmentPrompt(evidencePackage, body.userQuery));
        try {
          acceptedAi = validateAiPlanningAssessment(safeJsonCandidate(text), deterministicSchemes, active.schemeId);
        } catch (validationError) {
          const nonEmptyOutput = Boolean(text?.trim());
          if (!nonEmptyOutput || process.env.TASKMASTER_ALLOW_MODEL_REPAIR !== 'true') throw validationError;
          repairRequests = 1;
          text = await requestAssessment(`${assessmentPrompt(evidencePackage, body.userQuery)}\n\nThe previous non-empty JSON output did not satisfy the server contract. Repair it once. Return only the required JSON; do not add metrics or evidence keys outside the supplied package.`);
          acceptedAi = validateAiPlanningAssessment(safeJsonCandidate(text), deterministicSchemes, active.schemeId);
        }
        modelOutputsSchemaAccepted = 1;
        modelCalled = true;
        disclosure = 'AI assessment grounded in SitePilot results';
        backendAuthenticated = configuredProvider === 'VERTEX_AI';
        provenance = {
          model: configuredModel,
          project: getAiConfig().projectId || 'not-recorded',
          vertexLocation: getAiConfig().location || 'not-recorded',
          revision: process.env.K_REVISION,
          correlationId: request.headers.get('x-sitepilot-correlation-id') || undefined,
        };
      } catch (error) {
        failureClassification = modelOutputsReceived > 0 ? 'ASSESSMENT_STRUCTURED_OUTPUT_REJECTED' : 'ASSESSMENT_PROVIDER_OR_EMPTY_RESPONSE';
        console.error('[SitePilot Assessment API] Model assessment was not accepted.', { code: error instanceof Error ? error.name : 'ASSESSMENT_PROVIDER_FAILURE' });
        disclosure = providerResponses > 0
          ? 'Deterministic study summary — model response not accepted'
          : 'Deterministic study summary — Gemini request failed before a usable response';
      }
    } else if (cloudRunUrl && process.env.ASSESSMENT_FORCE_FALLBACK !== 'true' && !apiMode) {
      providerRequests = 1;
      const response = await fetch(`${cloudRunUrl.replace(/\/$/, '')}/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(serverSecret ? { Authorization: `Bearer ${serverSecret}` } : {}) },
        // The gateway maps this versioned contract to its server-owned SDK responseSchema.
        body: JSON.stringify({ prompt: assessmentPrompt(evidencePackage, body.userQuery), scenarioId: active.schemeId, outputContract: 'SITEPILOT_PLANNING_ASSESSMENT_V1' }),
      });
      if (!response.ok) {
        console.error('[SitePilot Assessment API] Cloud Run assessment request failed.', { status: response.status });
        return NextResponse.json({ error: `Cloud Run Vertex AI service error (HTTP ${response.status}).`, ok: false }, { status: response.status });
      }
      providerResponses = 1;
      successfulProviderRequests = 1;
      provider = 'VERTEX_AI';
      const data: Record<string, unknown> = await response.json();
      if (data.ok !== true || data.authenticated !== true || data.model !== REQUIRED_CLOUD_RUN_MODEL || data.project !== REQUIRED_CLOUD_RUN_PROJECT
        || data.vertexLocation !== REQUIRED_CLOUD_RUN_LOCATION || typeof data.revision !== 'string' || !data.revision
        || typeof data.correlationId !== 'string' || !data.correlationId) {
        console.error('[SitePilot Assessment API] Invalid Cloud Run provenance metadata.');
        return NextResponse.json({ error: 'Invalid or inconsistent provenance received from Cloud Run service.', ok: false }, { status: 502 });
      }
      backendAuthenticated = true;
      model = `${String(data.model)} (Cloud Run / Vertex AI)`;
      provenance = { model: String(data.model), project: String(data.project), vertexLocation: String(data.vertexLocation), revision: String(data.revision), correlationId: String(data.correlationId) };
      const usage = (data.usage && typeof data.usage === 'object' ? data.usage : {}) as Record<string, unknown>;
      promptTokens = typeof usage.promptTokens === 'number' ? usage.promptTokens : 0;
      candidateTokens = typeof usage.candidateTokens === 'number' ? usage.candidateTokens : 0;
      totalTokens = typeof usage.totalTokens === 'number' ? usage.totalTokens : promptTokens + candidateTokens;
      toolUsePromptTokens = typeof usage.toolUsePromptTokens === 'number' ? usage.toolUsePromptTokens : 0;
      thoughtTokens = typeof usage.thoughtTokens === 'number' ? usage.thoughtTokens : 0;
      try {
        const candidate = safeJsonCandidate(data.response);
        modelOutputsReceived = 1;
        acceptedAi = validateAiPlanningAssessment(candidate, deterministicSchemes, active.schemeId);
        modelOutputsSchemaAccepted = 1;
        modelCalled = true;
        disclosure = 'AI assessment grounded in SitePilot results';
      } catch (error) {
        console.error('[SitePilot Assessment API] Model assessment was not accepted.', { code: error instanceof Error ? error.message : 'ASSESSMENT_OUTPUT_INVALID' });
        disclosure = 'Deterministic study summary — model response not accepted';
      }
    } else if (!apiMode && !cloudRunUrl && process.env.NODE_ENV === 'production') return NextResponse.json({ error: 'Production deployment requires private Taskmaster routing.', ok: false }, { status: 500 });

    const assessment: PlanningAssessment = {
      caseId: body.projectId || body.projectName || body.caseName || 'not-recorded',
      scenarioId: active.schemeId, scenarioName: active.schemeName, status: active.status, decision: active.decision,
      supportingEvidence: active.evidence.slice(0, 4).map((item) => `${item.label}: ${item.value}`),
      identifiedRisks: active.risks, recommendedAction: active.recommendedAction, model, generatedAt,
      ...(normalizedQuestion ? { question: normalizedQuestion } : {}), accessPath,
      userAuthenticated: false, backendAuthenticated, provenance,
      deterministicAssessment: { authoritative: true, schemes: deterministicSchemes },
      aiAssessment: {
        advisory: true, provider, modelCalled, disclosure, schemeComments: acceptedAi.schemeComments,
        activeSchemeAssessment: acceptedAi.activeSchemeAssessment, providerRequests, successfulProviderRequests, providerResponses,
        modelOutputsReceived, modelOutputsSchemaAccepted, repairRequests, promptTokens, candidateTokens, totalTokens,
        toolUsePromptTokens, thoughtTokens, ...(failureClassification ? { failureClassification } : {}),
      },
      binding: {
        opportunityInputHash: body.opportunityInputHash || 'not-recorded', sourceStudyVersion: body.sourceStudyVersion || 'not-recorded',
        canonicalRevisionIds: Object.fromEntries(deterministicSchemes.map((scheme) => [scheme.schemeId, scheme.sourceRevisionId])),
        simulationResultHash, activeSchemeId: active.schemeId, questionHash, generatedAt,
      },
      stale: false,
    };
    return NextResponse.json(assessment, { status: 200 });
  } catch (error) {
    console.error('[SitePilot Assessment API] Safe assessment failure.', { code: error instanceof Error ? error.message : 'ASSESSMENT_UNKNOWN' });
    return NextResponse.json({ error: 'Failed to generate Planning Assessment.', ok: false }, { status: 500 });
  }
}
