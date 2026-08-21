import { describe, expect, it } from 'vitest';
import { checkConstraintViolations, exportToColladaDAE } from '@/lib/geometry/engine';
import { GOLDEN_PROJECT } from '@/lib/mock-data/golden-project';

const ZONING_LIMITS = {
  maxHeightFloors: 8,
  maxFAR: 3.2,
  maxCoveragePct: 55,
};

describe('SitePilot complete user journey', () => {
  it('moves from Capture through Understand, Investigate, Explore, Decide and Export', () => {
    // Capture: the initial site package contains usable, processed source material.
    expect(GOLDEN_PROJECT.status).toBe('ACTIVE');
    expect(GOLDEN_PROJECT.location.city).toBe('Jakarta');
    expect(GOLDEN_PROJECT.sources).toHaveLength(4);
    expect(GOLDEN_PROJECT.sources.every((source) => source.status === 'PROCESSED')).toBe(true);
    expect(GOLDEN_PROJECT.site.grossSiteArea).toBe(16850);
    expect(GOLDEN_PROJECT.site.coordinateSystem).toBe('WGS84');

    // Understand: extracted evidence preserves the broker/certificate conflict,
    // while verified title and zoning facts are available for downstream analysis.
    const areaFindings = GOLDEN_PROJECT.findings.filter(
      (finding) => finding.extractedValue?.key === 'gross_site_area',
    );
    expect(areaFindings.map((finding) => finding.extractedValue?.numericValue)).toEqual([
      18200,
      16850,
    ]);
    expect(areaFindings.map((finding) => finding.classification)).toEqual(['CLAIM', 'FACT']);
    expect(
      GOLDEN_PROJECT.findings.some(
        (finding) =>
          finding.extractedValue?.key === 'max_height_floors' &&
          finding.extractedValue.numericValue === 8 &&
          finding.classification === 'FACT',
      ),
    ).toBe(true);
    expect(
      GOLDEN_PROJECT.findings.some(
        (finding) =>
          finding.extractedValue?.key === 'max_far' &&
          finding.extractedValue.numericValue === 3.2 &&
          finding.classification === 'FACT',
      ),
    ).toBe(true);

    // Investigate: the material contradiction is resolved to the certified area,
    // but the access issue and follow-up actions remain visible.
    const areaContradiction = GOLDEN_PROJECT.contradictions.find(
      (contradiction) => contradiction.topic === 'gross_site_area',
    );
    expect(areaContradiction).toMatchObject({
      severity: 'CRITICAL',
      resolved: true,
      workingValueSelected: 16850,
    });
    expect(GOLDEN_PROJECT.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'iss-001', status: 'OPEN', severity: 'CRITICAL' }),
        expect.objectContaining({ id: 'iss-002', status: 'INVESTIGATING' }),
      ]),
    );
    expect(GOLDEN_PROJECT.actions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'act-001', status: 'IN_PROGRESS' }),
        expect.objectContaining({ id: 'act-002', status: 'PENDING' }),
      ]),
    );

    // Explore: all three scenarios are available, with B preferred and C clearly
    // separated as a speculative option that violates confirmed zoning.
    expect(GOLDEN_PROJECT.scenarios.map((scenario) => scenario.id)).toEqual([
      'scen-001',
      'scen-002',
      'scen-003',
    ]);
    const [scenarioA, scenarioB, scenarioC] = GOLDEN_PROJECT.scenarios;
    expect(scenarioA.name).toContain('Scenario A');
    expect(scenarioB).toMatchObject({
      name: 'Scenario B: Mid-Rise Mixed-Use (Preferred)',
      isPreferred: true,
      status: 'VALID',
    });
    expect(scenarioC).toMatchObject({
      name: 'Scenario C: Speculative High-Density (12 Storeys)',
      isPreferred: false,
      status: 'WARNING_EXCEEDS_CONSTRAINT',
    });
    expect(checkConstraintViolations(scenarioA.metrics, ZONING_LIMITS).hasViolations).toBe(false);
    expect(checkConstraintViolations(scenarioB.metrics, ZONING_LIMITS).hasViolations).toBe(false);
    expect(checkConstraintViolations(scenarioC.metrics, ZONING_LIMITS)).toMatchObject({
      hasViolations: true,
      warnings: expect.arrayContaining([
        'Massing height (43.2m / 12 floors) exceeds maximum allowable height (32.0m / 8 floors) by +11.2m.',
      ]),
    });
    expect(scenarioB.metrics.totalGFA).toBe(40400);
    expect(scenarioC.metrics.totalGFA).toBeGreaterThan(scenarioB.metrics.totalGFA);

    // Decide readiness: the recommendation reflects a promising but not fully
    // de-risked site, and points the user to a concrete next move.
    expect(GOLDEN_PROJECT).toMatchObject({
      recommendation: 'CONDITIONAL_PROCEED',
      siteReadinessPercentage: 68,
      evidenceConfidence: 'MEDIUM',
    });
    expect(GOLDEN_PROJECT.siteReadinessPercentage).toBeGreaterThan(0);
    expect(GOLDEN_PROJECT.siteReadinessPercentage).toBeLessThan(100);
    expect(GOLDEN_PROJECT.executiveSummary.criticalUnknowns.length).toBeGreaterThan(0);
    expect(GOLDEN_PROJECT.executiveSummary.recommendedNextMove).toContain('boundary survey');

    // Export: the selected, decision-ready scenario can be handed to SketchUp as
    // a meter-scaled COLLADA scene containing distinct site, setback, access and massing groups.
    const dae = exportToColladaDAE(GOLDEN_PROJECT.site, scenarioB.masses, scenarioB.name, scenarioB.assumptionsUsed.setbacks);
    expect(dae).toMatch(/^<\?xml version="1\.0" encoding="utf-8"\?>[\s\S]*<COLLADA[\s\S]*<\/COLLADA>$/);
    expect(dae).toContain('<unit name="meter" meter="1.0"/>');
    expect(dae).toContain('<up_axis>Z_UP</up_axis>');
    expect(dae).toContain('Scenario: Scenario B: Mid-Rise Mixed-Use (Preferred)');
    expect(dae).toContain('name="SITE_BOUNDARY"');
    expect(dae).toContain('name="BUILDABLE_AREA"');
    expect(dae).toContain('name="ACCESS_JL_TEUKU_UMAR"');
    expect(dae.match(/<geometry\s/g)).toHaveLength(scenarioB.masses.length + 4);
    for (const mass of scenarioB.masses) {
      expect(dae).toContain(mass.name.toUpperCase().replace(/[^A-Z0-9_]/g, '_'));
    }
  });
});
