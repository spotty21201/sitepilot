/**
 * SitePilot Case Repository & Persistence Layer
 * Provides durable client-side case management, schema versioning, and template isolation.
 * Standard: Invariants 1, 2, 3, 4, and 8.
 */

import { Project, CaseSummary, DevelopmentScenario, BuildingMass, AreaProvenanceType, Finding } from '@/types';
import { GOLDEN_PROJECT } from '@/lib/mock-data/golden-project';
import { 
  calculateDevelopmentMetrics, 
  calculateMassPairwiseIntersections, 
  evaluateScenarioCompliance,
  calculateBuildableArea,
  getCanonicalParcelBounds,
  fitMassesToBuildableEnvelope
} from '@/lib/geometry/engine';
import { ensureCanonicalProjectRevisions } from '@/lib/spatial/canonical-command-service';
import {
  deriveScenarioFloorLimit,
  deriveStreetName,
  resolveRectangularParcel,
} from '@/lib/opportunity/canonical-opportunity';
import type { IntakeValueSource } from '@/lib/opportunity/intake-draft';

const STORAGE_VERSION = 'v1';
const CASES_STORAGE_KEY = `sitepilot_cases_${STORAGE_VERSION}`;
const ACTIVE_CASE_KEY = `sitepilot_active_case_id_${STORAGE_VERSION}`;

export interface CreateCaseParams {
  name: string;
  address: string;
  city?: string;
  country?: string;
  objective?: string;
  grossSiteArea?: number;
  frontageLength?: number;
  lotDepth?: number;
  streetName?: string;

  // Existing asset facts
  existingBuildingGFA?: number;   // e.g. 3,760 m²
  existingGFA?: number;
  existingFloors?: number;        // e.g. 4 floors
  existingAssetDescription?: string; // e.g. "Operational Sharia Boutique Hotel"
  existingAssetStatus?: string;   // e.g. "Operational"

  // Planning & Zoning Parameters
  zoneCode?: string;              // e.g. "K.1"
  zoneName?: string;              // e.g. "Perkantoran, Perdagangan dan Jasa"
  statutoryMaxFAR?: number;       // e.g. 6.65
  maxFAR?: number;
  statutoryMaxCoveragePct?: number; // e.g. 55.0%
  maxCoveragePct?: number;
  statutoryMinKDHPct?: number;    // e.g. 20.0%
  minKDHPct?: number;
  landscapedPermeableAreaM2?: number;
  statutoryMaxKTBPct?: number;    // e.g. 55.0%
  statutoryMaxHeightMeters?: number; // e.g. 32.0m or 48.0m
  maxHeightMeters?: number;
  statutoryMaxFloors?: number;    // e.g. 8 or 14 floors
  maxFloors?: number;
  setbackFront?: number;
  setbackRear?: number;
  setbackSideLeft?: number;
  setbackSideRight?: number;
  setbacks?: { front: number; rear: number; sideLeft: number; sideRight: number };

  // Valuation & Commercial
  askingPriceAmount?: number;     // e.g. 125300000000 (Rp 125.3B)
  askingPriceCurrency?: string;   // e.g. "IDR"
  njopAmount?: number;            // e.g. 95000000000 (Rp 95B)
  valuationBasisNotes?: string;

  // Provenance
  provenanceType?: AreaProvenanceType;
  hasZoningEvidence?: boolean;
  intakeValueSources?: Record<string, IntakeValueSource>;
}

function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function hasUniqueStringIds(values: unknown[]): boolean {
  const ids = values.map((value) => isRecord(value) ? value.id : undefined);
  return ids.every((id): id is string => typeof id === 'string' && id.length > 0)
    && new Set(ids).size === ids.length;
}

function isSetbacksSpine(value: unknown): boolean {
  if (!isRecord(value)) return false;
  return ['front', 'rear', 'sideLeft', 'sideRight'].every((key) => isFiniteNumber(value[key]));
}

function isMassSpine(value: unknown): boolean {
  if (!isRecord(value)) return false;
  const position = value.position;
  const dimensions = value.dimensions;
  if (!isRecord(position) || !isRecord(dimensions)) return false;
  return typeof value.id === 'string'
    && value.id.length > 0
    && typeof value.name === 'string'
    && typeof value.type === 'string'
    && typeof value.program === 'string'
    && ['footprintArea', 'floors', 'floorToFloorHeight', 'height', 'gfa'].every((key) => isFiniteNumber(value[key]))
    && ['x', 'y', 'z'].every((key) => isFiniteNumber(position[key]))
    && ['width', 'length', 'height'].every((key) => isFiniteNumber(dimensions[key]));
}

function isMetricsSpine(value: unknown): boolean {
  if (!isRecord(value)) return false;
  return [
    'grossSiteArea',
    'netBuildableArea',
    'buildingFootprintArea',
    'siteCoveragePercentage',
    'totalGFA',
    'farKLB',
    'openSpaceArea',
    'openSpacePercentage',
    'totalFloors',
    'totalHeightMeters',
  ].every((key) => isFiniteNumber(value[key]));
}

function isScenarioSpine(value: unknown, projectId: string): boolean {
  if (!isRecord(value) || !Array.isArray(value.masses) || value.masses.length === 0) return false;
  if (!hasUniqueStringIds(value.masses) || !value.masses.every(isMassSpine)) return false;
  const assumptionsUsed = value.assumptionsUsed;
  if (!isRecord(assumptionsUsed) || !isSetbacksSpine(assumptionsUsed.setbacks)) return false;
  if (!['heightFloors', 'heightMeters', 'targetFAR', 'targetCoverageKDB', 'unverifiedAssumptionsCount']
    .every((key) => isFiniteNumber(assumptionsUsed[key]))) return false;
  return typeof value.id === 'string'
    && value.id.length > 0
    && value.projectId === projectId
    && typeof value.name === 'string'
    && typeof value.description === 'string'
    && isMetricsSpine(value.metrics)
    && Array.isArray(value.risks)
    && Array.isArray(value.opportunities)
    && typeof value.createdAt === 'string'
    && typeof value.updatedAt === 'string';
}

function isProjectSpine(value: unknown): value is Project {
  if (!isRecord(value) || typeof value.id !== 'string' || value.id.length === 0) return false;
  const projectId = value.id;
  if (!isRecord(value.location) || !isRecord(value.location.center)) return false;
  if (!isRecord(value.site) || !isRecord(value.site.boundary)) return false;
  if (!Array.isArray(value.scenarios) || value.scenarios.length === 0 || !hasUniqueStringIds(value.scenarios)) return false;
  const aggregateArrays = ['sources', 'findings', 'contradictions', 'assumptions', 'issues', 'actions'];
  if (!aggregateArrays.every((key) => Array.isArray(value[key]))) return false;
  if (!isRecord(value.executiveSummary)) return false;
  return typeof value.name === 'string'
    && typeof value.objective === 'string'
    && typeof value.location.address === 'string'
    && typeof value.location.city === 'string'
    && typeof value.location.country === 'string'
    && isFiniteNumber(value.location.center.lat)
    && isFiniteNumber(value.location.center.lng)
    && isFiniteNumber(value.site.grossSiteArea)
    && isFiniteNumber(value.site.buildableArea)
    && isSetbacksSpine(value.site.setbacks)
    && Array.isArray(value.site.boundary.coordinates)
    && typeof value.site.coordinateSystem === 'string'
    && value.scenarios.every((scenario) => isScenarioSpine(scenario, projectId))
    && Array.isArray(value.executiveSummary.topOpportunities)
    && Array.isArray(value.executiveSummary.criticalRisks)
    && Array.isArray(value.executiveSummary.criticalUnknowns)
    && typeof value.executiveSummary.recommendedNextMove === 'string'
    && typeof value.createdAt === 'string'
    && typeof value.updatedAt === 'string';
}

function getStoredCasesRecord(): Record<string, unknown> | null {
  if (!isBrowser()) return {};
  try {
    const raw = localStorage.getItem(CASES_STORAGE_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      console.warn('[SitePilot Case Repository] Stored case root is malformed and will not be overwritten.');
      return null;
    }
    return parsed as Record<string, unknown>;
  } catch (e) {
    console.warn('[SitePilot Case Repository] Failed to load stored cases:', e);
    return null;
  }
}

function getStoredCasesMap(): Record<string, Project> {
  const record = getStoredCasesRecord();
  if (!record) return {};
  return Object.fromEntries(
    Object.entries(record).filter((entry): entry is [string, Project] => (
      isProjectSpine(entry[1]) && entry[0] === entry[1].id
    ))
  );
}

function saveStoredCasesRecord(cases: Record<string, unknown>): boolean {
  if (!isBrowser()) return false;
  try {
    localStorage.setItem(CASES_STORAGE_KEY, JSON.stringify(cases));
    return true;
  } catch (e) {
    console.error('[SitePilot Case Repository] Failed to persist cases:', e);
    return false;
  }
}

export function listCases(): CaseSummary[] {
  const stored = getStoredCasesMap();
  const list: CaseSummary[] = [];

  // Always include Golden Project Demo template first
  const demoProject = stored[GOLDEN_PROJECT.id] || GOLDEN_PROJECT;
  list.push({
    id: demoProject.id,
    name: demoProject.name,
    address: demoProject.location.address,
    grossSiteArea: demoProject.site.grossSiteArea,
    isTemplate: true,
    createdAt: demoProject.createdAt,
    updatedAt: demoProject.updatedAt
  });

  // Append user-created cases
  Object.values(stored).forEach((proj) => {
    if (proj.id !== GOLDEN_PROJECT.id) {
      list.push({
        id: proj.id,
        name: proj.name,
        address: proj.location.address,
        grossSiteArea: proj.site.grossSiteArea,
        isTemplate: Boolean(proj.isTemplate),
        createdAt: proj.createdAt,
        updatedAt: proj.updatedAt
      });
    }
  });

  return list;
}

export function getActiveCaseId(): string {
  if (!isBrowser()) return GOLDEN_PROJECT.id;
  try {
    const activeId = localStorage.getItem(ACTIVE_CASE_KEY);
    if (!activeId || activeId === GOLDEN_PROJECT.id) return GOLDEN_PROJECT.id;
    return getStoredCasesMap()[activeId] ? activeId : GOLDEN_PROJECT.id;
  } catch {
    return GOLDEN_PROJECT.id;
  }
}

export function setActiveCaseId(caseId: string): void {
  if (!isBrowser()) return;
  try {
    localStorage.setItem(ACTIVE_CASE_KEY, caseId);
  } catch (e) {
    console.warn('[SitePilot Case Repository] Failed to set active case ID:', e);
  }
}

export function getCase(id: string): Project {
  if (id === GOLDEN_PROJECT.id) {
    const stored = getStoredCasesMap();
    return ensureCanonicalProjectRevisions(stored[id] || GOLDEN_PROJECT);
  }

  const stored = getStoredCasesMap();
  if (stored[id]) {
    return ensureCanonicalProjectRevisions(stored[id]);
  }

  return ensureCanonicalProjectRevisions(GOLDEN_PROJECT);
}

export function saveCase(project: Project): boolean {
  const stored = getStoredCasesRecord();
  if (!stored) return false;
  const normalized = ensureCanonicalProjectRevisions(project);
  stored[project.id] = normalized;
  return saveStoredCasesRecord(stored);
}

export function deleteCase(id: string): void {
  if (id === GOLDEN_PROJECT.id) return;
  const stored = getStoredCasesRecord();
  if (!stored) return;
  delete stored[id];
  saveStoredCasesRecord(stored);

  if (getActiveCaseId() === id) {
    setActiveCaseId(GOLDEN_PROJECT.id);
  }
}

export function resetDemo(): Project {
  if (isBrowser()) {
    const stored = getStoredCasesRecord();
    if (stored) {
      stored[GOLDEN_PROJECT.id] = ensureCanonicalProjectRevisions(GOLDEN_PROJECT);
      saveStoredCasesRecord(stored);
    }
  }
  return ensureCanonicalProjectRevisions(GOLDEN_PROJECT);
}

export const resetDemoCase = resetDemo;

/**
 * Creates a clean, trustworthy initial case with explicit USER_ENTERED_ASSUMPTION provenance.
 */
export function createCase(params: CreateCaseParams): Project {
  const caseId = `proj-${Date.now()}`;
  const now = new Date().toISOString();
  const suppliedArea = params.grossSiteArea !== undefined && params.grossSiteArea > 0 ? params.grossSiteArea : 10000;
  const inferredFrontage = Math.max(20, Math.round(Math.sqrt(suppliedArea * 0.75) * 10) / 10);
  const parcelResolution = resolveRectangularParcel({
    frontageMeters: params.frontageLength ?? inferredFrontage,
    depthMeters: params.lotDepth,
    siteAreaM2: suppliedArea,
    frontageSource: params.frontageLength !== undefined ? 'USER_ENTERED' : 'LEGACY_INFERRED',
    depthSource: params.lotDepth !== undefined ? 'USER_ENTERED' : 'ESTIMATED',
    areaSource: params.grossSiteArea !== undefined ? 'USER_ENTERED' : 'LEGACY_INFERRED',
  });
  if (!parcelResolution.valid) throw new Error(parcelResolution.errors.join(' '));
  const grossSiteArea = parcelResolution.siteAreaM2;
  const standardFrontage = parcelResolution.frontageMeters;
  const lotDepth = parcelResolution.depthMeters;
  const street = deriveStreetName(params.address, params.streetName);

  const defaultSetbacks = {
    front: params.setbacks?.front ?? params.setbackFront ?? 8,
    rear: params.setbacks?.rear ?? params.setbackRear ?? 5,
    sideLeft: params.setbacks?.sideLeft ?? params.setbackSideLeft ?? 4,
    sideRight: params.setbacks?.sideRight ?? params.setbackSideRight ?? 4
  };

  const bounds = getCanonicalParcelBounds(grossSiteArea, defaultSetbacks, standardFrontage);
  const netBuildableArea = calculateBuildableArea(grossSiteArea, defaultSetbacks, standardFrontage);
  const centerZ = (bounds.buildableMinY + bounds.buildableMaxY) / 2;

  // Planning & Zoning Limits
  const suppliedMaxFAR = params.maxFAR ?? params.statutoryMaxFAR;
  const suppliedMaxCoveragePct = params.maxCoveragePct ?? params.statutoryMaxCoveragePct;
  const suppliedMinKDHPct = params.minKDHPct ?? params.statutoryMinKDHPct;
  const suppliedMaxHeightMeters = params.maxHeightMeters ?? params.statutoryMaxHeightMeters;
  const maxFAR = suppliedMaxFAR ?? 3.20;
  const maxCoveragePct = suppliedMaxCoveragePct ?? 55.0;
  const minKDHPct = suppliedMinKDHPct ?? 20.0;
  const floorStudy = deriveScenarioFloorLimit({
    maximumHeightMeters: suppliedMaxHeightMeters,
    maximumFAR: suppliedMaxFAR,
    maximumCoveragePct: suppliedMaxCoveragePct,
    floorToFloorHeight: 3.5,
  });
  const maxFloors = params.maxFloors ?? params.statutoryMaxFloors ?? floorStudy.floorCount ?? 8;
  const maxHeightMeters = suppliedMaxHeightMeters;
  const maxGFA = Math.round(grossSiteArea * maxFAR);
  const verifiedPlanningBasis = Boolean(params.hasZoningEvidence && suppliedMaxFAR);
  const densityBasisLabel = verifiedPlanningBasis ? 'verified planning limit' : 'working planning-study assumption';
  const rawExistingGFA = params.existingGFA ?? params.existingBuildingGFA;
  const existingGFA = rawExistingGFA !== undefined && rawExistingGFA > 0 ? Math.round(rawExistingGFA) : undefined;
  const isFloorsAssumed = params.existingFloors === undefined;
  const existingFloors = params.existingFloors ?? 4;
  const expansionHeadroomGFA = existingGFA ? Math.max(0, maxGFA - existingGFA) : undefined;

  // Sizing baseline dimensions
  const podiumWidth = Math.max(12, Math.round(bounds.buildableWidth * 0.75 * 10) / 10);
  const podiumLength = Math.max(12, Math.round(bounds.buildableLength * 0.65 * 10) / 10);
  const podiumFootprint = Math.round(podiumWidth * podiumLength);

  const towerWidth = Math.max(10, Math.round(podiumWidth * 0.6 * 10) / 10);
  const towerLength = Math.max(10, Math.round(podiumLength * 0.6 * 10) / 10);
  const towerFootprint = Math.round(towerWidth * towerLength);

  // ----------------------------------------------------
  // SCENARIO A: Existing Asset Baseline / Low-Rise Concept
  // ----------------------------------------------------
  const targetFootprintA = existingGFA ? Math.round(existingGFA / existingFloors) : podiumFootprint;
  const massAWidth = Math.min(bounds.buildableWidth * 0.90, Math.max(12, Math.round(Math.sqrt(targetFootprintA * 0.85) * 10) / 10));
  const massALength = Math.min(bounds.buildableLength * 0.90, Math.max(12, Math.round((targetFootprintA / massAWidth) * 10) / 10));

  const massesA: BuildingMass[] = existingGFA ? [
    {
      id: `mass-${caseId}-a1`,
      name: params.existingAssetDescription 
        ? `${params.existingAssetDescription}${isFloorsAssumed ? ' (Assumed Geometry)' : ''}`
        : 'Existing Asset Baseline',
      type: 'GENERAL',
      footprintArea: Math.round(massAWidth * massALength),
      floors: existingFloors,
      floorToFloorHeight: 3.5,
      height: existingFloors * 3.5,
      gfa: existingGFA,
      program: 'HOTEL',
      position: { x: 0, y: 0, z: centerZ },
      dimensions: { 
        width: massAWidth, 
        length: massALength, 
        height: existingFloors * 3.5 
      },
      preserveGfa: true,
    }
  ] : [
    {
      id: `mass-${caseId}-a1`,
      name: 'Main Commercial Block',
      type: 'GENERAL',
      footprintArea: podiumFootprint,
      floors: 4,
      floorToFloorHeight: 3.5,
      height: 14.0,
      gfa: podiumFootprint * 4,
      program: 'COMMERCIAL',
      position: { x: 0, y: 0, z: centerZ },
      dimensions: { width: podiumWidth, length: podiumLength, height: 14.0 }
    }
  ];

  const fittedMassesA = fitMassesToBuildableEnvelope(grossSiteArea, defaultSetbacks, massesA, standardFrontage);
  const metricsA = calculateDevelopmentMetrics(grossSiteArea, fittedMassesA, defaultSetbacks, standardFrontage);
  const overlapA = calculateMassPairwiseIntersections(fittedMassesA);
  const scenarioAName = existingGFA 
    ? `Scenario A: Existing Asset Baseline (${metricsA.totalGFA.toLocaleString()} m² GFA)` 
    : 'Scenario A: Baseline Concept';

  const complianceA = evaluateScenarioCompliance(grossSiteArea, defaultSetbacks, fittedMassesA, metricsA, overlapA, {
    scenarioName: scenarioAName,
    hasZoningEvidence: Boolean(params.hasZoningEvidence),
    maxFAR: suppliedMaxFAR,
    maxCoveragePct: suppliedMaxCoveragePct,
    minKDHPct: suppliedMinKDHPct,
    maxHeightMeters,
    maxFloors: floorStudy.kind === 'HEIGHT_DERIVED_LEGAL_MAXIMUM' ? floorStudy.floorCount ?? undefined : undefined,
    frontageLength: standardFrontage
  });

  const scenarioA: DevelopmentScenario = {
    id: `scen-${caseId}-01`,
    projectId: caseId,
    name: scenarioAName,
    description: existingGFA 
      ? `Uses the recorded ${existingGFA.toLocaleString()} m² asset as a reference baseline (${isFloorsAssumed ? 'assumed 4 storeys' : `${existingFloors} storeys`}); future adaptation scope and cost are not assessed.`
      : 'Initial 4-storey commercial study envelope conforming to standard setbacks.',
    isPreferred: false,
    status: complianceA.status as DevelopmentScenario['status'],
    complianceReport: complianceA,
    pairwiseOverlap: overlapA,
    editClassification: 'BASE_CONCEPT',
    masses: fittedMassesA,
    metrics: metricsA,
    assumptionsUsed: {
      heightFloors: metricsA.totalFloors,
      heightMeters: metricsA.totalHeightMeters,
      targetFAR: metricsA.farKLB,
      targetCoverageKDB: metricsA.siteCoveragePercentage,
      setbacks: defaultSetbacks,
      unverifiedAssumptionsCount: params.hasZoningEvidence ? 0 : 2
    },
    risks: [`Preserves baseline without using the ${densityBasisLabel} for potential expansion headroom.`],
    opportunities: ['Retains the recorded existing asset as a reference baseline; revenue and operating performance were not supplied.'],
    existingAssetStrategy: existingGFA ? 'RETAIN' : undefined,
    createdAt: now,
    updatedAt: now
  };

  // ----------------------------------------------------
  // SCENARIO B: Phased Expansion / Target Scheme (Preferred)
  // ----------------------------------------------------
  const widthWing = Math.min(Math.round(bounds.buildableWidth * 0.45 * 10) / 10, 15);
  const lengthWing = Math.min(Math.round(bounds.buildableLength * 0.85 * 10) / 10, 35);
  const footprintPerWing = Math.round(widthWing * lengthWing);
  const existingFootprint = existingGFA && existingFloors > 0 ? existingGFA / existingFloors : footprintPerWing;
  const existingWidth = existingGFA
    ? Math.min(bounds.buildableWidth * 0.72, Math.max(12, Math.round(Math.sqrt(existingFootprint * 0.45) * 10) / 10))
    : widthWing;
  const existingLength = existingGFA
    ? Math.min(bounds.buildableLength * 0.90, Math.max(12, Math.round((existingFootprint / existingWidth) * 10) / 10))
    : lengthWing;
  const additionWidth = existingGFA
    ? Math.min(widthWing, Math.max(8, bounds.buildableWidth - existingWidth - 2))
    : widthWing;
  const additionLength = existingGFA ? Math.min(lengthWing, bounds.buildableLength * 0.72) : lengthWing;

  const floorsB1 = existingFloors;
  const floorsB2 = maxFloors;

  const posX_B1 = -Math.round((existingWidth / 2 + 1.0) * 10) / 10;
  const posX_B2 = Math.round((existingWidth / 2 + additionWidth / 2 + 1.0) * 10) / 10;

  const massesB: BuildingMass[] = existingGFA ? [
    {
      id: `mass-${caseId}-b1`,
      name: 'Existing Asset Wing',
      type: 'PODIUM',
      footprintArea: Math.round(existingWidth * existingLength),
      floors: floorsB1,
      floorToFloorHeight: 3.5,
      height: floorsB1 * 3.5,
      gfa: existingGFA,
      program: 'HOTEL',
      position: { x: posX_B1, y: 0, z: centerZ },
      dimensions: { 
        width: existingWidth,
        length: existingLength,
        height: floorsB1 * 3.5 
      },
      preserveGfa: true,
    },
    {
      id: `mass-${caseId}-b2`,
      name: 'New Lifestyle Tower Addition',
      type: 'TOWER',
      footprintArea: Math.round(additionWidth * additionLength),
      floors: floorsB2,
      floorToFloorHeight: 3.5,
      height: floorsB2 * 3.5,
      gfa: Math.round(additionWidth * additionLength * floorsB2),
      program: 'MIXED_USE',
      position: { x: posX_B2, y: 0, z: centerZ },
      dimensions: { 
        width: additionWidth,
        length: additionLength,
        height: floorsB2 * 3.5 
      }
    }
  ] : [
    {
      id: `mass-${caseId}-b1`,
      name: 'Retail Podium',
      type: 'PODIUM',
      footprintArea: podiumFootprint,
      floors: 2,
      floorToFloorHeight: 4.0,
      height: 8.0,
      gfa: podiumFootprint * 2,
      program: 'RETAIL',
      position: { x: 0, y: 0, z: centerZ },
      dimensions: { width: podiumWidth, length: podiumLength, height: 8.0 }
    },
    {
      id: `mass-${caseId}-b2`,
      name: 'Upper Tower',
      type: 'TOWER',
      footprintArea: towerFootprint,
      floors: 6,
      floorToFloorHeight: 3.5,
      height: 21.0,
      gfa: towerFootprint * 6,
      program: 'COMMERCIAL',
      position: { x: 0, y: 8.0, z: centerZ },
      dimensions: { width: towerWidth, length: towerLength, height: 21.0 }
    }
  ];

  const fittedMassesB = fitMassesToBuildableEnvelope(grossSiteArea, defaultSetbacks, massesB, standardFrontage);
  const metricsB = calculateDevelopmentMetrics(grossSiteArea, fittedMassesB, defaultSetbacks, standardFrontage);
  const overlapB = calculateMassPairwiseIntersections(fittedMassesB);
  const scenarioBName = existingGFA 
    ? 'Scenario B: Phased Expansion'
    : 'Scenario B: Phased Mixed-Use Development';

  const complianceB = evaluateScenarioCompliance(grossSiteArea, defaultSetbacks, fittedMassesB, metricsB, overlapB, {
    scenarioName: scenarioBName,
    hasZoningEvidence: Boolean(params.hasZoningEvidence),
    maxFAR: suppliedMaxFAR,
    maxCoveragePct: suppliedMaxCoveragePct,
    minKDHPct: suppliedMinKDHPct,
    maxHeightMeters,
    maxFloors: floorStudy.kind === 'HEIGHT_DERIVED_LEGAL_MAXIMUM' ? floorStudy.floorCount ?? undefined : undefined,
    frontageLength: standardFrontage
  });

  const scenarioB: DevelopmentScenario = {
    id: `scen-${caseId}-02`,
    projectId: caseId,
    name: scenarioBName,
    description: existingGFA
      ? `Phased scheme adds ${Math.max(0, metricsB.totalGFA - existingGFA).toLocaleString()} m² of study capacity beside the recorded ${existingGFA.toLocaleString()} m² asset. Existing-asset retention is partial and does not imply revenue or operational continuity.`
      : 'Balanced phased density scheme with active ground-floor retail and commercial suites.',
    isPreferred: true,
    status: complianceB.status as DevelopmentScenario['status'],
    complianceReport: complianceB,
    pairwiseOverlap: overlapB,
    editClassification: 'BASE_CONCEPT',
    masses: fittedMassesB,
    metrics: metricsB,
    assumptionsUsed: {
      heightFloors: metricsB.totalFloors,
      heightMeters: metricsB.totalHeightMeters,
      targetFAR: metricsB.farKLB,
      targetCoverageKDB: metricsB.siteCoveragePercentage,
      setbacks: defaultSetbacks,
      unverifiedAssumptionsCount: params.hasZoningEvidence ? 0 : 2
    },
    risks: ['Phased integration requires structural and egress interface coordination.'],
    opportunities: ['Balanced mixed-use study with explicit partial retention; financial performance and continuity require separate evidence.'],
    existingAssetStrategy: existingGFA ? 'PARTIALLY_RETAIN' : undefined,
    createdAt: now,
    updatedAt: now
  };

  // ----------------------------------------------------
  // SCENARIO C: high-yield study using either verified controls or an explicit working assumption.
  // ----------------------------------------------------
  const towerFloorsC = maxFloors;
  const towerHeightC = towerFloorsC * 3.5;
  const targetFootprintC = Math.min(Math.floor(bounds.netBuildableArea * 0.85), Math.floor((maxGFA * 0.995) / towerFloorsC));
  const widthC = Math.min(Math.floor(bounds.buildableWidth * 0.90 * 10) / 10, Math.max(15, Math.floor(Math.sqrt(targetFootprintC * 0.90) * 10) / 10));
  const lengthC = Math.min(Math.floor(bounds.buildableLength * 0.90 * 10) / 10, Math.max(15, Math.floor((targetFootprintC / widthC) * 10) / 10));

  const massesC: BuildingMass[] = [
    {
      id: `mass-${caseId}-c1`,
      name: 'Integrated Podium & Tower',
      type: 'GENERAL',
      footprintArea: Math.round(widthC * lengthC),
      floors: towerFloorsC,
      floorToFloorHeight: 3.5,
      height: towerHeightC,
      gfa: Math.round(widthC * lengthC * towerFloorsC),
      program: 'MIXED_USE',
      position: { x: 0, y: 0, z: centerZ },
      dimensions: { 
        width: widthC, 
        length: lengthC, 
        height: towerHeightC 
      }
    }
  ];

  const fittedMassesC = fitMassesToBuildableEnvelope(grossSiteArea, defaultSetbacks, massesC, standardFrontage);
  const metricsC = calculateDevelopmentMetrics(grossSiteArea, fittedMassesC, defaultSetbacks, standardFrontage);
  const overlapC = calculateMassPairwiseIntersections(fittedMassesC);
  const scenarioCName = verifiedPlanningBasis
    ? `Scenario C: Verified-Control Buildout (${metricsC.totalGFA.toLocaleString()} m² · KLB ${maxFAR.toFixed(2)}x)`
    : `Scenario C: Planning Study Buildout (${metricsC.totalGFA.toLocaleString()} m² · working KLB ${maxFAR.toFixed(2)}x)`;

  const complianceC = evaluateScenarioCompliance(grossSiteArea, defaultSetbacks, fittedMassesC, metricsC, overlapC, {
    scenarioName: scenarioCName,
    hasZoningEvidence: Boolean(params.hasZoningEvidence),
    maxFAR: suppliedMaxFAR,
    maxCoveragePct: suppliedMaxCoveragePct,
    minKDHPct: suppliedMinKDHPct,
    maxHeightMeters,
    maxFloors: floorStudy.kind === 'HEIGHT_DERIVED_LEGAL_MAXIMUM' ? floorStudy.floorCount ?? undefined : undefined,
    frontageLength: standardFrontage
  });

  const scenarioC: DevelopmentScenario = {
    id: `scen-${caseId}-03`,
    projectId: caseId,
    name: scenarioCName,
    description: verifiedPlanningBasis
      ? `Buildout study achieving ${metricsC.totalGFA.toLocaleString()} m² GFA across ${towerFloorsC} storeys against the supplied verified KLB ${maxFAR.toFixed(2)}x control.`
      : `Non-legal planning study achieving ${metricsC.totalGFA.toLocaleString()} m² GFA across an assumed ${towerFloorsC} storeys using working KLB ${maxFAR.toFixed(2)}x. Verify planning controls before reliance.`,
    isPreferred: false,
    status: complianceC.status as DevelopmentScenario['status'],
    complianceReport: complianceC,
    pairwiseOverlap: overlapC,
    editClassification: 'BASE_CONCEPT',
    masses: fittedMassesC,
    metrics: metricsC,
    assumptionsUsed: {
      heightFloors: towerFloorsC,
      heightMeters: towerHeightC,
      targetFAR: maxFAR,
      targetCoverageKDB: metricsC.siteCoveragePercentage,
      setbacks: defaultSetbacks,
      unverifiedAssumptionsCount: params.hasZoningEvidence ? 0 : 2
    },
    risks: ['Demands total demolition and high construction capital expenditure.'],
    existingAssetStrategy: existingGFA ? 'REPLACE' : undefined,
    opportunities: [verifiedPlanningBasis
      ? 'Tests development capacity against the supplied confirmed density control; value, cost, and feasibility require separate assessment.'
      : 'Tests development capacity under a clearly marked working density assumption; value, cost, and feasibility require separate assessment.'],
    createdAt: now,
    updatedAt: now
  };

  // Construct structured initial findings based on user-entered facts with honest provenance
  const findings: Finding[] = [
    {
      id: `fnd-${caseId}-01`,
      projectId: caseId,
      sourceId: 'src-intake-01',
      sourceName: 'Opportunity Intake (User Stated)',
      statement: `Land parcel area stated as ${grossSiteArea.toLocaleString()} m² with ${standardFrontage}m frontage width.`,
      category: 'PHYSICAL_SURVEY',
      classification: params.provenanceType === 'VERIFIED_TITLE' ? 'FACT' : 'ASSUMPTION',
      confidence: params.provenanceType === 'VERIFIED_TITLE' ? 'HIGH' : 'UNVERIFIED',
      extractedValue: { numericValue: grossSiteArea, unit: 'm²', key: 'gross_site_area' },
      createdAt: now
    }
  ];

  if (existingGFA) {
    findings.push({
      id: `fnd-${caseId}-02`,
      projectId: caseId,
      sourceId: 'src-intake-01',
      sourceName: 'Opportunity Intake (User Stated)',
      statement: `User-stated existing building on parcel comprises ${existingGFA.toLocaleString()} m² GFA (${params.existingFloors ? `${params.existingFloors} storeys—provided by the user, not yet confirmed` : 'storeys not provided; study assumption only'}, ${params.existingAssetDescription || 'Structure'}, status: ${params.existingAssetStatus || 'not provided'}).`,
      category: 'MARKET_COMMERCIAL',
      classification: 'CLAIM',
      confidence: 'LOW',
      extractedValue: { numericValue: existingGFA, unit: 'm²', key: 'existing_building_gfa' },
      createdAt: now
    });
  }

  if (params.statutoryMaxFAR !== undefined || params.maxFAR !== undefined) {
    findings.push({
      id: `fnd-${caseId}-03`,
      projectId: caseId,
      sourceId: 'src-intake-01',
      sourceName: params.hasZoningEvidence ? 'Official Municipal Zoning Certificate (RDTR)' : 'Opportunity Intake (User Parameter)',
      statement: params.hasZoningEvidence
        ? `Zoning evidence indicates ${params.zoneCode || 'K.1'} (${params.zoneName || 'Commercial'}) with KLB/FAR limit ${maxFAR.toFixed(2)}x (maximum study GFA: ${maxGFA.toLocaleString()} m²).`
        : `User-entered working planning parameter: ${params.zoneCode || 'zone not provided'} with KLB/FAR ${maxFAR.toFixed(2)}x (study GFA: ${maxGFA.toLocaleString()} m²). This is not verified statutory evidence.`,
      category: 'ZONING_PLANNING',
      classification: params.hasZoningEvidence ? 'FACT' : 'CLAIM',
      confidence: params.hasZoningEvidence ? 'HIGH' : 'LOW',
      extractedValue: { numericValue: maxFAR, unit: 'FAR', key: 'max_far' },
      createdAt: now
    });
  }

  if (params.statutoryMinKDHPct !== undefined || params.minKDHPct !== undefined) {
    findings.push({
      id: `fnd-${caseId}-04`,
      projectId: caseId,
      sourceId: 'src-intake-01',
      sourceName: 'Planning Guideline Assumption',
      statement: `A ${minKDHPct}% KDH planning requirement was provided, but landscaped/permeable area has not been entered; KDH is not demonstrated.`,
      category: 'ENVIRONMENTAL_TOPOGRAPHY',
      classification: 'ASSUMPTION',
      confidence: 'LOW',
      extractedValue: { numericValue: minKDHPct, unit: '%', key: 'min_kdh' },
      createdAt: now
    });
  }

  if (params.askingPriceAmount !== undefined) {
    const derivedPricePerM2 = Math.round(params.askingPriceAmount / grossSiteArea);
    findings.push({
      id: `fnd-${caseId}-05`,
      projectId: caseId,
      sourceId: 'src-intake-01',
      sourceName: 'Opportunity Intake (User Stated)',
      statement: `User-entered asking price stated at Rp ${(params.askingPriceAmount / 1e9).toFixed(2)} Billion (~Rp ${(derivedPricePerM2 / 1e6).toFixed(2)}M/m² land basis).`,
      category: 'MARKET_COMMERCIAL',
      classification: 'CLAIM',
      confidence: 'LOW',
      extractedValue: { numericValue: params.askingPriceAmount, unit: 'IDR', key: 'asking_price' },
      createdAt: now
    });
  }

  if (params.njopAmount !== undefined) {
    findings.push({
      id: `fnd-${caseId}-06`,
      projectId: caseId,
      sourceId: 'src-intake-01',
      sourceName: 'Opportunity Intake (User Stated)',
      statement: `User-entered tax appraisal benchmark (NJOP) recorded at Rp ${(params.njopAmount / 1e9).toFixed(2)} Billion (~Rp ${(Math.round(params.njopAmount / grossSiteArea) / 1e6).toFixed(2)}M/m²).`,
      category: 'MARKET_COMMERCIAL',
      classification: 'CLAIM',
      confidence: 'LOW',
      extractedValue: { numericValue: params.njopAmount, unit: 'IDR', key: 'njop' },
      createdAt: now
    });
  }

  const intakeText = (key: string, value: string | undefined, fallback: string): string => {
    if (params.intakeValueSources?.[key] === 'USER_CLEARED') return '';
    return value?.trim() || fallback;
  };
  const askingPriceAmount = params.askingPriceAmount;
  const hasAskingPrice = askingPriceAmount !== undefined;
  const newProject: Project = {
    id: caseId,
    name: params.name.trim(),
    isTemplate: false,
    objective: intakeText('objective', params.objective, 'Evaluate site viability, development yield, and zoning envelope.'),
    location: {
      address: params.address.trim(),
      city: intakeText('city', params.city, 'Jakarta'),
      country: intakeText('country', params.country, 'Indonesia'),
      center: { lat: -6.2088, lng: 106.8456 }
    },
    askingPrice: hasAskingPrice ? {
      amount: askingPriceAmount!,
      currency: params.askingPriceCurrency || 'IDR',
      pricePerM2: Math.round(askingPriceAmount! / grossSiteArea)
    } : undefined,
    existingAsset: existingGFA ? {
      gfa: existingGFA,
      floors: isFloorsAssumed ? undefined : existingFloors,
      isFloorsAssumed,
      description: intakeText('existingAssetDescription', params.existingAssetDescription, 'Operational Structure'),
      currentStatus: intakeText('existingAssetStatus', params.existingAssetStatus, 'Operational')
    } : undefined,
    zoningLimits: {
      zoneCode: intakeText('zoneCode', params.zoneCode, 'K.1'),
      zoneName: intakeText('zoneName', params.zoneName, 'Perkantoran, Perdagangan dan Jasa'),
      maxFAR: suppliedMaxFAR,
      maxCoveragePct: suppliedMaxCoveragePct,
      minKDHPct: suppliedMinKDHPct,
      maxKTBPct: params.statutoryMaxKTBPct ?? 55.0,
      maxHeightMeters,
      maxFloors: params.maxFloors ?? params.statutoryMaxFloors,
      setbacks: defaultSetbacks
    },
    valuation: hasAskingPrice ? {
      askingPriceAmount: askingPriceAmount!,
      askingPriceCurrency: params.askingPriceCurrency || 'IDR',
      njopAmount: params.njopAmount,
      pricePerM2: Math.round(askingPriceAmount! / grossSiteArea),
      valuationBasisNotes: params.valuationBasisNotes
    } : undefined,
    expansionHeadroomGFA,
    status: 'ACTIVE',
    recommendation: 'INVESTIGATE',
    siteReadinessPercentage: 25,
    evidenceConfidence: params.hasZoningEvidence ? 'MEDIUM' : 'UNVERIFIED',
    areaProvenance: {
      value: grossSiteArea,
      sourceType: params.provenanceType || 'USER_ENTERED_ASSUMPTION',
      sourceName: 'Opportunity Intake Form',
      confidence: params.provenanceType === 'VERIFIED_TITLE' ? 'HIGH' : 'UNVERIFIED',
      adoptedAt: now,
      notes: 'Initial site parameters recorded during opportunity creation.'
    },
    site: {
      grossSiteArea,
      buildableArea: netBuildableArea,
      coordinateSystem: 'WGS84',
      frontageLength: standardFrontage,
      lotDepth,
      accessRoadWidth: 8.0,
      address: params.address.trim(),
      streetName: street.value,
      streetNameSource: street.source,
      dimensionProvenance: parcelResolution.provenance,
      projectName: params.name.trim(),
      hasZoningEvidence: Boolean(params.hasZoningEvidence),
      landscapedPermeableAreaM2: params.landscapedPermeableAreaM2,
      setbacks: defaultSetbacks,
      boundary: {
        type: 'Polygon',
        coordinates: [[
          [106.8450, -6.2080],
          [106.8465, -6.2080],
          [106.8465, -6.2095],
          [106.8450, -6.2095],
          [106.8450, -6.2080]
        ]]
      }
    },
    sources: [],
    findings,
    contradictions: [],
    assumptions: [
      {
        id: `asm-${caseId}-01`,
        projectId: caseId,
        parameter: 'Municipal Zoning Envelope',
        workingValue: `${maxFAR.toFixed(2)}x KLB / ${maxCoveragePct}% KDB`,
        unit: 'ratio',
        source: params.hasZoningEvidence ? 'Zoning Certificate' : 'Opportunity Intake Form',
        classification: 'ASSUMPTION',
        verificationStatus: params.hasZoningEvidence ? 'VERIFIED' : 'UNVERIFIED',
        affectedScenarioIds: [scenarioA.id, scenarioB.id, scenarioC.id],
        lastUpdated: now
      }
    ],
    issues: [
      {
        id: `iss-${caseId}-01`,
        projectId: caseId,
        title: 'Municipal Planning & Title Verification Pending',
        category: 'LEGAL_TITLE',
        severity: 'IMPORTANT',
        evidenceSummary: `Initial land area (${grossSiteArea.toLocaleString()} m²) and zoning limits (${maxFAR.toFixed(2)}x FAR) are unverified intake assumptions.`,
        implication: 'Yield calculations and purchase price basis may change upon formal survey.',
        status: 'OPEN',
        recommendedAction: 'Obtain official land certificate (SHGB/SHM) and municipal KRK planning certificate.',
        affectedScenarioIds: [scenarioA.id, scenarioB.id, scenarioC.id]
      }
    ],
    actions: [
      {
        id: `act-${caseId}-01`,
        projectId: caseId,
        title: 'Verify Land Title & Cadastral Boundary',
        priority: 'CRITICAL',
        reason: 'Confirm precise boundary coordinates and official registered land area.',
        affectedScenarioIds: [scenarioA.id, scenarioB.id, scenarioC.id],
        status: 'PENDING',
        assignedTo: 'Due Diligence Team'
      },
      {
        id: `act-${caseId}-02`,
        projectId: caseId,
        title: 'Obtain Official Municipal Zoning Certificate (KRK/RDTR)',
        priority: 'IMPORTANT',
        reason: 'Verify binding statutory FAR, building height cap, and setback requirements.',
        affectedScenarioIds: [scenarioA.id, scenarioB.id, scenarioC.id],
        status: 'PENDING',
        assignedTo: 'Planning Consultant'
      }
    ],
    scenarios: [scenarioA, scenarioB, scenarioC],
    intakeValueSources: params.intakeValueSources,
    executiveSummary: {
      topOpportunities: [
        `Opportunity captured: ${params.name.trim()} (${grossSiteArea.toLocaleString()} m² site area).`,
        existingGFA 
          ? `Existing ${existingGFA.toLocaleString()} m² asset recorded as a study reference; revenue and operational performance were not supplied.`
          : `Parametric study initialized exploring 3 development schemes up to ${maxGFA.toLocaleString()} m² statutory capacity.`
      ],
      criticalRisks: [
        'Site area, setbacks, and allowable yields are provisional assumptions requiring verification.',
        params.askingPriceAmount !== undefined ? `Acquisition price of Rp ${(params.askingPriceAmount / 1e9).toFixed(1)}B requires formal yield validation.` : 'Commercial terms unverified.'
      ],
      criticalUnknowns: [
        'Legal land title certificate and official cadastral boundary verification pending.',
        'Local municipal zoning bylaws (KRK / RDTR certificate) pending confirmation.'
      ],
      recommendedNextMove: 'Conduct cadastral boundary survey and obtain municipal KRK zoning certificate to de-risk investment decision before entering binding agreements.'
    },
    createdAt: now,
    updatedAt: now
  };

  const normalizedProject = ensureCanonicalProjectRevisions(newProject);
  saveCase(normalizedProject);
  setActiveCaseId(normalizedProject.id);
  return normalizedProject;
}

/**
 * Adds a new custom scenario to an existing case.
 */
export function addScenarioToCase(caseId: string, scenario: DevelopmentScenario): Project {
  const project = getCase(caseId);
  const updatedScenarios = [...project.scenarios, scenario];
  const updatedProject = ensureCanonicalProjectRevisions({ ...project, scenarios: updatedScenarios });
  saveCase(updatedProject);
  return updatedProject;
}

/**
 * Duplicates an existing scenario into a new editable working scenario.
 */
export function duplicateScenarioInCase(caseId: string, sourceScenarioId: string): Project {
  const project = getCase(caseId);
  const source = project.scenarios.find(s => s.id === sourceScenarioId) || project.scenarios[0];
  const newId = `scen-${caseId}-${Date.now()}`;
  const sourceCopy = structuredClone(source);
  
  const duplicated: DevelopmentScenario = {
    ...sourceCopy,
    id: newId,
    name: `${source.name} (Copy)`,
    isPreferred: false,
    editClassification: 'USER_GEOMETRY_EDIT',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    canonicalRevision: undefined,
  };

  return addScenarioToCase(caseId, duplicated);
}

/**
 * Deletes a scenario from a case (preventing deletion if it's the last remaining scenario).
 */
export function deleteScenarioFromCase(caseId: string, scenarioId: string): Project {
  const project = getCase(caseId);
  if (project.scenarios.length <= 1) return project;

  const updatedScenarios = project.scenarios.filter(s => s.id !== scenarioId);
  const updatedProject = { ...project, scenarios: updatedScenarios };
  saveCase(updatedProject);
  return updatedProject;
}
