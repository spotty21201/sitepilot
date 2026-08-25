import { describe, expect, it } from 'vitest';

import {
  buildSpatialConsoleSnapshot,
  resolveSpatialEditorEngine,
} from '@/features/development-3d/spatial-editor-adapter';
import { evaluateScenarioCompliance } from '@/lib/geometry/engine';
import { GOLDEN_PROJECT } from '@/lib/mock-data/golden-project';
import { ensureCanonicalProjectRevisions } from '@/lib/spatial/canonical-command-service';
import type { Project } from '@/types';
import { deriveStudyEnvelopeDescriptor } from '@/features/development-3d/spatial-console/SpatialConsoleScene';

function canonicalProject(): Project {
  return ensureCanonicalProjectRevisions(structuredClone(GOLDEN_PROJECT));
}

function complianceFor(project: Project, scenario: Project['scenarios'][number]) {
  return scenario.complianceReport ?? evaluateScenarioCompliance(
    project.site.grossSiteArea,
    scenario.assumptionsUsed.setbacks,
    scenario.masses,
    scenario.metrics,
    scenario.pairwiseOverlap,
  );
}

describe('read-only Spatial Console adapter', () => {
  it('defaults unset configuration to Spatial Console and fails invalid values closed to legacy', () => {
    expect(resolveSpatialEditorEngine(undefined)).toBe('spatial-console');
    expect(resolveSpatialEditorEngine('legacy')).toBe('legacy');
    expect(resolveSpatialEditorEngine('SPATIAL-CONSOLE')).toBe('legacy');
    expect(resolveSpatialEditorEngine('')).toBe('legacy');
    expect(resolveSpatialEditorEngine('spatial-console')).toBe('spatial-console');
  });

  it('projects case, scenario, revision, metrics, compliance, and stable mass identity', () => {
    const project = canonicalProject();
    const scenario = project.scenarios[1];
    const snapshot = buildSpatialConsoleSnapshot({
      caseId: project.id,
      site: project.site,
      scenario,
      complianceReport: complianceFor(project, scenario),
      zoningHeightLimitMeters: project.zoningLimits?.maxHeightMeters,
    });

    expect(snapshot.caseId).toBe(project.id);
    expect(snapshot.scenarioId).toBe(scenario.id);
    expect(snapshot.revision).toEqual(scenario.canonicalRevision);
    expect(snapshot.metrics).toEqual(scenario.metrics);
    expect(snapshot.compliance.isCompliant).toBe(scenario.complianceReport?.isCompliant ?? true);
    expect(snapshot.masses.map((mass) => mass.id)).toEqual(scenario.masses.map((mass) => mass.id));
    expect(snapshot.frame.units).toBe('meters');
    expect(snapshot.frame.rendererAxes).toBe('X_EAST_Y_ELEVATION_Z_NORTH');
    expect(snapshot.frame.daeAxes).toBe('X_EAST_Y_NORTH_Z_ELEVATION_Z_UP');
  });

  it('does not mutate canonical input objects', () => {
    const project = canonicalProject();
    const before = structuredClone(project);
    buildSpatialConsoleSnapshot({
      caseId: project.id,
      site: project.site,
      scenario: project.scenarios[1],
      complianceReport: complianceFor(project, project.scenarios[1]),
    });
    expect(project).toEqual(before);
  });

  it('projects the canonical rectangular study parcel with the supplied frontage and depth', () => {
    const project = canonicalProject();
    const snapshot = buildSpatialConsoleSnapshot({
      caseId: project.id,
      site: project.site,
      scenario: project.scenarios[1],
      complianceReport: complianceFor(project, project.scenarios[1]),
    });
    const ring = snapshot.site.parcelBoundary.points;

    expect(snapshot.site.parcelBoundary.source).toBe('CANONICAL_RECTANGULAR_STUDY');
    expect(ring).toHaveLength(5);
    expect(ring[0]).toEqual(ring.at(-1));
    expect(new Set(ring.slice(0, -1).map((point) => point.x))).toHaveLength(2);
    expect(new Set(ring.slice(0, -1).map((point) => point.z))).toHaveLength(2);
    expect(Math.max(...ring.map((point) => point.x)) - Math.min(...ring.map((point) => point.x))).toBe(project.site.frontageLength);
    expect(Math.max(...ring.map((point) => point.z)) - Math.min(...ring.map((point) => point.z))).toBeCloseTo(project.site.lotDepth!, 2);
  });

  it('preserves non-rectangular EPSG:3857 mass footprints and canonical vertical position', () => {
    const project = canonicalProject();
    project.site.coordinateSystem = 'EPSG:3857';
    project.site.boundary.coordinates = [[
      [1000, 2000], [1110, 2000], [1110, 2153], [1000, 2153], [1000, 2000],
    ]];
    const scenario = project.scenarios[1];
    scenario.masses[0].position = { x: 7, y: 4, z: -9 };
    scenario.masses[0].footprintPolygon = {
      type: 'Polygon',
      coordinates: [[
        [1020, 2020], [1040, 2015], [1055, 2030], [1040, 2050], [1018, 2042], [1020, 2020],
      ]],
    };

    const snapshot = buildSpatialConsoleSnapshot({
      caseId: project.id,
      site: project.site,
      scenario,
      complianceReport: complianceFor(project, scenario),
    });
    const mass = snapshot.masses[0];
    expect(mass.footprint).toHaveLength(6);
    expect(new Set(mass.footprint!.slice(0, -1).map((point) => `${point.x}:${point.z}`))).toHaveLength(5);
    expect(mass.position).toEqual({ x: 7, y: 4, z: -9 });
    expect(mass.footprint![0]).toEqual(mass.footprint!.at(-1));
    expect(Math.min(...mass.footprint!.map((point) => point.x))).toBeCloseTo(7 - mass.dimensions.width / 2);
    expect(Math.max(...mass.footprint!.map((point) => point.x))).toBeCloseTo(7 + mass.dimensions.width / 2);
    expect(Math.min(...mass.footprint!.map((point) => point.z))).toBeCloseTo(-9 - mass.dimensions.length / 2);
    expect(Math.max(...mass.footprint!.map((point) => point.z))).toBeCloseTo(-9 + mass.dimensions.length / 2);
  });

  it('moves and resizes a non-rectangular WGS84 outline from canonical position and dimensions', () => {
    const project = canonicalProject();
    const scenario = project.scenarios[1];
    const mass = scenario.masses[0];
    mass.position = { x: 14, y: 3, z: -12 };
    mass.dimensions = { ...mass.dimensions, width: 54, length: 38 };
    mass.footprintPolygon = {
      type: 'Polygon',
      coordinates: [[
        [106.8308, -6.1950], [106.8313, -6.1949], [106.8316, -6.1952],
        [106.83135, -6.19555], [106.83075, -6.1954], [106.8308, -6.1950],
      ]],
    };

    const first = buildSpatialConsoleSnapshot({
      caseId: project.id,
      site: project.site,
      scenario,
      complianceReport: complianceFor(project, scenario),
    }).masses[0];
    const firstShape = first.footprint!.map((point) => ({
      x: (point.x - first.position.x) / first.dimensions.width,
      z: (point.z - first.position.z) / first.dimensions.length,
    }));

    mass.position = { x: -22, y: 3, z: 31 };
    mass.dimensions = { ...mass.dimensions, width: 72, length: 44 };
    const moved = buildSpatialConsoleSnapshot({
      caseId: project.id,
      site: project.site,
      scenario,
      complianceReport: complianceFor(project, scenario),
    }).masses[0];

    expect(Math.min(...moved.footprint!.map((point) => point.x))).toBeCloseTo(-58);
    expect(Math.max(...moved.footprint!.map((point) => point.x))).toBeCloseTo(14);
    expect(Math.min(...moved.footprint!.map((point) => point.z))).toBeCloseTo(9);
    expect(Math.max(...moved.footprint!.map((point) => point.z))).toBeCloseTo(53);
    const movedShape = moved.footprint!.map((point) => ({
      x: (point.x - moved.position.x) / moved.dimensions.width,
      z: (point.z - moved.position.z) / moved.dimensions.length,
    }));
    movedShape.forEach((point, index) => {
      expect(point.x).toBeCloseTo(firstShape[index].x);
      expect(point.z).toBeCloseTo(firstShape[index].z);
    });
  });

  it('uses the same evaluated compliance report as the production workspace', () => {
    const project = canonicalProject();
    const scenario = project.scenarios[1];
    const report = {
      ...complianceFor(project, scenario),
      isCompliant: false,
      status: 'WARNING_EXCEEDS_CONSTRAINT' as const,
    };
    scenario.status = 'VALID';
    const snapshot = buildSpatialConsoleSnapshot({
      caseId: project.id,
      site: project.site,
      scenario,
      complianceReport: report,
    });
    expect(snapshot.compliance.isCompliant).toBe(false);
    expect(snapshot.compliance.status).toBe('WARNING_EXCEEDS_CONSTRAINT');
  });

  it('uses the adapted buildable boundary and supplied height for the study envelope', () => {
    const project = canonicalProject();
    const scenario = project.scenarios[1];
    const snapshot = buildSpatialConsoleSnapshot({
      caseId: project.id,
      site: project.site,
      scenario,
      complianceReport: complianceFor(project, scenario),
      zoningHeightLimitMeters: 37,
    });
    const descriptor = deriveStudyEnvelopeDescriptor(snapshot.site);
    expect(descriptor.kind).toBe('VOLUME');
    expect(descriptor.heightMeters).toBe(37);
    expect(descriptor.boundary).toEqual(snapshot.site.buildableBoundary);
    expect(descriptor.boundary).not.toBe(snapshot.site.buildableBoundary);
  });

  it('shows only the buildable footprint when no maximum height is supplied', () => {
    const project = canonicalProject();
    const scenario = project.scenarios[0];
    const snapshot = buildSpatialConsoleSnapshot({
      caseId: project.id,
      site: project.site,
      scenario,
      complianceReport: complianceFor(project, scenario),
    });
    const descriptor = deriveStudyEnvelopeDescriptor(snapshot.site);
    expect(descriptor.kind).toBe('FOOTPRINT_ONLY');
    expect(descriptor.heightMeters).toBeNull();
    expect(descriptor.boundary).toEqual(snapshot.site.buildableBoundary);
  });

  it('rejects a scenario that has not entered the canonical revision system', () => {
    expect(() => buildSpatialConsoleSnapshot({
      caseId: GOLDEN_PROJECT.id,
      site: GOLDEN_PROJECT.site,
      scenario: GOLDEN_PROJECT.scenarios[0],
      complianceReport: complianceFor(GOLDEN_PROJECT, GOLDEN_PROJECT.scenarios[0]),
    })).toThrow('has no canonical revision');
  });
});
