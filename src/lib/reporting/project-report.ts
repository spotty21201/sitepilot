import { getScenarioFloorLimit, getScenarioFloorToFloorHeight } from '@/lib/opportunity/canonical-opportunity';
import type { DevelopmentScenario, Finding, Project } from '@/types';

export interface OptionReportRow {
  option: string;
  scenarioName: string;
  scenarioId: string;
  scenarioRevision: string;
  selected: boolean;
  compliance: string;
  floors: number;
  podiumFloors: number | null;
  towerFloors: number | null;
  heightMeters: number;
  floorToFloorMeters: number;
  footprintM2: number;
  gfaM2: number;
  farKLB: number;
  coverageKDBPct: number;
  openSpaceM2: number;
  openSpacePct: number;
  frontSetbackMeters: number;
  sideSetbackMeters: number;
  floorLimitBasis: string;
  warnings: string[];
  constraints: Array<{
    label: string;
    actual: string;
    limit: string;
    result: 'PASS' | 'FAIL' | 'UNVERIFIED';
    exceedance: string;
  }>;
  simulation: {
    masses: Array<{
      name: string;
      type: DevelopmentScenario['masses'][number]['type'];
      x: number;
      z: number;
      baseY: number;
      width: number;
      length: number;
      height: number;
      floors: number;
      floorToFloorHeight: number;
    }>;
  };
}

export interface ComparisonPageColumn {
  optionName: 'Option A' | 'Option B' | 'Option C';
  scenarioId: string;
  scenarioRevision: string;
  selected: boolean;
  option: OptionReportRow;
}

export interface ProjectReport {
  title: string;
  opportunity: string;
  address: string;
  generatedAt: string;
  site: {
    areaM2: number;
    frontageMeters: number | null;
    depthMeters: number | null;
    areaSource: string;
    frontageSource: string;
    depthSource: string;
    calculationMethod: string;
    streetName: string;
    rectangularStudyWarning: string;
  };
  acquisition: string;
  planning: {
    status: string;
    maxHeight: string;
    maxFAR: string;
    maxCoverage: string;
    minOpenSpace: string;
  };
  options: OptionReportRow[];
  currentOption: string;
  recommendation: string;
  assumptions: string[];
  warnings: string[];
  missingInputs: string[];
  evidenceReferences: string[];
  evidence: EvidenceLedgerRow[];
}

export interface EvidenceLedgerRow {
  id: string;
  sourceName: string;
  evidenceType: 'document' | 'address-derived' | 'user-entered' | 'calculated';
  fact: string;
  value: string;
  sourceDate: string;
  verification: string;
  dependencies: string;
  status: 'current' | 'missing' | 'stale' | 'conflicting' | 'overridden' | 'assumption';
  formula?: string;
}

function displaySource(source: string | undefined): string {
  if (!source) return 'Not recorded';
  const labels: Record<string, string> = {
    USER_ENTERED: 'Provided by user',
    USER_ENTERED_ASSUMPTION: 'Provided by user; not yet confirmed',
    ESTIMATED: 'Calculated from study inputs',
    EVIDENCE_VERIFIED: 'Confirmed information',
    VERIFIED_TITLE: 'Confirmed title information',
    LEGACY_INFERRED: 'Carried forward from an earlier study',
    WIDTH_X_DEPTH: 'Frontage × depth',
    AREA_DIV_FRONTAGE: 'Site area ÷ frontage',
    PROVIDED_DIMENSIONS: 'Provided dimensions',
    ADDRESS_DERIVED: 'Derived from opportunity address',
    NOT_PROVIDED: 'Not provided',
  };
  return labels[source] ?? source.replace(/_/g, ' ').toLowerCase();
}

function studyVersion(scenario: DevelopmentScenario): string {
  const sequence = scenario.canonicalRevision?.sequence;
  return sequence === undefined ? 'Study version not recorded' : `Study version ${sequence}`;
}

function sourceTypeText(type: EvidenceLedgerRow['evidenceType']): string {
  if (type === 'address-derived') return 'From address';
  if (type === 'user-entered') return 'Provided by user';
  if (type === 'calculated') return 'Calculated';
  return 'Document';
}

function sourceStatusText(status: EvidenceLedgerRow['status']): string {
  if (status === 'stale') return 'Needs updating';
  if (status === 'missing') return 'Information needed';
  if (status === 'conflicting') return 'Conflicting';
  if (status === 'overridden') return 'Replaced';
  if (status === 'assumption') return 'Assumption';
  return 'Current';
}

function assumptionStatusText(status: string): string {
  if (status === 'VERIFIED') return 'confirmed';
  if (status === 'UNVERIFIED') return 'not yet confirmed';
  if (status === 'CHALLENGED_BY_NEW_EVIDENCE') return 'conflicting information';
  if (status === 'SUPERSEDED') return 'replaced by a later value';
  return status.replace(/_/g, ' ').toLowerCase();
}

function planningResultText(result: OptionReportRow['constraints'][number]['result']): string {
  if (result === 'PASS') return 'Within limit';
  if (result === 'FAIL') return 'Exceeds limit';
  return 'Not confirmed';
}

function findingBasis(finding: Finding): string {
  const type = finding.classification === 'FACT'
    ? 'Confirmed information'
    : finding.classification === 'INFERENCE'
      ? 'Calculated from study inputs'
      : finding.classification === 'ASSUMPTION'
        ? 'Study assumption'
        : finding.classification === 'USER_OVERRIDE'
          ? 'Provided by user; replaces an earlier value'
          : 'Provided information';
  const reliability = finding.confidence === 'HIGH'
    ? 'high reliability'
    : finding.confidence === 'MEDIUM'
      ? 'review advised'
      : finding.confidence === 'LOW'
        ? 'limited reliability'
        : 'not yet confirmed';
  return `${type} · ${reliability}`;
}

function scenarioOptionName(scenario: DevelopmentScenario, index: number): string {
  const match = scenario.name.match(/Scenario\s+([A-Z])/i);
  return `Option ${match?.[1]?.toUpperCase() ?? String.fromCharCode(65 + index)}`;
}

function complianceText(scenario: DevelopmentScenario): string {
  if (!scenario.complianceReport) return 'Not evaluated';
  if (scenario.complianceReport.isCompliant) {
    return scenario.complianceReport.statusPillLabel.includes('Provisional')
      ? 'Within study envelope; statutory status not yet confirmed'
      : 'Compliant with supplied confirmed controls';
  }
  return scenario.complianceReport.statusPillLabel.replace(/_/g, ' ');
}

export function buildProjectReport(
  project: Project,
  selectedScenarioId?: string,
  generatedAt = new Date().toISOString(),
): ProjectReport {
  const provenance = project.site.dimensionProvenance;
  const options = project.scenarios.map((scenario, index): OptionReportRow => {
    const f2f = getScenarioFloorToFloorHeight(scenario);
    const floorLimit = getScenarioFloorLimit(project, scenario);
    const limits = project.zoningLimits;
    const constraints: OptionReportRow['constraints'] = [
      {
        label: 'Governing height', actual: `${scenario.metrics.totalHeightMeters.toFixed(1)} m`,
        limit: limits?.maxHeightMeters ? `${limits.maxHeightMeters.toFixed(1)} m` : 'Not supplied',
        result: limits?.maxHeightMeters ? (scenario.metrics.totalHeightMeters <= limits.maxHeightMeters + 0.01 ? 'PASS' : 'FAIL') : 'UNVERIFIED',
        exceedance: limits?.maxHeightMeters && scenario.metrics.totalHeightMeters > limits.maxHeightMeters
          ? `+${(scenario.metrics.totalHeightMeters - limits.maxHeightMeters).toFixed(1)} m` : '—',
      },
      {
        label: 'FAR / KLB', actual: `${scenario.metrics.farKLB.toFixed(2)}x`,
        limit: limits?.maxFAR ? `${limits.maxFAR.toFixed(2)}x` : 'Not supplied',
        result: limits?.maxFAR ? (scenario.metrics.farKLB <= limits.maxFAR + 0.01 ? 'PASS' : 'FAIL') : 'UNVERIFIED',
        exceedance: limits?.maxFAR && scenario.metrics.farKLB > limits.maxFAR
          ? `+${(scenario.metrics.farKLB - limits.maxFAR).toFixed(2)}x` : '—',
      },
      {
        label: 'Coverage / KDB', actual: `${scenario.metrics.siteCoveragePercentage.toFixed(1)}%`,
        limit: limits?.maxCoveragePct ? `${limits.maxCoveragePct.toFixed(1)}% max` : 'Not supplied',
        result: limits?.maxCoveragePct ? (scenario.metrics.siteCoveragePercentage <= limits.maxCoveragePct + 0.1 ? 'PASS' : 'FAIL') : 'UNVERIFIED',
        exceedance: limits?.maxCoveragePct && scenario.metrics.siteCoveragePercentage > limits.maxCoveragePct
          ? `+${(scenario.metrics.siteCoveragePercentage - limits.maxCoveragePct).toFixed(1)} pp` : '—',
      },
      {
        label: 'Open space / KDH', actual: `${scenario.metrics.openSpacePercentage.toFixed(1)}%`,
        limit: limits?.minKDHPct ? `${limits.minKDHPct.toFixed(1)}% min` : 'Not supplied',
        result: limits?.minKDHPct ? (scenario.metrics.openSpacePercentage + 0.1 >= limits.minKDHPct ? 'PASS' : 'FAIL') : 'UNVERIFIED',
        exceedance: limits?.minKDHPct && scenario.metrics.openSpacePercentage < limits.minKDHPct
          ? `${(limits.minKDHPct - scenario.metrics.openSpacePercentage).toFixed(1)} pp short` : '—',
      },
    ];
    return {
      option: scenarioOptionName(scenario, index),
      scenarioName: scenario.name.replace(/^Scenario\s+[A-Z]:?\s*/i, ''),
      scenarioId: scenario.id,
      scenarioRevision: studyVersion(scenario),
      selected: scenario.id === selectedScenarioId,
      compliance: complianceText(scenario),
      floors: scenario.metrics.totalFloors,
      podiumFloors: scenario.masses.some((mass) => mass.type === 'PODIUM')
        ? Math.max(...scenario.masses.filter((mass) => mass.type === 'PODIUM').map((mass) => mass.floors)) : null,
      towerFloors: scenario.masses.some((mass) => mass.type === 'TOWER')
        ? Math.max(...scenario.masses.filter((mass) => mass.type === 'TOWER').map((mass) => mass.floors)) : null,
      heightMeters: scenario.metrics.totalHeightMeters,
      floorToFloorMeters: f2f,
      footprintM2: scenario.metrics.buildingFootprintArea,
      gfaM2: scenario.metrics.totalGFA,
      farKLB: scenario.metrics.farKLB,
      coverageKDBPct: scenario.metrics.siteCoveragePercentage,
      openSpaceM2: scenario.metrics.openSpaceArea,
      openSpacePct: scenario.metrics.openSpacePercentage,
      frontSetbackMeters: scenario.assumptionsUsed.setbacks.front,
      sideSetbackMeters: scenario.assumptionsUsed.setbacks.sideLeft,
      floorLimitBasis: floorLimit.kind === 'HEIGHT_DERIVED_LEGAL_MAXIMUM'
        ? `height-derived whole-floor limit from supplied maximum: ${floorLimit.formula}`
        : `${floorLimit.kind.replace(/_/g, ' ').toLowerCase()}: ${floorLimit.formula}`,
      warnings: scenario.complianceReport?.violations ?? [],
      constraints,
      simulation: {
        masses: scenario.masses.map((mass) => ({
          name: mass.name,
          type: mass.type,
          x: mass.position.x,
          z: mass.position.z,
          baseY: mass.position.y,
          width: mass.dimensions.width,
          length: mass.dimensions.length,
          height: mass.dimensions.height,
          floors: mass.floors,
          floorToFloorHeight: mass.floorToFloorHeight,
        })),
      },
    };
  });
  const selected = options.find((option) => option.selected)
    ?? options.find((_, index) => project.scenarios[index]?.isPreferred)
    ?? options[0];
  const hasVerifiedPlanning = Boolean(project.site.hasZoningEvidence);
  const canRecommend = Boolean(selected)
    && hasVerifiedPlanning
    && selected.compliance.startsWith('Compliant')
    && (project.recommendation === 'PROCEED' || project.recommendation === 'CONDITIONAL_PROCEED');
  const missingInputs: string[] = [];
  if (!project.zoningLimits?.maxHeightMeters) missingInputs.push('Maximum building height');
  if (!project.zoningLimits?.maxFAR) missingInputs.push('FAR/KLB');
  if (!project.zoningLimits?.maxCoveragePct) missingInputs.push('Coverage/KDB');
  if (!project.zoningLimits?.minKDHPct) missingInputs.push('Open-space/KDH requirement');
  if (!hasVerifiedPlanning) missingInputs.push('Confirmed municipal planning controls');
  const dimensionWarning = provenance?.warning;
  const assumptions = [
    'Parcel is represented as a rectangle for planning study purposes; it is not surveyed cadastral geometry.',
    ...project.assumptions
      .filter((assumption) => !/setback|easement/i.test(assumption.parameter))
      .map((assumption) => `${assumption.parameter}: ${assumption.workingValue}${assumption.unit ? ` ${assumption.unit}` : ''} (${assumptionStatusText(assumption.verificationStatus)})`),
  ];
  const warnings = [
    ...(dimensionWarning ? [dimensionWarning] : []),
    ...project.issues.filter((issue) => issue.status !== 'RESOLVED').map((issue) => `${issue.title}: ${issue.implication}`),
  ];
  const currency = project.askingPrice?.currency ?? project.valuation?.askingPriceCurrency;
  const amount = project.askingPrice?.amount ?? project.valuation?.askingPriceAmount;
  return {
    title: 'SitePilot Development Options Comparison',
    opportunity: project.name,
    address: project.location.address || 'Address not provided',
    generatedAt,
    site: {
      areaM2: project.site.grossSiteArea,
      frontageMeters: project.site.frontageLength ?? null,
      depthMeters: project.site.lotDepth ?? null,
      areaSource: displaySource(provenance?.area.source ?? project.areaProvenance?.sourceType),
      frontageSource: displaySource(provenance?.frontage.source),
      depthSource: displaySource(provenance?.depth.source),
      calculationMethod: displaySource(provenance?.calculationMethod),
      streetName: project.site.streetName || 'Street name not provided',
      rectangularStudyWarning: 'Rectangular planning representation only; not surveyed cadastral geometry.',
    },
    acquisition: amount && currency ? `${currency} ${amount.toLocaleString()}` : 'Not provided',
    planning: {
      status: hasVerifiedPlanning ? 'Confirmed planning information on file' : 'Provided inputs and study assumptions; confirm before reliance',
      maxHeight: project.zoningLimits?.maxHeightMeters ? `${project.zoningLimits.maxHeightMeters} m` : 'Not provided',
      maxFAR: project.zoningLimits?.maxFAR ? `${project.zoningLimits.maxFAR.toFixed(2)}x` : 'Not provided',
      maxCoverage: project.zoningLimits?.maxCoveragePct ? `${project.zoningLimits.maxCoveragePct}%` : 'Not provided',
      minOpenSpace: project.zoningLimits?.minKDHPct ? `${project.zoningLimits.minKDHPct}%` : 'Not provided',
    },
    options,
    currentOption: selected?.option ?? 'No option selected',
    recommendation: canRecommend
      ? `${selected.option} is the current information-supported working option; this remains conditional and is not a guarantee of feasibility.`
      : `No option can be recommended safely from the current information. ${hasVerifiedPlanning ? 'Resolve active planning findings and commercial uncertainties.' : 'Confirm municipal planning controls and outstanding information first.'}`,
    assumptions,
    warnings,
    missingInputs,
    evidenceReferences: [...new Set(project.findings.map((finding) => friendlyEvidenceLabel(finding.sourceName)))],
    evidence: buildEvidenceLedgerRows(project),
  };
}

export function buildComparisonPageColumns(report: ProjectReport): ComparisonPageColumn[] {
  const expectedOptions = ['Option A', 'Option B', 'Option C'] as const;
  const byOptionName = new Map(report.options.map((option) => [option.option, option]));
  return expectedOptions.map((optionName) => {
    const option = byOptionName.get(optionName);
    if (!option) throw new Error(`Comparison report is missing ${optionName}.`);
    return {
      optionName,
      scenarioId: option.scenarioId,
      scenarioRevision: option.scenarioRevision,
      selected: option.selected,
      option,
    };
  });
}

const CSV_HEADERS = [
  'Opportunity', 'Address', 'Option', 'Selected', 'Site Area (m2)', 'Site Area Source',
  'Street Frontage (m)', 'Frontage Source', 'Lot Depth (m)', 'Depth Source', 'Street Name',
  'Acquisition Price', 'Maximum Height', 'Maximum FAR / KLB', 'Maximum Coverage / KDB',
  'Minimum Open Space / KDH', 'Podium Storeys', 'Tower Storeys', 'Governing Floor Count', 'Floor-to-Floor Height (m)', 'Building Height (m)',
  'Footprint (m2)', 'GFA (m2)', 'FAR / KLB', 'Coverage / KDB (%)', 'Open Space (m2)',
  'Open Space / KDH (%)', 'Front Setback (m)', 'Symmetric Side Setback (m)',
  'Planning Check', 'Floor Limit Method', 'Assumptions', 'Warnings', 'Information Still Needed',
  'Sources & Assumptions', 'Generated On', 'Study Version',
] as const;

function csvCell(value: string | number | boolean): string {
  const text = String(value).replace(/\r?\n/g, ' ');
  return `"${text.replace(/"/g, '""')}"`;
}

export function serializeProjectReportCsv(report: ProjectReport): string {
  const rows = report.options.map((option) => [
    report.opportunity, report.address, option.option, option.selected ? 'Yes' : 'No', report.site.areaM2,
    report.site.areaSource, report.site.frontageMeters ?? 'Not provided', report.site.frontageSource,
    report.site.depthMeters ?? 'Not provided', report.site.depthSource, report.site.streetName,
    report.acquisition, report.planning.maxHeight, report.planning.maxFAR, report.planning.maxCoverage,
    report.planning.minOpenSpace, option.podiumFloors ?? 'Not applicable', option.towerFloors ?? 'Not applicable',
    option.floors, option.floorToFloorMeters, option.heightMeters,
    option.footprintM2, option.gfaM2, option.farKLB, option.coverageKDBPct, option.openSpaceM2,
    option.openSpacePct, option.frontSetbackMeters, option.sideSetbackMeters,
    option.compliance, option.floorLimitBasis, [
      ...report.assumptions,
      `Front building setback: ${option.frontSetbackMeters} m`,
      `Symmetric side building setbacks: ${option.sideSetbackMeters} m left and right`,
    ].join(' | '),
    [...report.warnings, ...option.warnings].join(' | ') || 'None recorded',
    report.missingInputs.join(' | ') || 'None recorded', report.evidenceReferences.join(' | ') || 'No sources recorded',
    humanDate(report.generatedAt), option.scenarioRevision,
  ]);
  return [CSV_HEADERS, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n');
}

type PdfFont = 'F1' | 'F2' | 'F3';
type PdfColor = readonly [number, number, number];

const PDF_WIDTH = 841.89;
const PDF_HEIGHT = 595.28;
const INK: PdfColor = [0.12, 0.15, 0.18];
const MUTED: PdfColor = [0.37, 0.41, 0.45];
const NAVY: PdfColor = [0.08, 0.12, 0.17];
const GOLD: PdfColor = [0.69, 0.52, 0.27];
const ROSE: PdfColor = [0.68, 0.29, 0.36];
const GREEN: PdfColor = [0.25, 0.49, 0.38];
const LINE: PdfColor = [0.82, 0.84, 0.86];

function pdfText(value: string): string {
  return value
    .replace(/[–—]/g, '-')
    .replace(/•/g, '-')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/…/g, '...')
    .split('')
    .map((character) => character.charCodeAt(0) <= 255 ? character : '?')
    .join('');
}

function escapePdfText(value: string): string {
  return pdfText(value).replace(/([\\()])/g, '\\$1');
}

function textWidth(value: string, size: number, font: PdfFont): number {
  return pdfText(value).length * size * (font === 'F3' ? 0.6 : font === 'F2' ? 0.54 : 0.5);
}

function wrapPdfText(value: string, width: number, size: number, font: PdfFont): string[] {
  const maxChars = Math.max(1, Math.floor(width / (size * (font === 'F3' ? 0.6 : font === 'F2' ? 0.54 : 0.5))));
  const words = pdfText(value).split(/\s+/).filter(Boolean).flatMap((word) => {
    if (textWidth(word, size, font) <= width) return [word];
    const chunks: string[] = [];
    for (let index = 0; index < word.length; index += maxChars) chunks.push(word.slice(index, index + maxChars));
    return chunks;
  });
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (!line || textWidth(next, size, font) <= width) line = next;
    else { lines.push(line); line = word; }
  }
  if (line) lines.push(line);
  return lines.length ? lines : [''];
}

function humanDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Date not recorded';
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit', timeZoneName: 'short',
  }).format(date);
}

class PdfPage {
  readonly commands: string[] = [];

  rect(x: number, top: number, width: number, height: number, fill: PdfColor, stroke?: PdfColor): void {
    const y = PDF_HEIGHT - top - height;
    this.commands.push(`${fill.join(' ')} rg${stroke ? ` ${stroke.join(' ')} RG` : ''} ${x.toFixed(2)} ${y.toFixed(2)} ${width.toFixed(2)} ${height.toFixed(2)} re ${stroke ? 'B' : 'f'}`);
  }

  line(x1: number, top1: number, x2: number, top2: number, color: PdfColor = LINE, width = 0.5, dash?: string): void {
    this.commands.push(`${color.join(' ')} RG ${width} w ${dash ? `[${dash}] 0 d` : '[] 0 d'} ${x1.toFixed(2)} ${(PDF_HEIGHT - top1).toFixed(2)} m ${x2.toFixed(2)} ${(PDF_HEIGHT - top2).toFixed(2)} l S`);
  }

  polygon(points: Array<[number, number]>, fill: PdfColor, stroke?: PdfColor, width = 0.5): void {
    if (!points.length) return;
    const path = points.map(([x, top], index) => `${x.toFixed(2)} ${(PDF_HEIGHT - top).toFixed(2)} ${index ? 'l' : 'm'}`).join(' ');
    this.commands.push(`${fill.join(' ')} rg${stroke ? ` ${stroke.join(' ')} RG ${width} w` : ''} ${path} h ${stroke ? 'B' : 'f'}`);
  }

  text(value: string, x: number, top: number, size = 9, font: PdfFont = 'F1', color: PdfColor = INK, align: 'left' | 'right' | 'center' = 'left'): void {
    const safe = pdfText(value);
    const adjustedX = align === 'right' ? x - textWidth(safe, size, font) : align === 'center' ? x - textWidth(safe, size, font) / 2 : x;
    this.commands.push(`BT /${font} ${size} Tf ${color.join(' ')} rg 1 0 0 1 ${adjustedX.toFixed(2)} ${(PDF_HEIGHT - top).toFixed(2)} Tm (${escapePdfText(safe)}) Tj ET`);
  }

  paragraph(value: string, x: number, top: number, width: number, size = 9, font: PdfFont = 'F1', color: PdfColor = INK, leading = size * 1.35, maxLines = 99): number {
    const lines = wrapPdfText(value, width, size, font).slice(0, maxLines);
    lines.forEach((line, index) => this.text(line, x, top + index * leading, size, font, color));
    return lines.length * leading;
  }
}

interface PdfColumn { header: string; width: number; align?: 'left' | 'right' | 'center' }

function drawTable(
  page: PdfPage,
  x: number,
  top: number,
  columns: PdfColumn[],
  rows: string[][],
  options: { fontSize?: number; rowMinHeight?: number; selectedRow?: number; failedRows?: Set<number> } = {},
): number {
  const fontSize = options.fontSize ?? 7.5;
  const headerHeight = 30;
  const totalWidth = columns.reduce((sum, column) => sum + column.width, 0);
  page.rect(x, top, totalWidth, headerHeight, NAVY);
  let cursorX = x;
  columns.forEach((column) => {
    const lines = wrapPdfText(column.header, column.width - 8, 6.8, 'F2').slice(0, 2);
    lines.forEach((line, index) => page.text(line, cursorX + (column.align === 'right' ? column.width - 5 : 5), top + 11 + index * 8, 6.8, 'F2', [1, 1, 1], column.align ?? 'left'));
    cursorX += column.width;
  });
  let rowTop = top + headerHeight;
  rows.forEach((row, rowIndex) => {
    const wrapped = row.map((value, columnIndex) => wrapPdfText(value, columns[columnIndex].width - 8, fontSize, columns[columnIndex].align === 'right' ? 'F3' : 'F1').slice(0, 4));
    const rowHeight = Math.max(options.rowMinHeight ?? 27, Math.max(...wrapped.map((lines) => lines.length)) * (fontSize + 2) + 9);
    const fill: PdfColor = rowIndex === options.selectedRow
      ? [0.96, 0.92, 0.83]
      : options.failedRows?.has(rowIndex) ? [0.99, 0.92, 0.93] : rowIndex % 2 ? [0.965, 0.97, 0.97] : [1, 1, 1];
    page.rect(x, rowTop, totalWidth, rowHeight, fill, LINE);
    cursorX = x;
    wrapped.forEach((lines, columnIndex) => {
      const column = columns[columnIndex];
      lines.forEach((line, lineIndex) => page.text(
        line,
        cursorX + (column.align === 'right' ? column.width - 5 : 5),
        rowTop + 12 + lineIndex * (fontSize + 2),
        fontSize,
        column.align === 'right' ? 'F3' : 'F1',
        INK,
        column.align ?? 'left',
      ));
      cursorX += column.width;
    });
    rowTop += rowHeight;
  });
  return rowTop;
}

function drawSectionTitle(page: PdfPage, title: string, subtitle?: string): void {
  page.text(title, 30, 38, 20, 'F2', NAVY);
  if (subtitle) page.text(subtitle, 30, 57, 8, 'F1', MUTED);
  page.line(30, 70, PDF_WIDTH - 30, 70, GOLD, 1.2);
}

interface SimulationDrawingOptions {
  referenceMaxHeight?: number;
  showFloorLines?: boolean;
}

function drawSimulation(
  page: PdfPage,
  report: ProjectReport,
  option: OptionReportRow,
  x: number,
  top: number,
  width: number,
  height: number,
  drawingOptions: SimulationDrawingOptions = {},
): void {
  page.rect(x, top, width, height, [0.94, 0.95, 0.95], LINE);
  const captionHeight = 25;
  const sceneHeight = height - captionHeight;
  const siteWidth = report.site.frontageMeters ?? Math.sqrt(report.site.areaM2);
  const siteDepth = report.site.depthMeters ?? report.site.areaM2 / siteWidth;
  const maxHeight = drawingOptions.referenceMaxHeight
    ?? Math.max(1, ...option.simulation.masses.map((mass) => mass.baseY + mass.height));
  const cx = x + width * 0.5;
  const baseTop = top + sceneHeight * 0.61;
  const projectPoint = (worldX: number, worldZ: number, worldY = 0): [number, number] => {
    const nx = worldX / siteWidth;
    const nz = worldZ / siteDepth;
    return [cx + (nx - nz) * width * 0.34, baseTop + (nx + nz) * sceneHeight * 0.22 - (worldY / maxHeight) * sceneHeight * 0.38];
  };
  const minX = -siteWidth / 2; const maxX = siteWidth / 2;
  const minZ = -siteDepth / 2; const maxZ = siteDepth / 2;
  const roadFar = maxZ + 20;
  page.polygon([projectPoint(minX - 8, maxZ), projectPoint(maxX + 8, maxZ), projectPoint(maxX + 8, roadFar), projectPoint(minX - 8, roadFar)], [0.25, 0.28, 0.31], [0.34, 0.37, 0.4]);
  page.polygon([projectPoint(minX, minZ), projectPoint(maxX, minZ), projectPoint(maxX, maxZ), projectPoint(minX, maxZ)], [0.84, 0.87, 0.88], [0.22, 0.32, 0.4], 0.8);
  const frontZ = maxZ - option.frontSetbackMeters;
  const leftX = minX + option.sideSetbackMeters;
  const rightX = maxX - option.sideSetbackMeters;
  const [frontA, frontB] = [projectPoint(minX, frontZ), projectPoint(maxX, frontZ)];
  const [leftA, leftB] = [projectPoint(leftX, minZ), projectPoint(leftX, maxZ)];
  const [rightA, rightB] = [projectPoint(rightX, minZ), projectPoint(rightX, maxZ)];
  page.line(frontA[0], frontA[1], frontB[0], frontB[1], [0.72, 0.38, 0.49], 0.8, '3 2');
  page.line(leftA[0], leftA[1], leftB[0], leftB[1], [0.72, 0.38, 0.49], 0.8, '3 2');
  page.line(rightA[0], rightA[1], rightB[0], rightB[1], [0.72, 0.38, 0.49], 0.8, '3 2');
  [...option.simulation.masses].sort((a, b) => a.z - b.z).forEach((mass) => {
    const x1 = mass.x - mass.width / 2; const x2 = mass.x + mass.width / 2;
    const z1 = mass.z - mass.length / 2; const z2 = mass.z + mass.length / 2;
    const y1 = mass.baseY; const y2 = mass.baseY + mass.height;
    const b2 = projectPoint(x2, z1, y1); const b3 = projectPoint(x2, z2, y1); const b4 = projectPoint(x1, z2, y1);
    const t1 = projectPoint(x1, z1, y2); const t2 = projectPoint(x2, z1, y2); const t3 = projectPoint(x2, z2, y2); const t4 = projectPoint(x1, z2, y2);
    const roof: PdfColor = mass.type === 'PODIUM' ? [0.71, 0.59, 0.39] : mass.type === 'TOWER' ? [0.38, 0.55, 0.69] : [0.48, 0.58, 0.5];
    page.polygon([b2, b3, t3, t2], [roof[0] * 0.75, roof[1] * 0.75, roof[2] * 0.75], NAVY);
    page.polygon([b3, b4, t4, t3], [roof[0] * 0.62, roof[1] * 0.62, roof[2] * 0.62], NAVY);
    page.polygon([t1, t2, t3, t4], roof, NAVY);
    if (drawingOptions.showFloorLines !== false && mass.floors > 1 && mass.floorToFloorHeight > 0) {
      for (let floor = 1; floor < mass.floors; floor += 1) {
        const floorY = Math.min(y2, y1 + floor * mass.floorToFloorHeight);
        if (floorY >= y2 - 0.01) continue;
        const faceOneStart = projectPoint(x2, z1, floorY);
        const faceOneEnd = projectPoint(x2, z2, floorY);
        const faceTwoEnd = projectPoint(x1, z2, floorY);
        page.line(faceOneStart[0], faceOneStart[1], faceOneEnd[0], faceOneEnd[1], [0.82, 0.86, 0.89], 0.34);
        page.line(faceOneEnd[0], faceOneEnd[1], faceTwoEnd[0], faceTwoEnd[1], [0.76, 0.81, 0.85], 0.34);
      }
    }
  });
  const roadLabel = wrapPdfText(report.site.streetName, width * 0.42, 7.2, 'F2')[0];
  const roadLabelPoint = projectPoint(0, maxZ + 10);
  page.text(roadLabel, roadLabelPoint[0], roadLabelPoint[1] + 2, 7.2, 'F2', [1, 1, 1], 'center');
  page.rect(x, top + sceneHeight, width, captionHeight, [0.965, 0.97, 0.97], LINE);
  page.text(`STUDY CONTEXT · 20 m study road · front ${option.frontSetbackMeters} m · sides ${option.sideSetbackMeters} m`, x + 7, top + sceneHeight + 10, 5.8, 'F3', MUTED);
  page.text('Rectangular study geometry · not verified cadastral data', x + 7, top + sceneHeight + 20, 5.8, 'F1', MUTED);
}

interface ComparisonPageLayout {
  contentX: number;
  contentWidth: number;
  metricWidth: number;
  optionWidth: number;
  optionX: (index: number) => number;
}

interface ComparisonMetricRow {
  label: string;
  value: (option: OptionReportRow) => string;
  height: number;
  numeric?: boolean;
  status?: boolean;
}

function getComparisonPageLayout(): ComparisonPageLayout {
  const contentX = 30;
  const contentWidth = PDF_WIDTH - 60;
  const metricWidth = 126;
  const optionWidth = (contentWidth - metricWidth) / 3;
  return {
    contentX,
    contentWidth,
    metricWidth,
    optionWidth,
    optionX: (index) => contentX + metricWidth + index * optionWidth,
  };
}

function concisePlanningCheck(option: OptionReportRow): string {
  const failed = option.constraints.find((constraint) => constraint.result === 'FAIL');
  if (failed) return `${failed.label} exceeds the supplied limit${failed.exceedance === '—' ? '' : ` by ${failed.exceedance.replace(/^\+/, '')}`}.`;
  if (option.constraints.some((constraint) => constraint.result === 'UNVERIFIED')) return 'Planning limit not yet confirmed.';
  return 'Within supplied planning controls.';
}

function conciseOptionWarning(option: OptionReportRow): string {
  const failed = option.constraints.find((constraint) => constraint.result === 'FAIL');
  if (failed) return `${failed.actual} against ${failed.limit}${failed.exceedance === '—' ? '' : `; ${failed.exceedance} over`}.`;
  return option.warnings.length ? 'See option detail for supporting warning.' : 'No current planning breach recorded.';
}

function comparisonMetricRows(): ComparisonMetricRow[] {
  return [
    { label: 'Podium storeys', value: (option) => option.podiumFloors === null ? 'Not used in this option' : `${option.podiumFloors}`, height: 18, numeric: true },
    { label: 'Tower storeys', value: (option) => option.towerFloors === null ? 'Not used in this option' : `${option.towerFloors}`, height: 18, numeric: true },
    { label: 'Total storeys', value: (option) => `${option.floors}`, height: 18, numeric: true },
    { label: 'Height', value: (option) => `${option.heightMeters.toFixed(1)} m`, height: 18, numeric: true },
    { label: 'Footprint', value: (option) => `${option.footprintM2.toLocaleString()} m²`, height: 18, numeric: true },
    { label: 'GFA', value: (option) => `${option.gfaM2.toLocaleString()} m²`, height: 18, numeric: true },
    { label: 'FAR / KLB', value: (option) => `${option.farKLB.toFixed(2)}x`, height: 18, numeric: true },
    { label: 'Coverage / KDB', value: (option) => `${option.coverageKDBPct.toFixed(1)}%`, height: 18, numeric: true },
    { label: 'Open space / KDH', value: (option) => `${option.openSpaceM2.toLocaleString()} m² · ${option.openSpacePct.toFixed(1)}%`, height: 18, numeric: true },
    { label: 'Front setback', value: (option) => `${option.frontSetbackMeters} m`, height: 18, numeric: true },
    { label: 'Side setback', value: (option) => `${option.sideSetbackMeters} m each side`, height: 18, numeric: true },
    { label: 'Planning check', value: concisePlanningCheck, height: 28, status: true },
    { label: 'Key warning', value: conciseOptionWarning, height: 34, status: true },
  ];
}

function drawTransposedComparisonTable(
  page: PdfPage,
  columns: ComparisonPageColumn[],
  layout: ComparisonPageLayout,
  top: number,
): number {
  const headerHeight = 28;
  page.rect(layout.contentX, top, layout.metricWidth, headerHeight, NAVY);
  page.text('Development figure', layout.contentX + 7, top + 18, 7.3, 'F2', [1, 1, 1]);
  columns.forEach((column, index) => {
    const columnX = layout.optionX(index);
    page.rect(columnX, top, layout.optionWidth, headerHeight, column.selected ? [0.42, 0.34, 0.22] : NAVY);
    page.text(
      `${column.optionName}${column.selected ? ' · Selected' : ''}`,
      columnX + layout.optionWidth - 7,
      top + 18,
      7.3,
      'F2',
      [1, 1, 1],
      'right',
    );
  });

  let rowTop = top + headerHeight;
  comparisonMetricRows().forEach((row, rowIndex) => {
    const baseFill: PdfColor = rowIndex % 2 ? [0.965, 0.97, 0.97] : [1, 1, 1];
    page.rect(layout.contentX, rowTop, layout.metricWidth, row.height, [0.94, 0.95, 0.95], LINE);
    page.text(row.label, layout.contentX + 7, rowTop + 12, 7.2, 'F2', INK);
    columns.forEach((column, columnIndex) => {
      const option = column.option;
      const failed = option.constraints.some((constraint) => constraint.result === 'FAIL');
      const cellFill: PdfColor = row.status && failed
        ? [0.99, 0.92, 0.93]
        : column.selected ? [0.985, 0.955, 0.88] : baseFill;
      const columnX = layout.optionX(columnIndex);
      page.rect(columnX, rowTop, layout.optionWidth, row.height, cellFill, LINE);
      const value = row.value(option);
      const align = row.numeric && !value.startsWith('Not used') ? 'right' : 'left';
      const font: PdfFont = align === 'right' ? 'F3' : 'F1';
      const fontSize = row.status ? 6.5 : 7.1;
      const lines = wrapPdfText(value, layout.optionWidth - 14, fontSize, font)
        .slice(0, Math.max(1, Math.floor((row.height - 7) / (fontSize + 1.4))));
      lines.forEach((line, lineIndex) => page.text(
        line,
        columnX + (align === 'right' ? layout.optionWidth - 7 : 7),
        rowTop + 11 + lineIndex * (fontSize + 1.4),
        fontSize,
        font,
        row.status && failed ? ROSE : INK,
        align,
      ));
    });
    rowTop += row.height;
  });
  return rowTop;
}

function addFooter(page: PdfPage, pageNumber: number, totalPages: number): void {
  page.line(30, PDF_HEIGHT - 28, PDF_WIDTH - 30, PDF_HEIGHT - 28, LINE, 0.5);
  page.text('SitePilot planning study · not surveyed geometry or a guarantee of statutory feasibility.', 30, PDF_HEIGHT - 15, 6.8, 'F1', MUTED);
  page.text(`Page ${pageNumber} of ${totalPages}`, PDF_WIDTH - 30, PDF_HEIGHT - 15, 7, 'F3', MUTED, 'right');
}

export function generateProjectReportPdf(report: ProjectReport): Uint8Array {
  const pages: PdfPage[] = [];
  const selected = report.options.find((option) => option.selected) ?? report.options[0];

  const summary = new PdfPage();
  summary.rect(0, 0, PDF_WIDTH, 92, NAVY);
  summary.text('SitePilot', 30, 35, 24, 'F2', [1, 1, 1]);
  summary.text('Development options report', 30, 59, 11, 'F1', [0.82, 0.85, 0.88]);
  summary.text(humanDate(report.generatedAt), PDF_WIDTH - 30, 35, 8, 'F3', [0.82, 0.85, 0.88], 'right');
  summary.text(`${report.currentOption} · ${selected?.scenarioRevision ?? 'Study version not recorded'}`, PDF_WIDTH - 30, 57, 8, 'F3', [0.94, 0.78, 0.49], 'right');
  summary.text(report.opportunity, 30, 122, 18, 'F2', NAVY);
  summary.paragraph(report.address, 30, 140, 370, 9, 'F1', MUTED, 12, 2);
  const cards = [
    ['Site area', `${report.site.areaM2.toLocaleString()} m²`],
    ['Frontage', report.site.frontageMeters === null ? 'Not provided' : `${report.site.frontageMeters.toLocaleString()} m`],
    ['Lot depth', report.site.depthMeters === null ? 'Not provided' : `${report.site.depthMeters.toLocaleString()} m`],
    ['Acquisition', report.acquisition],
  ];
  cards.forEach(([label, value], index) => {
    const cardX = 30 + index * 98;
    summary.rect(cardX, 180, 90, 52, [0.95, 0.96, 0.96], LINE);
    summary.text(label, cardX + 8, 196, 7, 'F1', MUTED);
    summary.paragraph(value, cardX + 8, 214, 76, 8.2, 'F2', INK, 10, 2);
  });
  summary.text('Key planning controls', 30, 266, 11, 'F2', NAVY);
  drawTable(summary, 30, 278, [
    { header: 'Planning status', width: 166 }, { header: 'Height', width: 55, align: 'right' },
    { header: 'FAR / KLB', width: 55, align: 'right' }, { header: 'Coverage / KDB', width: 62, align: 'right' },
    { header: 'Open space / KDH', width: 62, align: 'right' },
  ], [[report.planning.status, report.planning.maxHeight, report.planning.maxFAR, report.planning.maxCoverage, report.planning.minOpenSpace]], { fontSize: 7.2, rowMinHeight: 40 });
  summary.text('Decision statement', 30, 381, 11, 'F2', NAVY);
  summary.rect(30, 392, 370, 63, [0.97, 0.94, 0.86], [0.78, 0.66, 0.43]);
  summary.paragraph(report.recommendation, 41, 411, 348, 8.4, 'F1', INK, 11.5, 4);
  const warningSummary = [...report.warnings, ...report.missingInputs.map((item) => `Information still needed: ${item}`)];
  summary.text('Important warnings and unresolved inputs', 30, 481, 10, 'F2', NAVY);
  warningSummary.slice(0, 3).forEach((warning, index) => summary.paragraph(`• ${warning}`, 39, 497 + index * 19, 360, 7.4, 'F1', index === 0 ? ROSE : MUTED, 9, 2));
  if (selected) drawSimulation(summary, report, selected, 430, 118, 382, 382);
  pages.push(summary);

  const comparison = new PdfPage();
  drawSectionTitle(comparison, 'Scenario comparison', 'Options A, B, and C use the same opportunity inputs, site geometry, development figures, and planning checks.');
  const comparisonLayout = getComparisonPageLayout();
  const comparisonColumns = buildComparisonPageColumns(report);
  const comparisonMaxHeight = Math.max(1, ...comparisonColumns.flatMap((column) => (
    column.option.simulation.masses.map((mass) => mass.baseY + mass.height)
  )));
  comparison.text('Comparable study views', comparisonLayout.contentX + 2, 90, 7.1, 'F2', MUTED);
  comparison.text('Same camera, projection, scale, and framing', comparisonLayout.contentX + 2, 103, 6.1, 'F1', MUTED);
  comparisonColumns.forEach((column, index) => {
    const columnX = comparisonLayout.optionX(index);
    comparison.text(
      `${column.optionName}${column.selected ? ' · Selected' : ''}`,
      columnX + comparisonLayout.optionWidth / 2,
      90,
      8.2,
      'F2',
      column.selected ? GOLD : NAVY,
      'center',
    );
    drawSimulation(
      comparison,
      report,
      column.option,
      columnX + 5,
      98,
      comparisonLayout.optionWidth - 10,
      156,
      { referenceMaxHeight: comparisonMaxHeight, showFloorLines: true },
    );
  });
  drawTransposedComparisonTable(comparison, comparisonColumns, comparisonLayout, 262);
  pages.push(comparison);

  report.options.forEach((option) => {
    const detail = new PdfPage();
    drawSectionTitle(detail, `${option.option} · ${option.scenarioName}`, `${option.selected ? 'Selected working option' : 'Comparison option'} · ${option.scenarioRevision}`);
    detail.rect(30, 82, 782, 30, option.constraints.some((constraint) => constraint.result === 'FAIL') ? [0.98, 0.91, 0.92] : [0.9, 0.96, 0.92], option.constraints.some((constraint) => constraint.result === 'FAIL') ? ROSE : GREEN);
    detail.text(option.compliance, 42, 101, 8.2, 'F2', option.constraints.some((constraint) => constraint.result === 'FAIL') ? ROSE : GREEN);
    drawSimulation(detail, report, option, 30, 128, 390, 248);
    detail.text('Development metrics', 444, 139, 11, 'F2', NAVY);
    drawTable(detail, 444, 151, [
      { header: 'Metric', width: 156 }, { header: 'Study figure', width: 182, align: 'right' },
    ], [
      ['Podium storeys', option.podiumFloors === null ? 'Not applicable' : `${option.podiumFloors} floors`],
      ['Tower storeys', option.towerFloors === null ? 'Not applicable' : `${option.towerFloors} floors`],
      ['Governing height', `${option.heightMeters.toFixed(1)} m`], ['Footprint', `${option.footprintM2.toLocaleString()} m²`],
      ['Gross floor area', `${option.gfaM2.toLocaleString()} m²`], ['FAR / KLB', `${option.farKLB.toFixed(2)}x`],
      ['Coverage / KDB', `${option.coverageKDBPct.toFixed(1)}%`], ['Open space / KDH', `${option.openSpaceM2.toLocaleString()} m² · ${option.openSpacePct.toFixed(1)}%`],
      ['Front / symmetric sides', `${option.frontSetbackMeters} m / ${option.sideSetbackMeters} m`],
    ], { fontSize: 7.5, rowMinHeight: 25 });
    detail.text('Planning-limit comparison', 30, 414, 10.5, 'F2', NAVY);
    drawTable(detail, 30, 426, [
      { header: 'Control', width: 130 }, { header: 'Actual', width: 82, align: 'right' }, { header: 'Supplied limit', width: 108, align: 'right' },
      { header: 'Result', width: 58 }, { header: 'Exceedance / shortfall', width: 172, align: 'right' },
    ], option.constraints.map((constraint) => [constraint.label, constraint.actual, constraint.limit, planningResultText(constraint.result), constraint.exceedance]), {
      fontSize: 6.8, rowMinHeight: 21,
      failedRows: new Set(option.constraints.map((constraint, index) => constraint.result === 'FAIL' ? index : -1).filter((index) => index >= 0)),
    });
    detail.text('Assumptions and warnings', 595, 414, 10.5, 'F2', NAVY);
    detail.paragraph(option.floorLimitBasis, 595, 432, 217, 6.8, 'F1', MUTED, 8.5, 4);
    detail.paragraph(option.warnings.join(' · ') || 'No current planning breach recorded. Planning controls and source information still require professional confirmation.', 595, 470, 217, 6.8, 'F1', option.warnings.length ? ROSE : MUTED, 8.5, 7);
    pages.push(detail);
  });

  const evidenceChunks: EvidenceLedgerRow[][] = [];
  const evidenceRows: EvidenceLedgerRow[] = report.evidence.length ? report.evidence : [{
    id: 'none', sourceName: 'Sources & assumptions', evidenceType: 'user-entered', fact: 'No sources or assumptions recorded', value: 'Not available', sourceDate: '', verification: 'Not yet confirmed', dependencies: 'All planning conclusions', status: 'missing',
  }];
  for (let index = 0; index < evidenceRows.length; index += 6) evidenceChunks.push(evidenceRows.slice(index, index + 6));
  evidenceChunks.forEach((chunk, chunkIndex) => {
    const evidence = new PdfPage();
    drawSectionTitle(evidence, `Sources and Basis${evidenceChunks.length > 1 ? ` · ${chunkIndex + 1}` : ''}`, 'Clear source names show how each figure was established and what still needs confirmation.');
    drawTable(evidence, 30, 88, [
      { header: 'Source or input', width: 125 }, { header: 'Source type', width: 70 }, { header: 'Information and value', width: 215 },
      { header: 'Check status', width: 80 }, { header: 'Source date', width: 90 }, { header: 'Used for', width: 160 }, { header: 'Ref.', width: 42 },
    ], chunk.map((row) => [
      row.sourceName, sourceTypeText(row.evidenceType), `${row.fact}: ${row.value}${row.formula ? ` · Calculated as: ${row.formula}` : ''}`,
      `${sourceStatusText(row.status)} · ${row.verification}`, row.sourceDate ? humanDate(row.sourceDate) : 'Not recorded', row.dependencies, `S-${String(chunkIndex * 6 + chunk.indexOf(row) + 1).padStart(2, '0')}`,
    ]), {
      fontSize: 7.1, rowMinHeight: 47,
      failedRows: new Set(chunk.map((row, index) => ['missing', 'conflicting', 'stale'].includes(row.status) ? index : -1).filter((index) => index >= 0)),
    });
    evidence.text('How sources are treated', 30, 515, 10, 'F2', NAVY);
    evidence.paragraph('Confirmed information, provided inputs, calculations, assumptions, replaced values, conflicts, and missing items remain distinct. Calculated dimensions show their formula and originating inputs. Manual assumptions are marked as not yet confirmed.', 30, 532, 760, 8, 'F1', MUTED, 10.5, 3);
    pages.push(evidence);
  });

  pages.forEach((page, index) => addFooter(page, index + 1, pages.length));
  const objects: string[] = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    `<< /Type /Pages /Kids [${pages.map((_, index) => `${6 + index * 2} 0 R`).join(' ')}] /Count ${pages.length} >>`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Courier /Encoding /WinAnsiEncoding >>',
  ];
  pages.forEach((page, index) => {
    const contentId = 7 + index * 2;
    const stream = page.commands.join('\n');
    objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PDF_WIDTH} ${PDF_HEIGHT}] /Resources << /Font << /F1 3 0 R /F2 4 0 R /F3 5 0 R >> >> /Contents ${contentId} 0 R >>`);
    objects.push(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
  });
  let pdf = '%PDF-1.4\n%\xE2\xE3\xCF\xD3\n';
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(pdf.length);
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xrefOffset = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let index = 1; index <= objects.length; index += 1) pdf += `${String(offsets[index]).padStart(10, '0')} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return Uint8Array.from(pdf, (character) => character.charCodeAt(0) & 0xff);
}

function findingEvidenceType(finding: Finding): EvidenceLedgerRow['evidenceType'] {
  if (finding.sourceId.startsWith('src-intake')) return 'user-entered';
  if (finding.classification === 'INFERENCE') return 'calculated';
  return 'document';
}

function friendlyEvidenceLabel(sourceName: string): string {
  return sourceName
    .replace(/\.[a-z0-9]+$/i, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim() || 'Source';
}

export function buildEvidenceLedgerRows(project: Project): EvidenceLedgerRow[] {
  const provenance = project.site.dimensionProvenance;
  const dimensionRows: EvidenceLedgerRow[] = provenance ? [
    {
      id: 'canonical-frontage', sourceName: 'Opportunity inputs', evidenceType: 'user-entered', fact: 'Street frontage / lot width',
      value: `${provenance.frontage.value} m`, sourceDate: project.updatedAt, verification: displaySource(provenance.frontage.source),
      dependencies: '2D plan; 3D parcel; setbacks; coverage; all scenarios; exports', status: provenance.frontage.source === 'EVIDENCE_VERIFIED' ? 'current' : 'assumption',
    },
    {
      id: 'canonical-depth', sourceName: 'Parcel calculation', evidenceType: provenance.depth.source === 'ESTIMATED' ? 'calculated' : 'user-entered', fact: 'Lot depth',
      value: `${provenance.depth.value} m`, sourceDate: project.updatedAt, verification: displaySource(provenance.depth.source),
      dependencies: '2D plan; 3D parcel; setbacks; all scenarios; exports', status: provenance.depth.source === 'ESTIMATED' ? 'assumption' : 'current', formula: provenance.depth.formula,
    },
    {
      id: 'canonical-area', sourceName: project.areaProvenance?.sourceName ?? 'Opportunity inputs', evidenceType: provenance.area.source === 'ESTIMATED' ? 'calculated' : 'user-entered', fact: 'Rectangular study area',
      value: `${provenance.area.value.toLocaleString()} m²`, sourceDate: project.areaProvenance?.adoptedAt ?? project.updatedAt, verification: displaySource(provenance.area.source),
      dependencies: 'FAR; KDB; KDH; GFA; 2D/3D parcel; all options; exports', status: provenance.warning ? 'conflicting' : provenance.area.source === 'ESTIMATED' ? 'assumption' : 'current', formula: provenance.area.formula,
    },
    {
      id: 'canonical-street', sourceName: project.site.streetNameSource === 'USER_ENTERED' ? 'Manual correction' : 'Opportunity address',
      evidenceType: project.site.streetNameSource === 'ADDRESS_DERIVED' ? 'address-derived' : 'user-entered', fact: 'Street-facing boundary label',
      value: project.site.streetName || 'Street name not provided', sourceDate: project.updatedAt, verification: displaySource(project.site.streetNameSource),
      dependencies: '2D plan; 3D road; DAE export', status: project.site.streetNameSource === 'NOT_PROVIDED' ? 'missing' : 'current',
    },
    {
      id: 'planning-front-setback', sourceName: 'Opportunity and planning inputs', evidenceType: 'user-entered', fact: 'Front building setback',
      value: project.scenarios.map((scenario, index) => `Option ${String.fromCharCode(65 + index)} ${scenario.assumptionsUsed.setbacks.front} m`).join(' · '), sourceDate: project.updatedAt,
      verification: project.site.hasZoningEvidence ? 'supplied control; planning information on file' : 'provided study assumption',
      dependencies: 'Buildable envelope; containment; plans; planning checks; downloads', status: project.site.hasZoningEvidence ? 'current' : 'assumption',
    },
    {
      id: 'planning-side-setbacks', sourceName: 'Opportunity and planning inputs', evidenceType: 'user-entered', fact: 'Symmetric side building setbacks',
      value: project.scenarios.map((scenario, index) => `Option ${String.fromCharCode(65 + index)} ${scenario.assumptionsUsed.setbacks.sideLeft} m left/right`).join(' · '), sourceDate: project.updatedAt,
      verification: project.site.hasZoningEvidence ? 'supplied control; planning information on file' : 'provided study assumption',
      dependencies: 'Buildable width; containment; plans; planning checks; downloads', status: project.site.hasZoningEvidence ? 'current' : 'assumption',
      formula: 'same user-entered side setback applied symmetrically to left and right boundaries',
    },
  ] : [];
  const findingRows = project.findings.map((finding): EvidenceLedgerRow => ({
    id: finding.id,
    sourceName: friendlyEvidenceLabel(finding.sourceName),
    evidenceType: findingEvidenceType(finding),
    fact: finding.statement,
    value: finding.extractedValue?.numericValue === undefined
      ? 'See finding'
      : `${finding.extractedValue.numericValue.toLocaleString()}${finding.extractedValue.unit ? ` ${finding.extractedValue.unit}` : ''}`,
    sourceDate: finding.createdAt,
    verification: findingBasis(finding),
    dependencies: finding.extractedValue?.key?.replace(/_/g, ' ') ?? finding.category.replace(/_/g, ' ').toLowerCase(),
    status: finding.userOverridden ? 'overridden' : finding.classification === 'ASSUMPTION' ? 'assumption' : 'current',
  }));
  return [...dimensionRows, ...findingRows];
}

export function safeReportFilename(projectName: string, extension: 'csv' | 'pdf'): string {
  const clean = projectName.trim().replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase() || 'sitepilot';
  return `${clean}-options-a-b-c.${extension}`;
}
