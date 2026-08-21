/**
 * SitePilot Case Repository & Persistence Layer
 * Provides durable client-side case management, schema versioning, and template isolation.
 * Standard: Invariants 1, 2, 3, 4, and 8.
 */

import { Project, CaseSummary, DevelopmentScenario, BuildingMass } from '@/types';
import { GOLDEN_PROJECT } from '@/lib/mock-data/golden-project';
import { 
  calculateDevelopmentMetrics, 
  calculateMassPairwiseIntersections, 
  evaluateScenarioCompliance,
  calculateBuildableArea,
  getCanonicalParcelBounds
} from '@/lib/geometry/engine';

const STORAGE_VERSION = 'v1';
const CASES_STORAGE_KEY = `sitepilot_cases_${STORAGE_VERSION}`;
const ACTIVE_CASE_KEY = `sitepilot_active_case_id_${STORAGE_VERSION}`;

export interface CreateCaseParams {
  name: string;
  address: string;
  city?: string;
  country?: string;
  objective?: string;
  askingPriceAmount?: number;
  askingPriceCurrency?: string;
  grossSiteArea?: number;
  frontageLength?: number;
}

function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function getStoredCasesMap(): Record<string, Project> {
  if (!isBrowser()) return {};
  try {
    const raw = localStorage.getItem(CASES_STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw);
  } catch (e) {
    console.warn('[SitePilot Case Repository] Failed to load stored cases:', e);
    return {};
  }
}

function saveStoredCasesMap(cases: Record<string, Project>): void {
  if (!isBrowser()) return;
  try {
    localStorage.setItem(CASES_STORAGE_KEY, JSON.stringify(cases));
  } catch (e) {
    console.error('[SitePilot Case Repository] Failed to persist cases:', e);
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
    return localStorage.getItem(ACTIVE_CASE_KEY) || GOLDEN_PROJECT.id;
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
    return stored[id] || GOLDEN_PROJECT;
  }

  const stored = getStoredCasesMap();
  if (stored[id]) {
    return stored[id];
  }

  return GOLDEN_PROJECT;
}

export function saveCase(project: Project): void {
  if (!isBrowser()) return;
  const stored = getStoredCasesMap();
  const updatedProject = {
    ...project,
    updatedAt: new Date().toISOString()
  };
  stored[project.id] = updatedProject;
  saveStoredCasesMap(stored);
}

export function deleteCase(id: string): void {
  if (!isBrowser() || id === GOLDEN_PROJECT.id) return;
  const stored = getStoredCasesMap();
  delete stored[id];
  saveStoredCasesMap(stored);

  if (getActiveCaseId() === id) {
    setActiveCaseId(GOLDEN_PROJECT.id);
  }
}

export function resetDemoCase(): Project {
  if (isBrowser()) {
    const stored = getStoredCasesMap();
    delete stored[GOLDEN_PROJECT.id];
    saveStoredCasesMap(stored);
  }
  return GOLDEN_PROJECT;
}

/**
 * Creates a clean, trustworthy initial case with explicit USER_ENTERED_ASSUMPTION provenance.
 */
export function createCase(params: CreateCaseParams): Project {
  const caseId = `proj-${Date.now()}`;
  const now = new Date().toISOString();
  const grossSiteArea = params.grossSiteArea && !isNaN(params.grossSiteArea) && params.grossSiteArea > 0
    ? Math.max(100, Math.round(params.grossSiteArea))
    : 10000;
  
  // Calculate reasonable initial frontage and rectangular bounding dimensions
  const standardFrontage = params.frontageLength && params.frontageLength > 0
    ? params.frontageLength
    : Math.max(20, Math.round(Math.sqrt(grossSiteArea * 0.75) * 10) / 10);

  const defaultSetbacks = {
    front: 8,
    rear: 5,
    sideLeft: 4,
    sideRight: 4
  };

  const bounds = getCanonicalParcelBounds(grossSiteArea, defaultSetbacks, standardFrontage);
  const netBuildableArea = calculateBuildableArea(grossSiteArea, defaultSetbacks, standardFrontage);

  // Generate 2 clean illustrative study scenarios scaled to the site area
  const podiumWidth = Math.max(15, Math.round(bounds.buildableWidth * 0.75 * 10) / 10);
  const podiumLength = Math.max(15, Math.round(bounds.buildableLength * 0.65 * 10) / 10);
  const podiumFootprint = Math.round(podiumWidth * podiumLength);

  const towerWidth = Math.max(12, Math.round(podiumWidth * 0.6 * 10) / 10);
  const towerLength = Math.max(12, Math.round(podiumLength * 0.6 * 10) / 10);
  const towerFootprint = Math.round(towerWidth * towerLength);

  // Scenario A: Low-Rise Study (4 Storeys)
  const massesA: BuildingMass[] = [
    {
      id: `mass-${caseId}-a1`,
      name: 'Main Block',
      type: 'GENERAL',
      footprintArea: podiumFootprint,
      floors: 4,
      floorToFloorHeight: 3.5,
      height: 14.0,
      gfa: podiumFootprint * 4,
      program: 'COMMERCIAL',
      position: { x: 0, y: 0, z: 0 },
      dimensions: { width: podiumWidth, length: podiumLength, height: 14.0 }
    }
  ];

  const metricsA = calculateDevelopmentMetrics(grossSiteArea, massesA, defaultSetbacks);
  const overlapA = calculateMassPairwiseIntersections(massesA);
  const complianceA = evaluateScenarioCompliance(grossSiteArea, defaultSetbacks, massesA, metricsA, overlapA, {
    scenarioName: 'Scenario A: Baseline Concept',
    hasZoningEvidence: false
  });

  const scenarioA: DevelopmentScenario = {
    id: `scen-${caseId}-01`,
    projectId: caseId,
    name: 'Scenario A: Baseline Concept',
    description: 'Initial 4-storey commercial study envelope conforming to standard setbacks.',
    isPreferred: false,
    status: complianceA.status as DevelopmentScenario['status'],
    complianceReport: complianceA,
    pairwiseOverlap: overlapA,
    editClassification: 'BASE_CONCEPT',
    masses: massesA,
    metrics: metricsA,
    assumptionsUsed: {
      heightFloors: 4,
      heightMeters: 14.0,
      targetFAR: 1.5,
      targetCoverageKDB: 40.0,
      setbacks: defaultSetbacks,
      unverifiedAssumptionsCount: 2
    },
    risks: ['Planning parameters unverified against local zoning regulation.'],
    opportunities: ['Moderate scale enables rapid approval feasibility.'],
    createdAt: now,
    updatedAt: now
  };

  // Scenario B: Mid-Rise Mixed-Use Study (8 Storeys, Podium + Tower)
  const massesB: BuildingMass[] = [
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
      position: { x: 0, y: 0, z: 0 },
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
      position: { x: 0, y: 8.0, z: 0 },
      dimensions: { width: towerWidth, length: towerLength, height: 21.0 }
    }
  ];

  const metricsB = calculateDevelopmentMetrics(grossSiteArea, massesB, defaultSetbacks);
  const overlapB = calculateMassPairwiseIntersections(massesB);
  const complianceB = evaluateScenarioCompliance(grossSiteArea, defaultSetbacks, massesB, metricsB, overlapB, {
    scenarioName: 'Scenario B: Mixed-Use Option (Preferred)',
    hasZoningEvidence: false
  });

  const scenarioB: DevelopmentScenario = {
    id: `scen-${caseId}-02`,
    projectId: caseId,
    name: 'Scenario B: Mixed-Use Option (Preferred)',
    description: '8-storey concept featuring 2-storey retail podium and 6-storey upper commercial block.',
    isPreferred: true,
    status: complianceB.status as DevelopmentScenario['status'],
    complianceReport: complianceB,
    pairwiseOverlap: overlapB,
    editClassification: 'BASE_CONCEPT',
    masses: massesB,
    metrics: metricsB,
    assumptionsUsed: {
      heightFloors: 8,
      heightMeters: 29.0,
      targetFAR: 2.5,
      targetCoverageKDB: 45.0,
      setbacks: defaultSetbacks,
      unverifiedAssumptionsCount: 2
    },
    risks: ['Pending formal zoning confirmation for 8 storeys.'],
    opportunities: ['Optimizes site capacity across commercial and retail programs.'],
    createdAt: now,
    updatedAt: now
  };

  const newProject: Project = {
    id: caseId,
    name: params.name.trim(),
    isTemplate: false,
    objective: params.objective?.trim() || 'Evaluate site viability, development yield, and zoning envelope.',
    location: {
      address: params.address.trim(),
      city: params.city?.trim() || 'Jakarta',
      country: params.country?.trim() || 'Indonesia',
      center: { lat: -6.2088, lng: 106.8456 }
    },
    askingPrice: params.askingPriceAmount ? {
      amount: params.askingPriceAmount,
      currency: params.askingPriceCurrency || 'IDR',
      pricePerM2: Math.round(params.askingPriceAmount / grossSiteArea)
    } : undefined,
    status: 'ACTIVE',
    recommendation: 'INVESTIGATE',
    siteReadinessPercentage: 25,
    evidenceConfidence: 'UNVERIFIED',
    areaProvenance: {
      value: grossSiteArea,
      sourceType: 'USER_ENTERED_ASSUMPTION',
      sourceName: 'Opportunity Intake Form',
      confidence: 'UNVERIFIED',
      adoptedAt: now,
      notes: 'Initial site area entered during new opportunity intake'
    },
    site: {
      grossSiteArea,
      buildableArea: netBuildableArea,
      coordinateSystem: 'WGS84',
      frontageLength: standardFrontage,
      accessRoadWidth: 8.0,
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
    findings: [],
    contradictions: [],
    assumptions: [
      {
        id: `assump-${caseId}-01`,
        projectId: caseId,
        parameter: 'Initial Site Area',
        workingValue: grossSiteArea,
        unit: 'm²',
        source: 'Opportunity Intake Form',
        classification: 'ASSUMPTION',
        verificationStatus: 'UNVERIFIED',
        affectedScenarioIds: [scenarioA.id, scenarioB.id],
        lastUpdated: now
      },
      {
        id: `assump-${caseId}-02`,
        projectId: caseId,
        parameter: 'Working Setbacks',
        workingValue: `${defaultSetbacks.front}m Front / ${defaultSetbacks.rear}m Rear / ${defaultSetbacks.sideLeft}m Sides`,
        unit: 'meters',
        source: 'Standard Municipal Urban Planning Rule of Thumb',
        classification: 'ASSUMPTION',
        verificationStatus: 'UNVERIFIED',
        affectedScenarioIds: [scenarioA.id, scenarioB.id],
        lastUpdated: now
      }
    ],
    issues: [
      {
        id: `iss-${caseId}-01`,
        projectId: caseId,
        title: 'Site Area & Boundary Unverified',
        category: 'LEGAL_TITLE',
        severity: 'IMPORTANT',
        evidenceSummary: `Initial site area of ${grossSiteArea.toLocaleString()} m² is based on opportunity intake assumptions without cadastral survey verification.`,
        implication: 'Yield calculations and purchase price basis may change upon formal survey.',
        status: 'OPEN',
        recommendedAction: 'Obtain official land certificate (SHGB/SHM) and topographic survey.',
        affectedScenarioIds: [scenarioA.id, scenarioB.id]
      }
    ],
    actions: [
      {
        id: `act-${caseId}-01`,
        projectId: caseId,
        title: 'Verify Land Title & Survey Certificate',
        priority: 'CRITICAL',
        reason: 'Confirm precise boundary coordinates and official registered land area.',
        affectedScenarioIds: [scenarioA.id, scenarioB.id],
        status: 'PENDING',
        assignedTo: 'Due Diligence Team'
      },
      {
        id: `act-${caseId}-02`,
        projectId: caseId,
        title: 'Confirm Municipal Zoning Designation (RDTR)',
        priority: 'IMPORTANT',
        reason: 'Verify allowable FAR, building height, coverage, and statutory setbacks.',
        affectedScenarioIds: [scenarioA.id, scenarioB.id],
        status: 'PENDING',
        assignedTo: 'Planning Consultant'
      }
    ],
    scenarios: [scenarioA, scenarioB],
    executiveSummary: {
      topOpportunities: [
        `Opportunity captured: ${params.name.trim()} (${grossSiteArea.toLocaleString()} m² initial site area).`,
        'Parametric study envelope initialized for rapid due diligence exploration.'
      ],
      criticalRisks: [
        'Site area, setbacks, and allowable yields are provisional assumptions requiring verification.'
      ],
      criticalUnknowns: [
        'Legal land title certificate and official cadastral boundary verification pending.',
        'Local municipal zoning bylaws (FAR, maximum height, permitted uses) pending confirmation.'
      ],
      recommendedNextMove: 'Upload legal title documents or municipal zoning excerpts to verify planning parameters and unlock high-confidence feasibility assessment.'
    },
    createdAt: now,
    updatedAt: now
  };

  saveCase(newProject);
  setActiveCaseId(newProject.id);
  return newProject;
}
