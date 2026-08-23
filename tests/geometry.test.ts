import { describe, it, expect } from 'vitest';
import { 
  getCanonicalParcelBounds,
  checkSetbackEncroachments,
  fitMassesToBuildableEnvelope,
  calculateMassPairwiseIntersections,
  calculateGroundFootprintUnion,
  detectScenarioEditClassification,
  findNonOverlappingDuplicatePosition,
  evaluateScenarioCompliance
} from '@/lib/geometry/engine';
import { GOLDEN_PROJECT } from '@/lib/mock-data/golden-project';

describe('Canonical Geometry Engine & Spatial Containment (PRD Sec 17, 24, & 34)', () => {
  it('calculates canonical 16,850 m² parcel coordinates exactly', () => {
    const grossArea = 16850; // m²
    const setbacks = { front: 10, rear: 6, sideLeft: 5, sideRight: 5 };
    const bounds = getCanonicalParcelBounds(grossArea, setbacks, 110);

    expect(bounds.width).toBe(110);
    expect(bounds.length).toBeCloseTo(153.18, 1);
    expect(bounds.grossSiteArea).toBe(16850);
    expect(bounds.minX).toBe(-55);
    expect(bounds.maxX).toBe(55);
    expect(bounds.buildableMinX).toBe(-50);
    expect(bounds.buildableMaxX).toBe(50);
    expect(bounds.buildableWidth).toBe(100);
    expect(bounds.netBuildableArea).toBeGreaterThan(13000);
    expect(bounds.netBuildableArea).toBeLessThan(grossArea);
  });

  it('asserts ZERO intersection volume across all golden scenarios (A, B, C)', () => {
    for (const scen of GOLDEN_PROJECT.scenarios) {
      const intersection = calculateMassPairwiseIntersections(scen.masses);
      expect(intersection.hasOverlap).toBe(false);
      expect(intersection.overlapVolumeM3).toBe(0);
      expect(intersection.overlaps).toHaveLength(0);
    }
  });

  it('detects 3D pairwise collision when duplicate mass overlaps existing wing', () => {
    const scenarioB = GOLDEN_PROJECT.scenarios[1];
    const originalWestWing = scenarioB.masses[1]; // West Wing at x=-21, z=0, w=35, l=68.57, h=21, y=9

    // Overlapping clone offset by +10m in X and +10m in Z
    const overlappingClone = {
      ...originalWestWing,
      id: 'clone-overlap',
      name: 'West Wing Duplicate',
      position: { x: -11, y: 9, z: 10 }
    };

    const collisionResult = calculateMassPairwiseIntersections([...scenarioB.masses, overlappingClone]);
    expect(collisionResult.hasOverlap).toBe(true);
    expect(collisionResult.overlapVolumeM3).toBeGreaterThan(25000); // ~30,749 m³
    expect(collisionResult.overlaps[0].massA).toBe('West Residential Wing');
    expect(collisionResult.overlaps[0].massB).toBe('West Wing Duplicate');
  });

  it('calculates exact 2D analytic footprint union and detects out-of-bounds footprints', () => {
    const setbacks = { front: 10, rear: 6, sideLeft: 5, sideRight: 5 };
    const bounds = getCanonicalParcelBounds(16850, setbacks, 110);
    const scenarioB = GOLDEN_PROJECT.scenarios[1];

    // 1. Standard Scenario B footprint union (towers completely within podium)
    const union = calculateGroundFootprintUnion(scenarioB.masses, bounds);
    expect(union.totalFootprintArea).toBe(5800); // Exactly 80m x 72.5m podium
    expect(union.parcelContainedArea).toBe(5800);
    expect(union.outOfBoundsArea).toBe(0);

    // 2. Mass extended out of parcel
    const outOfBoundsMass = {
      ...scenarioB.masses[1],
      dimensions: { width: 150, length: 180, height: 21 } // extends outside 110x153.18m parcel
    };

    const outOfBoundsUnion = calculateGroundFootprintUnion([outOfBoundsMass], bounds);
    expect(outOfBoundsUnion.totalFootprintArea).toBe(27000); // 150 x 180
    expect(outOfBoundsUnion.parcelContainedArea).toBeLessThan(16850);
    expect(outOfBoundsUnion.outOfBoundsArea).toBeGreaterThan(10000);
  });

  it('calculates exact Scenario B metrics with 0 rounding errors and non-overlapping floorplates', () => {
    const scenarioB = GOLDEN_PROJECT.scenarios[1];
    const metrics = scenarioB.metrics;

    expect(metrics.grossSiteArea).toBe(16850);
    expect(metrics.buildingFootprintArea).toBe(5800); // 80m x 72.5m podium
    expect(metrics.siteCoveragePercentage).toBe(34.4); // 5800 / 16850 * 100 = 34.42%
    expect(metrics.totalGFA).toBe(40400); // (5800*2) + (2400*6) + (2400*6)
    expect(metrics.farKLB).toBe(2.4); // 40400 / 16850 = 2.3976 -> 2.40x
    expect(metrics.openSpaceArea).toBe(11050); // 16850 - 5800 = 11050
    expect(metrics.openSpacePercentage).toBe(65.6); // 11050 / 16850 = 65.578% -> 65.6%
    expect(metrics.totalFloors).toBe(8);
    expect(metrics.totalHeightMeters).toBe(30.0);
  });

  it('accurately classifies scenario edit taxonomy', () => {
    const scenarioB = GOLDEN_PROJECT.scenarios[1];

    // Base concept
    expect(detectScenarioEditClassification(scenarioB, scenarioB)).toBe('BASE_CONCEPT');

    // User Geometry Edit
    const editedScen = {
      ...scenarioB,
      masses: scenarioB.masses.map(m => m.id === 'mass-b-tower1' ? { ...m, dimensions: { ...m.dimensions, width: 38 } } : m)
    };
    expect(detectScenarioEditClassification(editedScen, scenarioB)).toBe('USER_GEOMETRY_EDIT');

    // Fitted to Setback
    const fittedScen = { ...scenarioB, isFittedOverride: true };
    expect(detectScenarioEditClassification(fittedScen, scenarioB)).toBe('FITTED_TO_SETBACK');
  });

  it('finds non-overlapping placement for duplicated masses', () => {
    const scenarioB = GOLDEN_PROJECT.scenarios[1];
    const bounds = getCanonicalParcelBounds(16850, scenarioB.assumptionsUsed.setbacks, 110);
    const westWing = scenarioB.masses[1];

    const duplicatePos = findNonOverlappingDuplicatePosition(westWing, scenarioB.masses, bounds);
    expect(duplicatePos).toBeDefined();
    expect(typeof duplicatePos.x).toBe('number');
    expect(typeof duplicatePos.z).toBe('number');
  });

  it('performs one-click exact containment fit when front setback is set to 47m', () => {
    const scenarioB = GOLDEN_PROJECT.scenarios[1];
    const restrictiveSetbacks = { front: 47, rear: 6, sideLeft: 5, sideRight: 5 };
    
    // 1. Assert pre-fit encroachment exists
    const preFitEncroachments = checkSetbackEncroachments(16850, restrictiveSetbacks, scenarioB.masses);
    expect(preFitEncroachments.length).toBeGreaterThan(0);
    expect(preFitEncroachments[0].edge).toBe('FRONT');
    expect(preFitEncroachments[0].distanceMeters).toBeGreaterThan(6.0);

    // 2. Perform One-Click Fit
    const fittedMasses = fitMassesToBuildableEnvelope(16850, restrictiveSetbacks, scenarioB.masses);

    // 3. Assert post-fit has ZERO encroachments
    const postFitEncroachments = checkSetbackEncroachments(16850, restrictiveSetbacks, fittedMasses);
    expect(postFitEncroachments).toHaveLength(0);
  });

  it('performs single authoritative compliance evaluation and never reports green when 32m cap is exceeded', () => {
    const scenarioB = GOLDEN_PROJECT.scenarios[1];
    
    // 1. Baseline Scenario B (30m height, 8 floors) -> COMPLIANT
    const baselineComp = evaluateScenarioCompliance(
      16850,
      scenarioB.assumptionsUsed.setbacks,
      scenarioB.masses,
      scenarioB.metrics
    );
    expect(baselineComp.isCompliant).toBe(true);
    expect(baselineComp.isGreen).toBe(true);
    expect(baselineComp.statusPillLabel).toBe('Zoning: Compliant · Within Envelope');

    // 2. F2F 4.0m resulting in 33.0m height -> NON-COMPLIANT
    const overheightMetrics = {
      ...scenarioB.metrics,
      totalHeightMeters: 33.0,
      totalFloors: 8
    };
    const overheightComp = evaluateScenarioCompliance(
      16850,
      scenarioB.assumptionsUsed.setbacks,
      scenarioB.masses,
      overheightMetrics
    );
    expect(overheightComp.isCompliant).toBe(false);
    expect(overheightComp.isGreen).toBe(false);
    expect(overheightComp.status).toBe('WARNING_EXCEEDS_CONSTRAINT');
    expect(overheightComp.statusPillLabel).toContain('Height Overrun: +1.0m');
    expect(overheightComp.violations[0]).toContain('exceeds Subzone R.9 32.0m cap by +1.0m');
  });

  it('derives Scenario C constraint status from the golden project zoning evidence', () => {
    const scenarioC = GOLDEN_PROJECT.scenarios[2];
    const report = evaluateScenarioCompliance(
      GOLDEN_PROJECT.site.grossSiteArea,
      scenarioC.assumptionsUsed.setbacks,
      scenarioC.masses,
      scenarioC.metrics,
      calculateMassPairwiseIntersections(scenarioC.masses),
      {
        scenarioName: scenarioC.name,
        hasZoningEvidence: GOLDEN_PROJECT.site.hasZoningEvidence,
        maxFAR: GOLDEN_PROJECT.zoningLimits?.maxFAR,
        maxCoveragePct: GOLDEN_PROJECT.zoningLimits?.maxCoveragePct,
        minKDHPct: GOLDEN_PROJECT.zoningLimits?.minKDHPct,
        maxHeightMeters: GOLDEN_PROJECT.zoningLimits?.maxHeightMeters,
        maxFloors: GOLDEN_PROJECT.zoningLimits?.maxFloors,
        zoningName: GOLDEN_PROJECT.zoningLimits?.zoneName,
        frontageLength: GOLDEN_PROJECT.site.frontageLength
      }
    );

    expect(GOLDEN_PROJECT.site.hasZoningEvidence).toBe(true);
    expect(report.isCompliant).toBe(false);
    expect(report.assessmentStatus).toBe('NON_COMPLIANT_HEIGHT');
    expect(report.statusPillLabel).toBe('Height Overrun: +11.2m (>32m cap)');
  });
});
