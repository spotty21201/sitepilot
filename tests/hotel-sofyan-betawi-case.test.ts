import { describe, it, expect, beforeEach } from 'vitest';
import { createCase } from '@/lib/storage/case-repository';
import { 
  exportToColladaDAE,
  getCanonicalParcelBounds
} from '@/lib/geometry/engine';

describe('Hotel Sofyan Betawi — Human Acceptance & Investor Workflow Integration', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('captures full brownfield hotel opportunity intake with unknown floors/heights and builds 3 compliant scenarios', () => {
    // 1. Intake the Hotel Sofyan Betawi Case with exact required parameters
    // Note: existingFloors, statutoryMaxFloors, statutoryMaxHeightMeters are unsupplied (unknown)
    const hotelCase = createCase({
      name: 'Hotel Sofyan Betawi — Acquisition & Expansion',
      address: 'Jl. Cut Mutia No. 9, Menteng, Central Jakarta, Indonesia',
      city: 'Jakarta',
      country: 'Indonesia',
      objective: 'Evaluate Rp 125.29B acquisition of 3,760 m² boutique hotel with phased lifestyle expansion under KLB 6.65.',
      grossSiteArea: 2014,
      frontageLength: 40,
      
      // Existing Asset Facts (Existing storeys is unknown)
      existingGFA: 3760,
      existingAssetDescription: 'Operational Sharia Boutique Hotel',
      existingAssetStatus: 'Operational',

      // Statutory Zoning Limits
      zoneCode: 'KT + K-1',
      zoneName: 'Commercial / Hospitality',
      maxFAR: 6.65,
      maxCoveragePct: 55.0,
      minKDHPct: 20.0,
      hasZoningEvidence: false,

      // Commercial & Valuation
      askingPriceAmount: 125290000000,
      askingPriceCurrency: 'IDR',
      njopAmount: 104405760000,
      valuationBasisNotes: 'Target acquisition price equates to ~Rp 62.21M/m² land basis; NJOP benchmark Rp 51.84M/m²'
    });

    // 2. Assert Project Root Metadata & Unknown Handling
    expect(hotelCase.id).toMatch(/^proj-\d+/);
    expect(hotelCase.name).toBe('Hotel Sofyan Betawi — Acquisition & Expansion');
    expect(hotelCase.site.grossSiteArea).toBe(2014);
    expect(hotelCase.site.frontageLength).toBe(40);
    
    // Existing storeys is unknown: must not be represented as a confirmed fact
    expect(hotelCase.existingAsset).toBeDefined();
    expect(hotelCase.existingAsset?.gfa).toBe(3760);
    expect(hotelCase.existingAsset?.floors).toBeUndefined();
    expect(hotelCase.existingAsset?.isFloorsAssumed).toBe(true);

    // Valuation precision
    expect(hotelCase.askingPrice?.amount).toBe(125290000000);
    expect(hotelCase.askingPrice?.pricePerM2).toBe(62209533); // ~Rp 62.21M/m² (125,290,000,000 / 2,014)
    expect(hotelCase.valuation?.njopAmount).toBe(104405760000);

    // Planning Limits
    expect(hotelCase.zoningLimits?.maxFAR).toBe(6.65);
    expect(hotelCase.zoningLimits?.maxCoveragePct).toBe(55.0);
    expect(hotelCase.zoningLimits?.minKDHPct).toBe(20.0);
    expect(hotelCase.expansionHeadroomGFA).toBe(9633); // 13,393 - 3,760

    // 3. Assert Provenance Accuracy (No invented authoritative record sources)
    for (const finding of hotelCase.findings) {
      expect(finding.sourceName).not.toContain('Asset Inventory Records');
      expect(finding.sourceName).not.toContain('Tax Assessment Notice');
      expect(finding.sourceName).toMatch(/Opportunity Intake|Planning Guideline/);
      expect(finding.classification).toMatch(/CLAIM|ASSUMPTION/);
      expect(finding.confidence).toMatch(/LOW|UNVERIFIED/);
    }

    // 4. Assert Canonical Parcel Bounds (40m frontage -> 50.35m depth)
    const bounds = getCanonicalParcelBounds(2014, hotelCase.site.setbacks, 40);
    expect(bounds.width).toBe(40);
    expect(bounds.length).toBeCloseTo(50.35, 1);
    expect(bounds.buildableWidth).toBe(32); // 40 - (4 + 4)
    expect(bounds.buildableLength).toBeCloseTo(37.35, 1); // 50.35 - (8 + 5)

    // 5. Verify 3 Generated Scenarios (A, B, C)
    expect(hotelCase.scenarios).toHaveLength(3);
    const [scenA, scenB, scenC] = hotelCase.scenarios;

    // Scenario A: Existing Asset Baseline
    expect(scenA.name).toContain('Scenario A: Existing Asset Baseline');
    expect(scenA.description).toContain('3,760 m²');
    expect(scenA.metrics.totalGFA).toBeGreaterThanOrEqual(3750);
    expect(scenA.metrics.totalGFA).toBeLessThanOrEqual(3770);
    expect(scenA.metrics.farKLB).toBeCloseTo(1.87, 2);
    expect(scenA.metrics.siteCoveragePercentage).toBeLessThanOrEqual(55.0);
    expect(scenA.complianceReport?.isCompliant).toBe(true);
    expect(scenA.complianceReport?.statusPillLabel).toContain('Within Envelope');

    // Scenario B: Phased Expansion (Preferred)
    expect(scenB.name).toContain('Scenario B: Phased Expansion');
    expect(scenB.isPreferred).toBe(true);
    expect(scenB.metrics.totalGFA).toBeGreaterThan(scenA.metrics.totalGFA);
    expect(scenB.metrics.farKLB).toBeLessThanOrEqual(6.65);
    expect(scenB.metrics.siteCoveragePercentage).toBeLessThanOrEqual(55.0);
    expect(scenB.masses.length).toBe(2);
    expect(scenB.complianceReport?.isCompliant).toBe(true);

    // Scenario C is explicitly a study because the entered planning values are not verified evidence.
    expect(scenC.name).toContain('Scenario C: Planning Study Buildout');
    expect(scenC.description).toContain('Non-legal planning study');
    expect(scenC.metrics.totalGFA).toBeGreaterThan(scenB.metrics.totalGFA);
    expect(scenC.metrics.farKLB).toBeLessThanOrEqual(6.65);
    expect(scenC.metrics.siteCoveragePercentage).toBeLessThanOrEqual(55.0);
    expect(scenC.complianceReport?.isCompliant).toBe(true);

    // 6. Strict Geometry Assertions Across All Scenarios
    for (const scen of hotelCase.scenarios) {
      // Zero out-of-bounds footprint
      expect(scen.metrics.outOfBoundsAreaM2 || 0).toBe(0);
      // Zero mass collisions
      expect(scen.pairwiseOverlap?.hasOverlap).toBe(false);
      expect(scen.pairwiseOverlap?.overlapVolumeM3 || 0).toBe(0);

      // Verify each mass sits strictly inside the buildable envelope
      for (const mass of scen.masses) {
        const halfW = mass.dimensions.width / 2;
        const halfL = mass.dimensions.length / 2;
        const minX = mass.position.x - halfW;
        const maxX = mass.position.x + halfW;
        const minZ = mass.position.z - halfL;
        const maxZ = mass.position.z + halfL;

        expect(minX).toBeGreaterThanOrEqual(bounds.buildableMinX - 0.05);
        expect(maxX).toBeLessThanOrEqual(bounds.buildableMaxX + 0.05);
        expect(minZ).toBeGreaterThanOrEqual(bounds.buildableMinY - 0.05);
        expect(maxZ).toBeLessThanOrEqual(bounds.buildableMaxY + 0.05);
      }
    }

    // 7. Leakage Protection Assertions
    const serialized = JSON.stringify(hotelCase);
    expect(serialized).not.toContain('Menteng Heritage Quarter');
    expect(serialized).not.toContain('Teuku Umar');
    expect(serialized).not.toContain('16,850');
    expect(serialized).not.toContain('16850');
    expect(serialized).not.toContain('Rp 450B');
  });

  it('generates a valid, parseable COLLADA DAE export file for Hotel Sofyan Betawi Scenario B', () => {
    const hotelCase = createCase({
      name: 'Hotel Sofyan Betawi — Acquisition & Expansion',
      address: 'Jl. Cut Mutia No. 9',
      grossSiteArea: 2014,
      frontageLength: 40,
      existingGFA: 3760,
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
    expect(daeXml).toContain('<COLLADA xmlns="http://www.collada.org/2005/11/COLLADASchema" version="1.4.1">');
    expect(daeXml).toContain('Hotel_Sofyan_Betawi_Scenario_B');
    expect(daeXml).toContain('<unit name="meter" meter="1.0"/>');
    expect(daeXml).toContain('<library_geometries>');
    expect(daeXml).toContain('<library_visual_scenes>');
    expect(daeXml).toContain('</COLLADA>');

    // Structural node assertions
    const geometryMatches = daeXml.match(/<geometry /g) || [];
    const meshMatches = daeXml.match(/<mesh>/g) || [];
    const nodeMatches = daeXml.match(/<node /g) || [];
    expect(geometryMatches.length).toBeGreaterThanOrEqual(2);
    expect(meshMatches.length).toBeGreaterThanOrEqual(2);
    expect(nodeMatches.length).toBeGreaterThanOrEqual(2);

    // Leakage check
    expect(daeXml).not.toContain('Teuku Umar');
    expect(daeXml).not.toContain('Menteng Heritage Quarter');
  });
});
