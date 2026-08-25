import { z } from 'zod';
import type { ExistingAssetStrategy, Project, SchemeProposal } from '@/types';
import { getAiConfig } from '@/lib/ai/config';
import { createAiClient } from '@/lib/ai/gemini';

export const schemePrioritiesSchema = z.object({
  existingBuildingRetention: z.enum(['retain', 'adapt', 'partial', 'replace']),
  developmentYield: z.enum(['conservative', 'balanced', 'maximum']),
  publicRealm: z.enum(['standard', 'strong', 'generous']),
  programMix: z.string().trim().min(1).max(500),
  phasing: z.enum(['single_phase', 'phased']),
  planningRiskTolerance: z.enum(['low', 'medium', 'high']),
  investmentHorizon: z.enum(['short', 'medium', 'long']),
  allowNonCompliantStretch: z.boolean(),
});

export type SchemePriorities = z.infer<typeof schemePrioritiesSchema>;

const proposalSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  thesis: z.string().min(1),
  existingAssetDecision: z.enum(['RETAIN', 'PARTIALLY_RETAIN', 'ADAPT', 'REPLACE']),
  existingAssetScope: z.string().min(1),
  proposedMassRoles: z.array(z.string().min(1)).min(1),
  podiumStoreys: z.number().int().positive().optional(),
  towerStoreys: z.number().int().positive().optional(),
  floorToFloorAssumptions: z.object({ podium: z.number().positive().optional(), tower: z.number().positive().optional() }),
  programGFAByUse: z.record(z.string(), z.number().nonnegative()),
  footprintIntent: z.string().min(1),
  publicRealmIntent: z.string().min(1),
  landscapedPermeableKDHIntent: z.string().min(1),
  accessServicingConcept: z.string().min(1),
  phasingConcept: z.string().min(1),
  ownerPrioritiesAddressed: z.array(z.string().min(1)).min(1),
  assumptionsIntroduced: z.array(z.string().min(1)),
  rationale: z.string().min(1).max(1000),
  tradeOffs: z.array(z.string().min(1)).min(1),
  allowNonCompliantStretch: z.boolean(),
});

export const schemeProposalArraySchema = z.array(proposalSchema).length(3);

export interface SchemeGenerationInput {
  opportunityId: string;
  name: string;
  address: string;
  objective: string;
  siteAreaM2: number;
  frontageMeters: number;
  depthMeters: number;
  landscapedPermeableAreaM2?: number;
  existingAsset?: { gfa: number; floors?: number; description?: string; currentStatus?: string };
  planningLimits: { maxFAR?: number; maxCoveragePct?: number; minKDHPct?: number; maxHeightMeters?: number; setbacks: { front: number; rear: number; sideLeft: number; sideRight: number } };
  studyVersion: string;
  inputHash: string;
  priorities: SchemePriorities;
}

export interface SchemeGenerationResult {
  provider: 'VERTEX_AI' | 'GEMINI_API' | 'LOCAL_DEVELOPMENT';
  model: string;
  modelCalled: boolean;
  disclosure: string;
  generatedAt: string;
  opportunityId: string;
  sourceStudyVersion: string;
  inputHash: string;
  userPriorities: SchemePriorities;
  assumptions: string[];
  proposals: SchemeProposal[];
  validation: { valid: boolean; errors: string[] };
}

export function buildSchemeInputHash(input: Omit<SchemeGenerationInput, 'inputHash'>): string {
  const stable = JSON.stringify({
    opportunityId: input.opportunityId,
    name: input.name,
    address: input.address,
    objective: input.objective,
    siteAreaM2: input.siteAreaM2,
    frontageMeters: input.frontageMeters,
    depthMeters: input.depthMeters,
    landscapedPermeableAreaM2: input.landscapedPermeableAreaM2,
    existingAsset: input.existingAsset,
    planningLimits: input.planningLimits,
    studyVersion: input.studyVersion,
    priorities: input.priorities,
  });
  let hash = 2166136261;
  for (let index = 0; index < stable.length; index += 1) {
    hash ^= stable.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `input-${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

function priorityLabels(input: SchemeGenerationInput): string[] {
  return [
    input.priorities.programMix,
    `Public realm priority: ${input.priorities.publicRealm}`,
    `Planning risk tolerance: ${input.priorities.planningRiskTolerance}`,
    `Investment horizon: ${input.priorities.investmentHorizon}`,
  ];
}

/**
 * Honest local fallback used when no authenticated model is configured. It is
 * deliberately labelled as templates and is never presented as model output.
 */
export function createStudyTemplateProposals(input: SchemeGenerationInput): SchemeProposal[] {
  const existing = input.existingAsset;
  const maxHeight = input.planningLimits.maxHeightMeters;
  const maxFloorStudy = maxHeight ? Math.max(1, Math.floor(maxHeight / 3.5)) : 12;
  const maxFAR = input.planningLimits.maxFAR ?? 3.2;
  const maxCoverage = input.planningLimits.maxCoveragePct ?? 55;
  const labels = priorityLabels(input);
  return [
    {
      id: `${input.opportunityId}-scheme-a`,
      name: 'Scheme A — Adaptive / Lower Risk',
      thesis: 'Retain or adapt the existing asset with a measured addition and generous public realm.',
      existingAssetDecision: existing ? ('ADAPT' as ExistingAssetStrategy) : 'RETAIN',
      existingAssetScope: existing ? `Retain the entered ${existing.gfa.toLocaleString()} m² asset and adapt its ground-floor interface.` : 'No existing asset supplied; retain the low-rise study baseline.',
      proposedMassRoles: ['Retained/adapted existing asset', 'Low-rise retail and community addition'],
      podiumStoreys: Math.min(2, maxFloorStudy),
      towerStoreys: Math.min(8, maxFloorStudy),
      floorToFloorAssumptions: { podium: 4, tower: 3.5 },
      programGFAByUse: { retail: 2200, office: 1800, residential: 4000, hotel: 0 },
      footprintIntent: `Keep ground coverage below approximately ${Math.min(35, maxCoverage - 10)}% to preserve daylight and public space.`,
      publicRealmIntent: 'Generous shaded forecourt, pedestrian edge, and transit-facing public realm.',
      landscapedPermeableKDHIntent: 'Reserve a clearly identified landscaped/permeable allocation; verify its area before KDH reliance.',
      accessServicingConcept: 'Keep servicing at the edge and preserve a legible pedestrian-first frontage.',
      phasingConcept: 'Phase adaptation first, then add the new low-rise volume without interrupting existing operations.',
      ownerPrioritiesAddressed: labels,
      assumptionsIntroduced: ['Existing asset can be adapted without structural survey.', 'Landscaped/permeable area remains to be measured.'],
      rationale: 'A lower-risk option protects optionality and operational continuity while testing a clear public-realm improvement.',
      tradeOffs: ['Lower yield than the boundary study.', 'Existing-asset condition and adaptation cost remain open questions.'],
      allowNonCompliantStretch: false,
    },
    {
      id: `${input.opportunityId}-scheme-b`,
      name: 'Scheme B — Balanced Mixed-Use',
      thesis: 'Balance active retail, office, residential and hotel uses around a legible podium-and-tower strategy.',
      existingAssetDecision: existing ? 'PARTIALLY_RETAIN' : 'ADAPT',
      existingAssetScope: existing ? `Retain the entered ${existing.gfa.toLocaleString()} m² asset as a defined partial-retention wing; any removal must be confirmed before design.` : 'Adapt the baseline massing into a mixed-use podium and tower.',
      proposedMassRoles: ['Active retail podium', 'Office and hotel transition', 'Residential tower'],
      podiumStoreys: Math.min(4, maxFloorStudy),
      towerStoreys: Math.min(18, maxFloorStudy),
      floorToFloorAssumptions: { podium: 4, tower: 3.5 },
      programGFAByUse: { retail: 7200, office: 10500, residential: 21000, hotel: 9000 },
      footprintIntent: `Use a compact podium and tower with study coverage kept at or below the supplied ${maxCoverage}% KDB limit.`,
      publicRealmIntent: 'Shaded public realm at the transit edge, with active retail frontage and a central landscape court.',
      landscapedPermeableKDHIntent: `Allocate explicit landscape/permeable study area toward the supplied ${input.planningLimits.minKDHPct ?? 'not provided'}% KDH requirement; confirm the measured area.`,
      accessServicingConcept: 'Separate pedestrian transit frontage from a controlled rear servicing route.',
      phasingConcept: 'Phase podium and public realm first, then deliver office/residential/hotel towers as demand is confirmed.',
      ownerPrioritiesAddressed: labels,
      assumptionsIntroduced: ['Partial-retention boundary requires a measured existing-asset survey.', 'Program GFA is a proposal, not a calculated total.', 'Landscape/permeability must be explicitly verified.'],
      rationale: 'A balanced mixed-use scheme responds to the stated transit-oriented brief while keeping the planning envelope legible and reviewable.',
      tradeOffs: ['More complex phasing and servicing.', 'Partial retention must be resolved before operational continuity can be claimed.'],
      allowNonCompliantStretch: false,
    },
    {
      id: `${input.opportunityId}-scheme-c`,
      name: 'Scheme C — Boundary Study',
      thesis: 'Test the supplied FAR, KDB and height envelope near its boundary while exposing headroom and delivery risk.',
      existingAssetDecision: existing ? 'REPLACE' : 'REPLACE',
      existingAssetScope: existing ? `Full replacement study; the entered ${existing.gfa.toLocaleString()} m² asset is not retained in this option.` : 'Replace the low-rise baseline with a new integrated development.',
      proposedMassRoles: ['Large active podium', 'High-rise office/residential/hotel tower'],
      podiumStoreys: Math.min(6, maxFloorStudy),
      towerStoreys: maxFloorStudy,
      floorToFloorAssumptions: { podium: 4, tower: 3.5 },
      programGFAByUse: { retail: 8500, office: Math.round(input.siteAreaM2 * maxFAR * 0.32), residential: Math.round(input.siteAreaM2 * maxFAR * 0.43), hotel: Math.round(input.siteAreaM2 * maxFAR * 0.15) },
      footprintIntent: `Approach the supplied ${maxCoverage}% KDB limit without exceeding it; deterministic geometry will verify the result.`,
      publicRealmIntent: 'Compact but continuous shaded public realm with clear transit arrival and servicing separation.',
      landscapedPermeableKDHIntent: 'Reserve an explicit landscape/permeable allocation before claiming KDH; any shortfall is shown as a warning.',
      accessServicingConcept: 'Concentrate servicing and emergency access in a dedicated edge route.',
      phasingConcept: 'Single major construction phase after demolition, subject to capital and planning-risk confirmation.',
      ownerPrioritiesAddressed: labels,
      assumptionsIntroduced: ['Replacement and demolition are required.', `FAR is studied toward the supplied ${maxFAR.toFixed(2)}x limit.`, 'Landscape/permeability and servicing capacity require confirmation.'],
      rationale: 'The boundary study clarifies how much of the supplied envelope can be approached and where planning or delivery risk becomes decisive.',
      tradeOffs: ['Highest capital and planning risk.', 'No operational continuity because replacement is explicit.'],
      allowNonCompliantStretch: input.priorities.allowNonCompliantStretch,
    },
  ];
}

export function validateSchemeProposals(proposals: unknown, input: SchemeGenerationInput): { valid: boolean; errors: string[]; proposals: SchemeProposal[] } {
  const parsed = schemeProposalArraySchema.safeParse(proposals);
  if (!parsed.success) {
    return { valid: false, errors: parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`), proposals: [] };
  }
  const errors: string[] = [];
  if (new Set(parsed.data.map((proposal) => proposal.name)).size !== 3) errors.push('Three proposals must have distinct names.');
  if (!input.priorities.allowNonCompliantStretch && parsed.data.some((proposal) => proposal.allowNonCompliantStretch)) {
    errors.push('A non-compliant stretch proposal requires explicit owner permission.');
  }
  if (input.planningLimits.maxHeightMeters !== undefined) {
    parsed.data.forEach((proposal) => {
      const podiumHeight = (proposal.podiumStoreys ?? 0) * (proposal.floorToFloorAssumptions.podium ?? 4);
      const towerHeight = (proposal.towerStoreys ?? 0) * (proposal.floorToFloorAssumptions.tower ?? 3.5);
      if (Math.max(podiumHeight, towerHeight) > input.planningLimits.maxHeightMeters! + 0.01
        && !proposal.allowNonCompliantStretch) {
        errors.push(`${proposal.name} proposes a height above the supplied study limit without stretch permission.`);
      }
    });
  }
  return { valid: errors.length === 0, errors, proposals: parsed.data as SchemeProposal[] };
}

function modelPrompt(input: SchemeGenerationInput): string {
  return `Return exactly three structured urban-design proposals for ${input.name} at ${input.address}. Do not return calculated totals or chain-of-thought. Use these confirmed user priorities: ${JSON.stringify(input.priorities)}. Site: ${input.siteAreaM2} m², ${input.frontageMeters} m frontage, ${input.depthMeters} m depth. Existing asset: ${JSON.stringify(input.existingAsset || null)}. Planning inputs: ${JSON.stringify(input.planningLimits)}. Each proposal must have a distinct thesis, existing-asset decision, mass roles, program GFA by use, public realm, landscape/permeability, access, phasing, assumptions, rationale and trade-offs. The application will independently calculate geometry and planning checks.`;
}

export async function generateSchemeProposals(input: SchemeGenerationInput): Promise<SchemeGenerationResult> {
  const config = getAiConfig();
  const generatedAt = new Date().toISOString();
  if (config.provider === 'LOCAL_DEVELOPMENT') {
    const proposals = createStudyTemplateProposals(input);
    return {
      provider: config.provider,
      model: 'Not called in local development',
      modelCalled: false,
      disclosure: 'No model is configured in this local environment. Study templates—not model-generated.',
      generatedAt,
      opportunityId: input.opportunityId,
      sourceStudyVersion: input.studyVersion,
      inputHash: input.inputHash,
      userPriorities: input.priorities,
      assumptions: proposals.flatMap((proposal) => proposal.assumptionsIntroduced),
      proposals,
      validation: { valid: true, errors: [] },
    };
  }

  try {
    const { ai, model, provider } = createAiClient();
    const maxOutputTokens = Number(process.env.TASKMASTER_MAX_OUTPUT_TOKENS || 0);
    const responseSchema = {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          id: { type: 'STRING' }, name: { type: 'STRING' }, thesis: { type: 'STRING' },
          existingAssetDecision: { type: 'STRING', enum: ['RETAIN', 'PARTIALLY_RETAIN', 'ADAPT', 'REPLACE'] },
          existingAssetScope: { type: 'STRING' }, proposedMassRoles: { type: 'ARRAY', items: { type: 'STRING' } },
          podiumStoreys: { type: 'INTEGER' }, towerStoreys: { type: 'INTEGER' },
          floorToFloorAssumptions: { type: 'OBJECT', properties: { podium: { type: 'NUMBER' }, tower: { type: 'NUMBER' } } },
          programGFAByUse: { type: 'OBJECT' }, footprintIntent: { type: 'STRING' }, publicRealmIntent: { type: 'STRING' },
          landscapedPermeableKDHIntent: { type: 'STRING' }, accessServicingConcept: { type: 'STRING' }, phasingConcept: { type: 'STRING' },
          ownerPrioritiesAddressed: { type: 'ARRAY', items: { type: 'STRING' } }, assumptionsIntroduced: { type: 'ARRAY', items: { type: 'STRING' } },
          rationale: { type: 'STRING' }, tradeOffs: { type: 'ARRAY', items: { type: 'STRING' } }, allowNonCompliantStretch: { type: 'BOOLEAN' },
        },
        required: ['id', 'name', 'thesis', 'existingAssetDecision', 'existingAssetScope', 'proposedMassRoles', 'floorToFloorAssumptions', 'programGFAByUse', 'footprintIntent', 'publicRealmIntent', 'landscapedPermeableKDHIntent', 'accessServicingConcept', 'phasingConcept', 'ownerPrioritiesAddressed', 'assumptionsIntroduced', 'rationale', 'tradeOffs', 'allowNonCompliantStretch'],
      },
    };
    const requestConfig = {
      responseMimeType: 'application/json',
      ...(Number.isFinite(maxOutputTokens) && maxOutputTokens > 0 ? { maxOutputTokens } : {}),
      responseSchema,
    };
    let response = await ai.models.generateContent({ model, contents: modelPrompt(input), config: requestConfig });
    let validation = validateSchemeProposals(JSON.parse(response.text || '[]'), input);
    if (!validation.valid && process.env.TASKMASTER_ALLOW_MODEL_REPAIR === 'true') {
      response = await ai.models.generateContent({
        model,
        contents: `Repair this invalid SitePilot proposal set once. Return only a schema-valid JSON array of exactly three materially different proposals. Do not add calculated planning totals. Validation errors: ${validation.errors.join('; ')}. Candidate: ${response.text || '[]'}`,
        config: requestConfig,
      });
      validation = validateSchemeProposals(JSON.parse(response.text || '[]'), input);
    }
    if (!validation.valid) throw new Error(validation.errors.join(' '));
    return {
      provider: provider as SchemeGenerationResult['provider'], model, modelCalled: true,
      disclosure: `${provider} generated structured proposals with ${model}. SitePilot independently checks geometry and planning limits.`,
      generatedAt, opportunityId: input.opportunityId, sourceStudyVersion: input.studyVersion, inputHash: input.inputHash,
      userPriorities: input.priorities, assumptions: validation.proposals.flatMap((proposal) => proposal.assumptionsIntroduced), proposals: validation.proposals, validation: { valid: true, errors: [] },
    };
  } catch (error) {
    if (process.env.TASKMASTER_ALLOW_LIVE_MODEL === 'true') throw error;
    const fallback = createStudyTemplateProposals(input);
    return {
      provider: config.provider, model: 'Not called; deterministic fallback used', modelCalled: false,
      disclosure: `The configured model could not return a valid proposal set (${error instanceof Error ? error.message : 'unknown error'}). Study templates—not model-generated.`,
      generatedAt, opportunityId: input.opportunityId, sourceStudyVersion: input.studyVersion, inputHash: input.inputHash,
      userPriorities: input.priorities, assumptions: fallback.flatMap((proposal) => proposal.assumptionsIntroduced), proposals: fallback,
      validation: { valid: true, errors: ['Model response was replaced by a bounded deterministic fallback.'] },
    };
  }
}

export function proposalGenerationInputFromProject(project: Project, priorities: SchemePriorities): SchemeGenerationInput {
  const sourceStudyVersion = `Study version ${project.scenarios.find((scenario) => scenario.isPreferred)?.canonicalRevision?.sequence ?? 0}`;
  const withoutHash = {
    opportunityId: project.id,
    name: project.name,
    address: project.location.address,
    objective: project.objective,
    siteAreaM2: project.site.grossSiteArea,
    frontageMeters: project.site.frontageLength || 0,
    depthMeters: project.site.lotDepth || 0,
    landscapedPermeableAreaM2: project.site.landscapedPermeableAreaM2,
    existingAsset: project.existingAsset,
    planningLimits: { ...project.zoningLimits!, setbacks: project.site.setbacks },
    studyVersion: sourceStudyVersion,
    priorities,
  };
  return { ...withoutHash, inputHash: buildSchemeInputHash(withoutHash) };
}
