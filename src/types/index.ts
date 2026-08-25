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
  lotDepth?: number;           // in meters; rectangular study depth from the street-facing edge
  accessRoadWidth?: number;    // in meters
  address?: string;
  streetName?: string;
  streetNameSource?: 'ADDRESS_DERIVED' | 'USER_ENTERED' | 'NOT_PROVIDED';
  dimensionProvenance?: ParcelDimensionProvenance;
  projectName?: string;
  hasZoningEvidence?: boolean;
  landscapedPermeableAreaM2?: number;
  publicRealmAreaM2?: number;
  coordinateSystem: 'WGS84' | 'EPSG:3857';
  boundingBox?: [number, number, number, number]; // [minLng, minLat, maxLng, maxLat]
}

export type ParcelDimensionSource = 'USER_ENTERED' | 'ESTIMATED' | 'EVIDENCE_VERIFIED' | 'LEGACY_INFERRED';

export interface ParcelDimensionValue {
  value: number;
  source: ParcelDimensionSource;
  formula?: string;
  originatingInputs?: string[];
}

export interface ParcelDimensionProvenance {
  assumption: 'RECTANGULAR_STUDY_PARCEL';
  calculationMethod: 'WIDTH_X_DEPTH' | 'AREA_DIVIDED_BY_FRONTAGE' | 'LEGACY_AREA_DIVIDED_BY_FRONTAGE';
  frontage: ParcelDimensionValue;
  depth: ParcelDimensionValue;
  area: ParcelDimensionValue;
  suppliedAreaM2?: number;
  warning?: string;
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
  /** Existing-asset study mass may retain its entered GFA while the illustrative footprint is fitted. */
  preserveGfa?: boolean;
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
  source: string;              // e.g. "Municipal Urban Planning Rule of Thumb"
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
  /** Explicit landscaped/permeable area used to demonstrate KDH. */
  landscapedPermeableAreaM2?: number;
  kdhDemonstrated?: boolean;
}

export type ExistingAssetStrategy = 'RETAIN' | 'PARTIALLY_RETAIN' | 'ADAPT' | 'REPLACE' | 'NOT_APPLICABLE';
export type SchemeStrategy = 'CONSERVATIVE' | 'BALANCED' | 'BOUNDARY';

export interface SchemeProposal {
  id: string;
  name: string;
  strategy: SchemeStrategy;
  thesis: string;
  existingAssetDecision: ExistingAssetStrategy;
  existingAssetScope: string;
  proposedMassRoles: string[];
  podiumStoreys?: number;
  towerStoreys?: number;
  floorToFloorAssumptions: { podium?: number; tower?: number };
  programGFAByUse: Record<string, number>;
  programSharePct: Record<string, number>;
  setbacks: Setbacks;
  footprintIntent: string;
  publicRealmIntent: string;
  landscapedPermeableKDHIntent: string;
  accessServicingConcept: string;
  phasingConcept: string;
  ownerPrioritiesAddressed: string[];
  assumptionsIntroduced: string[];
  rationale: string;
  tradeOffs: string[];
  allowNonCompliantStretch: boolean;
}

export interface SchemeGenerationMetadata {
  status: 'PENDING' | 'READY' | 'FAILED' | 'NEEDS_REGENERATION';
  provider: 'VERTEX_AI' | 'GEMINI_API' | 'LOCAL_DEVELOPMENT';
  model: string;
  modelCalled: boolean;
  disclosure: string;
  generatedAt?: string;
  opportunityId: string;
  sourceStudyVersion: string;
  inputHash: string;
  userPriorities: Record<string, string | boolean>;
  assumptions: string[];
  validation: { valid: boolean; errors: string[] };
  proposals: SchemeProposal[];
  acceptedProposalId?: string;
  /** Server-side Taskmaster run that produced this review set, when available. */
  taskmasterRunId?: string;
  taskmasterState?: string;
}

export type ScenarioEditClassification = 
  | 'BASE_CONCEPT'
  | 'USER_GEOMETRY_EDIT'
  | 'FITTED_TO_SETBACK'
  | 'HEIGHT_OVERRIDE'
  | 'PROGRAM_OVERRIDE'
  | 'INVALID_CONFLICT';

export interface CanonicalScenarioRevision {
  schemaVersion: 1;
  revisionId: string;
  revisionHash: string;
  sequence: number;
  commandId: string;
  sourceRevisionId: string | null;
  timestamp: string;
}

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
    decisionText?: string;
    recommendedAction?: string;
    identifiedRisks?: string[];
    assessmentStatus?: string;
    primaryWarning?: string;
    violations: string[];
    kdhDemonstrated?: boolean;
  };
  pairwiseOverlap?: {
    hasOverlap: boolean;
    overlapVolumeM3: number;
    overlaps: { massA: string; massB: string; overlapAreaM2: number; overlapVolumeM3: number }[];
  };
  canonicalRevision?: CanonicalScenarioRevision;
  risks: string[];
  opportunities: string[];
  createdAt: string;
  updatedAt: string;
  existingAssetStrategy?: ExistingAssetStrategy;
  proposal?: SchemeProposal;
}

export type AreaProvenanceType = 
  | 'VERIFIED_TITLE'            // e.g. BPN Certificate
  | 'EXTRACTED_CLAIM'           // e.g. Broker Brochure
  | 'CALCULATED_GEOMETRY'       // e.g. User drawn polygon
  | 'USER_ENTERED_ASSUMPTION'   // e.g. Opportunity Intake Form
  | 'ILLUSTRATIVE_STUDY';       // e.g. Generated massing model

export interface AreaProvenance {
  value: number;                  // Area in m²
  sourceType: AreaProvenanceType;
  sourceDocumentId?: string;
  sourceName: string;             // e.g. "User Intake Form", "SHGB Certificate #1842"
  confidence: ConfidenceLevel;
  adoptedAt?: string;
  adoptedBy?: string;
  notes?: string;
}

export interface CaseSummary {
  id: string;
  name: string;
  address: string;
  grossSiteArea: number;
  isTemplate?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ExistingAssetInfo {
  gfa: number;              // in m² (e.g. 3,760 m²)
  floors?: number;          // e.g. 4 storeys (undefined if unconfirmed)
  isFloorsAssumed?: boolean;
  description?: string;     // e.g. "Operational Sharia Boutique Hotel"
  currentStatus?: string;   // e.g. "Operational", "Vacant", "Underutilized"
}

export interface ProjectZoningLimits {
  zoneCode?: string;        // e.g. "K.1" or "Subzone R.9"
  zoneName?: string;        // e.g. "Perkantoran, Perdagangan dan Jasa"
  maxFAR?: number;          // e.g. 6.65
  maxCoveragePct?: number;  // e.g. 55.0%
  minKDHPct?: number;       // e.g. 20.0%
  maxKTBPct?: number;       // e.g. 55.0%
  maxHeightMeters?: number; // e.g. 32.0m or 48.0m
  maxFloors?: number;       // legacy/input reference; derived height limit is authoritative when height exists
  setbacks: Setbacks;
}

export interface ValuationInfo {
  askingPriceAmount: number;
  askingPriceCurrency: string;
  njopAmount?: number;
  pricePerM2: number;
  valuationBasisNotes?: string;
}

// ==========================================
// 6. Project Aggregate Root (PRD Sec 11 & 35)
// ==========================================
export interface Project {
  id: string;
  name: string;
  isTemplate?: boolean;        // If true, represents read-only Golden Project demonstration
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
  existingAsset?: ExistingAssetInfo;
  zoningLimits?: ProjectZoningLimits;
  valuation?: ValuationInfo;
  expansionHeadroomGFA?: number;
  status: 'ACTIVE' | 'ARCHIVED';
  recommendation: RecommendationStatus;
  siteReadinessPercentage: number; // 0 - 100%
  evidenceConfidence: ConfidenceLevel;
  areaProvenance?: AreaProvenance;
  
  site: SiteGeometry;
  sources: SourceDocument[];
  findings: Finding[];
  contradictions: Contradiction[];
  assumptions: Assumption[];
  issues: ProjectIssue[];
  actions: InvestigationAction[];
  scenarios: DevelopmentScenario[];
  /** Optional record of the latest model-assisted (or honest local-template) scheme study. */
  schemeGeneration?: SchemeGenerationMetadata;
  /** Browser-local pointer used to resume/poll a server-side Taskmaster run. */
  taskmasterRunId?: string;
  
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
  status: 'COMPLIANT' | 'NON_COMPLIANT_HEIGHT' | 'NON_COMPLIANT_FAR' | 'NON_COMPLIANT_COVERAGE' | 'NON_COMPLIANT_SETBACK' | 'NON_COMPLIANT_OUT_OF_BOUNDS' | 'COLLISION_DETECTED' | 'WARNING';
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
