import { describe, it, expect, beforeEach } from 'vitest';
import { createCase } from '@/lib/storage/case-repository';
import { 
  evaluateScenarioCompliance, 
  exportToColladaDAE, 
  calculateDevelopmentMetrics
} from '@/lib/geometry/engine';
import { adaptSitePilotToPascalScene } from '@/features/development-3d/adapter';
import { SITEPILOT_PASCAL_NODE_DEFINITIONS } from '@/features/development-3d/pascal-plugin';
import { SiteGeometry, DevelopmentScenario } from '@/types';

const FORBIDDEN_GOLDEN_STRINGS = [
  'Menteng Heritage Quarter',
  'Jl. Teuku Umar',
  'Teuku Umar',
  'Subzone R.9',
  'HGB No. 1842',
  '16,850',
  '16850'
];

describe('Golden Project Zero-Leakage & Provenance Decoupling Suite', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('creates a fresh synthetic case with ZERO Golden Project literals across all surfaces', () => {
    const syntheticCase = createCase({
      name: 'Surabaya CBD Logistics Center',
      address: 'Jl. Pemuda No. 88, Surabaya, East Java',
      city: 'Surabaya',
      country: 'Indonesia',
      objective: 'Evaluate 9,200 m² parcel for logistics and commercial headquarters.',
      askingPriceAmount: 180000000000,
      askingPriceCurrency: 'IDR',
      grossSiteArea: 9200,
      frontageLength: 95
    });

    const serializedCase = JSON.stringify(syntheticCase);

    // Assert that no forbidden Golden Project literals appear in the fresh case JSON
    for (const forbidden of FORBIDDEN_GOLDEN_STRINGS) {
      expect(serializedCase).not.toContain(forbidden);
    }

    // Verify canonical site metrics match user input
    expect(syntheticCase.site.grossSiteArea).toBe(9200);
    expect(syntheticCase.site.frontageLength).toBe(95);
    expect(syntheticCase.location.address).toBe('Jl. Pemuda No. 88, Surabaya, East Java');
    expect(syntheticCase.location.city).toBe('Surabaya');
  });

  it('PRD AC-01: Creates a functioning case workspace with minimal fields (area defaulted)', () => {
    const minimalCase = createCase({
      name: 'Bandung Creative Quarter',
      address: 'Jl. Ir. H. Juanda No. 12',
      objective: 'Mixed-use residential and retail hub.'
    });

    expect(minimalCase.id).toMatch(/^proj-\d+/);
    expect(minimalCase.name).toBe('Bandung Creative Quarter');
    expect(minimalCase.site.grossSiteArea).toBe(10000); // Defaults cleanly to 10,000 m²
    expect(minimalCase.scenarios).toHaveLength(2);
    expect(minimalCase.scenarios[0].metrics.grossSiteArea).toBe(10000);
    expect(minimalCase.scenarios[1].metrics.grossSiteArea).toBe(10000);

    const serialized = JSON.stringify(minimalCase);
    for (const forbidden of FORBIDDEN_GOLDEN_STRINGS) {
      expect(serialized).not.toContain(forbidden);
    }
  });

  it('marks fresh cases as PROVISIONAL and UNKNOWN zoning compliance when evidence is absent', () => {
    const testCase = createCase({
      name: 'Medan North Gateway',
      address: 'Jl. Gatot Subroto No. 45, Medan',
      grossSiteArea: 14000
    });

    const scenarioA = testCase.scenarios[0];
    const reportA = scenarioA.complianceReport;

    expect(reportA).toBeDefined();
    // Invariant: Without official zoning certificate, status pill must indicate provisional study
    expect(reportA?.statusPillLabel).toContain('Provisional Study');
    expect(reportA?.statusPillLabel).not.toContain('Subzone R.9');

    // Invariant: Decision text must be honest about unverified statutory compliance
    expect(reportA?.decisionText).toContain('Provisional Study');
    expect(reportA?.decisionText).toContain('Statutory municipal zoning compliance is UNKNOWN');
    expect(reportA?.decisionText).not.toContain('Fully conforms to Subzone R.9');

    // Invariant: Recommended action must advise obtaining official RDTR/KRK
    expect(reportA?.recommendedAction).toContain('Obtain official municipal planning certificate (RDTR / KRK)');

    // Invariant: Risks must flag unverified parameters
    expect(reportA?.identifiedRisks?.some((r: string) => r.includes('Municipal zoning parameters unverified'))).toBe(true);
  });

  it('exports clean COLLADA (.dae) files without hardcoded Golden Project nodes', () => {
    const syntheticSite: SiteGeometry = {
      boundary: { type: 'Polygon', coordinates: [[[0,0], [80,0], [80,106.25], [0,106.25], [0,0]]] },
      grossSiteArea: 8500,
      buildableArea: 6800,
      coordinateSystem: 'WGS84',
      frontageLength: 80,
      address: 'Jl. Asia Afrika No. 100, Bandung',
      setbacks: { front: 10, rear: 6, sideLeft: 5, sideRight: 5 }
    };

    const masses = [
      {
        id: 'mass-test-1',
        name: 'Block A',
        type: 'GENERAL' as const,
        footprintArea: 3000,
        floors: 6,
        floorToFloorHeight: 3.5,
        height: 21.0,
        gfa: 18000,
        program: 'COMMERCIAL' as const,
        position: { x: 0, y: 0, z: 0 },
        dimensions: { width: 50, length: 60, height: 21.0 }
      }
    ];

    const daeXml = exportToColladaDAE(
      syntheticSite,
      masses,
      'Bandung_Block_A',
      syntheticSite.setbacks
    );

    // Verify DAE is valid XML and contains no Golden Project literals
    expect(daeXml).toContain('<?xml version="1.0" encoding="utf-8"?>');
    expect(daeXml).toContain('<COLLADA xmlns="http://www.collada.org/2005/11/COLLADASchema" version="1.4.1">');
    expect(daeXml).toContain('BUILDING_MASS_BLOCK_A');

    // Verify no Teuku Umar or Menteng strings
    for (const forbidden of FORBIDDEN_GOLDEN_STRINGS) {
      expect(daeXml).not.toContain(forbidden);
    }

    // Verify node uses dynamic street address
    expect(daeXml).toContain('ACCESS_JL__ASIA_AFRIKA_NO__100');
  });

  it('adapts clean scene graph nodes into Pascal format without hardcoded Menteng descriptions', () => {
    const syntheticSite: SiteGeometry = {
      boundary: { type: 'Polygon', coordinates: [[[0,0], [90,0], [90,122.2], [0,122.2], [0,0]]] },
      grossSiteArea: 11000,
      buildableArea: 8800,
      coordinateSystem: 'WGS84',
      frontageLength: 90,
      accessRoadWidth: 8.0,
      setbacks: { front: 8, rear: 5, sideLeft: 4, sideRight: 4 }
    };

    const scenario: DevelopmentScenario = {
      id: 'scen-test',
      projectId: 'proj-test',
      name: 'Test Scenario',
      description: 'Test',
      isPreferred: true,
      status: 'VALID' as const,
      editClassification: 'BASE_CONCEPT' as const,
      assumptionsUsed: {
        heightFloors: 4,
        heightMeters: 14.0,
        targetFAR: 2.0,
        targetCoverageKDB: 50.0,
        setbacks: syntheticSite.setbacks,
        unverifiedAssumptionsCount: 0
      },
      masses: [
        {
          id: 'mass-1',
          name: 'Main Block',
          type: 'GENERAL' as const,
          footprintArea: 4000,
          floors: 4,
          floorToFloorHeight: 3.5,
          height: 14.0,
          gfa: 16000,
          program: 'COMMERCIAL' as const,
          position: { x: 0, y: 0, z: 0 },
          dimensions: { width: 50, length: 80, height: 14.0 }
        }
      ],
      metrics: calculateDevelopmentMetrics(11000, [], syntheticSite.setbacks),
      risks: [],
      opportunities: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const scene = adaptSitePilotToPascalScene(syntheticSite, scenario, 32.0);

    const serializedScene = JSON.stringify(scene);
    for (const forbidden of FORBIDDEN_GOLDEN_STRINGS) {
      expect(serializedScene).not.toContain(forbidden);
    }

    // Verify Pascal definitions are generic
    for (const key of Object.keys(SITEPILOT_PASCAL_NODE_DEFINITIONS)) {
      const def = SITEPILOT_PASCAL_NODE_DEFINITIONS[key];
      const serializedDef = JSON.stringify(def);
      for (const forbidden of FORBIDDEN_GOLDEN_STRINGS) {
        expect(serializedDef).not.toContain(forbidden);
      }
    }
  });

  it('reconciles scenario geometry changes live without resetting to Golden Project baselines', () => {
    const freshCase = createCase({
      name: 'Yogyakarta Tech Center',
      address: 'Jl. Malioboro No. 50',
      grossSiteArea: 15000
    });

    const scenario = freshCase.scenarios[0];
    const initialMass = scenario.masses[0];

    // Simulate changing floor count from 4 to 6
    const updatedMasses = scenario.masses.map(m => ({
      ...m,
      floors: 6,
      height: 6 * 3.5,
      gfa: m.footprintArea * 6,
      dimensions: { ...m.dimensions, height: 6 * 3.5 }
    }));

    const newMetrics = calculateDevelopmentMetrics(15000, updatedMasses, scenario.assumptionsUsed.setbacks);
    const newReport = evaluateScenarioCompliance(
      15000, 
      scenario.assumptionsUsed.setbacks, 
      updatedMasses, 
      newMetrics, 
      undefined, 
      { scenarioName: scenario.name, hasZoningEvidence: false }
    );

    expect(newMetrics.totalFloors).toBe(6);
    expect(newMetrics.totalHeightMeters).toBe(21.0);
    expect(newMetrics.totalGFA).toBe(initialMass.footprintArea * 6);
    expect(newReport.statusPillLabel).toContain('Provisional Study');
    expect(newReport.decisionText).toContain('Provisional Study');
  });
});
