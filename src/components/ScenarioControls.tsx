'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { DevelopmentScenario, SiteGeometry, PlanningAssessment, Project } from '@/types';
import { checkSetbackEncroachments, exportToColladaDAE, getCanonicalParcelBounds } from '@/lib/geometry/engine';
import { deriveScenarioFloorLimit, getScenarioFloorLimit, getScenarioFloorToFloorHeight } from '@/lib/opportunity/canonical-opportunity';
import {
  buildProjectReport,
  generateProjectReportPdf,
  safeReportFilename,
  serializeProjectReportCsv,
} from '@/lib/reporting/project-report';
import { 
  Building2, 
  Download, 
  Sliders, 
  CheckCircle2, 
  ShieldAlert, 
  RefreshCw, 
  Copy, 
  Check, 
  Code2, 
  X, 
  RotateCcw, 
  AlertTriangle,
  Sparkles,
  ArrowRight,
  FileText,
  Table2,
} from 'lucide-react';

interface CommittedRangeInputProps {
  min: number;
  max: number;
  value: number;
  ariaLabel: string;
  className: string;
  onCommit: (value: number) => void;
}

function CommittedRangeInput({
  min,
  max,
  value,
  ariaLabel,
  className,
  onCommit,
}: CommittedRangeInputProps) {
  const [draft, setDraft] = useState(value);
  const draftRef = useRef(value);
  const pointerActive = useRef(false);

  useEffect(() => {
    if (!pointerActive.current) {
      draftRef.current = value;
      setDraft(value);
    }
  }, [value]);

  const commit = (nextValue: number) => {
    draftRef.current = nextValue;
    setDraft(nextValue);
    if (nextValue !== value) onCommit(nextValue);
  };

  return (
    <input
      type="range"
      min={min}
      max={max}
      step={1}
      value={draft}
      aria-label={ariaLabel}
      onPointerDown={() => {
        pointerActive.current = true;
      }}
      onPointerUp={() => {
        pointerActive.current = false;
        commit(draftRef.current);
      }}
      onPointerCancel={() => {
        pointerActive.current = false;
        setDraft(value);
      }}
      onBlur={(event) => {
        if (!pointerActive.current) return;
        pointerActive.current = false;
        commit(Number(event.currentTarget.value));
      }}
      onChange={(event) => {
        const nextValue = Number(event.currentTarget.value);
        draftRef.current = nextValue;
        setDraft(nextValue);
        if (!pointerActive.current) commit(nextValue);
      }}
      className={className}
    />
  );
}

interface ScenarioControlsProps {
  site: SiteGeometry;
  scenarios: DevelopmentScenario[];
  activeScenarioId: string;
  onSelectScenario: (id: string) => void;
  onUpdateScenarioParam: (scenarioId: string, param: 'podiumFloors' | 'towerFloors' | 'frontSetback' | 'sideSetback' | 'rearSetback', value: number) => void;
  onFitMassingToEnvelope: (scenarioId: string) => void;
  onResetScenario: (scenarioId: string) => void;
  onOpenCompareModal?: () => void;
  onDuplicateScenario?: (scenarioId: string) => void;
  project?: Project;
}

export function ScenarioControls({
  site,
  scenarios,
  activeScenarioId,
  onSelectScenario,
  onUpdateScenarioParam,
  onFitMassingToEnvelope,
  onResetScenario,
  onOpenCompareModal,
  project
}: ScenarioControlsProps) {
  const [copied, setCopied] = useState(false);
  const [downloadedToast, setDownloadedToast] = useState<string | null>(null);
  const [showXmlModal, setShowXmlModal] = useState(false);
  const [rawXml, setRawXml] = useState('');
  const [prevScenarioId, setPrevScenarioId] = useState(activeScenarioId);
  const [assessment, setAssessment] = useState<PlanningAssessment | null>(null);
  const [assessedSnapshot, setAssessedSnapshot] = useState<string | null>(null);
  const [isLoadingAssessment, setIsLoadingAssessment] = useState(false);
  const [assessmentError, setAssessmentError] = useState<string | null>(null);
  const [investorQuery, setInvestorQuery] = useState('');
  
  const modalRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);

  if (activeScenarioId !== prevScenarioId) {
    setPrevScenarioId(activeScenarioId);
    setAssessment(null);
    setAssessedSnapshot(null);
    setAssessmentError(null);
  }

  const activeScenario = scenarios.find(s => s.id === activeScenarioId) || scenarios[0];
  const metrics = activeScenario.metrics;
  const currentSetback = activeScenario.assumptionsUsed.setbacks.front;
  const currentSideSetback = activeScenario.assumptionsUsed.setbacks.sideLeft;
  const currentRearSetback = activeScenario.assumptionsUsed.setbacks.rear;
  const podiumMasses = activeScenario.masses.filter((mass) => mass.type === 'PODIUM');
  const towerMasses = activeScenario.masses.filter((mass) => mass.type === 'TOWER');
  const podiumFloors = podiumMasses.length ? Math.max(...podiumMasses.map((mass) => mass.floors)) : null;
  const towerFloors = towerMasses.length ? Math.max(...towerMasses.map((mass) => mass.floors)) : null;
  const floorLimit = project
    ? getScenarioFloorLimit(project, activeScenario)
    : deriveScenarioFloorLimit({ floorToFloorHeight: getScenarioFloorToFloorHeight(activeScenario) });
  const parcelBounds = getCanonicalParcelBounds(site.grossSiteArea, activeScenario.assumptionsUsed.setbacks, site.frontageLength);
  const frontSetbackMax = Math.max(currentSetback, Math.floor(Math.max(0, parcelBounds.length - activeScenario.assumptionsUsed.setbacks.rear)));
  const sideSetbackMax = Math.max(currentSideSetback, Math.floor(parcelBounds.width / 2));
  const heightLimit = project?.zoningLimits?.maxHeightMeters;
  const towerPermittedFloors = towerMasses.length && heightLimit
    ? Math.max(1, Math.min(...towerMasses.map((mass) => Math.floor((heightLimit - mass.position.y) / mass.floorToFloorHeight))))
    : floorLimit.floorCount;
  const podiumPermittedFloors = podiumMasses.length && heightLimit
    ? Math.max(1, Math.min(...podiumMasses.map((mass) => Math.floor(heightLimit / mass.floorToFloorHeight))))
    : floorLimit.floorCount;
  // The interaction range is derived from the active study instead of imposing a
  // statutory maximum. It deliberately extends beyond the permitted value so the
  // user can test, and receive a truthful warning for, an over-limit assumption.
  const interactionMax = (current: number, permitted: number | null) => {
    const basis = permitted ?? current;
    return Math.max(current, basis * 2);
  };
  const podiumSliderMax = podiumFloors === null ? 1 : interactionMax(podiumFloors, podiumPermittedFloors);
  const towerSliderMax = towerFloors === null ? 1 : interactionMax(towerFloors, towerPermittedFloors);

  const isFittedToSetback = activeScenario.isFittedOverride === true || activeScenario.editClassification === 'FITTED_TO_SETBACK';
  const isUserOverride = (activeScenario.editClassification === 'USER_GEOMETRY_EDIT' || 
    activeScenario.editClassification === 'HEIGHT_OVERRIDE' || 
    activeScenario.editClassification === 'PROGRAM_OVERRIDE') && !isFittedToSetback;

  const isOverridden = isUserOverride || isFittedToSetback;
  const hasCollision = activeScenario.pairwiseOverlap?.hasOverlap;
  const isOutOfBounds = (metrics.outOfBoundsAreaM2 || 0) > 0;

  const encroachments = checkSetbackEncroachments(
    site.grossSiteArea, 
    activeScenario.assumptionsUsed.setbacks, 
    activeScenario.masses,
    site.frontageLength,
  );

  const cleanProjectName = (site.projectName || 'SitePilot').split('—')[0].trim().replace(/[^a-zA-Z0-9_-]/g, '_');
  const cleanScenarioName = activeScenario.name.split(':')[0].replace(/[^a-zA-Z0-9_-]/g, '_');
  const exportFilename = `${cleanProjectName}_${cleanScenarioName}_${metrics.totalFloors}Fl${isOverridden ? '_Override' : ''}.dae`;

  // Dynamic description deriving from live geometry
  const dynamicDescription = (() => {
    if (hasCollision) {
      return `⚠️ Geometry Conflict: Massing blocks intersect (${activeScenario.pairwiseOverlap?.overlapVolumeM3.toLocaleString()} m³ overlap volume).`;
    }
    if (isOutOfBounds) {
      return `⚠️ Out of Bounds: Massing extends ${metrics.outOfBoundsAreaM2?.toLocaleString()} m² beyond parcel perimeter.`;
    }
    if (activeScenario.complianceReport?.assessmentStatus === 'NON_COMPLIANT_HEIGHT') {
      return `⚠️ ${activeScenario.complianceReport.summaryText}`;
    }
    if (encroachments.length > 0) {
      return `⚠️ Setback Warning: ${encroachments[0].description}`;
    }
    return activeScenario.description;
  })();

  // Generate canonical DAE XML from live activeScenario masses
  const generateLiveXml = () => {
    return exportToColladaDAE(
      site,
      activeScenario.masses,
      exportFilename.replace('.dae', ''),
      activeScenario.assumptionsUsed.setbacks
    );
  };

  // Direct client-side blob download with feedback toast
  const handleClientDownloadBlob = () => {
    const xml = generateLiveXml();
    const blob = new Blob([xml], { type: 'model/vnd.collada+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = exportFilename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      if (document.body.contains(a)) {
        document.body.removeChild(a);
      }
      URL.revokeObjectURL(url);
    }, 1500);

    setDownloadedToast(exportFilename);
    setTimeout(() => setDownloadedToast(null), 4000);
  };

  const downloadReport = (format: 'csv' | 'pdf') => {
    if (!project) return;
    const report = buildProjectReport(project, activeScenario.id);
    const filename = safeReportFilename(project.name, format);
    const body: BlobPart = format === 'csv'
      ? serializeProjectReportCsv(report)
      : generateProjectReportPdf(report).buffer as ArrayBuffer;
    const blob = new Blob([body], {
      type: format === 'csv' ? 'text/csv;charset=utf-8' : 'application/pdf',
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1500);
    setDownloadedToast(filename);
    window.setTimeout(() => setDownloadedToast(null), 4000);
  };

  const handleCopyXML = async () => {
    const xml = generateLiveXml();
    setRawXml(xml);

    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(xml);
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
      } else {
        setShowXmlModal(true);
      }
    } catch {
      setShowXmlModal(true);
    }
  };

  const handleOpenXmlModal = () => {
    triggerRef.current = document.activeElement as HTMLElement;
    setRawXml(generateLiveXml());
    setShowXmlModal(true);
  };

  const handleCloseXmlModal = useCallback(() => {
    setShowXmlModal(false);
    setTimeout(() => {
      triggerRef.current?.focus();
    }, 50);
  }, []);

  const getCurrentSnapshot = useCallback(() => {
    return `${activeScenario.id}-${metrics.totalGFA}-${metrics.totalFloors}-${metrics.totalHeightMeters}-${currentSetback}-${currentSideSetback}-${isFittedToSetback}-${(activeScenario.masses || []).map(m => `${m.id}:${m.position.x},${m.position.y},${m.position.z}:${m.dimensions.width},${m.dimensions.length}:${m.floors}`).join('|')}`;
  }, [activeScenario.id, activeScenario.masses, currentSetback, currentSideSetback, isFittedToSetback, metrics.totalFloors, metrics.totalGFA, metrics.totalHeightMeters]);

  const baseFloors = activeScenario.originalMasses 
    ? Math.max(...activeScenario.originalMasses.map(m => m.floors), 1)
    : metrics.totalFloors;
  const baseGFA = activeScenario.originalMasses
    ? activeScenario.originalMasses.reduce((acc, m) => acc + m.gfa, 0)
    : metrics.totalGFA;

  const isAssessmentStale = Boolean(assessment && assessedSnapshot && assessedSnapshot !== getCurrentSnapshot());

  const handleGenerateAssessment = async (overrideQuery?: string) => {
    setIsLoadingAssessment(true);
    setAssessmentError(null);
    const snapshot = getCurrentSnapshot();
    const queryToSend = overrideQuery !== undefined ? overrideQuery : investorQuery;

    try {
      const res = await fetch('/api/assessment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scenarioId: activeScenario.id,
          scenarioName: activeScenario.name,
          grossSiteArea: site.grossSiteArea,
          frontageLength: site.frontageLength,
          setbacks: activeScenario.assumptionsUsed.setbacks,
          masses: activeScenario.masses, // CRITICAL FIX: Pass masses array
          projectName: site.projectName,
          address: site.address,
          hasZoningEvidence: Boolean(site.hasZoningEvidence),
          zoningLimits: project?.zoningLimits,
          existingAsset: project?.existingAsset,
          valuation: project?.valuation,
          expansionHeadroomGFA: project?.expansionHeadroomGFA,
          userQuery: queryToSend.trim() || undefined
        })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(res.status === 400 && data.error
          ? data.error
          : 'The assessment could not be prepared. Try again later.');
      }
      setAssessment(data);
      setAssessedSnapshot(snapshot);
    } catch (err) {
      setAssessmentError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsLoadingAssessment(false);
    }
  };

  // Keyboard Trap & Escape Dismiss for Accessible Modal
  useEffect(() => {
    if (!showXmlModal) return;

    // Focus first focusable element inside modal
    const focusable = modalRef.current?.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    if (focusable && focusable.length > 0) {
      focusable[0].focus();
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        handleCloseXmlModal();
        return;
      }

      if (e.key === 'Tab') {
        const focusableElements = modalRef.current?.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (!focusableElements || focusableElements.length === 0) return;

        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === firstElement) {
            e.preventDefault();
            lastElement.focus();
          }
        } else {
          if (document.activeElement === lastElement) {
            e.preventDefault();
            firstElement.focus();
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showXmlModal, handleCloseXmlModal]);

  return (
    <div className="panel-shell flex flex-col h-full overflow-hidden select-none">
      {/* Real Download Toast Notification */}
      {downloadedToast && (
        <div className="bg-[var(--status-verified-surface)] border-b border-[var(--status-verified)] p-2.5 flex items-center justify-between text-xs text-[var(--status-verified)] animate-in fade-in slide-in-from-top duration-200">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span className="truncate">Saved <strong>{downloadedToast}</strong> to downloads.</span>
          </div>
          <button 
            onClick={() => setDownloadedToast(null)}
            className="text-[var(--status-verified)] hover:text-[var(--text-primary)] text-xs px-1 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* Header & Export Actions */}
      <div className="p-3 border-b border-[var(--border-subtle)] bg-[var(--bg-tertiary)]">
        <div className="flex items-center justify-between mb-2.5">
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-[var(--spatial-selection)]" />
            <h3 className="type-section-title">Development Scenarios</h3>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => downloadReport('csv')}
              disabled={!project}
              title="Download Options A, B, and C as CSV"
              className="button-secondary flex items-center gap-1 px-2 py-1.5 text-[10px] font-semibold disabled:opacity-50"
            >
              <Table2 className="h-3.5 w-3.5" /> CSV
            </button>
            <button
              type="button"
              onClick={() => downloadReport('pdf')}
              disabled={!project}
              title="Download Options A, B, and C as PDF"
              className="button-secondary flex items-center gap-1 px-2 py-1.5 text-[10px] font-semibold disabled:opacity-50"
            >
              <FileText className="h-3.5 w-3.5" /> PDF
            </button>
            {onOpenCompareModal && (
              <button
                onClick={onOpenCompareModal}
                title="Compare all scenarios side-by-side"
                aria-label="Compare all scenarios side-by-side"
                className="button-secondary flex items-center gap-1 px-2.5 py-1.5 text-[var(--status-evidence)] text-[11px] font-semibold transition-colors cursor-pointer"
              >
                <span>Compare</span>
              </button>
            )}

            <button
              onClick={handleOpenXmlModal}
              title="Inspect & Copy Raw COLLADA XML"
              aria-label="Inspect and Copy Raw COLLADA XML"
              className="button-secondary flex items-center gap-1 px-2 py-1.5 text-[11px] font-semibold transition-colors cursor-pointer"
            >
              <Code2 className="w-3.5 h-3.5 text-[var(--text-muted)]" />
              <span className="sr-only">XML</span>
            </button>

            <button
              onClick={handleCopyXML}
              title="Copy DAE to Clipboard"
              aria-label="Copy DAE to Clipboard"
              className="button-secondary flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-semibold transition-colors cursor-pointer"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-[var(--status-verified)]" /> : <Copy className="w-3.5 h-3.5 text-[var(--text-muted)]" />}
              <span className="sr-only">{copied ? 'Copied' : 'Copy'}</span>
            </button>

            <button
              onClick={handleClientDownloadBlob}
              title="Download COLLADA DAE File"
              aria-label="Download COLLADA DAE File"
              className="button-secondary flex items-center gap-1.5 px-3 py-1.5 text-[var(--status-evidence)] text-xs font-semibold transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="sr-only">Export DAE</span>
            </button>
          </div>
        </div>

        {/* Scenario Switcher Tabs */}
        <div className={`grid gap-1.5 p-1 bg-[var(--bg-secondary)] rounded-[var(--radius-card)] border border-[var(--border-subtle)] grid-cols-${scenarios.length}`}>
          {scenarios.map((s) => {
            const isSelected = s.id === activeScenario.id;
            const sOrigFloors = s.id === 'scen-001' ? 4 : s.id === 'scen-002' ? 8 : 12;
            const sOverridden = s.metrics.totalFloors !== sOrigFloors || s.isFittedOverride;

            return (
              <button
                key={s.id}
                onClick={() => onSelectScenario(s.id)}
                title={s.name}
                aria-pressed={isSelected}
                className={`py-2 px-1.5 rounded-[var(--radius-control)] border text-[11px] font-semibold transition-colors text-center truncate cursor-pointer ${
                  isSelected
                    ? 'bg-[var(--spatial-selection-surface)] text-[var(--spatial-selection-strong)] border-[var(--spatial-selection)]'
                    : 'text-[var(--text-secondary)] border-transparent hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]'
                }`}
              >
                <div className="truncate">{s.name.split('(')[0].replace('Scenario ', '')}</div>
                <div className={`text-[9px] font-mono ${isSelected ? 'text-[var(--spatial-selection)]' : 'text-[var(--text-muted)]'}`}>
                  {s.metrics.totalFloors} Fl · {s.metrics.totalGFA.toLocaleString()} m²
                  {sOverridden && ' *'}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Active Scenario Overview & Explicit State Strip */}
      <div className="p-3 border-b border-[var(--border-subtle)] bg-[var(--bg-secondary)] space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-1">
            <h4 className="text-xs font-bold text-[var(--text-primary)]">{activeScenario.name}</h4>

            {/* Explicit State Badges Strip */}
            <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
              <span className="px-2 py-0.5 rounded-[var(--radius-control)] text-[9px] font-mono font-bold bg-[var(--bg-tertiary)] text-[var(--text-secondary)] border border-[var(--border-default)]">
                [BASE CONCEPT]
              </span>

              {isUserOverride && (
                <span className="status-badge status-badge--investigation !min-h-0 !rounded-[var(--radius-control)] !px-2 !py-0.5 text-[9px]">
                  [USER OVERRIDE]
                </span>
              )}

              {isFittedToSetback && (
                <span className="status-badge status-badge--evidence !min-h-0 !rounded-[var(--radius-control)] !px-2 !py-0.5 text-[9px]">
                  [FITTED TO SETBACK]
                </span>
              )}
            </div>

            <p className={`text-[11px] mt-1 leading-relaxed ${
              hasCollision || isOutOfBounds || metrics.totalHeightMeters > 32.0 
                ? 'text-[var(--status-error)] font-medium'
                : 'text-[var(--text-secondary)]'
            }`}>
              {dynamicDescription}
            </p>

            {activeScenario.proposal && (
              <details className="mt-2 rounded-[var(--radius-control)] border border-[var(--border-subtle)] bg-[var(--bg-inspector)] px-2.5 py-1.5 text-[10px] text-[var(--text-secondary)]">
                <summary className="cursor-pointer font-semibold text-[var(--text-primary)]">Study brief</summary>
                <div className="mt-1.5 space-y-1.5 leading-relaxed">
                  <p>{activeScenario.proposal.rationale}</p>
                  <p><strong className="text-[var(--text-primary)]">Existing asset:</strong> {activeScenario.proposal.existingAssetDecision.toLowerCase().replace('_', ' ')} — {activeScenario.proposal.existingAssetScope}</p>
                  <p><strong className="text-[var(--text-primary)]">Public realm:</strong> {activeScenario.proposal.publicRealmIntent}</p>
                  <p><strong className="text-[var(--text-primary)]">Phasing:</strong> {activeScenario.proposal.phasingConcept}</p>
                </div>
              </details>
            )}
          </div>

          {/* Reset Button (Restores Active Scenario to Baseline Concept) */}
          <button
            onClick={() => onResetScenario(activeScenario.id)}
            title="Reset active scenario to original baseline concept"
            aria-label="Reset scenario to baseline concept"
            className="button-secondary flex items-center gap-1 px-2.5 py-1 text-[11px] font-mono font-semibold transition-colors cursor-pointer shrink-0"
          >
            <RotateCcw className="w-3.5 h-3.5 text-[var(--status-evidence)]" />
            <span>Reset</span>
          </button>
        </div>

        {/* Base Concept vs Working Override Geometry Readout */}
        {isOverridden ? (
          <div className="p-2.5 bg-[var(--status-investigation-surface)] border border-[var(--status-investigation)] rounded-[var(--radius-card)] space-y-1 text-xs">
            <div className="flex items-center justify-between text-[var(--text-secondary)] text-[11px]">
              <span className="text-[var(--text-muted)]">Base Concept:</span>
              <span className="font-mono">{baseFloors} Storeys ({baseGFA.toLocaleString()} m² GFA)</span>
            </div>
            <div className="flex items-center justify-between text-[var(--status-investigation)] font-semibold text-[11px]">
              <span>Working Geometry:</span>
              <span className="font-mono font-bold">{metrics.totalFloors} Storeys ({metrics.totalGFA.toLocaleString()} m² GFA)</span>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between text-[10px] text-[var(--text-secondary)] bg-[var(--bg-inspector)] px-2.5 py-1.5 rounded-[var(--radius-control)] border border-[var(--border-subtle)]">
            <span>Base Concept: {baseFloors} Storeys ({baseGFA.toLocaleString()} m² GFA)</span>
            <span className="font-mono text-[var(--status-verified)] font-semibold">Active Baseline</span>
          </div>
        )}

        {/* Pairwise Collision Alert Banner */}
        {hasCollision && (
          <div className="p-2.5 bg-[var(--status-error-surface)] border border-[var(--status-error)] rounded-[var(--radius-card)] space-y-1.5 text-xs text-[var(--status-error)]">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-[var(--text-primary)] block">Mass Collision Active!</span>
                <span className="text-[11px] text-[var(--status-error)]">
                  {activeScenario.pairwiseOverlap?.overlaps[0]?.massA} intersects with {activeScenario.pairwiseOverlap?.overlaps[0]?.massB} (Overlap volume: {activeScenario.pairwiseOverlap?.overlapVolumeM3.toLocaleString()} m³).
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Setback Encroachment Alert & Fit Action */}
        {(activeScenario.status === 'WARNING_EXCEEDS_CONSTRAINT' || encroachments.length > 0) && (
          <div className="p-2.5 bg-[var(--status-error-surface)] border border-[var(--status-error)] rounded-[var(--radius-card)] space-y-2 text-xs text-[var(--status-error)]">
            <div className="flex items-start gap-2">
              <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
              <div className="flex-1 leading-snug">
                {encroachments.length > 0 
                  ? encroachments[0].description 
                  : (activeScenario.warningMessage || 'Exceeds zoning constraints.')}
              </div>
            </div>

            {encroachments.length > 0 && (
              <button
                onClick={() => onFitMassingToEnvelope(activeScenario.id)}
                className="button-secondary w-full py-1.5 px-2.5 text-[var(--status-error)] text-[11px] font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Fit Massing to Setback Envelope
              </button>
            )}
          </div>
        )}
      </div>

      {/* Main Content: Metrics & Interactive Parameter Adjuster */}
      <div className="p-3 flex-1 overflow-y-auto space-y-3.5">
        {/* Interactive Parameter Adjuster */}
        <div className="surface-inspector p-3">
          <div className="flex items-center justify-between mb-2.5">
            <div className="flex items-center gap-1.5 text-[var(--text-primary)] text-xs font-semibold">
              <Sliders className="w-3.5 h-3.5" />
              Scenario Parameters ({activeScenario.name.split(':')[0]})
            </div>
            <span className="type-metadata">Independent</span>
          </div>

          <div className="space-y-3">
            {/* Tower storeys */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-[var(--text-secondary)]">Tower storeys</span>
                <span className="font-mono font-bold text-[var(--text-primary)] bg-[var(--bg-hover)] px-2 py-0.5 rounded-[var(--radius-control)] text-[11px]">
                  {towerFloors === null ? 'Unavailable' : `${towerFloors} Fl · ${Math.max(...towerMasses.map((mass) => mass.height)).toFixed(1)} m`}
                </span>
              </div>
              {towerFloors === null ? (
                <p className="text-[9px] leading-relaxed text-[var(--text-muted)]">This option has no tower. Other building elements will not be changed.</p>
              ) : (
                <>
                  <CommittedRangeInput min={1} max={towerSliderMax} value={towerFloors} ariaLabel="Tower storeys" onCommit={(value) => onUpdateScenarioParam(activeScenario.id, 'towerFloors', value)} className="w-full h-1.5 bg-[var(--border-strong)] rounded-lg appearance-none cursor-pointer accent-[var(--action-primary)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]" />
                  <p className={`text-[9px] font-mono ${towerPermittedFloors !== null && towerFloors > towerPermittedFloors ? 'text-[var(--status-error)]' : 'text-[var(--text-muted)]'}`}>{towerPermittedFloors === null ? 'Editable range unavailable: supply height, or FAR and KDB.' : `Editable study range: 1–${towerSliderMax} Fl · supplied planning limit: ${towerPermittedFloors} Fl${floorLimit.kind === 'FAR_COVERAGE_STUDY_ESTIMATE' ? ' (study estimate, not a legal maximum)' : ''}`}</p>
                </>
              )}
            </div>

            {/* Podium storeys */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs mb-1"><span className="text-[var(--text-secondary)]">Podium storeys</span><span className="font-mono font-bold text-[var(--text-primary)] bg-[var(--bg-hover)] px-2 py-0.5 rounded-[var(--radius-control)] text-[11px]">{podiumFloors === null ? 'Unavailable' : `${podiumFloors} Fl · ${Math.max(...podiumMasses.map((mass) => mass.height)).toFixed(1)} m`}</span></div>
              {podiumFloors === null ? (
                <p className="text-[9px] leading-relaxed text-[var(--text-muted)]">This option has no podium. Other building elements will not be changed.</p>
              ) : (
                <>
                  <CommittedRangeInput min={1} max={podiumSliderMax} value={podiumFloors} ariaLabel="Podium storeys" onCommit={(value) => onUpdateScenarioParam(activeScenario.id, 'podiumFloors', value)} className="w-full h-1.5 bg-[var(--border-strong)] rounded-lg appearance-none cursor-pointer accent-[var(--action-primary)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]" />
                  <p className={`text-[9px] font-mono ${podiumPermittedFloors !== null && podiumFloors > podiumPermittedFloors ? 'text-[var(--status-error)]' : 'text-[var(--text-muted)]'}`}>{podiumPermittedFloors === null ? 'Editable range unavailable: supply height, or FAR and KDB.' : `Editable study range: 1–${podiumSliderMax} Fl · supplied planning limit: ${podiumPermittedFloors} Fl${floorLimit.kind === 'FAR_COVERAGE_STUDY_ESTIMATE' ? ' (study estimate, not a legal maximum)' : ''}`}</p>
                </>
              )}
            </div>

            {/* Front Setback Slider */}
            <div>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-[var(--text-secondary)]">Front setback</span>
                <span className="font-mono font-bold text-[var(--text-primary)] bg-[var(--bg-hover)] px-2 py-0.5 rounded-[var(--radius-control)] text-[11px]">
                  {currentSetback} m
                </span>
              </div>
              <CommittedRangeInput
                min={0}
                max={frontSetbackMax}
                value={currentSetback}
                ariaLabel="Front setback in metres"
                onCommit={(value) => onUpdateScenarioParam(activeScenario.id, 'frontSetback', value)}
                className="w-full h-1.5 bg-[var(--border-strong)] rounded-lg appearance-none cursor-pointer accent-[var(--spatial-selection)]"
              />
              <div className="flex justify-between text-[9px] text-[var(--text-muted)] font-mono mt-0.5">
                <span>0 m · frontage line</span>
                <span>{frontSetbackMax} m · parcel-derived range</span>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between text-xs mb-1"><span className="text-[var(--text-secondary)]">Side setback</span><span className="font-mono font-bold text-[var(--text-primary)] bg-[var(--bg-hover)] px-2 py-0.5 rounded-[var(--radius-control)] text-[11px]">{currentSideSetback} m each side</span></div>
              <CommittedRangeInput min={0} max={sideSetbackMax} value={currentSideSetback} ariaLabel="Symmetric side setback in metres" onCommit={(value) => onUpdateScenarioParam(activeScenario.id, 'sideSetback', value)} className="w-full h-1.5 bg-[var(--border-strong)] rounded-lg appearance-none cursor-pointer accent-[var(--spatial-selection)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]" />
              <div className="flex justify-between text-[9px] text-[var(--text-muted)] font-mono mt-0.5"><span>0 m</span><span>Default for new opportunities: 4 m</span><span>{sideSetbackMax} m</span></div>
            </div>

            <div>
              <div className="flex items-center justify-between text-xs mb-1"><span className="text-[var(--text-secondary)]">Rear setback</span><span className="font-mono font-bold text-[var(--text-primary)] bg-[var(--bg-hover)] px-2 py-0.5 rounded-[var(--radius-control)] text-[11px]">{currentRearSetback} m</span></div>
              <CommittedRangeInput min={0} max={Math.max(currentRearSetback, Math.floor(Math.max(0, parcelBounds.length - activeScenario.assumptionsUsed.setbacks.front)))} value={currentRearSetback} ariaLabel="Rear setback in metres" onCommit={(value) => onUpdateScenarioParam(activeScenario.id, 'rearSetback', value)} className="w-full h-1.5 bg-[var(--border-strong)] rounded-lg appearance-none cursor-pointer accent-[var(--spatial-selection)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]" />
              <div className="flex justify-between text-[9px] text-[var(--text-muted)] font-mono mt-0.5"><span>0 m</span><span>Parcel-derived range</span></div>
            </div>

            {/* Encroachment Status Line */}
            <div className="pt-2 border-t border-[var(--border-subtle)] flex items-center justify-between text-[11px]">
              <span className="text-[var(--text-secondary)]">Buildable: {metrics.netBuildableArea.toLocaleString()} m²</span>
              {encroachments.length === 0 ? (
                <span className="text-[var(--status-verified)] text-[10px] flex items-center gap-1 font-semibold">
                  <CheckCircle2 className="w-3 h-3" /> Fully Contained
                </span>
              ) : (
                <button
                  onClick={() => onFitMassingToEnvelope(activeScenario.id)}
                  aria-label="Fit massing to setback"
                  className="button-secondary text-[10px] text-[var(--status-error)] flex items-center gap-1 font-semibold px-2 py-1 transition-colors cursor-pointer"
                >
                  <RefreshCw className="w-3 h-3" /> Fit to Setback
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Live Yield Metrics Grid */}
        <div>
          <h4 className="text-[11px] font-semibold text-[var(--text-secondary)] mb-2.5">
            Development Figures
          </h4>

          {(() => {
            const maxFAR = project?.zoningLimits?.maxFAR;
            const maxCoverage = project?.zoningLimits?.maxCoveragePct;
            const hasZoningEvidence = Boolean(site.hasZoningEvidence);

            return (
              <div className="grid grid-cols-2 gap-2">
                <div className="surface-inspector p-2.5">
                  <span className="text-[10px] text-[var(--text-secondary)] block">Total GFA</span>
                  <span className="text-base font-bold text-[var(--text-primary)] font-mono">
                    {metrics.totalGFA.toLocaleString()} <span className="text-xs font-normal text-[var(--text-muted)]">m²</span>
                  </span>
                </div>

                <div className="surface-inspector p-2.5">
                  <span className="text-[10px] text-[var(--text-secondary)] block">FAR / KLB Ratio</span>
                  <span className={`text-base font-bold font-mono ${maxFAR !== undefined && metrics.farKLB > maxFAR + 0.01 ? 'text-[var(--status-error)]' : 'text-[var(--status-evidence)]'}`}>
                    {metrics.farKLB.toFixed(2)}x
                  </span>
                  <span className="text-[9px] text-[var(--text-muted)] block">
                    {maxFAR === undefined ? 'FAR limit not provided' : `${hasZoningEvidence ? 'Confirmed cap' : 'Supplied target'}: ${maxFAR.toFixed(2)}x`}
                  </span>
                </div>

                <div className="surface-inspector p-2.5">
                  <span className="text-[10px] text-[var(--text-secondary)] block">Site Coverage (KDB)</span>
                  <span className={`text-base font-bold font-mono ${maxCoverage !== undefined && metrics.siteCoveragePercentage > maxCoverage + 0.1 ? 'text-[var(--status-error)]' : 'text-[var(--text-primary)]'}`}>
                    {metrics.siteCoveragePercentage}%
                  </span>
                  <span className="text-[9px] text-[var(--text-muted)] block">
                    {maxCoverage === undefined ? 'KDB limit not provided' : `${hasZoningEvidence ? 'Confirmed limit' : 'Supplied limit'}: ${maxCoverage}%`}
                  </span>
                </div>

                <div className="surface-inspector p-2.5">
                  <span className="text-[10px] text-[var(--text-secondary)] block">Unbuilt Site Area</span>
                  <span className="text-base font-bold text-[var(--status-verified)] font-mono">
                    {metrics.openSpaceArea.toLocaleString()} <span className="text-xs font-normal text-[var(--text-muted)]">m²</span>
                  </span>
                  <span className="text-[9px] text-[var(--text-muted)] block">({metrics.openSpacePercentage}% unbuilt)</span>
                </div>
              </div>
            );
          })()}
        </div>

        {/* On-demand planning and investment review */}
        <div className="pt-2 border-t border-[var(--border-subtle)] space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-[var(--status-investigation)] text-xs font-semibold">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Planning &amp; Investment Intelligence</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="font-mono text-[9px] text-[var(--text-muted)]" title="Configured model for planning assessment">
                Configured model · gemini-3.7-flash
              </span>
              <span className="status-badge status-badge--investigation !min-h-0 !rounded-[var(--radius-control)] !px-1.5 !py-0.5 text-[9px]">
                On request
              </span>
            </div>
          </div>

          {/* Interactive Investor Prompt Box */}
          <div className="surface-inspector space-y-1.5 p-2">
            <label className="block text-[10px] font-semibold text-[var(--text-secondary)]">
              Question for review
            </label>
            <div className="flex gap-1.5">
              <input
                type="text"
                value={investorQuery}
                onChange={(e) => setInvestorQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !isLoadingAssessment) {
                    e.preventDefault();
                    handleGenerateAssessment(investorQuery);
                  }
                }}
                placeholder="e.g. Evaluate Rp 125.3B yield vs NJOP benchmark"
                className="flex-1 min-h-[var(--control-height-md)] bg-[var(--bg-primary)] border border-[var(--border-default)] rounded-[var(--radius-control)] px-2.5 py-1.5 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--focus-ring)]"
              />
              <button
                type="button"
                onClick={() => handleGenerateAssessment(investorQuery)}
                disabled={isLoadingAssessment}
                className="button-primary px-3 py-1.5 text-xs font-semibold flex items-center gap-1 cursor-pointer disabled:opacity-50"
              >
                <span>Review</span>
              </button>
            </div>

            {/* Quick Prompt Chips */}
            <div className="flex flex-wrap gap-1 pt-1">
              {[
                'Evaluate yield vs asking price',
                'Analyze expansion headroom',
                'Check KDH 20% & parking'
              ].map((chip) => (
                <button
                  key={chip}
                  type="button"
                  onClick={() => {
                    setInvestorQuery(chip);
                    handleGenerateAssessment(chip);
                  }}
                  disabled={isLoadingAssessment}
                  className="button-secondary !min-h-[24px] text-[9px] px-1.5 py-0.5 text-[var(--status-investigation)] cursor-pointer transition-colors"
                >
                  {chip}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={() => handleGenerateAssessment(investorQuery)}
            disabled={isLoadingAssessment}
            aria-label="Prepare planning and investment assessment"
            className="w-full button-primary py-2 px-3 text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer disabled:opacity-50"
          >
            {isLoadingAssessment ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Preparing assessment...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5" />
                <span>Prepare Planning Assessment</span>
              </>
            )}
          </button>

          {assessmentError && (
            <div className="p-3 bg-[var(--status-error-surface)] border border-[var(--status-error)] rounded-[var(--radius-card)] text-xs text-[var(--status-error)] space-y-2">
              <div className="flex items-center gap-1.5 font-semibold text-[var(--text-primary)]">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                <span>Assessment Request Failed</span>
              </div>
              <p className="text-[11px] leading-relaxed">
                {assessmentError}
              </p>
              <button
                onClick={() => handleGenerateAssessment()}
                className="button-secondary px-2.5 py-1 text-[var(--status-error)] text-[11px] font-semibold flex items-center gap-1 cursor-pointer transition-colors"
              >
                <RefreshCw className="w-3 h-3" />
                <span>Retry Assessment</span>
              </button>
            </div>
          )}

          {assessment && (
            <div className="surface-inspector p-3 space-y-2 text-xs">
              {isAssessmentStale && (
                <div className="p-2 bg-[var(--status-warning-surface)] border border-[var(--status-warning)] rounded-[var(--radius-card)] flex items-center justify-between gap-2 text-[var(--status-warning)] text-[11px]">
                  <div className="flex items-center gap-1.5 font-semibold">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    <span>Needs updating · inputs changed since this assessment</span>
                  </div>
                  <button
                    onClick={() => handleGenerateAssessment()}
                    disabled={isLoadingAssessment}
                    className="button-secondary !min-h-[24px] px-2 py-0.5 text-[var(--status-warning)] text-[10px] font-semibold cursor-pointer shrink-0"
                  >
                    Re-evaluate
                  </button>
                </div>
              )}

              <div className="flex items-center justify-between pb-1.5 border-b border-[var(--border-subtle)]">
                <span className="text-[10px] font-semibold text-[var(--text-secondary)]">Executive Verdict</span>
                <span className={`status-badge !min-h-0 !px-2 !py-0.5 text-[9px] ${
                  assessment.status === 'WITHIN_SUPPLIED_STUDY_ENVELOPE'
                    ? 'status-badge--verified'
                    : 'status-badge--error'
                }`}>
                  {assessment.status === 'WITHIN_SUPPLIED_STUDY_ENVELOPE' ? 'Within supplied study envelope' : 'Planning issues found'}
                </span>
              </div>

              <p className="text-[var(--text-primary)] font-medium leading-relaxed text-[11px]">
                {assessment.decision}
              </p>

              {assessment.supportingEvidence.length > 0 && (
                <div className="space-y-1 pt-1">
                  <span className="text-[10px] text-[var(--text-secondary)] font-semibold block">
                    Basis for assessment:
                  </span>
                  <ul className="space-y-0.5 text-[11px] text-[var(--text-secondary)] list-disc list-inside marker:text-[var(--status-evidence)]">
                    {assessment.supportingEvidence.map((ev, idx) => (
                      <li key={idx} className="leading-snug">{ev}</li>
                    ))}
                  </ul>
                </div>
              )}

              {assessment.identifiedRisks.length > 0 && (
                <div className="space-y-1 pt-1">
                  <span className="text-[10px] text-[var(--status-warning)] font-semibold block">
                    Identified Risks:
                  </span>
                  <ul className="space-y-0.5 text-[11px] text-[var(--text-secondary)] list-disc list-inside marker:text-[var(--status-warning)]">
                    {assessment.identifiedRisks.map((rk, idx) => (
                      <li key={idx} className="leading-snug">{rk}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="pt-1.5 border-t border-[var(--border-subtle)]">
                <span className="text-[10px] text-[var(--status-evidence)] font-semibold block mb-0.5">
                  Recommended Action:
                </span>
                <div className="p-2 bg-[var(--status-evidence-surface)] rounded-[var(--radius-control)] border border-[var(--status-evidence)] text-[11px] text-[var(--text-primary)] flex items-start gap-1.5">
                  <ArrowRight className="w-3.5 h-3.5 text-[var(--status-evidence)] shrink-0 mt-0.5" />
                  <span>{assessment.recommendedAction}</span>
                </div>
              </div>

              <div className="pt-1 flex items-center justify-end text-[9px] text-[var(--text-muted)] font-mono">
                <span>Prepared {new Date(assessment.generatedAt).toLocaleTimeString()}</span>
              </div>
            </div>
          )}
        </div>

        {/* Building Mass Composition */}
        <div className="pt-2 border-t border-[var(--border-subtle)]">
          <h5 className="text-[11px] font-semibold text-[var(--text-secondary)] mb-2">
            {hasCollision ? 'Massing Blocks (Collision Active)' : 'Massing Blocks (Zero Overlap)'}
          </h5>
          <div className="space-y-1.5">
            {activeScenario.masses.map((m) => (
              <div key={m.id} className="surface-inspector flex items-center justify-between text-xs px-3 py-2">
                <div className="flex items-center gap-2">
                  <span className={`w-2.5 h-2.5 rounded-sm ${m.type === 'PODIUM' ? 'bg-[var(--status-evidence)]' : 'bg-[var(--spatial-selection)]'}`} />
                  <span className="text-[var(--text-primary)] font-medium">{m.name}</span>
                </div>
                <div className="text-[var(--text-secondary)] font-mono text-[11px]">
                  {m.floors} Fl · {m.gfa.toLocaleString()} m²
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Accessible COLLADA XML Viewer Modal */}
      {showXmlModal && (
        <div 
          role="dialog"
          aria-modal="true"
          aria-labelledby="xml-modal-title"
          aria-describedby="xml-modal-desc"
          onClick={handleCloseXmlModal}
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <div 
            ref={modalRef}
            onClick={(e) => e.stopPropagation()}
            className="bg-[var(--bg-secondary)] border border-[var(--border-default)] rounded-[var(--radius-panel)] max-w-2xl w-full max-h-[80vh] flex flex-col shadow-[var(--shadow-elevated)] overflow-hidden"
          >
            <div className="p-3 border-b border-[var(--border-subtle)] flex items-center justify-between bg-[var(--bg-tertiary)]">
              <div className="flex items-center gap-2">
                <Code2 className="w-4 h-4 text-[var(--status-evidence)]" />
                <h4 id="xml-modal-title" className="type-section-title">
                  COLLADA XML ({exportFilename})
                </h4>
              </div>
              <button
                onClick={handleCloseXmlModal}
                aria-label="Close dialog"
                className="p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)] rounded-[var(--radius-control)] hover:bg-[var(--bg-hover)] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 flex-1 overflow-hidden flex flex-col">
              <p id="xml-modal-desc" className="text-[11px] text-[var(--text-secondary)] mb-2">
                Click inside the code box to select all, then press <kbd className="bg-slate-800 px-1 py-0.5 rounded text-white font-mono text-[10px]">Ctrl+C</kbd> (or <kbd className="bg-slate-800 px-1 py-0.5 rounded text-white font-mono text-[10px]">Cmd+C</kbd>):
              </p>
              <textarea
                readOnly
                value={rawXml}
                onClick={(e) => (e.target as HTMLTextAreaElement).select()}
                className="w-full flex-1 min-h-[300px] bg-[var(--bg-primary)] border border-[var(--border-default)] rounded-[var(--radius-control)] p-3 text-xs font-mono text-[var(--text-secondary)] focus:border-[var(--focus-ring)] resize-none"
              />
            </div>

            <div className="p-3 border-t border-[var(--border-subtle)] flex justify-between items-center bg-[var(--bg-tertiary)]">
              <button
                onClick={handleClientDownloadBlob}
                className="button-secondary flex items-center gap-1.5 px-3 py-1.5 text-[var(--status-evidence)] text-xs font-semibold cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Save .dae File</span>
              </button>

              <button
                onClick={handleCloseXmlModal}
                className="button-primary px-3 py-1.5 text-xs font-semibold cursor-pointer"
              >
                Close (Esc)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
