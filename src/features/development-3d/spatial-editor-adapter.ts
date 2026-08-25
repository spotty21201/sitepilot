/**
 * Read-only production boundary between SitePilot's canonical planning model
 * and replaceable spatial renderers.
 *
 * Canonical coordinates use x=east, y=elevation, z=north in metres. Three.js
 * consumes the same axes. COLLADA export remains independently authoritative
 * and maps those coordinates to X=x, Y=z, Z=y with Z_UP.
 */

import { getCanonicalParcelBounds } from '@/lib/geometry/engine';
import {
  createLocalProjectFrame,
  geographicToLocalFrame,
  type LocalProjectFrame,
} from '@/lib/spatial/project-frame';
import {
  DevelopmentMetrics,
  DevelopmentScenario,
  SiteGeometry,
} from '@/types';

export type SpatialEditorEngine = 'legacy' | 'spatial-console';

export interface SpatialPoint2 {
  x: number;
  z: number;
}

export interface SpatialPolygonSnapshot {
  points: readonly SpatialPoint2[];
  source: 'CANONICAL_SITE_BOUNDARY' | 'CANONICAL_PLANNING_BOUNDS_FALLBACK' | 'CANONICAL_RECTANGULAR_STUDY';
}

export interface SpatialMassSnapshot {
  id: string;
  name: string;
  type: 'PODIUM' | 'TOWER' | 'GENERAL' | 'COURTYARD';
  program: string;
  position: Readonly<{ x: number; y: number; z: number }>;
  dimensions: Readonly<{ width: number; length: number; height: number }>;
  floors: number;
  floorToFloorHeight: number;
  footprintArea: number;
  footprint: readonly SpatialPoint2[] | null;
}

export interface SpatialComplianceSnapshot {
  isCompliant: boolean;
  status: DevelopmentScenario['status'];
  label: string;
  summary: string;
  violations: readonly string[];
}

export interface SpatialConsoleSnapshot {
  schemaVersion: 1;
  caseId: string;
  scenarioId: string;
  scenarioName: string;
  revision: Readonly<NonNullable<DevelopmentScenario['canonicalRevision']>>;
  frame: Readonly<{
    id: string;
    units: 'meters';
    sourceCrs: string;
    northRotationDegrees: number;
    rendererAxes: 'X_EAST_Y_ELEVATION_Z_NORTH';
    daeAxes: 'X_EAST_Y_NORTH_Z_ELEVATION_Z_UP';
  }>;
  site: Readonly<{
    parcelBoundary: SpatialPolygonSnapshot;
    planningParcelBoundary: readonly SpatialPoint2[];
    buildableBoundary: readonly SpatialPoint2[];
    grossSiteArea: number;
    frontageMeters: number;
    depthMeters: number;
    streetName: string;
    buildableArea: number;
    setbacks: Readonly<DevelopmentScenario['assumptionsUsed']['setbacks']>;
    zoningHeightLimitMeters: number | null;
  }>;
  masses: readonly SpatialMassSnapshot[];
  metrics: Readonly<DevelopmentMetrics>;
  compliance: SpatialComplianceSnapshot;
}

export interface BuildSpatialConsoleSnapshotInput {
  caseId: string;
  site: SiteGeometry;
  scenario: DevelopmentScenario;
  complianceReport: NonNullable<DevelopmentScenario['complianceReport']>;
  zoningHeightLimitMeters?: number;
}

/**
 * `NEXT_PUBLIC_SPATIAL_EDITOR_ENGINE=legacy|spatial-console`.
 * Unset configuration promotes Spatial Console; an unrecognized explicit value
 * fails closed to the legacy renderer.
 */
export function resolveSpatialEditorEngine(value: string | undefined): SpatialEditorEngine {
  if (value === undefined || value === 'spatial-console') return 'spatial-console';
  return 'legacy';
}

function closeRing(points: readonly SpatialPoint2[]): SpatialPoint2[] {
  if (points.length === 0) return [];
  const cleaned = points
    .filter((point) => Number.isFinite(point.x) && Number.isFinite(point.z))
    .map((point) => ({ x: point.x, z: point.z }));
  if (cleaned.length < 3) return [];
  const first = cleaned[0];
  const last = cleaned[cleaned.length - 1];
  if (first.x !== last.x || first.z !== last.z) cleaned.push({ ...first });
  return cleaned;
}

function rectangleRing(minX: number, maxX: number, minZ: number, maxZ: number): SpatialPoint2[] {
  return [
    { x: minX, z: minZ },
    { x: maxX, z: minZ },
    { x: maxX, z: maxZ },
    { x: minX, z: maxZ },
    { x: minX, z: minZ },
  ];
}

interface BoundaryConversion {
  points: SpatialPoint2[];
  frame: LocalProjectFrame | null;
}

function convertBoundary(site: SiteGeometry, caseId: string): BoundaryConversion {
  const ring = site.boundary.coordinates[0] ?? [];
  if (site.coordinateSystem === 'WGS84') {
    const coordinates = ring
      .filter((coordinate) => coordinate.length >= 2 && coordinate.every(Number.isFinite))
      .map(([longitude, latitude]) => ({ longitude, latitude }));
    if (coordinates.length < 3) return { points: [], frame: null };
    const first = coordinates[0];
    const last = coordinates[coordinates.length - 1];
    if (first.longitude !== last.longitude || first.latitude !== last.latitude) {
      coordinates.push({ ...first });
    }
    const frame = createLocalProjectFrame({
      id: `boundary-${caseId}`,
      name: site.projectName ?? caseId,
      coordinates,
      metadata: {
        providerName: 'SitePilot canonical case',
        retrievalDate: 'not-recorded',
        sourceCRS: 'EPSG:4326',
        units: 'degrees',
        accuracyMeters: 0,
        authority: 'IMPORTED_SOURCE',
        attribution: 'Canonical SiteGeometry.boundary',
      },
      areaM2: site.grossSiteArea,
      perimeterMeters: 0,
    }, `frame-${caseId}`);
    return {
      frame,
      points: closeRing(coordinates.map((coordinate) => {
        const local = geographicToLocalFrame(coordinate, frame);
        return { x: local.x, z: local.y };
      })),
    };
  }

  const projected = closeRing(ring.map(([x, y]) => ({ x, z: y })));
  if (projected.length === 0) return { points: [], frame: null };
  const vertices = projected.slice(0, -1);
  const centerX = vertices.reduce((sum, point) => sum + point.x, 0) / vertices.length;
  const centerZ = vertices.reduce((sum, point) => sum + point.z, 0) / vertices.length;
  return {
    frame: null,
    points: projected.map((point) => ({ x: point.x - centerX, z: point.z - centerZ })),
  };
}

function convertFootprint(
  site: SiteGeometry,
  scenarioMass: DevelopmentScenario['masses'][number],
  frame: LocalProjectFrame | null,
): SpatialPoint2[] | null {
  const ring = scenarioMass.footprintPolygon?.coordinates[0];
  if (!ring?.length) return null;
  const sourcePoints = site.coordinateSystem === 'WGS84' && frame
    ? closeRing(ring.map(([longitude, latitude]) => {
      const local = geographicToLocalFrame({ longitude, latitude }, frame);
      return { x: local.x, z: local.y };
    }))
    : closeRing(ring.map(([x, y]) => ({ x, z: y })));
  if (sourcePoints.length === 0) return null;

  // The polygon supplies shape only. Canonical position and dimensions remain
  // authoritative, so accepted move/resize commands transform the outline too.
  const vertices = sourcePoints.slice(0, -1);
  const xs = vertices.map((point) => point.x);
  const zs = vertices.map((point) => point.z);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minZ = Math.min(...zs);
  const maxZ = Math.max(...zs);
  const sourceWidth = maxX - minX;
  const sourceLength = maxZ - minZ;
  if (sourceWidth <= Number.EPSILON || sourceLength <= Number.EPSILON) return null;
  const centerX = (minX + maxX) / 2;
  const centerZ = (minZ + maxZ) / 2;
  return sourcePoints.map((point) => ({
    x: scenarioMass.position.x
      + ((point.x - centerX) / sourceWidth) * scenarioMass.dimensions.width,
    z: scenarioMass.position.z
      + ((point.z - centerZ) / sourceLength) * scenarioMass.dimensions.length,
  }));
}

export function buildSpatialConsoleSnapshot({
  caseId,
  site,
  scenario,
  complianceReport,
  zoningHeightLimitMeters,
}: BuildSpatialConsoleSnapshotInput): SpatialConsoleSnapshot {
  if (!scenario.canonicalRevision) {
    throw new Error(`Scenario ${scenario.id} has no canonical revision.`);
  }
  if (!complianceReport) {
    throw new Error(`Scenario ${scenario.id} has no evaluated compliance report.`);
  }

  const bounds = getCanonicalParcelBounds(
    site.grossSiteArea,
    scenario.assumptionsUsed.setbacks,
    site.frontageLength || 110,
  );
  const planningParcelBoundary = rectangleRing(bounds.minX, bounds.maxX, bounds.minY, bounds.maxY);
  const buildableBoundary = rectangleRing(
    bounds.buildableMinX,
    bounds.buildableMaxX,
    bounds.buildableMinY,
    bounds.buildableMaxY,
  );
  const convertedBoundary = convertBoundary(site, caseId);
  const parcelBoundary = site.dimensionProvenance?.assumption === 'RECTANGULAR_STUDY_PARCEL'
    ? { points: planningParcelBoundary, source: 'CANONICAL_RECTANGULAR_STUDY' as const }
    : convertedBoundary.points.length > 0
      ? { points: convertedBoundary.points, source: 'CANONICAL_SITE_BOUNDARY' as const }
      : { points: planningParcelBoundary, source: 'CANONICAL_PLANNING_BOUNDS_FALLBACK' as const };
  return {
    schemaVersion: 1,
    caseId,
    scenarioId: scenario.id,
    scenarioName: scenario.name,
    revision: { ...scenario.canonicalRevision },
    frame: {
      id: convertedBoundary.frame?.id ?? `frame-${caseId}`,
      units: 'meters',
      sourceCrs: site.coordinateSystem === 'WGS84' ? 'EPSG:4326' : 'EPSG:3857',
      northRotationDegrees: convertedBoundary.frame?.rotationDegrees ?? 0,
      rendererAxes: 'X_EAST_Y_ELEVATION_Z_NORTH',
      daeAxes: 'X_EAST_Y_NORTH_Z_ELEVATION_Z_UP',
    },
    site: {
      parcelBoundary,
      planningParcelBoundary,
      buildableBoundary,
      grossSiteArea: site.grossSiteArea,
      frontageMeters: bounds.width,
      depthMeters: bounds.length,
      streetName: site.streetName || 'Street name not provided',
      buildableArea: scenario.metrics.netBuildableArea,
      setbacks: { ...scenario.assumptionsUsed.setbacks },
      zoningHeightLimitMeters: Number.isFinite(zoningHeightLimitMeters)
        ? zoningHeightLimitMeters ?? null
        : null,
    },
    masses: scenario.masses.map((mass) => ({
      id: mass.id,
      name: mass.name,
      type: mass.type,
      program: mass.program,
      position: { ...mass.position },
      dimensions: { ...mass.dimensions },
      floors: mass.floors,
      floorToFloorHeight: mass.floorToFloorHeight,
      footprintArea: mass.footprintArea,
      footprint: convertFootprint(site, mass, convertedBoundary.frame),
    })),
    metrics: { ...scenario.metrics },
    compliance: {
      isCompliant: complianceReport.isCompliant,
      status: complianceReport.status,
      label: complianceReport.statusPillLabel,
      summary: complianceReport.summaryText,
      violations: [...complianceReport.violations],
    },
  };
}
