import { beforeEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

import { checkSetbackEncroachments, getCanonicalParcelBounds } from '@/lib/geometry/engine';
import {
  deriveScenarioFloorLimit,
  deriveStreetName,
  resolveRectangularParcel,
  STREET_NAME_FALLBACK,
  synchronizeProjectDerivedState,
} from '@/lib/opportunity/canonical-opportunity';
import {
  buildEvidenceLedgerRows,
  buildComparisonPageColumns,
  buildProjectReport,
  generateProjectReportPdf,
  serializeProjectReportCsv,
} from '@/lib/reporting/project-report';
import { createCase } from '@/lib/storage/case-repository';

describe('canonical opportunity, parcel, scenario, and reporting workflow', () => {
  beforeEach(() => localStorage.clear());

  it('calculates site area from entered width and depth', () => {
    const result = resolveRectangularParcel({ frontageMeters: 40, depthMeters: 50 });
    expect(result.valid).toBe(true);
    if (!result.valid) return;
    expect(result.siteAreaM2).toBe(2000);
    expect(result.provenance.calculationMethod).toBe('WIDTH_X_DEPTH');
    expect(result.provenance.area.source).toBe('ESTIMATED');
    expect(result.provenance.area.formula).toBe('street frontage × lot depth');
  });

  it('estimates depth from entered area and frontage', () => {
    const result = resolveRectangularParcel({ siteAreaM2: 2400, frontageMeters: 40 });
    expect(result.valid).toBe(true);
    if (!result.valid) return;
    expect(result.depthMeters).toBe(60);
    expect(result.provenance.depth.source).toBe('ESTIMATED');
    expect(result.provenance.depth.formula).toBe('site area ÷ street frontage');
  });

  it('gives entered dimensions precedence and warns on a material contradictory area', () => {
    const result = resolveRectangularParcel({ siteAreaM2: 2500, frontageMeters: 40, depthMeters: 50 });
    expect(result.valid).toBe(true);
    if (!result.valid) return;
    expect(result.siteAreaM2).toBe(2000);
    expect(result.provenance.suppliedAreaM2).toBe(2500);
    expect(result.warning).toContain('differs from frontage × depth');
  });

  it.each([
    [{ frontageMeters: 0, depthMeters: 50 }, 'greater than zero'],
    [{ frontageMeters: 40 }, 'Enter lot depth'],
    [{ siteAreaM2: 2000 }, 'Street frontage is required'],
  ])('rejects invalid or incomplete dimensions', (input, message) => {
    const result = resolveRectangularParcel(input);
    expect(result.valid).toBe(false);
    if (result.valid) return;
    expect(result.errors.join(' ')).toContain(message);
  });

  it('derives whole-floor height limits from height and scenario floor-to-floor height', () => {
    const result = deriveScenarioFloorLimit({ maximumHeightMeters: 32, floorToFloorHeight: 3.5 });
    expect(result.kind).toBe('HEIGHT_DERIVED_LEGAL_MAXIMUM');
    expect(result.floorCount).toBe(9);
    expect(result.formula).toBe('floor(32 m ÷ 3.5 m/floor)');
  });

  it('derives a clearly non-legal FAR/KDB study floor count when height is absent', () => {
    const result = deriveScenarioFloorLimit({ maximumFAR: 3.2, maximumCoveragePct: 55, floorToFloorHeight: 3.5 });
    expect(result.kind).toBe('FAR_COVERAGE_STUDY_ESTIMATE');
    expect(result.floorCount).toBe(6);
    expect(result.explanation).toContain('not a statutory floor maximum');
  });

  it('does not fabricate a floor maximum when the planning inputs are insufficient', () => {
    const result = deriveScenarioFloorLimit({ maximumFAR: 3.2, floorToFloorHeight: 3.5 });
    expect(result.kind).toBe('INSUFFICIENT_INPUTS');
    expect(result.floorCount).toBeNull();
    expect(result.missingInputs).toContain('coverage/KDB');
  });

  it('parses, falls back, and permits a manual street-name correction', () => {
    expect(deriveStreetName('Jl. Pemuda No. 10, Surabaya')).toEqual({ value: 'Jl. Pemuda', source: 'ADDRESS_DERIVED' });
    expect(deriveStreetName('Central Jakarta').value).toBe(STREET_NAME_FALLBACK);
    expect(deriveStreetName('Central Jakarta', 'Jalan Veteran')).toEqual({ value: 'Jalan Veteran', source: 'USER_ENTERED' });
  });

  it('keeps parcel geometry, all scenario metrics, and compliance synchronized after an input edit', () => {
    const project = createCase({
      name: 'Canonical Parcel Test', address: 'Jalan Veteran 12, Jakarta', grossSiteArea: 2400, frontageLength: 40,
      statutoryMaxHeightMeters: 28, statutoryMaxFAR: 3.2, statutoryMaxCoveragePct: 55,
    });
    const parcel = resolveRectangularParcel({ siteAreaM2: 3000, frontageMeters: 50 });
    expect(parcel.valid).toBe(true);
    if (!parcel.valid) return;
    const synchronized = synchronizeProjectDerivedState({
      ...project,
      site: {
        ...project.site,
        grossSiteArea: parcel.siteAreaM2,
        frontageLength: parcel.frontageMeters,
        lotDepth: parcel.depthMeters,
        dimensionProvenance: parcel.provenance,
      },
    });
    const bounds = getCanonicalParcelBounds(
      synchronized.site.grossSiteArea,
      synchronized.site.setbacks,
      synchronized.site.frontageLength,
    );
    expect(bounds.width).toBe(50);
    expect(bounds.length).toBe(60);
    expect(synchronized.scenarios.every((scenario) => scenario.metrics.grossSiteArea === 3000)).toBe(true);
    expect(synchronized.scenarios.every((scenario) => scenario.complianceReport !== undefined)).toBe(true);
  });

  it('treats 0 m front and 4 m symmetric sides as exact canonical offsets', () => {
    const bounds = getCanonicalParcelBounds(1000, { front: 0, rear: 5, sideLeft: 4, sideRight: 4 }, 20);
    expect(bounds.length).toBe(50);
    expect(bounds.buildableMaxY).toBe(bounds.maxY);
    expect(bounds.buildableMinX).toBe(bounds.minX + 4);
    expect(bounds.buildableMaxX).toBe(bounds.maxX - 4);
    const created = createCase({ name: 'Default side study', address: 'Jalan Uji', grossSiteArea: 1000, frontageLength: 20 });
    expect(created.site.setbacks.sideLeft).toBe(4);
    expect(created.site.setbacks.sideRight).toBe(4);
  });

  it('detects front and side crossings, including a narrow almost-consumed parcel', () => {
    const created = createCase({ name: 'Narrow study', address: 'Jalan Narrow', grossSiteArea: 600, frontageLength: 12 });
    const mass = { ...created.scenarios[0].masses[0], position: { x: 0, y: 0, z: 20 }, dimensions: { ...created.scenarios[0].masses[0].dimensions, width: 6, length: 12 }, footprintArea: 72 };
    const setbacks = { front: 6, rear: 5, sideLeft: 5, sideRight: 5 };
    const bounds = getCanonicalParcelBounds(600, setbacks, 12);
    expect(bounds.buildableWidth).toBe(2);
    const warnings = checkSetbackEncroachments(600, setbacks, [mass], 12);
    expect(warnings.some((warning) => warning.description.toLowerCase().includes('front'))).toBe(true);
    expect(warnings.some((warning) => warning.description.toLowerCase().includes('side'))).toBe(true);
  });

  it('exports one human-readable CSV row per option and a valid inspectable PDF', () => {
    const project = createCase({
      name: 'Export Parcel', address: 'Jl. Merdeka No. 7, Bandung', grossSiteArea: 2400, frontageLength: 40,
      askingPriceAmount: 100_000_000, statutoryMaxHeightMeters: 28, statutoryMaxFAR: 3.2,
      statutoryMaxCoveragePct: 55, statutoryMinKDHPct: 20,
    });
    const report = buildProjectReport(project, project.scenarios[1].id, '2026-08-24T12:00:00.000Z');
    expect(report.options).toHaveLength(3);
    expect(report.currentOption).toBe('Option B');
    expect(report.recommendation).not.toMatch(/guaranteed|guarantee of feasibility$/i);
    const csv = serializeProjectReportCsv(report);
    expect(csv.split('\r\n')).toHaveLength(4);
    expect(csv).toContain('"Option A"');
    expect(csv).toContain('"Option B"');
    expect(csv).toContain('"Option C"');
    expect(csv).toContain('"Front Setback (m)"');
    expect(csv).toContain('"Symmetric Side Setback (m)"');
    expect(csv).toContain('"Podium Storeys"');
    expect(csv).not.toMatch(/null|undefined/);
    const pdfText = Buffer.from(generateProjectReportPdf(report)).toString('latin1');
    expect(pdfText.startsWith('%PDF-1.4')).toBe(true);
    expect(pdfText).toContain('Scenario comparison');
    expect(pdfText).toContain('Comparable study views');
    expect(pdfText).toContain('Development figure');
    expect(pdfText).toContain('Total storeys');
    expect(pdfText).toContain('Key warning');
    expect(pdfText).toContain('Not used in this option');
    expect(pdfText.indexOf('Comparable study views')).toBeLessThan(pdfText.indexOf('Development figure'));
    expect(pdfText).not.toContain('N/A');
    expect(pdfText).toContain('Option B');
    expect(pdfText).toContain('Rectangular study geometry');
    expect(pdfText).toContain('Sources and Basis');
    expect(pdfText).not.toContain('Evidence and provenance');
    expect(pdfText).toContain('20 m study road');
    expect(pdfText).toContain('m²');
    expect(pdfText).toContain('%%EOF');
  });

  it('binds each comparison drawing and value column to the same distinct scenario identity', () => {
    const project = createCase({
      name: 'Distinct comparison study', address: 'Jalan Columns 3', grossSiteArea: 3600, frontageLength: 60,
      statutoryMaxHeightMeters: 52, statutoryMaxFAR: 5, statutoryMaxCoveragePct: 65, statutoryMinKDHPct: 15,
    });
    const markers = [
      { id: 'scenario-alpha', width: 21, floors: 3, gfa: 11_111, front: 2, version: 11 },
      { id: 'scenario-bravo', width: 32, floors: 7, gfa: 22_222, front: 5, version: 22 },
      { id: 'scenario-charlie', width: 43, floors: 13, gfa: 33_333, front: 9, version: 33 },
    ];
    project.scenarios.forEach((scenario, index) => {
      const marker = markers[index];
      scenario.id = marker.id;
      scenario.masses[0] = {
        ...scenario.masses[0],
        name: `${marker.id}-mass`,
        floors: marker.floors,
        dimensions: { ...scenario.masses[0].dimensions, width: marker.width },
      };
      scenario.metrics = { ...scenario.metrics, totalGFA: marker.gfa, totalFloors: marker.floors };
      scenario.assumptionsUsed = {
        ...scenario.assumptionsUsed,
        setbacks: { ...scenario.assumptionsUsed.setbacks, front: marker.front },
      };
      scenario.canonicalRevision = { ...scenario.canonicalRevision!, sequence: marker.version };
    });
    const before = structuredClone(project);
    const report = buildProjectReport(project, 'scenario-bravo', '2026-08-25T10:00:00.000Z');
    const columns = buildComparisonPageColumns(report);
    expect(columns.map((column) => column.scenarioId)).toEqual(markers.map((marker) => marker.id));
    columns.forEach((column, index) => {
      const marker = markers[index];
      expect(column.option.gfaM2).toBe(marker.gfa);
      expect(column.option.frontSetbackMeters).toBe(marker.front);
      expect(column.option.simulation.masses[0]).toMatchObject({
        name: `${marker.id}-mass`, width: marker.width, floors: marker.floors,
      });
      expect(column.scenarioRevision).toBe(`Study version ${marker.version}`);
      expect(column.selected).toBe(index === 1);
    });
    const reportingSource = readFileSync('src/lib/reporting/project-report.ts', 'utf8');
    expect(reportingSource).toContain('const comparisonLayout = getComparisonPageLayout()');
    expect(reportingSource).toContain('const columnX = comparisonLayout.optionX(index)');
    expect(reportingSource).toContain('drawTransposedComparisonTable(comparison, comparisonColumns, comparisonLayout, 262)');
    expect(reportingSource).toContain('const columnX = layout.optionX(columnIndex)');
    expect(reportingSource).toContain('{ referenceMaxHeight: comparisonMaxHeight, showFloorLines: true }');
    expect(reportingSource).toContain('drawSimulation(\n      comparison,\n      report,\n      column.option,');
    generateProjectReportPdf(report);
    expect(project).toEqual(before);
  });

  it('builds useful Executive Brief and Sources & Assumptions state from the same project report model', () => {
    const project = createCase({
      name: 'Evidence Parcel', address: 'Road', grossSiteArea: 2100, frontageLength: 35,
      statutoryMaxFAR: 3, statutoryMaxCoveragePct: 50,
    });
    const report = buildProjectReport(project, project.scenarios[0].id, '2026-08-24T12:00:00.000Z');
    const ledger = buildEvidenceLedgerRows(project);
    expect(report.site.areaM2).toBe(project.scenarios[0].metrics.grossSiteArea);
    expect(report.options.map((option) => option.gfaM2)).toEqual(project.scenarios.map((scenario) => scenario.metrics.totalGFA));
    expect(ledger.find((row) => row.id === 'canonical-depth')?.formula).toBe('site area ÷ street frontage');
    expect(ledger.find((row) => row.id === 'canonical-street')?.status).toBe('missing');
    expect(ledger.find((row) => row.id === 'planning-front-setback')?.dependencies).toContain('planning checks');
    expect(ledger.find((row) => row.id === 'planning-side-setbacks')?.formula).toContain('symmetrically');
  });

  it('keeps internal engineering terminology out of principal CSV and PDF copy', () => {
    const project = createCase({
      name: 'Professional Language Study', address: 'Jalan Bahasa 10, Jakarta', grossSiteArea: 2400, frontageLength: 40,
      statutoryMaxHeightMeters: 28, statutoryMaxFAR: 3.2, statutoryMaxCoveragePct: 55, statutoryMinKDHPct: 20,
    });
    const report = buildProjectReport(project, project.scenarios[1].id, '2026-08-24T12:00:00.000Z');
    const csv = serializeProjectReportCsv(report);
    const pdfText = Buffer.from(generateProjectReportPdf(report)).toString('latin1');
    const disallowed = [
      /evidence ledger/i,
      /evidence and provenance/i,
      /canonical/i,
      /deterministic/i,
      /evidence classification/i,
      /friendly labels are primary/i,
      /scenario revision/i,
      /\bstale\b/i,
      /\bconfidence\b/i,
      /\binference\b/i,
      /\bpipeline\b/i,
      /\bsemantic\b/i,
      /model-generated/i,
      /source of truth/i,
      /verified controls/i,
      /\bUNVERIFIED\b/,
      /\bAI\b/i,
      /\bagent\b/i,
    ];
    for (const term of disallowed) {
      expect(csv).not.toMatch(term);
      expect(pdfText).not.toMatch(term);
    }
    expect(csv).toContain('"Sources & Assumptions"');
    expect(csv).toContain('"Study Version"');
    expect(pdfText).toContain('Sources and Basis');
    expect(pdfText).toContain('Study version');
  });

  it('labels the planning intelligence element and configured Gemini model clearly', () => {
    const controls = readFileSync('src/components/ScenarioControls.tsx', 'utf8');
    expect(controls).toContain('Planning &amp; Investment Intelligence');
    expect(controls).toContain('AI assessment · model shown only after accepted output');
    expect(controls).not.toContain('Configured model · gemini-3.7-flash');
    expect(controls).not.toContain('Planning &amp; Investment Review');
  });

  it('renders road names without an outline while retaining the accepted text and background treatment', () => {
    const spatialConsole = readFileSync('src/features/development-3d/spatial-console/SpatialConsoleScene.ts', 'utf8');
    const legacy = readFileSync('src/features/development-3d/ViewportCanvas.tsx', 'utf8');
    const plan = readFileSync('src/features/development-3d/DevelopmentWorkspace.tsx', 'utf8');
    const report = readFileSync('src/lib/reporting/project-report.ts', 'utf8');
    const roadLabelSources = [spatialConsole, legacy, plan, report].join('\n');
    expect(roadLabelSources).not.toMatch(/strokeText|strokeRect|text-shadow|-webkit-text-stroke|WebkitTextStroke/);
    expect(spatialConsole).toContain("context.fillStyle = 'rgba(20, 23, 28, 0.82)'");
    expect(spatialConsole).toContain("context.fillStyle = '#f0d39c'");
    expect(spatialConsole).toContain('context.fillText(text');
    expect(legacy).toContain("context.fillStyle = 'rgba(20, 23, 28, 0.84)'");
    expect(plan).toContain('fill="#c9a96a"');
    expect(report).toContain("page.text(roadLabel");
  });

  it('recalculates compliance after a planning-height edit without retaining the prior floor cap', () => {
    const project = createCase({
      name: 'Compliance Parcel', address: 'Jl. Test 1', grossSiteArea: 2400, frontageLength: 40,
      statutoryMaxHeightMeters: 42, statutoryMaxFAR: 4, statutoryMaxCoveragePct: 60,
    });
    const reduced = synchronizeProjectDerivedState({
      ...project,
      zoningLimits: { ...project.zoningLimits!, maxHeightMeters: 10, maxFloors: undefined },
    });
    expect(reduced.scenarios.some((scenario) => scenario.complianceReport?.assessmentStatus === 'NON_COMPLIANT_HEIGHT')).toBe(true);
    expect(deriveScenarioFloorLimit({ maximumHeightMeters: 10, floorToFloorHeight: 3.5 }).floorCount).toBe(2);
  });
});
