/**
 * SitePilot Golden Project Dataset (PRD Sec 11-20 & Sec 46)
 * Real-world benchmark: Menteng Mixed-Use Site (Jakarta, Indonesia)
 * Single Canonical Geometry Model matching 2D, 3D, and COLLADA export.
 */

import { Project } from '@/types';
import { calculateDevelopmentMetrics } from '../geometry/engine';

export const GOLDEN_PROJECT: Project = {
  id: 'proj-menteng-001',
  name: 'Menteng Heritage Quarter',
  objective: 'Evaluate 1.68 ha site for premium boutique residential and lifestyle retail development.',
  location: {
    address: 'Jl. Teuku Umar No. 42-46, Menteng, Central Jakarta',
    city: 'Jakarta',
    country: 'Indonesia',
    center: { lat: -6.1954, lng: 106.8317 }
  },
  askingPrice: {
    amount: 450000000000, // IDR 450 Billion
    currency: 'IDR',
    pricePerM2: 26700000 // ~Rp 26.7M/m² based on 16,850 m²
  },
  status: 'ACTIVE',
  recommendation: 'CONDITIONAL_PROCEED',
  siteReadinessPercentage: 68,
  evidenceConfidence: 'MEDIUM',
  
  site: {
    grossSiteArea: 16850, // Confirmed Certificate Fact
    buildableArea: 13718, // Calculated from canonical 110m frontage & setbacks
    coordinateSystem: 'WGS84',
    frontageLength: 110,
    accessRoadWidth: 6.5,
    setbacks: {
      front: 10,
      rear: 6,
      sideLeft: 5,
      sideRight: 5
    },
    boundary: {
      type: 'Polygon',
      coordinates: [[
        [106.8305, -6.1948],
        [106.8322, -6.1946],
        [106.8325, -6.1962],
        [106.8307, -6.1965],
        [106.8305, -6.1948]
      ]]
    }
  },

  sources: [
    {
      id: 'src-001',
      projectId: 'proj-menteng-001',
      name: 'Menteng_Prime_Broker_Pitch_2026.pdf',
      fileType: 'PDF',
      origin: 'Seller Broker Presentation',
      uploadedAt: '2026-08-10T04:30:00Z',
      pageCount: 14,
      status: 'PROCESSED',
      summary: 'Sales brochure marketing 1.82 ha prime land with Rp 450B asking price and stated 12-storey development potential.',
      confidence: 'LOW'
    },
    {
      id: 'src-002',
      projectId: 'proj-menteng-001',
      name: 'SHGB_Certificate_No_1842_Scan.pdf',
      fileType: 'PDF',
      origin: 'National Land Agency (BPN) Certified Scan',
      uploadedAt: '2026-08-12T09:15:00Z',
      pageCount: 4,
      status: 'PROCESSED',
      summary: 'Official SHGB land title certificate confirming exact parcel measurement of 16,850 m² valid through 2045.',
      confidence: 'HIGH'
    },
    {
      id: 'src-003',
      projectId: 'proj-menteng-001',
      name: 'Jakarta_RDTR_Zoning_Excerpt_Subzone_R9.pdf',
      fileType: 'PDF',
      origin: 'DKI Jakarta Planning Department (RDTR 2022-2026)',
      uploadedAt: '2026-08-14T11:00:00Z',
      pageCount: 8,
      status: 'PROCESSED',
      summary: 'Zoning regulation excerpt designating Subzone R.9 (High-Medium Density Mixed Housing). Max Height: 8 floors, KDB: 55%, KLB / FAR: 3.2.',
      confidence: 'HIGH'
    },
    {
      id: 'src-004',
      projectId: 'proj-menteng-001',
      name: 'Site_Access_Northern_Corridor_Photo.jpg',
      fileType: 'IMAGE',
      origin: 'Site Visit Observation',
      uploadedAt: '2026-08-15T02:20:00Z',
      status: 'PROCESSED',
      summary: 'Northern access road measured at 6.5m width with high afternoon vehicle volume.',
      confidence: 'MEDIUM'
    }
  ],

  findings: [
    {
      id: 'fnd-001',
      projectId: 'proj-menteng-001',
      sourceId: 'src-001',
      sourceName: 'Menteng_Prime_Broker_Pitch_2026.pdf',
      pageLocation: 'Page 2, Executive Summary',
      statement: 'Gross land area stated as 18,200 m² (1.82 Hectares) with asking price Rp 450,000,000,000.',
      category: 'LEGAL_TITLE',
      classification: 'CLAIM',
      confidence: 'LOW',
      extractedValue: { numericValue: 18200, unit: 'm2', key: 'gross_site_area' },
      createdAt: '2026-08-10T04:31:00Z'
    },
    {
      id: 'fnd-002',
      projectId: 'proj-menteng-001',
      sourceId: 'src-002',
      sourceName: 'SHGB_Certificate_No_1842_Scan.pdf',
      pageLocation: 'Page 1, Cadastral Register Item 4',
      statement: 'Official registered cadastral area is 16,850 m² under Hak Guna Bangunan (HGB No. 1842/Menteng, expires 2045).',
      category: 'LEGAL_TITLE',
      classification: 'FACT',
      confidence: 'HIGH',
      extractedValue: { numericValue: 16850, unit: 'm2', key: 'gross_site_area' },
      createdAt: '2026-08-12T09:16:00Z'
    },
    {
      id: 'fnd-003',
      projectId: 'proj-menteng-001',
      sourceId: 'src-003',
      sourceName: 'Jakarta_RDTR_Zoning_Excerpt_Subzone_R9.pdf',
      pageLocation: 'Page 3, Table 4.1 (Subzone R.9 Controls)',
      statement: 'Maximum permissible building height for Subzone R.9 is 8 storeys (32m maximum ridge elevation).',
      category: 'ZONING_PLANNING',
      classification: 'FACT',
      confidence: 'HIGH',
      extractedValue: { numericValue: 8, unit: 'floors', key: 'max_height_floors' },
      createdAt: '2026-08-14T11:02:00Z'
    },
    {
      id: 'fnd-004',
      projectId: 'proj-menteng-001',
      sourceId: 'src-003',
      sourceName: 'Jakarta_RDTR_Zoning_Excerpt_Subzone_R9.pdf',
      pageLocation: 'Page 3, Table 4.1 (Development Yields)',
      statement: 'Maximum allowable Floor Area Ratio (KLB / FAR) is 3.20; Maximum Building Coverage (KDB) is 55%; Minimum Open Green Space (KDH) is 20%.',
      category: 'ZONING_PLANNING',
      classification: 'FACT',
      confidence: 'HIGH',
      extractedValue: { numericValue: 3.2, unit: 'far', key: 'max_far' },
      createdAt: '2026-08-14T11:02:00Z'
    },
    {
      id: 'fnd-005',
      projectId: 'proj-menteng-001',
      sourceId: 'src-004',
      sourceName: 'Site_Access_Northern_Corridor_Photo.jpg',
      pageLocation: 'Site Photoset #4',
      statement: 'Access road width is approximately 6.5 meters, which may trigger municipal traffic review and restrict high-volume residential egress.',
      category: 'ACCESS_TRAFFIC',
      classification: 'INFERENCE',
      confidence: 'MEDIUM',
      extractedValue: { numericValue: 6.5, unit: 'm', key: 'access_road_width' },
      createdAt: '2026-08-15T02:22:00Z'
    }
  ],

  contradictions: [
    {
      id: 'contra-001',
      projectId: 'proj-menteng-001',
      title: 'Critical Site Area Discrepancy (1,350 m² variance / 8.1% discrepancy)',
      topic: 'gross_site_area',
      severity: 'CRITICAL',
      findings: [
        {
          id: 'fnd-001',
          projectId: 'proj-menteng-001',
          sourceId: 'src-001',
          sourceName: 'Broker Pitch 2026 (p.2)',
          statement: 'Broker claims 18,200 m² (Asking Rp 450B / Rp 24.7M per m²)',
          category: 'LEGAL_TITLE',
          classification: 'CLAIM',
          confidence: 'LOW',
          createdAt: '2026-08-10T04:31:00Z'
        },
        {
          id: 'fnd-002',
          projectId: 'proj-menteng-001',
          sourceId: 'src-002',
          sourceName: 'SHGB Certificate #1842 (p.1)',
          statement: 'Official Certificate confirms 16,850 m² (True basis Rp 26.7M per m²)',
          category: 'LEGAL_TITLE',
          classification: 'FACT',
          confidence: 'HIGH',
          createdAt: '2026-08-12T09:16:00Z'
        }
      ],
      impactStatement: 'Overstated land area artificially deflates advertised price per m² and distorts potential theoretical maximum GFA capacity by ~4,320 m² at 3.20 FAR.',
      recommendedAction: 'Adopt 16,850 m² as baseline working fact and recalculate land acquisition price basis to Rp 416B before entering binding discussions.',
      resolved: true,
      workingValueSelected: 16850
    }
  ],

  assumptions: [
    {
      id: 'assump-001',
      projectId: 'proj-menteng-001',
      parameter: 'Working Land Area',
      workingValue: 16850,
      unit: 'm²',
      source: 'SHGB Certificate No. 1842 (Verified Cadastral Fact)',
      classification: 'FACT',
      verificationStatus: 'VERIFIED',
      affectedScenarioIds: ['scen-001', 'scen-002', 'scen-003'],
      lastUpdated: '2026-08-12T09:20:00Z'
    },
    {
      id: 'assump-002',
      projectId: 'proj-menteng-001',
      parameter: 'Setbacks (Front / Rear / Sides)',
      workingValue: '10m Front / 6m Rear / 5m Sides',
      unit: 'meters',
      source: 'DKI Jakarta Main Boulevard Setback Standard (Unverified against current widening plan)',
      classification: 'ASSUMPTION',
      verificationStatus: 'UNVERIFIED',
      affectedScenarioIds: ['scen-001', 'scen-002', 'scen-003'],
      lastUpdated: '2026-08-14T11:15:00Z'
    },
    {
      id: 'assump-003',
      projectId: 'proj-menteng-001',
      parameter: 'Maximum Height Limitation',
      workingValue: 8,
      unit: 'floors',
      source: 'DKI Jakarta RDTR 2022-2026 (Subzone R.9 Verified Fact)',
      classification: 'FACT',
      verificationStatus: 'VERIFIED',
      affectedScenarioIds: ['scen-001', 'scen-002', 'scen-003'],
      lastUpdated: '2026-08-14T11:20:00Z'
    }
  ],

  issues: [
    {
      id: 'iss-001',
      projectId: 'proj-menteng-001',
      title: 'Asking Price Adjustment Required (Rp 34B Variance)',
      category: 'LEGAL_TITLE',
      severity: 'CRITICAL',
      evidenceSummary: 'Broker advertised Rp 450B on 18,200 m² (Rp 24.7M/m²), but true cadastral area is 16,850 m² (Rp 26.7M/m²).',
      implication: 'Acquisition basis is 8.1% higher per square meter than initially presented. True total at advertised unit rate should be Rp 416B.',
      status: 'OPEN',
      recommendedAction: 'Renegotiate purchase agreement based on certified 16,850 m² area.',
      affectedScenarioIds: ['scen-001', 'scen-002', 'scen-003']
    },
    {
      id: 'iss-002',
      projectId: 'proj-menteng-001',
      title: 'Secondary Access & Fire Egress Clearance (6.5m Corridor)',
      category: 'ACCESS_TRAFFIC',
      severity: 'IMPORTANT',
      evidenceSummary: 'Existing northern access is 6.5m wide with high peak-hour volume.',
      implication: 'High-density residential scheme (>30,000 m² GFA) may require dedicated dual entrance/exit loops and municipal traffic clearance.',
      status: 'INVESTIGATING',
      recommendedAction: 'Engage traffic consultant for preliminary site ingress/egress review.',
      affectedScenarioIds: ['scen-002', 'scen-003']
    }
  ],

  actions: [
    {
      id: 'act-001',
      projectId: 'proj-menteng-001',
      title: 'Verify Physical Boundary Markers via Cadastral Survey',
      priority: 'CRITICAL',
      reason: 'Confirm no encroachments along southern perimeter wall before contract signing. Source: SHGB Certificate #1842.',
      affectedIssueId: 'iss-001',
      affectedScenarioIds: ['scen-001', 'scen-002', 'scen-003'],
      status: 'IN_PROGRESS',
      assignedTo: 'BPN Cadastral Surveyor',
      dueDate: '2026-08-25'
    },
    {
      id: 'act-002',
      projectId: 'proj-menteng-001',
      title: 'Confirm Municipal Setback Alignments on Teuku Umar Frontage',
      priority: 'IMPORTANT',
      reason: 'Confirm whether upcoming road widening requires an extra 2m front setback. Source: RDTR Subzone R.9 excerpt.',
      affectedScenarioIds: ['scen-002', 'scen-003'],
      status: 'PENDING',
      assignedTo: 'Planning Consultant',
      dueDate: '2026-08-28'
    },
    {
      id: 'act-003',
      projectId: 'proj-menteng-001',
      title: 'Engage Traffic Consultant for 6.5m Access & Egress Study',
      priority: 'IMPORTANT',
      reason: 'Assess whether 6.5m northern corridor satisfies municipal fire egress for Scenario B (40,400 m² GFA). Source: Site Photo #4.',
      affectedIssueId: 'iss-002',
      affectedScenarioIds: ['scen-002', 'scen-003'],
      status: 'PENDING',
      assignedTo: 'Traffic Engineering Specialist',
      dueDate: '2026-08-30'
    }
  ],

  scenarios: [
    {
      id: 'scen-001',
      projectId: 'proj-menteng-001',
      name: 'Scenario A: Low-Rise Heritage Villas',
      description: 'Exclusive 4-storey luxury residences with expansive landscaped gardens and central courtyard. Low yield, zero planning friction.',
      isPreferred: false,
      status: 'VALID',
      masses: [
        {
          id: 'mass-a1',
          name: 'West Villa Cluster',
          type: 'GENERAL',
          footprintArea: 3200,
          floors: 4,
          floorToFloorHeight: 3.8,
          height: 15.2,
          gfa: 12800,
          program: 'RESIDENTIAL',
          position: { x: -24, y: 0, z: 0 },
          dimensions: { width: 40, length: 80, height: 15.2 }
        },
        {
          id: 'mass-a2',
          name: 'East Villa Cluster',
          type: 'GENERAL',
          footprintArea: 2800,
          floors: 4,
          floorToFloorHeight: 3.8,
          height: 15.2,
          gfa: 11200,
          program: 'RESIDENTIAL',
          position: { x: 24, y: 0, z: 0 },
          dimensions: { width: 35, length: 80, height: 15.2 }
        }
      ],
      metrics: calculateDevelopmentMetrics(16850, [
        {
          id: 'mass-a1',
          name: 'West Villa Cluster',
          type: 'GENERAL',
          footprintArea: 3200,
          floors: 4,
          floorToFloorHeight: 3.8,
          height: 15.2,
          gfa: 12800,
          program: 'RESIDENTIAL',
          position: { x: -24, y: 0, z: 0 },
          dimensions: { width: 40, length: 80, height: 15.2 }
        },
        {
          id: 'mass-a2',
          name: 'East Villa Cluster',
          type: 'GENERAL',
          footprintArea: 2800,
          floors: 4,
          floorToFloorHeight: 3.8,
          height: 15.2,
          gfa: 11200,
          program: 'RESIDENTIAL',
          position: { x: 24, y: 0, z: 0 },
          dimensions: { width: 35, length: 80, height: 15.2 }
        }
      ], { front: 10, rear: 6, sideLeft: 5, sideRight: 5 }),
      assumptionsUsed: {
        heightFloors: 4,
        heightMeters: 15.2,
        targetFAR: 1.42,
        targetCoverageKDB: 35.6,
        setbacks: { front: 10, rear: 6, sideLeft: 5, sideRight: 5 },
        unverifiedAssumptionsCount: 0
      },
      risks: ['Higher cost per buildable m²', 'Lower overall revenue potential'],
      opportunities: ['Zero planning friction', 'Rapid approval timeline', 'High sales velocity in Menteng'],
      createdAt: '2026-08-14T12:00:00Z',
      updatedAt: '2026-08-16T14:30:00Z'
    },
    {
      id: 'scen-002',
      projectId: 'proj-menteng-001',
      name: 'Scenario B: Mid-Rise Mixed-Use (Preferred)',
      description: '8-storey premium residences atop 2-storey boutique retail & dining podium. Fully complies with Subzone R.9 height and FAR limits.',
      isPreferred: true,
      status: 'VALID',
      masses: [
        {
          id: 'mass-b-podium',
          name: 'Retail & Wellness Podium',
          type: 'PODIUM',
          footprintArea: 5800,
          floors: 2,
          floorToFloorHeight: 4.5,
          height: 9.0,
          gfa: 11600,
          program: 'RETAIL',
          position: { x: 0, y: 0, z: 0 },
          dimensions: { width: 80, length: 72.5, height: 9.0 }
        },
        {
          id: 'mass-b-tower1',
          name: 'West Residential Wing',
          type: 'TOWER',
          footprintArea: 2400,
          floors: 6,
          floorToFloorHeight: 3.5,
          height: 21.0,
          gfa: 14400,
          program: 'RESIDENTIAL',
          position: { x: -21, y: 9.0, z: 0 },
          dimensions: { width: 35, length: 68.57142857142857, height: 21.0 }
        },
        {
          id: 'mass-b-tower2',
          name: 'East Residential Wing',
          type: 'TOWER',
          footprintArea: 2400,
          floors: 6,
          floorToFloorHeight: 3.5,
          height: 21.0,
          gfa: 14400,
          program: 'RESIDENTIAL',
          position: { x: 21, y: 9.0, z: 0 },
          dimensions: { width: 35, length: 68.57142857142857, height: 21.0 }
        }
      ],
      metrics: calculateDevelopmentMetrics(16850, [
        {
          id: 'mass-b-podium',
          name: 'Retail & Wellness Podium',
          type: 'PODIUM',
          footprintArea: 5800,
          floors: 2,
          floorToFloorHeight: 4.5,
          height: 9.0,
          gfa: 11600,
          program: 'RETAIL',
          position: { x: 0, y: 0, z: 0 },
          dimensions: { width: 80, length: 72.5, height: 9.0 }
        },
        {
          id: 'mass-b-tower1',
          name: 'West Residential Wing',
          type: 'TOWER',
          footprintArea: 2400,
          floors: 6,
          floorToFloorHeight: 3.5,
          height: 21.0,
          gfa: 14400,
          program: 'RESIDENTIAL',
          position: { x: -21, y: 9.0, z: 0 },
          dimensions: { width: 35, length: 68.57142857142857, height: 21.0 }
        },
        {
          id: 'mass-b-tower2',
          name: 'East Residential Wing',
          type: 'TOWER',
          footprintArea: 2400,
          floors: 6,
          floorToFloorHeight: 3.5,
          height: 21.0,
          gfa: 14400,
          program: 'RESIDENTIAL',
          position: { x: 21, y: 9.0, z: 0 },
          dimensions: { width: 35, length: 68.57142857142857, height: 21.0 }
        }
      ], { front: 10, rear: 6, sideLeft: 5, sideRight: 5 }),
      assumptionsUsed: {
        heightFloors: 8,
        heightMeters: 30.0,
        targetFAR: 2.40,
        targetCoverageKDB: 34.4,
        setbacks: { front: 10, rear: 6, sideLeft: 5, sideRight: 5 },
        unverifiedAssumptionsCount: 1
      },
      risks: ['Requires acoustic design along Teuku Umar frontage'],
      opportunities: ['Optimal yield balancing FAR 2.40x against Menteng height caps', 'Strong retail frontage activation'],
      createdAt: '2026-08-15T09:00:00Z',
      updatedAt: '2026-08-17T11:00:00Z'
    },
    {
      id: 'scen-003',
      projectId: 'proj-menteng-001',
      name: 'Scenario C: Speculative High-Density (12 Storeys)',
      description: 'Broker-suggested 12-storey tower concept. Tests yield if special height variance could be obtained.',
      isPreferred: false,
      status: 'WARNING_EXCEEDS_CONSTRAINT',
      warningMessage: 'Massing height (43.2m / 12 floors) exceeds Subzone R.9 maximum allowable height (32.0m / 8 floors) by 11.2m.',
      masses: [
        {
          id: 'mass-c1',
          name: 'Speculative Tower Central',
          type: 'TOWER',
          footprintArea: 4200,
          floors: 12,
          floorToFloorHeight: 3.6,
          height: 43.2,
          gfa: 50400,
          program: 'MIXED_USE',
          position: { x: 0, y: 0, z: 0 },
          dimensions: { width: 60, length: 70, height: 43.2 }
        }
      ],
      metrics: calculateDevelopmentMetrics(16850, [
        {
          id: 'mass-c1',
          name: 'Speculative Tower Central',
          type: 'TOWER',
          footprintArea: 4200,
          floors: 12,
          floorToFloorHeight: 3.6,
          height: 43.2,
          gfa: 50400,
          program: 'MIXED_USE',
          position: { x: 0, y: 0, z: 0 },
          dimensions: { width: 60, length: 70, height: 43.2 }
        }
      ], { front: 10, rear: 6, sideLeft: 5, sideRight: 5 }),
      assumptionsUsed: {
        heightFloors: 12,
        heightMeters: 43.2,
        targetFAR: 2.99,
        targetCoverageKDB: 24.9,
        setbacks: { front: 10, rear: 6, sideLeft: 5, sideRight: 5 },
        unverifiedAssumptionsCount: 3
      },
      risks: ['High regulatory risk: May be rejected by DKI Jakarta planning board', 'Overlooks protected residential heritage perimeter'],
      opportunities: ['Maximum GFA yield (50,400 m²) if discretionary zoning waiver is approved'],
      createdAt: '2026-08-16T16:00:00Z',
      updatedAt: '2026-08-17T15:00:00Z'
    }
  ],

  executiveSummary: {
    topOpportunities: [
      'Prime 1.68 ha rectangular parcel in prestigious Menteng submarket with high prestige value.',
      'Confirmed Subzone R.9 allows up to 8 floors and 3.20 FAR for mixed-use residential (Source: RDTR Table 4.1, Verified Fact).',
      'Optimal development yield achieved under Scenario B (40,400 m² GFA, 2.40 FAR) with zero zoning variance required.'
    ],
    criticalRisks: [
      'Cadastral discrepancy: True area is 16,850 m² vs 18,200 m² advertised by broker (8.1% price inflation per m² / Rp 34B total variance).',
      'Single 6.5m northern access corridor may limit emergency vehicle throughput for large schemes without secondary egress loop.'
    ],
    criticalUnknowns: [
      'Formal setback confirmation along Teuku Umar frontage pending municipal road expansion plan (Source: Planning Standard Assumption).',
      'Utility infrastructure capacity (8 MVA power substation availability unverified).'
    ],
    recommendedNextMove: 'Pre-Offer Investigation: Verify boundary coordinates via cadastral boundary survey and confirm Teuku Umar road widening setbacks before issuing formal offer based on certified 16,850 m² area (Rp 416B basis).'
  },

  createdAt: '2026-08-10T04:00:00Z',
  updatedAt: '2026-08-18T08:00:00Z'
};
