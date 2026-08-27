import { z } from 'zod';
import type { ConfirmedSchemeInputSnapshot, ExistingAssetStrategy, Project, SchemeProposal } from '@/types';
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
  strategy: z.enum(['CONSERVATIVE', 'BALANCED', 'BOUNDARY']),
  thesis: z.string().min(1),
  existingAssetDecision: z.enum(['RETAIN', 'PARTIALLY_RETAIN', 'ADAPT', 'REPLACE', 'NOT_APPLICABLE']),
  existingAssetScope: z.string().min(1),
  existingGfaRetainedM2: z.number().nonnegative(),
  existingGfaRemovedM2: z.number().nonnegative(),
  proposedMassRoles: z.array(z.string().min(1)).min(1),
  podiumStoreys: z.number().int().positive().optional(),
  towerStoreys: z.number().int().positive().optional(),
  alternativeStoreys: z.number().int().positive().optional(),
  floorToFloorAssumptions: z.object({ podium: z.number().positive().optional(), tower: z.number().positive().optional(), alternative: z.number().positive().optional() }),
  programGFAByUse: z.record(z.string(), z.number().nonnegative()).refine((value) => Object.keys(value).length > 0, 'A structured development program is required.'),
  programSharePct: z.record(z.string(), z.number().nonnegative()).refine((value) => Object.keys(value).length > 0, 'Program shares are required.'),
  setbacks: z.object({ front: z.number().nonnegative(), rear: z.number().nonnegative(), sideLeft: z.number().nonnegative(), sideRight: z.number().nonnegative() }),
  footprintIntent: z.string().min(1),
  publicRealmIntent: z.string().min(1),
  landscapedPermeableKDHIntent: z.string().min(1),
  accessServicingConcept: z.string().min(1),
  phasingConcept: z.string().min(1),
  commercialPremise: z.string().min(1),
  planningResponse: z.string().min(1),
  targetGFA: z.number().positive(),
  achievedGFA: z.number().nonnegative(),
  varianceGFA: z.number(),
  varianceExplanation: z.string().min(1),
  ownerPrioritiesAddressed: z.array(z.string().min(1)).min(1),
  assumptionsIntroduced: z.array(z.string().min(1)),
  rationale: z.string().min(1).max(1000),
  tradeOffs: z.array(z.string().min(1)).min(1),
  informationStillRequired: z.array(z.string().min(1)),
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
  landscapedPermeablePct?: number;
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
  qualityGate: {
    distinctnessPassed: boolean;
    repairAttempted: boolean;
    repairSucceeded: boolean;
  };
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
    landscapedPermeablePct: input.landscapedPermeablePct,
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

function roundGfa(value: number): number {
  return Math.round(value * 100) / 100;
}

function roundedProgram(total: number, shares: Record<string, number>): Record<string, number> {
  const entries = Object.entries(shares);
  let assigned = 0;
  return Object.fromEntries(entries.map(([use, share], index) => {
    const value = index === entries.length - 1 ? roundGfa(total - assigned) : roundGfa(total * share / 100);
    assigned += value;
    return [use, value];
  }));
}

function targetFor(input: SchemeGenerationInput, ratio: number, fallbackFar: number): number {
  const envelope = input.siteAreaM2 * (input.planningLimits.maxFAR ?? fallbackFar);
  return Math.max(input.existingAsset?.gfa ?? 0, Math.round(envelope * ratio));
}

function informationRequired(input: SchemeGenerationInput): string[] {
  return [
    input.existingAsset && input.existingAsset.floors === undefined ? 'Measured existing-asset storeys and geometry' : undefined,
    input.planningLimits.minKDHPct !== undefined && input.landscapedPermeableAreaM2 === undefined ? 'Measured landscaped/permeable area to demonstrate KDH' : undefined,
    input.planningLimits.maxHeightMeters === undefined ? 'Maximum supplied building height' : undefined,
    'Statutory planning confirmation and supporting source documents',
    'Market, cost, absorption and phasing feasibility evidence',
  ].filter((item): item is string => Boolean(item));
}

/**
 * Honest local fallback used when no authenticated model is configured. It is
 * deliberately labelled as templates and is never presented as model output.
 */
export function createStudyTemplateProposals(input: SchemeGenerationInput): SchemeProposal[] {
  const existing = input.existingAsset;
  const maxHeight = input.planningLimits.maxHeightMeters;
  const maxFloorStudy = maxHeight !== undefined ? Math.max(1, Math.floor(maxHeight / 3.5)) : 12;
  const maxFAR = input.planningLimits.maxFAR ?? 3.2;
  const maxCoverage = input.planningLimits.maxCoveragePct ?? 55;
  const labels = priorityLabels(input);
  const missing = informationRequired(input);
  const targetA = targetFor(input, 0.38, 2.4);
  const targetB = targetFor(input, 0.68, 4.8);
  const targetC = targetFor(input, 0.90, 6.4);
  const sharesA = { retail: 18, office: 22, residential: 32, hotel: 12, publicRealmAmenities: 16 };
  const sharesB = { retail: 14, office: 24, residential: 38, hotel: 18, publicRealmAmenities: 6 };
  const sharesC = { retail: 10, office: 28, residential: 45, hotel: 14, publicRealmAmenities: 3 };
  const existingGfa = existing?.gfa ?? 0;
  const partialRetained = existing ? roundGfa(existing.gfa * 0.6) : 0;
  return [
    {
      id: `${input.opportunityId}-scheme-a`,
      name: 'Scheme A — Retention Courtyard',
      strategy: 'CONSERVATIVE',
      thesis: 'Preserve the entered asset exactly, maintain operations, and frame a shaded public courtyard with lower-rise additions.',
      existingAssetDecision: existing ? ('ADAPT' as ExistingAssetStrategy) : 'NOT_APPLICABLE',
      existingAssetScope: existing ? `Retain the entered ${existing.gfa.toLocaleString()} m² asset exactly, remove 0 m², and adapt its ground-floor interface.` : 'No existing asset was supplied; the study uses a lower-rise courtyard arrangement.',
      existingGfaRetainedM2: existingGfa,
      existingGfaRemovedM2: 0,
      proposedMassRoles: existing ? ['Retained existing asset', 'Low-rise courtyard wings'] : ['Low-rise courtyard anchor', 'Low-rise courtyard wings'],
      alternativeStoreys: Math.min(6, maxFloorStudy),
      floorToFloorAssumptions: { alternative: 3.5 },
      programGFAByUse: roundedProgram(targetA, sharesA),
      programSharePct: sharesA,
      setbacks: { ...input.planningLimits.setbacks },
      footprintIntent: `Keep ground coverage below approximately ${Math.min(35, maxCoverage - 10)}% to preserve daylight and public space.`,
      publicRealmIntent: 'A generous shaded courtyard and porous pedestrian forecourt connect the retained asset to the transit edge.',
      landscapedPermeableKDHIntent: 'Reserve a clearly identified landscaped/permeable allocation; verify its area before KDH reliance.',
      accessServicingConcept: 'Retain the operational arrival, add a pedestrian-first transit frontage, and keep loading on a screened edge route.',
      phasingConcept: 'Phase adaptation first, then add the new low-rise volume without interrupting existing operations.',
      commercialPremise: 'Protect operating income and stage capital expenditure before committing to denser later phases.',
      planningResponse: `Remain materially below the supplied ${maxFAR.toFixed(2)} FAR and ${maxCoverage}% KDB inputs while respecting every supplied setback.`,
      targetGFA: targetA,
      achievedGFA: 0,
      varianceGFA: -targetA,
      varianceExplanation: 'Pending deterministic massing simulation.',
      ownerPrioritiesAddressed: labels,
      assumptionsIntroduced: ['Existing asset can be adapted without structural survey.', 'Landscaped/permeable area remains to be measured.'],
      rationale: 'A lower-risk option protects optionality and operational continuity while testing a clear public-realm improvement.',
      tradeOffs: ['Lower yield than the boundary study.', 'Existing-asset condition and adaptation cost remain open questions.'],
      informationStillRequired: missing,
      allowNonCompliantStretch: false,
    },
    {
      id: `${input.opportunityId}-scheme-b`,
      name: 'Scheme B — Balanced Mixed-Use',
      strategy: 'BALANCED',
      thesis: 'Balance active retail, office, residential and hotel uses around a legible podium-and-tower strategy.',
      existingAssetDecision: existing ? 'PARTIALLY_RETAIN' : 'NOT_APPLICABLE',
      existingAssetScope: existing ? `Retain exactly ${partialRetained.toLocaleString()} m² and remove exactly ${(existing.gfa - partialRetained).toLocaleString()} m² in a surveyed partial-retention phase.` : 'No existing asset was supplied; organize mixed uses in a podium-and-tower study.',
      existingGfaRetainedM2: partialRetained,
      existingGfaRemovedM2: roundGfa(existingGfa - partialRetained),
      proposedMassRoles: ['Active retail podium', 'Office and hotel transition', 'Residential tower'],
      podiumStoreys: Math.min(4, maxFloorStudy),
      towerStoreys: Math.min(18, maxFloorStudy),
      floorToFloorAssumptions: { podium: 4, tower: 3.5 },
      programGFAByUse: roundedProgram(targetB, sharesB),
      programSharePct: sharesB,
      setbacks: { ...input.planningLimits.setbacks },
      footprintIntent: `Use a compact podium and tower with study coverage kept at or below the supplied ${maxCoverage}% KDB limit.`,
      publicRealmIntent: 'Shaded public realm at the transit edge, with active retail frontage and a central landscape court.',
      landscapedPermeableKDHIntent: `Allocate explicit landscape/permeable study area toward the supplied ${input.planningLimits.minKDHPct ?? 'not provided'}% KDH requirement; confirm the measured area.`,
      accessServicingConcept: 'Separate pedestrian transit frontage from a controlled rear servicing route.',
      phasingConcept: 'Phase podium and public realm first, then deliver office/residential/hotel towers as demand is confirmed.',
      commercialPremise: 'Balance early place-making value with phased mixed-use absorption and a defined partial-retention cost decision.',
      planningResponse: `Use the supplied setbacks as fixed edges and test a balanced yield within the ${maxFAR.toFixed(2)} FAR, ${maxCoverage}% KDB and supplied height inputs.`,
      targetGFA: targetB,
      achievedGFA: 0,
      varianceGFA: -targetB,
      varianceExplanation: 'Pending deterministic massing simulation.',
      ownerPrioritiesAddressed: labels,
      assumptionsIntroduced: ['Partial-retention boundary requires a measured existing-asset survey.', 'Program GFA is a proposal, not a calculated total.', 'Landscape/permeability must be explicitly verified.'],
      rationale: 'A balanced mixed-use scheme responds to the stated transit-oriented brief while keeping the planning envelope legible and reviewable.',
      tradeOffs: ['More complex phasing and servicing.', 'Partial retention must be resolved before operational continuity can be claimed.'],
      informationStillRequired: missing,
      allowNonCompliantStretch: false,
    },
    {
      id: `${input.opportunityId}-scheme-c`,
      name: 'Scheme C — Boundary Study',
      strategy: 'BOUNDARY',
      thesis: 'Test the supplied FAR, KDB and height envelope near its boundary while exposing headroom and delivery risk.',
      existingAssetDecision: existing ? 'REPLACE' : 'NOT_APPLICABLE',
      existingAssetScope: existing ? `Full replacement study; remove exactly ${existing.gfa.toLocaleString()} m² and retain 0 m².` : 'No existing asset was supplied; create a comprehensive integrated development.',
      existingGfaRetainedM2: 0,
      existingGfaRemovedM2: existingGfa,
      proposedMassRoles: ['Large active podium', 'High-rise office/residential/hotel tower'],
      podiumStoreys: Math.min(6, maxFloorStudy),
      towerStoreys: maxHeight === undefined
        ? maxFloorStudy
        : Math.max(1, Math.floor((maxHeight - Math.min(6, maxFloorStudy) * 4) / 3.5)),
      floorToFloorAssumptions: { podium: 4, tower: 3.5 },
      programGFAByUse: roundedProgram(targetC, sharesC),
      programSharePct: sharesC,
      setbacks: { ...input.planningLimits.setbacks },
      footprintIntent: `Approach the supplied ${maxCoverage}% KDB limit without exceeding it; deterministic geometry will verify the result.`,
      publicRealmIntent: 'Compact but continuous shaded public realm with clear transit arrival and servicing separation.',
      landscapedPermeableKDHIntent: 'Reserve an explicit landscape/permeable allocation before claiming KDH; any shortfall is shown as a warning.',
      accessServicingConcept: 'Concentrate servicing and emergency access in a dedicated edge route.',
      phasingConcept: 'Single major construction phase after demolition, subject to capital and planning-risk confirmation.',
      commercialPremise: 'Accept demolition, higher capital exposure and a longer income gap to test the strongest yield near the supplied envelope.',
      planningResponse: `Push toward—but do not claim permission beyond—the supplied ${maxFAR.toFixed(2)} FAR, ${maxCoverage}% KDB, height and setback inputs.`,
      targetGFA: targetC,
      achievedGFA: 0,
      varianceGFA: -targetC,
      varianceExplanation: 'Pending deterministic massing simulation.',
      ownerPrioritiesAddressed: labels,
      assumptionsIntroduced: ['Replacement and demolition are required.', `FAR is studied toward the supplied ${maxFAR.toFixed(2)}x limit.`, 'Landscape/permeability and servicing capacity require confirmation.'],
      rationale: 'The boundary study clarifies how much of the supplied envelope can be approached and where planning or delivery risk becomes decisive.',
      tradeOffs: ['Highest capital and planning risk.', 'No operational continuity because replacement is explicit.'],
      informationStillRequired: missing,
      allowNonCompliantStretch: input.priorities.allowNonCompliantStretch,
    },
  ];
}

function normalizeProposalCandidates(proposals: unknown): unknown {
  if (!Array.isArray(proposals)) return proposals;
  return proposals.map((candidate) => {
    if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) return candidate;
    const record = candidate as Record<string, unknown>;
    const target = typeof record.targetGFA === 'number' ? record.targetGFA : 0;
    return {
      ...record,
      achievedGFA: 0,
      varianceGFA: -target,
      varianceExplanation: 'Pending deterministic massing simulation.',
    };
  });
}

function programDifference(a: SchemeProposal, b: SchemeProposal): boolean {
  const uses = new Set([...Object.keys(a.programSharePct), ...Object.keys(b.programSharePct)]);
  return [...uses].some((use) => Math.abs((a.programSharePct[use] || 0) - (b.programSharePct[use] || 0)) >= 8);
}

function massingSignature(proposal: SchemeProposal): string {
  return `${proposal.podiumStoreys ?? 0}/${proposal.towerStoreys ?? 0}/${proposal.alternativeStoreys ?? 0}/${proposal.proposedMassRoles.map((role) => role.toLowerCase().replace(/[^a-z]+/g, ' ').trim()).sort().join('|')}`;
}

export function meaningfulProposalDifferences(a: SchemeProposal, b: SchemeProposal): string[] {
  return [
    a.existingAssetDecision !== b.existingAssetDecision ? 'existing-asset treatment' : undefined,
    programDifference(a, b) ? 'program mix' : undefined,
    a.publicRealmIntent.trim().toLowerCase() !== b.publicRealmIntent.trim().toLowerCase() ? 'public realm' : undefined,
    a.accessServicingConcept.trim().toLowerCase() !== b.accessServicingConcept.trim().toLowerCase() ? 'access and servicing' : undefined,
    a.phasingConcept.trim().toLowerCase() !== b.phasingConcept.trim().toLowerCase() ? 'phasing' : undefined,
    massingSignature(a) !== massingSignature(b) ? 'massing arrangement' : undefined,
    a.commercialPremise.trim().toLowerCase() !== b.commercialPremise.trim().toLowerCase() ? 'commercial strategy' : undefined,
  ].filter((item): item is string => Boolean(item));
}

export function validateSchemeProposals(
  proposals: unknown,
  input: SchemeGenerationInput,
  phase: 'DRAFT' | 'RECONCILED' = 'DRAFT',
): { valid: boolean; errors: string[]; proposals: SchemeProposal[]; distinctnessPassed: boolean } {
  const parsed = schemeProposalArraySchema.safeParse(phase === 'DRAFT' ? normalizeProposalCandidates(proposals) : proposals);
  if (!parsed.success) {
    return { valid: false, errors: parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`), proposals: [], distinctnessPassed: false };
  }
  const errors: string[] = [];
  if (new Set(parsed.data.map((proposal) => proposal.name)).size !== 3) errors.push('Three proposals must have distinct names.');
  if (new Set(parsed.data.map((proposal) => proposal.strategy)).size !== 3) errors.push('The three proposals must use conservative, balanced and boundary strategies.');
  parsed.data.forEach((proposal) => {
    const shareTotal = Object.values(proposal.programSharePct).reduce((sum, value) => sum + value, 0);
    if (Math.abs(shareTotal - 100) > 0.5) errors.push(`${proposal.name} program shares must total 100% (received ${shareTotal.toFixed(1)}%).`);
    const programTotal = Object.values(proposal.programGFAByUse).reduce((sum, value) => sum + value, 0);
    const expectedProgramTotal = phase === 'RECONCILED' ? proposal.achievedGFA : proposal.targetGFA;
    if (Math.abs(programTotal - expectedProgramTotal) > 1) errors.push(`${proposal.name} program GFA must sum to ${phase === 'RECONCILED' ? 'deterministically achieved' : 'target'} GFA within 1 m².`);
    if (JSON.stringify(proposal.setbacks) !== JSON.stringify(input.planningLimits.setbacks)) errors.push(`${proposal.name} setbacks must match the supplied planning inputs.`);
    if (!input.existingAsset && ['RETAIN', 'PARTIALLY_RETAIN', 'ADAPT'].includes(proposal.existingAssetDecision)) errors.push(`${proposal.name} cannot retain or adapt an existing asset because none was supplied.`);
    const existingGfa = input.existingAsset?.gfa ?? 0;
    if (Math.abs(proposal.existingGfaRetainedM2 + proposal.existingGfaRemovedM2 - existingGfa) > 0.01) errors.push(`${proposal.name} retained and removed existing GFA must reconcile exactly to the entered ${existingGfa.toLocaleString()} m².`);
    if (['RETAIN', 'ADAPT'].includes(proposal.existingAssetDecision) && (proposal.existingGfaRetainedM2 !== existingGfa || proposal.existingGfaRemovedM2 !== 0)) errors.push(`${proposal.name} must preserve the entered existing asset exactly.`);
    if (proposal.existingAssetDecision === 'PARTIALLY_RETAIN' && !(proposal.existingGfaRetainedM2 > 0 && proposal.existingGfaRemovedM2 > 0)) errors.push(`${proposal.name} partial retention requires positive exact retained and removed GFA.`);
    if (proposal.existingAssetDecision === 'REPLACE' && (proposal.existingGfaRetainedM2 !== 0 || proposal.existingGfaRemovedM2 !== existingGfa)) errors.push(`${proposal.name} replacement must explicitly remove the full entered existing GFA.`);
    if (proposal.existingAssetDecision === 'NOT_APPLICABLE' && (proposal.existingGfaRetainedM2 !== 0 || proposal.existingGfaRemovedM2 !== 0)) errors.push(`${proposal.name} cannot assign existing GFA when no existing asset applies.`);
    const scopeNumbers = proposal.existingAssetScope.replace(/,/g, '');
    if (input.existingAsset && !scopeNumbers.includes(String(proposal.existingGfaRetainedM2))) errors.push(`${proposal.name} narrative must state the exact retained existing GFA.`);
    if (input.existingAsset && !scopeNumbers.includes(String(proposal.existingGfaRemovedM2))) errors.push(`${proposal.name} narrative must state the exact removed existing GFA.`);
    const roleText = `${proposal.name} ${proposal.proposedMassRoles.join(' ')} ${proposal.footprintIntent}`.toLowerCase();
    if (roleText.includes('podium') !== (proposal.podiumStoreys !== undefined)) errors.push(`${proposal.name} podium labels and controls must match the actual podium component.`);
    if (roleText.includes('tower') !== (proposal.towerStoreys !== undefined)) errors.push(`${proposal.name} tower labels and controls must match the actual tower component.`);
    if (!proposal.podiumStoreys && !proposal.towerStoreys && !proposal.alternativeStoreys) errors.push(`${proposal.name} requires a podium, tower, or alternative massing component.`);
    if (proposal.alternativeStoreys && (proposal.podiumStoreys || proposal.towerStoreys)) errors.push(`${proposal.name} alternative massing cannot simultaneously declare podium/tower controls.`);
    if (proposal.targetGFA + 0.01 < proposal.existingGfaRetainedM2) errors.push(`${proposal.name} target GFA cannot be below its retained existing GFA.`);
    const suppliedMaxGfa = input.planningLimits.maxFAR === undefined ? undefined : input.siteAreaM2 * input.planningLimits.maxFAR;
    if (suppliedMaxGfa !== undefined && proposal.targetGFA > suppliedMaxGfa + 1 && !proposal.allowNonCompliantStretch) errors.push(`${proposal.name} target GFA exceeds the supplied FAR study envelope without explicit stretch permission.`);
    if (phase === 'RECONCILED') {
      const expectedVariance = roundGfa(proposal.achievedGFA - proposal.targetGFA);
      if (Math.abs(proposal.varianceGFA - expectedVariance) > 0.01) errors.push(`${proposal.name} variance must equal achieved GFA minus target GFA.`);
      if (proposal.varianceExplanation === 'Pending deterministic massing simulation.') errors.push(`${proposal.name} requires an explanation for the deterministic target variance.`);
    }
  });
  let distinctnessPassed = true;
  for (let left = 0; left < parsed.data.length; left += 1) {
    for (let right = left + 1; right < parsed.data.length; right += 1) {
      const differences = meaningfulProposalDifferences(parsed.data[left] as SchemeProposal, parsed.data[right] as SchemeProposal);
      if (differences.length < 2) {
        distinctnessPassed = false;
        errors.push(`${parsed.data[left].name} and ${parsed.data[right].name} must differ meaningfully in at least two development-strategy areas.`);
      }
    }
  }
  if (!input.priorities.allowNonCompliantStretch && parsed.data.some((proposal) => proposal.allowNonCompliantStretch)) {
    errors.push('A non-compliant stretch proposal requires explicit owner permission.');
  }
  if (input.planningLimits.maxHeightMeters !== undefined) {
    parsed.data.forEach((proposal) => {
      const podiumHeight = (proposal.podiumStoreys ?? 0) * (proposal.floorToFloorAssumptions.podium ?? 4);
      const towerHeight = (proposal.towerStoreys ?? 0) * (proposal.floorToFloorAssumptions.tower ?? 3.5);
      const alternativeHeight = (proposal.alternativeStoreys ?? 0) * (proposal.floorToFloorAssumptions.alternative ?? 3.5);
      if (Math.max(podiumHeight + towerHeight, alternativeHeight) > input.planningLimits.maxHeightMeters! + 0.01
        && !proposal.allowNonCompliantStretch) {
        errors.push(`${proposal.name} proposes a height above the supplied study limit without stretch permission.`);
      }
    });
  }
  return { valid: errors.length === 0, errors, proposals: parsed.data as SchemeProposal[], distinctnessPassed };
}

export function reconcileSchemeProposals(
  proposals: SchemeProposal[],
  simulations: Array<{ proposalId: string; totalGFA: number }>,
): SchemeProposal[] {
  return proposals.map((proposal) => {
    const simulation = simulations.find((candidate) => candidate.proposalId === proposal.id);
    if (!simulation) throw new Error(`No deterministic simulation exists for ${proposal.name}.`);
    const achievedGFA = roundGfa(simulation.totalGFA);
    const varianceGFA = roundGfa(achievedGFA - proposal.targetGFA);
    const varianceExplanation = Math.abs(varianceGFA) <= 1
      ? 'Deterministic massing achieved the target within the documented 1 m² reconciliation tolerance.'
      : `Deterministic massing achieved ${achievedGFA.toLocaleString()} m² against the ${proposal.targetGFA.toLocaleString()} m² target; whole-storey components, supplied height, coverage and setback inputs explain the ${varianceGFA > 0 ? 'positive' : 'negative'} variance.`;
    return {
      ...proposal,
      achievedGFA,
      varianceGFA,
      varianceExplanation,
      programGFAByUse: roundedProgram(achievedGFA, proposal.programSharePct),
    };
  });
}

function modelPrompt(input: SchemeGenerationInput): string {
  const maxGfa = (input.planningLimits.maxFAR ?? 0) * input.siteAreaM2;
  const maxCoverage = input.planningLimits.maxCoveragePct ?? 50;
  const height = input.planningLimits.maxHeightMeters ?? 'not supplied';
  return `Return exactly three concise professional urban-design strategy documents for ${input.name} at ${input.address}. Do not return chain-of-thought and do not claim calculated, statutory, approved or authoritative figures. Use these confirmed user priorities: ${JSON.stringify(input.priorities)}. Site: ${input.siteAreaM2} m², ${input.frontageMeters} m frontage, ${input.depthMeters} m depth. Existing asset: ${JSON.stringify(input.existingAsset || null)}. Planning inputs: ${JSON.stringify(input.planningLimits)}. Supplied study envelope: maximum GFA ${maxGfa.toFixed(1)} m², maximum footprint ${maxCoverage}%, height input ${height}, and setbacks ${JSON.stringify(input.planningLimits.setbacks)}. Explore CONSERVATIVE retention/continuity, BALANCED phased development, and BOUNDARY comprehensive higher-yield lenses, adapted to the actual brief rather than fixed narratives. For each, state exact existing GFA retained and removed; these must sum to the entered existing asset and retention/adaptation must keep it exactly. Include targetGFA as a recommendation only, program GFA summing to that target, program shares totaling 100%, the exact supplied setbacks, massing intent, public realm/street interface, pedestrian/vehicle/loading/servicing, phasing and operational continuity, commercial premise, response to supplied limits, major trade-offs, assumptions and information still required. Options must differ meaningfully in at least two strategy areas. SitePilot will ignore any attempted achieved result and independently calculate geometry, achieved GFA, variance and planning checks.`;
}

function parseProposalResponse(text: string | undefined): unknown {
  try {
    return JSON.parse(text || '[]');
  } catch {
    return [];
  }
}

export async function generateSchemeProposals(
  input: SchemeGenerationInput,
  options: { onRepairAttempt?: () => void | Promise<void> } = {},
): Promise<SchemeGenerationResult> {
  const config = getAiConfig();
  const generatedAt = new Date().toISOString();
  if (config.provider === 'LOCAL_DEVELOPMENT') {
    const proposals = createStudyTemplateProposals(input);
    return {
      provider: config.provider,
      model: 'Template schemes used',
      modelCalled: false,
      disclosure: 'Template schemes used. No model request was made; SitePilot calculated and validated all planning figures deterministically.',
      generatedAt,
      opportunityId: input.opportunityId,
      sourceStudyVersion: input.studyVersion,
      inputHash: input.inputHash,
      userPriorities: input.priorities,
      assumptions: proposals.flatMap((proposal) => proposal.assumptionsIntroduced),
      proposals,
      validation: { valid: true, errors: [] },
      qualityGate: { distinctnessPassed: true, repairAttempted: false, repairSucceeded: false },
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
          id: { type: 'STRING' }, name: { type: 'STRING' }, strategy: { type: 'STRING', enum: ['CONSERVATIVE', 'BALANCED', 'BOUNDARY'] }, thesis: { type: 'STRING' },
          existingAssetDecision: { type: 'STRING', enum: ['RETAIN', 'PARTIALLY_RETAIN', 'ADAPT', 'REPLACE', 'NOT_APPLICABLE'] },
          existingAssetScope: { type: 'STRING' }, existingGfaRetainedM2: { type: 'NUMBER' }, existingGfaRemovedM2: { type: 'NUMBER' }, proposedMassRoles: { type: 'ARRAY', items: { type: 'STRING' } },
          podiumStoreys: { type: 'INTEGER' }, towerStoreys: { type: 'INTEGER' }, alternativeStoreys: { type: 'INTEGER' },
          floorToFloorAssumptions: { type: 'OBJECT', properties: { podium: { type: 'NUMBER' }, tower: { type: 'NUMBER' }, alternative: { type: 'NUMBER' } } },
          programGFAByUse: { type: 'OBJECT' }, programSharePct: { type: 'OBJECT' }, setbacks: { type: 'OBJECT', properties: { front: { type: 'NUMBER' }, rear: { type: 'NUMBER' }, sideLeft: { type: 'NUMBER' }, sideRight: { type: 'NUMBER' } } }, footprintIntent: { type: 'STRING' }, publicRealmIntent: { type: 'STRING' },
          landscapedPermeableKDHIntent: { type: 'STRING' }, accessServicingConcept: { type: 'STRING' }, phasingConcept: { type: 'STRING' },
          commercialPremise: { type: 'STRING' }, planningResponse: { type: 'STRING' }, targetGFA: { type: 'NUMBER' },
          ownerPrioritiesAddressed: { type: 'ARRAY', items: { type: 'STRING' } }, assumptionsIntroduced: { type: 'ARRAY', items: { type: 'STRING' } },
          rationale: { type: 'STRING' }, tradeOffs: { type: 'ARRAY', items: { type: 'STRING' } }, informationStillRequired: { type: 'ARRAY', items: { type: 'STRING' } }, allowNonCompliantStretch: { type: 'BOOLEAN' },
        },
        required: ['id', 'name', 'strategy', 'thesis', 'existingAssetDecision', 'existingAssetScope', 'existingGfaRetainedM2', 'existingGfaRemovedM2', 'proposedMassRoles', 'floorToFloorAssumptions', 'programGFAByUse', 'programSharePct', 'setbacks', 'footprintIntent', 'publicRealmIntent', 'landscapedPermeableKDHIntent', 'accessServicingConcept', 'phasingConcept', 'commercialPremise', 'planningResponse', 'targetGFA', 'ownerPrioritiesAddressed', 'assumptionsIntroduced', 'rationale', 'tradeOffs', 'informationStillRequired', 'allowNonCompliantStretch'],
      },
    };
    const requestConfig = {
      responseMimeType: 'application/json',
      ...(Number.isFinite(maxOutputTokens) && maxOutputTokens > 0 ? { maxOutputTokens } : {}),
      responseSchema,
    };
    let repairAttempted = false;
    let response = await ai.models.generateContent({ model, contents: modelPrompt(input), config: requestConfig });
    let validation = validateSchemeProposals(parseProposalResponse(response.text), input);
    if (!validation.valid && process.env.TASKMASTER_ALLOW_MODEL_REPAIR === 'true') {
      repairAttempted = true;
      await options.onRepairAttempt?.();
      response = await ai.models.generateContent({
        model,
        contents: `Repair this invalid SitePilot proposal set once. Return only a schema-valid JSON array of exactly three materially different proposals. Do not add calculated planning totals. Validation errors: ${validation.errors.join('; ')}. Candidate: ${response.text || '[]'}`,
        config: requestConfig,
      });
      validation = validateSchemeProposals(parseProposalResponse(response.text), input);
    }
    if (!validation.valid) throw new Error(validation.errors.join(' '));
    return {
      provider: provider as SchemeGenerationResult['provider'], model, modelCalled: true,
      disclosure: `${provider} generated structured proposals with ${model}. SitePilot independently checks geometry and planning limits.`,
      generatedAt, opportunityId: input.opportunityId, sourceStudyVersion: input.studyVersion, inputHash: input.inputHash,
      userPriorities: input.priorities, assumptions: validation.proposals.flatMap((proposal) => proposal.assumptionsIntroduced), proposals: validation.proposals, validation: { valid: true, errors: [] },
      qualityGate: { distinctnessPassed: validation.distinctnessPassed, repairAttempted, repairSucceeded: repairAttempted },
    };
  } catch (error) {
    if (process.env.TASKMASTER_ALLOW_LIVE_MODEL === 'true') throw error;
    const fallback = createStudyTemplateProposals(input);
    return {
      provider: 'LOCAL_DEVELOPMENT', model: 'Template schemes used', modelCalled: false,
      disclosure: 'Template schemes used after the live proposal path could not complete. No live result was accepted or presented as model-generated.',
      generatedAt, opportunityId: input.opportunityId, sourceStudyVersion: input.studyVersion, inputHash: input.inputHash,
      userPriorities: input.priorities, assumptions: fallback.flatMap((proposal) => proposal.assumptionsIntroduced), proposals: fallback,
      validation: { valid: true, errors: ['Model response was replaced by a bounded deterministic fallback.'] },
      qualityGate: { distinctnessPassed: true, repairAttempted: false, repairSucceeded: false },
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
    landscapedPermeablePct: project.site.landscapedPermeableAreaM2 !== undefined && project.site.grossSiteArea > 0
      ? (project.site.landscapedPermeableAreaM2 / project.site.grossSiteArea) * 100
      : undefined,
    existingAsset: project.existingAsset,
    planningLimits: { ...project.zoningLimits!, setbacks: project.site.setbacks },
    studyVersion: sourceStudyVersion,
    priorities,
  };
  return { ...withoutHash, inputHash: buildSchemeInputHash(withoutHash) };
}

export function confirmSchemeGenerationInput(
  project: Project,
  priorities: SchemePriorities,
  confirmedAt = new Date().toISOString(),
): { input: SchemeGenerationInput; snapshot: ConfirmedSchemeInputSnapshot } {
  const input = proposalGenerationInputFromProject(project, priorities);
  return {
    input,
    snapshot: {
      ...structuredClone(input),
      confirmedAt,
      priorities: { ...input.priorities },
    },
  };
}

export function isConfirmedSchemeInputCurrent(
  project: Project,
  snapshot: ConfirmedSchemeInputSnapshot | undefined = project.confirmedSchemeInput,
): boolean {
  if (!snapshot) return false;
  const current = proposalGenerationInputFromProject(project, snapshot.priorities as SchemePriorities);
  const { inputHash: _currentHash, ...hashable } = current;
  void _currentHash;
  return buildSchemeInputHash({ ...hashable, studyVersion: snapshot.studyVersion }) === snapshot.inputHash;
}
