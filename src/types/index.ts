/**
 * SitePilot Core Data Types & Schemas
 * Source of Truth: SitePilot — Product Requirements Document v1.0.md
 */

// ==========================================
// 1. Information Classification (PRD Sec 9)
// ==========================================
export type EvidenceClassification = 
  | 'FACT'            // Supported by reliable evidence (e.g. Certificate area: 16,850 m²)
  | 'CLAIM'           // Provided by another party but unverified (e.g. Broker brochure: 18,200 m²)
  | 'ASSUMPTION'      // Temporary basis used for analysis (e.g. Assume 5m setbacks)
  | 'INFERENCE'       // AI / System interpretation of available data (e.g. Access road may constrain FAR)
  | 'RECOMMENDATION'  // Suggested professional action (e.g. Confirm road width before signing)
  | 'USER_OVERRIDE';  // Explicit user instruction superseding automated interpretation

export type EvidenceCategory = 
  | 'LEGAL_TITLE'
  | 'PHYSICAL_SURVEY'
  | 'ZONING_PLANNING'
  | 'ENVIRONMENTAL_TOPOGRAPHY'
  | 'INFRASTRUCTURE_UTILITIES'
  | 'ACCESS_TRAFFIC'
  | 'MARKET_COMMERCIAL'
  | 'GENERAL_NOTE';

export type ConfidenceLevel = 'HIGH' | 'MEDIUM' | 'LOW' | 'UNVERIFIED';

export type IssueSeverity = 'CRITICAL' | 'IMPORTANT' | 'MODERATE' | 'INFO';

export type RecommendationStatus = 
  | 'PROCEED'
  | 'CONDITIONAL_PROCEED'
  | 'INVESTIGATE'
  | 'HOLD'
  | 'DO_NOT_PROCEED';

// ==========================================
// 2. Spatial & Geometry Types (PRD Sec 14 & 16)
// ==========================================
export interface LatLng {
  lat: number;
  lng: number;
}

export interface GeoPolygon {
  type: 'Polygon';
  coordinates: number[][][]; // GeoJSON format: [ [ [lng, lat], [lng, lat], ... ] ]
}

export interface Setbacks {
  front: number; // in meters
  rear: number;  // in meters
  sideLeft: number; // in meters
  sideRight: number; // in meters
}

export interface SiteGeometry {
  boundary: GeoPolygon;
  grossSiteArea: number;       // in m² (deterministic calculation from boundary)
  buildableArea: number;       // in m² (gross minus setbacks & constraints)
  setbacks: Setbacks;
  frontageLength?: number;     // in meters
  accessRoadWidth?: number;    // in meters
  coordinateSystem: 'WGS84' | 'EPSG:3857';
  boundingBox?: [number, number, number, number]; // [minLng, minLat, maxLng, maxLat]
}

export interface BuildingMass {
  id: string;
  name: string;
  type: 'PODIUM' | 'TOWER' | 'GENERAL' | 'COURTYARD';
  footprintPolygon?: GeoPolygon;
  footprintArea: number;       // in m²
  floors: number;
  floorToFloorHeight: number;  // in meters (default 3.5m - 4.0m)
  height: number;              // total height in meters (floors * floorToFloorHeight)
  gfa: number;                 // Gross Floor Area = footprintArea * floors (or per-floor sum)
  program: 'RESIDENTIAL' | 'COMMERCIAL' | 'RETAIL' | 'MIXED_USE' | 'HOTEL' | 'PARKING';
  position: { x: number; y: number; z: number }; // local relative coords for 3D
  dimensions: { width: number; length: number; height: number };
}

// ==========================================
// 3. Evidence & Finding Model (PRD Sec 13 & 35)
// ==========================================
export interface SourceDocument {
  id: string;
  projectId: string;
  name: string;
  fileType: 'PDF' | 'IMAGE' | 'CAD_DWG' | 'GEOJSON' | 'TEXT_NOTE' | 'BROCHURE';
  fileUrl?: string;
  origin: string; // e.g. "Sentul Broker PDF", "Land Registry Scan", "WhatsApp Message"
  uploadedAt: string;
  pageCount?: number;
  status: 'PENDING' | 'PROCESSED' | 'FAILED';
  summary?: string;
  confidence: ConfidenceLevel;
}

export interface Finding {
  id: string;
  projectId: string;
  sourceId: string;
  sourceName: string;
  pageLocation?: string;       // e.g. "Page 3, Paragraph 2"
  statement: string;           // e.g. "Certificate area stated as 16,850 m²"
  category: EvidenceCategory;
  classification: EvidenceClassification;
  confidence: ConfidenceLevel;
  extractedValue?: {
    numericValue?: number;
    unit?: string;
    key?: string;              // e.g. "site_area", "max_height", "far", "kdb"
  };
  relatedIssueId?: string;
  createdAt: string;
  userOverridden?: boolean;
}

export interface Contradiction {
  id: string;
  projectId: string;
  title: string;               // e.g. "Site Area Discrepancy"
  topic: string;               // e.g. "gross_site_area"
  severity: IssueSeverity;
  findings: Finding[];         // The conflicting findings (e.g. Brochure: 18,200 vs Certificate: 16,850)
  impactStatement: string;     // e.g. "Affects FAR yield and land price per buildable m²"
  recommendedAction: string;   // e.g. "Request official topographic boundary survey"
  resolved: boolean;
  workingValueSelected?: string | number;
}

// ==========================================
// 4. Assumptions, Risks & Actions (PRD Sec 19, 21, 35)
// ==========================================
export interface Assumption {
  id: string;
  projectId: string;
  parameter: string;           // e.g. "Maximum Height", "Front Setback", "FAR / KLB"
  workingValue: string | number;
  unit?: string;
  source: string;              // e.g. "Standard Menteng Mixed-Use Rule of Thumb"
  classification: EvidenceClassification;
  verificationStatus: 'VERIFIED' | 'UNVERIFIED' | 'CHALLENGED_BY_NEW_EVIDENCE';
  affectedScenarioIds: string[];
  lastUpdated: string;
}

export interface ProjectIssue {
  id: string;
  projectId: string;
  title: string;
  category: EvidenceCategory;
  severity: IssueSeverity;
  evidenceSummary: string;
  implication: string;
  status: 'OPEN' | 'INVESTIGATING' | 'RESOLVED' | 'ACCEPTED_RISK';
  recommendedAction: string;
  affectedScenarioIds: string[];
}

export interface InvestigationAction {
  id: string;
  projectId: string;
  title: string;
  priority: 'CRITICAL' | 'IMPORTANT' | 'LATER';
  reason: string;
  affectedIssueId?: string;
  affectedScenarioIds: string[];
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'BLOCKED';
  assignedTo?: string;
  dueDate?: string;
}

// ==========================================
// 5. Scenario Model (PRD Sec 18 & 35)
// ==========================================
export interface DevelopmentMetrics {
  grossSiteArea: number;       // in m²
  netBuildableArea: number;    // in m²
  buildingFootprintArea: number; // in m²
  siteCoveragePercentage: number; // KDB (%) = (footprint / siteArea) * 100
  totalGFA: number;            // in m²
  farKLB: number;              // KLB = totalGFA / siteArea
  openSpaceArea: number;       // in m² = siteArea - footprint
  openSpacePercentage: number; // (%)
  totalFloors: number;
  totalHeightMeters: number;
  estimatedParkingSpaces?: number;
  outOfBoundsAreaM2?: number;
  parcelContainedFootprintM2?: number;
}

export type ScenarioEditClassification = 
  | 'BASE_CONCEPT'
  | 'USER_GEOMETRY_EDIT'
  | 'FITTED_TO_SETBACK'
  | 'HEIGHT_OVERRIDE'
  | 'PROGRAM_OVERRIDE'
  | 'INVALID_CONFLICT';

export interface DevelopmentScenario {
  id: string;
  projectId: string;
  name: string;                // e.g. "Scenario A: Low-Rise Luxury", "Scenario B: Mixed-Use Mid-Rise"
  description: string;
  isPreferred?: boolean;
  status: 'VALID' | 'WARNING_EXCEEDS_CONSTRAINT' | 'UNVERIFIED_ASSUMPTIONS';
  warningMessage?: string;
  editClassification?: ScenarioEditClassification;
  masses: BuildingMass[];
  metrics: DevelopmentMetrics;
  assumptionsUsed: {
    heightFloors: number;
    heightMeters: number;
    targetFAR: number;
    targetCoverageKDB: number;
    setbacks: Setbacks;
    unverifiedAssumptionsCount: number;
  };
  notes?: string;
  isFittedOverride?: boolean;
  fitOverrideReason?: string;
  originalMasses?: BuildingMass[];
  complianceReport?: {
    isCompliant: boolean;
    status: 'VALID' | 'WARNING_EXCEEDS_CONSTRAINT';
    statusPillLabel: string;
    isGreen: boolean;
    summaryText: string;
    primaryWarning?: string;
    violations: string[];
  };
  pairwiseOverlap?: {
    hasOverlap: boolean;
    overlapVolumeM3: number;
    overlaps: { massA: string; massB: string; overlapAreaM2: number; overlapVolumeM3: number }[];
  };
  risks: string[];
  opportunities: string[];
  createdAt: string;
  updatedAt: string;
}

// ==========================================
// 6. Project Aggregate Root (PRD Sec 11 & 35)
// ==========================================
export interface Project {
  id: string;
  name: string;
  objective: string;           // e.g. "Evaluate site for luxury residential or boutique mixed-use"
  location: {
    address: string;
    city: string;
    country: string;
    center: LatLng;
  };
  askingPrice?: {
    amount: number;
    currency: string;          // e.g. "IDR", "USD"
    pricePerM2?: number;
  };
  status: 'ACTIVE' | 'ARCHIVED';
  recommendation: RecommendationStatus;
  siteReadinessPercentage: number; // 0 - 100%
  evidenceConfidence: ConfidenceLevel;
  
  site: SiteGeometry;
  sources: SourceDocument[];
  findings: Finding[];
  contradictions: Contradiction[];
  assumptions: Assumption[];
  issues: ProjectIssue[];
  actions: InvestigationAction[];
  scenarios: DevelopmentScenario[];
  
  executiveSummary: {
    topOpportunities: string[];
    criticalRisks: string[];
    criticalUnknowns: string[];
    recommendedNextMove: string;
  };
  
  createdAt: string;
  updatedAt: string;
}

export interface PlanningAssessment {
  scenarioId: string;
  scenarioName: string;
  status: 'COMPLIANT' | 'NON_COMPLIANT_HEIGHT' | 'NON_COMPLIANT_FAR' | 'NON_COMPLIANT_COVERAGE' | 'NON_COMPLIANT_SETBACK' | 'COLLISION_DETECTED' | 'WARNING';
  decision: string;
  supportingEvidence: string[];
  identifiedRisks: string[];
  recommendedAction: string;
  model: string;
  generatedAt: string;
  accessPath: 'same_origin_browser' | 'authorized_server';
  userAuthenticated: boolean;
  backendAuthenticated: boolean;
  provenance?: {
    model: string;
    project: string;
    vertexLocation: string;
    revision?: string;
    correlationId?: string;
  };
}
