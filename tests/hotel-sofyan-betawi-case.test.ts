import { describe, it, expect, beforeEach } from 'vitest';
import { createCase, getCase, saveCase } from '@/lib/storage/case-repository';
import { 
  calculateDevelopmentMetrics, 
  fitMassesToBuildableEnvelope, 
  calculateMassPairwiseIntersections,
  evaluateScenarioCompliance,
  exportToColladaDAE
} from '@/lib/geometry/engine';

describe('Hotel Sofyan Betawi — Human Acceptance & Investor Workflow Integration', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('captures full brownfield hotel opportunity intake and builds 3 compliant scenarios', () => {
    // 1. Intake the Hotel Sofyan Betawi Case
    const hotelCase = createCase({
      name: 'Hotel Sofyan Betawi — Acquisition & Expansion',
      address: 'Jl. Cut Mutiah No. 9, Menteng, Central Jakarta',
      city: 'Jakarta',
      country: 'Indonesia',
      objective: 'Evaluate Rp 125.3B acquisition of 3,760 m² boutique hotel with 10,000 m² phased lifestyle expansion under KLB 6.65.',
      grossSiteArea: 2014,
      frontageLength: 40,
      
      // Existing Asset Facts
      existingGFA: 3760,
      existingFloors: 4,
      existingAssetDescription: '4-Storey Operational Heritage Sharia Boutique Hotel',
      existingAssetStatus: 'Operational',

      // Statutory Zoning Limits
      zoneCode: 'K.1',
      zoneName: 'Subzone Komersial / Perkantoran Terpadu',
      maxFAR: 6.65,
      maxCoveragePct: 55.0,
      minKDHPct: 20.0,
      maxHeightMeters: 48.0,
      maxFloors: 14,
      setbacks: { front: 8, rear: 4, sideLeft: 3, sideRight: 3 },
      hasZoningEvidence: false,

      // Commercial & Valuation
      askingPriceAmount: 125300000000,
      askingPriceCurrency: 'IDR',
      njopAmount: 95000000000,
      valuationBasisNotes: 'Rp 62.2M / m² land basis; Rp 33.3M / m² existing GFA basis'
    });

    // 2. Assert Project Root Metadata
    expect(hotelCase.id).toMatch(/^proj-\d+/);
    expect(hotelCase.name).toBe('Hotel Sofyan Betawi — Acquisition & Expansion');
    expect(hotelCase.site.grossSiteArea).toBe(2014);
    expect(hotelCase.site.frontageLength).toBe(40);
    expect(hotelCase.site.setbacks.front).toBe(8);

    // 3. Verify Existing Asset & Zoning Limits Aggregates
    expect(hotelCase.existingAsset).toBeDefined();
    expect(hotelCase.existingAsset?.gfa).toBe(3760);
    expect(hotelCase.existingAsset?.floors).toBe(4);
    expect(hotelCase.zoningLimits?.maxFAR).toBe(6.65);
    expect(hotelCase.zoningLimits?.maxCoveragePct).toBe(55.0);
    expect(hotelCase.zoningLimits?.minKDHPct).toBe(20.0);
    expect(hotelCase.zoningLimits?.maxFloors).toBe(14);
    expect(hotelCase.expansionHeadroomGFA).toBe(9633); // 13,393 - 3,760

    // 4. Verify 3 Generated Scenarios
    expect(hotelCase.scenarios).toHaveLength(3);
    const [scenA, scenB, scenC] = hotelCase.scenarios;

    // Scenario A: Existing Asset Baseline
    expect(scenA.name).toContain('Existing Asset Baseline');
    expect(scenA.metrics.totalFloors).toBe(4);
    expect(scenA.metrics.totalGFA).toBeGreaterThanOrEqual(3600);
    expect(scenA.metrics.totalGFA).toBeLessThanOrEqual(3900);
    expect(scenA.metrics.farKLB).toBeCloseTo(1.87, 1);
    expect(scenA.metrics.siteCoveragePercentage).toBeLessThanOrEqual(55.0);

    // Scenario B: Phased Expansion (Preferred)
    expect(scenB.name).toContain('Phased Expansion');
    expect(scenB.isPreferred).toBe(true);
    expect(scenB.metrics.totalFloors).toBeGreaterThanOrEqual(6);
    expect(scenB.metrics.totalGFA).toBeGreaterThan(scenA.metrics.totalGFA);
    expect(scenB.metrics.farKLB).toBeLessThanOrEqual(6.65);
    expect(scenB.metrics.siteCoveragePercentage).toBeLessThanOrEqual(55.0);

    // Scenario C: Maximum Statutory Buildout
    expect(scenC.name).toContain('Maximum Statutory Buildout');
    expect(scenC.metrics.totalFloors).toBe(14);
    expect(scenC.metrics.totalGFA).toBeGreaterThan(scenB.metrics.totalGFA);
    expect(scenC.metrics.farKLB).toBeLessThanOrEqual(6.65);
    expect(scenC.metrics.siteCoveragePercentage).toBeLessThanOrEqual(55.0);

    // 5. Assert ZERO Out-Of-Bounds Footprint and ZERO Collision Across All Scenarios
    for (const scen of hotelCase.scenarios) {
      expect(scen.metrics.outOfBoundsAreaM2 || 0).toBe(0);
      expect(scen.pairwiseOverlap?.hasOverlap).toBe(false);

      // Verify each mass vertex is strictly inside buildable bounds
      for (const mass of scen.masses) {
        const halfW = mass.dimensions.width / 2;
        const halfL = mass.dimensions.length / 2;
        const minX = mass.position.x - halfW;
        const maxX = mass.position.x + halfW;
        const minZ = mass.position.z - halfL;
        const maxZ = mass.position.z + halfL;

        // Frontage width 40m, setbacks sideLeft 3m, sideRight 3m -> buildable width 34m [-17, 17]
        expect(minX).toBeGreaterThanOrEqual(-17.01);
        expect(maxX).toBeLessThanOrEqual(17.01);

        // Site depth 50.35m, setbacks front 8m, rear 4m -> buildable depth 38.35m
        expect(maxZ - minZ).toBeLessThanOrEqual(38.35);
      }
    }

    // 6. Assert Evidence Findings Integrity (No dummy/demo choices)
    expect(hotelCase.findings.length).toBeGreaterThanOrEqual(4);
    const serialized = JSON.stringify(hotelCase);
    expect(serialized).not.toContain('16,850');
    expect(serialized).not.toContain('16850');
    expect(serialized).not.toContain('18,200');
    expect(serialized).not.toContain('18200');
    expect(serialized).not.toContain('Subzone R.9');
    expect(serialized).not.toContain('HGB No. 1842');
  });

  it('generates a valid COLLADA DAE export file for Hotel Sofyan Betawi Scenario B', () => {
    const hotelCase = createCase({
      name: 'Hotel Sofyan Betawi — Acquisition & Expansion',
      address: 'Jl. Cut Mutiah No. 9',
      grossSiteArea: 2014,
      frontageLength: 40,
      existingGFA: 3760,
      existingFloors: 4,
      maxFAR: 6.65,
      setbacks: { front: 8, rear: 4, sideLeft: 3, sideRight: 3 }
    });

    const scenB = hotelCase.scenarios[1];
    const daeXml = exportToColladaDAE(
      hotelCase.site,
      scenB.masses,
      'Hotel_Sofyan_Betawi_Scenario_B',
      scenB.assumptionsUsed.setbacks
    );

    expect(daeXml).toContain('<?xml version="1.0" encoding="utf-8"?>');
    expect(daeXml).toContain('<COLLADA');
    expect(daeXml).toContain('Hotel_Sofyan_Betawi_Scenario_B');
    expect(daeXml).toContain('</COLLADA>');

    // Check that masses are encoded in the mesh
    expect(daeXml).toContain('<library_geometries>');
    expect(daeXml).toContain('<library_visual_scenes>');
    expect(scenB.masses.length).toBeGreaterThanOrEqual(2);
  });
});
