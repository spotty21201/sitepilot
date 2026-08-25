import {
  calculateBuildableArea,
  calculateDevelopmentMetrics,
  calculateMassPairwiseIntersections,
  evaluateScenarioCompliance,
} from '@/lib/geometry/engine';
export { deriveStreetName, STREET_NAME_FALLBACK } from '@/lib/opportunity/street-name';
import { deriveStreetName } from '@/lib/opportunity/street-name';
import type {
  DevelopmentScenario,
  ParcelDimensionProvenance,
  ParcelDimensionSource,
  Project,
} from '@/types';

export const DIMENSION_MATERIAL_DIFFERENCE_RATIO = 0.02;
export const DIMENSION_MATERIAL_DIFFERENCE_MIN_M2 = 10;

export interface RectangularParcelInput {
  frontageMeters?: number;
  depthMeters?: number;
  siteAreaM2?: number;
  frontageSource?: ParcelDimensionSource;
  depthSource?: ParcelDimensionSource;
  areaSource?: ParcelDimensionSource;
}

export type RectangularParcelResolution =
  | {
      valid: true;
      frontageMeters: number;
      depthMeters: number;
      siteAreaM2: number;
      provenance: ParcelDimensionProvenance;
      warning?: string;
    }
  | {
      valid: false;
      errors: string[];
    };

function positive(value: number | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

function roundDimension(value: number): number {
  return Math.round(value * 100) / 100;
}

export function resolveRectangularParcel(input: RectangularParcelInput): RectangularParcelResolution {
  const errors: string[] = [];
  const supplied = [
    ['Street frontage', input.frontageMeters],
    ['Lot depth', input.depthMeters],
    ['Site area', input.siteAreaM2],
  ] as const;
  for (const [label, value] of supplied) {
    if (value !== undefined && (!Number.isFinite(value) || value <= 0)) {
      errors.push(`${label} must be greater than zero.`);
    }
  }
  if (errors.length > 0) return { valid: false, errors };
  if (!positive(input.frontageMeters)) {
    return { valid: false, errors: ['Street frontage is required to define the rectangular study parcel.'] };
  }

  const frontageMeters = roundDimension(input.frontageMeters);
  if (positive(input.depthMeters)) {
    const depthMeters = roundDimension(input.depthMeters);
    const calculatedArea = roundDimension(frontageMeters * depthMeters);
    const suppliedArea = positive(input.siteAreaM2) ? roundDimension(input.siteAreaM2) : undefined;
    const difference = suppliedArea === undefined ? 0 : Math.abs(calculatedArea - suppliedArea);
    const materialThreshold = suppliedArea === undefined
      ? Number.POSITIVE_INFINITY
      : Math.max(DIMENSION_MATERIAL_DIFFERENCE_MIN_M2, suppliedArea * DIMENSION_MATERIAL_DIFFERENCE_RATIO);
    const warning = difference > materialThreshold
      ? `Supplied site area (${suppliedArea!.toLocaleString()} m²) differs from frontage × depth (${calculatedArea.toLocaleString()} m²). The rectangular study uses the entered frontage and depth; verify the parcel before relying on yield figures.`
      : undefined;
    return {
      valid: true,
      frontageMeters,
      depthMeters,
      siteAreaM2: calculatedArea,
      warning,
      provenance: {
        assumption: 'RECTANGULAR_STUDY_PARCEL',
        calculationMethod: 'WIDTH_X_DEPTH',
        frontage: {
          value: frontageMeters,
          source: input.frontageSource ?? 'USER_ENTERED',
        },
        depth: {
          value: depthMeters,
          source: input.depthSource ?? 'USER_ENTERED',
        },
        area: {
          value: calculatedArea,
          source: positive(input.siteAreaM2) && !warning
            ? (input.areaSource ?? 'USER_ENTERED')
            : 'ESTIMATED',
          formula: 'street frontage × lot depth',
          originatingInputs: ['street frontage', 'lot depth'],
        },
        suppliedAreaM2: suppliedArea,
        warning,
      },
    };
  }

  if (positive(input.siteAreaM2)) {
    const siteAreaM2 = roundDimension(input.siteAreaM2);
    const depthMeters = roundDimension(siteAreaM2 / frontageMeters);
    return {
      valid: true,
      frontageMeters,
      depthMeters,
      siteAreaM2,
      provenance: {
        assumption: 'RECTANGULAR_STUDY_PARCEL',
        calculationMethod: 'AREA_DIVIDED_BY_FRONTAGE',
        frontage: {
          value: frontageMeters,
          source: input.frontageSource ?? 'USER_ENTERED',
        },
        depth: {
          value: depthMeters,
          source: 'ESTIMATED',
          formula: 'site area ÷ street frontage',
          originatingInputs: ['site area', 'street frontage'],
        },
        area: {
          value: siteAreaM2,
          source: input.areaSource ?? 'USER_ENTERED',
        },
      },
    };
  }

  return {
    valid: false,
    errors: ['Enter lot depth, or enter site area so depth can be estimated from area ÷ frontage.'],
  };
}

export interface ScenarioFloorLimit {
  kind: 'HEIGHT_DERIVED_LEGAL_MAXIMUM' | 'FAR_COVERAGE_STUDY_ESTIMATE' | 'INSUFFICIENT_INPUTS';
  floorCount: number | null;
  floorToFloorHeight: number;
  formula: string;
  explanation: string;
  missingInputs: string[];
}

export function deriveScenarioFloorLimit(input: {
  maximumHeightMeters?: number;
  floorToFloorHeight: number;
  maximumFAR?: number;
  maximumCoveragePct?: number;
}): ScenarioFloorLimit {
  const floorToFloorHeight = positive(input.floorToFloorHeight) ? input.floorToFloorHeight : 3.5;
  if (positive(input.maximumHeightMeters)) {
    const floorCount = Math.max(0, Math.floor(input.maximumHeightMeters / floorToFloorHeight));
    return {
      kind: 'HEIGHT_DERIVED_LEGAL_MAXIMUM',
      floorCount,
      floorToFloorHeight,
      formula: `floor(${input.maximumHeightMeters} m ÷ ${floorToFloorHeight} m/floor)`,
      explanation: `Maximum whole floors derived from the supplied building-height limit and this scenario's floor-to-floor height.`,
      missingInputs: [],
    };
  }
  if (positive(input.maximumFAR) && positive(input.maximumCoveragePct)) {
    const floorCount = Math.max(1, Math.ceil(input.maximumFAR / (input.maximumCoveragePct / 100)));
    return {
      kind: 'FAR_COVERAGE_STUDY_ESTIMATE',
      floorCount,
      floorToFloorHeight,
      formula: `ceil(${input.maximumFAR} FAR ÷ ${input.maximumCoveragePct / 100} coverage ratio)`,
      explanation: 'Study estimate of whole floors needed to distribute the FAR allowance at the permitted maximum site coverage. It is not a statutory floor maximum.',
      missingInputs: [],
    };
  }
  const missingInputs: string[] = [];
  if (!positive(input.maximumHeightMeters)) missingInputs.push('maximum building height');
  if (!positive(input.maximumFAR)) missingInputs.push('FAR/KLB');
  if (!positive(input.maximumCoveragePct)) missingInputs.push('coverage/KDB');
  return {
    kind: 'INSUFFICIENT_INPUTS',
    floorCount: null,
    floorToFloorHeight,
    formula: 'not available',
    explanation: `No statutory floor maximum can be derived. Supply a maximum building height, or both FAR/KLB and coverage/KDB for a planning study estimate.`,
    missingInputs,
  };
}

export function getScenarioFloorToFloorHeight(scenario: DevelopmentScenario): number {
  const tallest = scenario.masses.reduce((current, mass) => (
    mass.height > current.height ? mass : current
  ), scenario.masses[0]);
  return tallest?.floorToFloorHeight || 3.5;
}

export function getScenarioFloorLimit(project: Project, scenario: DevelopmentScenario): ScenarioFloorLimit {
  return deriveScenarioFloorLimit({
    maximumHeightMeters: project.zoningLimits?.maxHeightMeters,
    maximumFAR: project.zoningLimits?.maxFAR,
    maximumCoveragePct: project.zoningLimits?.maxCoveragePct,
    floorToFloorHeight: getScenarioFloorToFloorHeight(scenario),
  });
}

export function synchronizeProjectDerivedState(project: Project): Project {
  const fallbackFrontage = positive(project.site.frontageLength)
    ? project.site.frontageLength
    : Math.max(1, Math.sqrt(project.site.grossSiteArea));
  const parcelResolution = resolveRectangularParcel({
    frontageMeters: fallbackFrontage,
    depthMeters: project.site.lotDepth,
    siteAreaM2: project.site.grossSiteArea,
    frontageSource: project.site.dimensionProvenance?.frontage.source ?? 'LEGACY_INFERRED',
    depthSource: project.site.dimensionProvenance?.depth.source ?? 'LEGACY_INFERRED',
    areaSource: project.site.dimensionProvenance?.area.source ?? 'LEGACY_INFERRED',
  });
  if (!parcelResolution.valid) return project;
  const street = deriveStreetName(
    project.location.address,
    project.site.streetNameSource === 'USER_ENTERED' ? project.site.streetName : undefined,
  );
  const site = {
    ...project.site,
    grossSiteArea: parcelResolution.siteAreaM2,
    frontageLength: parcelResolution.frontageMeters,
    lotDepth: parcelResolution.depthMeters,
    buildableArea: calculateBuildableArea(
      parcelResolution.siteAreaM2,
      project.site.setbacks,
      parcelResolution.frontageMeters,
    ),
    streetName: street.value,
    streetNameSource: street.source,
    dimensionProvenance: project.site.dimensionProvenance ?? {
      ...parcelResolution.provenance,
      calculationMethod: 'LEGACY_AREA_DIVIDED_BY_FRONTAGE' as const,
    },
  };
  const scenarios = project.scenarios.map((scenario) => {
    const metrics = calculateDevelopmentMetrics(
      site.grossSiteArea,
      scenario.masses,
      scenario.assumptionsUsed.setbacks,
      site.frontageLength,
      site.landscapedPermeableAreaM2,
    );
    const pairwiseOverlap = calculateMassPairwiseIntersections(scenario.masses);
    const floorLimit = getScenarioFloorLimit({ ...project, site }, scenario);
    const complianceReport = evaluateScenarioCompliance(
      site.grossSiteArea,
      scenario.assumptionsUsed.setbacks,
      scenario.masses,
      metrics,
      pairwiseOverlap,
      {
        scenarioName: scenario.name,
        hasZoningEvidence: Boolean(site.hasZoningEvidence),
        maxFAR: project.zoningLimits?.maxFAR,
        maxCoveragePct: project.zoningLimits?.maxCoveragePct,
        minKDHPct: project.zoningLimits?.minKDHPct,
        maxHeightMeters: project.zoningLimits?.maxHeightMeters,
        maxFloors: floorLimit.kind === 'HEIGHT_DERIVED_LEGAL_MAXIMUM'
          ? floorLimit.floorCount ?? undefined
          : undefined,
        zoningName: project.zoningLimits?.zoneName,
        frontageLength: site.frontageLength,
        kdhAreaM2: site.landscapedPermeableAreaM2,
      },
    );
    return {
      ...scenario,
      metrics,
      pairwiseOverlap,
      complianceReport,
      status: complianceReport.status as DevelopmentScenario['status'],
      warningMessage: complianceReport.primaryWarning,
      assumptionsUsed: {
        ...scenario.assumptionsUsed,
        heightFloors: metrics.totalFloors,
        heightMeters: metrics.totalHeightMeters,
        targetFAR: metrics.farKLB,
        targetCoverageKDB: metrics.siteCoveragePercentage,
      },
    };
  });
  return { ...project, site, scenarios };
}
