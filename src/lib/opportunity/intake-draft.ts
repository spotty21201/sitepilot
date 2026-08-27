import type { SchemePriorities } from '@/lib/schemes/proposal-contract';

export const OPPORTUNITY_INTAKE_DRAFT_KEY = 'sitepilot_opportunity_intake_draft_v2';

export type IntakeValueSource = 'DEFAULT' | 'USER_PROVIDED' | 'USER_CLEARED' | 'MISSING';

export const intakeFieldNames = [
  'name', 'address', 'city', 'country', 'objective', 'grossSiteArea', 'frontageLength', 'lotDepth', 'manualStreetName',
  'existingBuildingGFA', 'existingFloors', 'existingAssetDescription', 'existingAssetStatus',
  'zoneCode', 'zoneName', 'statutoryMaxFAR', 'statutoryMaxCoveragePct', 'statutoryMinKDHPct',
  'landscapedPermeableAreaM2', 'statutoryMaxHeightMeters', 'setbackFront', 'setbackRear', 'setbackSide',
  'askingPriceAmount', 'askingPriceCurrency', 'njopAmount', 'valuationBasisNotes',
] as const;

export type IntakeFieldName = typeof intakeFieldNames[number];

export interface OpportunityIntakeDraftValues {
  name: string;
  address: string;
  city: string;
  country: string;
  objective: string;
  grossSiteArea: string;
  frontageLength: string;
  lotDepth: string;
  manualStreetName: string;
  existingBuildingGFA: string;
  existingFloors: string;
  existingAssetDescription: string;
  existingAssetStatus: string;
  zoneCode: string;
  zoneName: string;
  statutoryMaxFAR: string;
  statutoryMaxCoveragePct: string;
  statutoryMinKDHPct: string;
  landscapedPermeableAreaM2: string;
  statutoryMaxHeightMeters: string;
  setbackFront: string;
  setbackRear: string;
  setbackSide: string;
  askingPriceAmount: string;
  askingPriceCurrency: string;
  njopAmount: string;
  valuationBasisNotes: string;
}

export interface OpportunityIntakeDraft {
  schemaVersion: 2;
  values: OpportunityIntakeDraftValues;
  sources: Record<IntakeFieldName, IntakeValueSource>;
  priorities: SchemePriorities;
  prioritiesSource: IntakeValueSource;
  additionalStrategyInstructions: string;
  additionalStrategyInstructionsSource: IntakeValueSource;
}

const defaultValues: OpportunityIntakeDraftValues = {
  name: '',
  address: '',
  city: 'Jakarta',
  country: 'Indonesia',
  objective: '',
  grossSiteArea: '',
  frontageLength: '',
  lotDepth: '',
  manualStreetName: '',
  existingBuildingGFA: '',
  existingFloors: '',
  existingAssetDescription: '',
  existingAssetStatus: 'Operational',
  zoneCode: 'KT + K-1',
  zoneName: 'Commercial / Hospitality',
  statutoryMaxFAR: '6.65',
  statutoryMaxCoveragePct: '55',
  statutoryMinKDHPct: '20',
  landscapedPermeableAreaM2: '',
  statutoryMaxHeightMeters: '',
  setbackFront: '',
  setbackRear: '',
  setbackSide: '',
  askingPriceAmount: '',
  askingPriceCurrency: 'IDR',
  njopAmount: '',
  valuationBasisNotes: '',
};

const defaultPriorities: SchemePriorities = {
  existingBuildingRetention: 'adapt',
  developmentYield: 'balanced',
  publicRealm: 'strong',
  programMix: 'Active retail podium, offices, residences, hotel, shaded public realm and transit-oriented development',
  phasing: 'phased',
  planningRiskTolerance: 'medium',
  investmentHorizon: 'medium',
  allowNonCompliantStretch: false,
};

function initialSource(field: IntakeFieldName): IntakeValueSource {
  return defaultValues[field].trim() ? 'DEFAULT' : 'MISSING';
}

export function createOpportunityIntakeDraft(): OpportunityIntakeDraft {
  return {
    schemaVersion: 2,
    values: { ...defaultValues },
    sources: Object.fromEntries(intakeFieldNames.map((field) => [field, initialSource(field)])) as Record<IntakeFieldName, IntakeValueSource>,
    priorities: { ...defaultPriorities },
    prioritiesSource: 'DEFAULT',
    additionalStrategyInstructions: '',
    additionalStrategyInstructionsSource: 'MISSING',
  };
}

export function updateIntakeDraftField(
  draft: OpportunityIntakeDraft,
  field: IntakeFieldName,
  value: string,
): OpportunityIntakeDraft {
  return {
    ...draft,
    values: { ...draft.values, [field]: value },
    sources: { ...draft.sources, [field]: value.trim() ? 'USER_PROVIDED' : 'USER_CLEARED' },
  };
}

export function updateIntakeDraftPriorities(
  draft: OpportunityIntakeDraft,
  priorities: SchemePriorities,
): OpportunityIntakeDraft {
  return { ...draft, priorities: { ...priorities }, prioritiesSource: 'USER_PROVIDED' };
}

export function updateAdditionalStrategyInstructions(
  draft: OpportunityIntakeDraft,
  value: string,
): OpportunityIntakeDraft {
  return {
    ...draft,
    additionalStrategyInstructions: value,
    additionalStrategyInstructionsSource: value.trim() ? 'USER_PROVIDED' : 'USER_CLEARED',
  };
}

export function parseDraftNumber(value: string): number | undefined {
  if (!value.trim()) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function intakeSourceLabel(source: IntakeValueSource): string {
  if (source === 'USER_PROVIDED') return 'User provided';
  if (source === 'DEFAULT') return 'Default study assumption';
  if (source === 'USER_CLEARED') return 'Cleared by user';
  return 'Not provided';
}

function isDraftShape(value: unknown): value is OpportunityIntakeDraft {
  if (!value || typeof value !== 'object') return false;
  const draft = value as Partial<OpportunityIntakeDraft>;
  if (draft.schemaVersion !== 2 || !draft.values || !draft.sources || !draft.priorities) return false;
  return intakeFieldNames.every((field) => typeof draft.values?.[field] === 'string'
    && ['DEFAULT', 'USER_PROVIDED', 'USER_CLEARED', 'MISSING'].includes(String(draft.sources?.[field])));
}

export function loadOpportunityIntakeDraft(storage: Pick<Storage, 'getItem'> | undefined): OpportunityIntakeDraft {
  if (!storage) return createOpportunityIntakeDraft();
  try {
    const raw = storage.getItem(OPPORTUNITY_INTAKE_DRAFT_KEY);
    if (!raw) return createOpportunityIntakeDraft();
    const parsed: unknown = JSON.parse(raw);
    if (!isDraftShape(parsed)) return createOpportunityIntakeDraft();
    return {
      ...parsed,
      additionalStrategyInstructions: typeof parsed.additionalStrategyInstructions === 'string' ? parsed.additionalStrategyInstructions : '',
      additionalStrategyInstructionsSource: parsed.additionalStrategyInstructionsSource ?? 'MISSING',
    };
  } catch {
    return createOpportunityIntakeDraft();
  }
}

export function persistOpportunityIntakeDraft(
  storage: Pick<Storage, 'setItem'> | undefined,
  draft: OpportunityIntakeDraft,
): void {
  if (!storage) return;
  storage.setItem(OPPORTUNITY_INTAKE_DRAFT_KEY, JSON.stringify(draft));
}

export function clearOpportunityIntakeDraft(storage: Pick<Storage, 'removeItem'> | undefined): void {
  storage?.removeItem(OPPORTUNITY_INTAKE_DRAFT_KEY);
}

export interface IntakeReviewResult {
  criticalErrors: string[];
  clarifyingQuestions: string[];
  assumptions: string[];
}

export function reviewOpportunityIntakeDraft(draft: OpportunityIntakeDraft): IntakeReviewResult {
  const values = draft.values;
  const siteArea = parseDraftNumber(values.grossSiteArea);
  const frontage = parseDraftNumber(values.frontageLength);
  const depth = parseDraftNumber(values.lotDepth);
  const far = parseDraftNumber(values.statutoryMaxFAR);
  const coverage = parseDraftNumber(values.statutoryMaxCoveragePct);
  const kdh = parseDraftNumber(values.statutoryMinKDHPct);
  const height = parseDraftNumber(values.statutoryMaxHeightMeters);
  const existingGfa = parseDraftNumber(values.existingBuildingGFA);
  const existingFloors = parseDraftNumber(values.existingFloors);
  const landscaped = parseDraftNumber(values.landscapedPermeableAreaM2);
  const criticalErrors: string[] = [];
  const clarifyingQuestions: string[] = [];
  const assumptions: string[] = [];

  if (!values.name.trim()) criticalErrors.push('Opportunity name is required.');
  if (!values.address.trim()) criticalErrors.push('Site address is required.');
  if ((siteArea ?? 0) <= 0 && !((frontage ?? 0) > 0 && (depth ?? 0) > 0)) {
    criticalErrors.push('Provide a positive site area, or positive frontage and depth.');
  }
  if (far !== undefined && far <= 0) criticalErrors.push('FAR/KLB must be greater than zero to generate development studies.');
  if (coverage !== undefined && (coverage <= 0 || coverage > 100)) criticalErrors.push('KDB must be greater than zero and no more than 100%.');
  if (kdh !== undefined && (kdh < 0 || kdh > 100)) criticalErrors.push('KDH must be between 0% and 100%.');
  if (height !== undefined && height <= 0) criticalErrors.push('Maximum height must be greater than zero when supplied.');
  if (existingGfa !== undefined && existingGfa < 0) criticalErrors.push('Existing GFA cannot be negative.');
  if (existingFloors !== undefined && (!Number.isInteger(existingFloors) || existingFloors <= 0)) criticalErrors.push('Existing storeys must be a positive whole number.');
  if (landscaped !== undefined && (landscaped < 0 || (siteArea !== undefined && landscaped > siteArea))) {
    criticalErrors.push('Landscaped/permeable area cannot be negative or exceed the site area.');
  }

  if ((existingGfa ?? 0) > 0 && existingFloors === undefined) clarifyingQuestions.push('How many storeys does the existing asset have? Geometry will otherwise remain provisional.');
  if (kdh !== undefined && landscaped === undefined) clarifyingQuestions.push('What measured landscaped/permeable area supports the supplied KDH value?');
  if (height === undefined) clarifyingQuestions.push('Is a maximum building height available?');
  if (!values.objective.trim()) clarifyingQuestions.push('What development and investment outcome should the three studies prioritize?');

  if (draft.sources.statutoryMaxFAR === 'DEFAULT') assumptions.push('FAR/KLB uses the default study assumption until the user confirms or changes it.');
  if (draft.sources.statutoryMaxCoveragePct === 'DEFAULT') assumptions.push('KDB uses the default study assumption until the user confirms or changes it.');
  if (draft.sources.statutoryMinKDHPct === 'DEFAULT') assumptions.push('KDH requirement uses the default study assumption and is not demonstrated without a measured landscaped/permeable area.');
  assumptions.push('Planning and commercial figures supplied through intake remain unverified until supporting evidence is added.');

  return { criticalErrors, clarifyingQuestions, assumptions };
}
