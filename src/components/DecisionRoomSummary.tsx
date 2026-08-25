'use client';

import React, { useMemo } from 'react';
import { Project } from '@/types';
import { 
  TrendingUp, 
  AlertTriangle, 
  HelpCircle, 
  ArrowRightCircle, 
  Clock, 
  CheckCircle2, 
  Compass, 
  User,
  Download,
  Printer,
} from 'lucide-react';
import { buildProjectReport, generateProjectReportPdf, safeReportFilename } from '@/lib/reporting/project-report';

interface DecisionRoomSummaryProps {
  project: Project;
  selectedScenarioId?: string;
}

export function DecisionRoomSummary({ project, selectedScenarioId }: DecisionRoomSummaryProps) {
  const { actions = [], executiveSummary, issues = [] } = project;
  const report = useMemo(
    () => buildProjectReport(project, selectedScenarioId, project.updatedAt),
    [project, selectedScenarioId],
  );

  const topOpportunities = executiveSummary?.topOpportunities || [];
  const criticalRisks = executiveSummary?.criticalRisks || [];
  const recommendedNextMove = executiveSummary?.recommendedNextMove || 
    'Upload land certificates, topographic surveys, or municipal planning documents to establish a reliable feasibility basis.';

  const downloadBrief = () => {
    const bytes = generateProjectReportPdf(buildProjectReport(project, selectedScenarioId));
    const blob = new Blob([bytes.buffer as ArrayBuffer], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = safeReportFilename(project.name, 'pdf');
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1500);
  };

  return (
    <div className="panel-shell flex flex-col h-full overflow-hidden select-none">
      {/* Header */}
      <div className="p-3.5 border-b border-[var(--border-subtle)] flex items-center justify-between bg-[var(--bg-tertiary)]">
        <div className="flex items-center gap-2">
          <Compass className="w-4 h-4 text-[var(--status-evidence)]" />
          <h3 className="type-section-title">Executive Decision Brief</h3>
        </div>
        <div className="flex items-center gap-1 text-xs">
          <button type="button" onClick={() => window.print()} className="button-secondary p-1.5" aria-label="Print Executive Brief"><Printer className="h-3.5 w-3.5" /></button>
          <button type="button" onClick={downloadBrief} className="button-secondary p-1.5" aria-label="Download Executive Brief PDF"><Download className="h-3.5 w-3.5" /></button>
          <span className="text-[var(--text-muted)]">Site Readiness:</span>
          <span className="font-bold text-[var(--status-verified)] font-mono">{project.siteReadinessPercentage}%</span>
        </div>
      </div>

      <div className="p-3.5 flex-1 overflow-y-auto space-y-3.5">
        <section className="surface-inspector space-y-2 p-3" aria-label="Opportunity and parcel summary">
          <div>
            <h4 className="text-xs font-semibold text-[var(--text-primary)]">{report.opportunity}</h4>
            <p className="mt-0.5 text-[10px] text-[var(--text-secondary)]">{report.address}</p>
          </div>
          <div className="grid grid-cols-3 gap-2 border-y border-[var(--border-subtle)] py-2 text-center font-mono">
            <div><span className="block text-[9px] text-[var(--text-muted)]">AREA</span><strong className="text-[11px] text-[var(--text-primary)]">{report.site.areaM2.toLocaleString()} m²</strong></div>
            <div><span className="block text-[9px] text-[var(--text-muted)]">FRONTAGE</span><strong className="text-[11px] text-[var(--text-primary)]">{report.site.frontageMeters ?? '—'} m</strong></div>
            <div><span className="block text-[9px] text-[var(--text-muted)]">DEPTH</span><strong className="text-[11px] text-[var(--text-primary)]">{report.site.depthMeters ?? '—'} m</strong></div>
          </div>
          <p className="text-[10px] leading-relaxed text-[var(--text-muted)]">Sources: area {report.site.areaSource}; frontage {report.site.frontageSource}; depth {report.site.depthSource}. {report.site.rectangularStudyWarning}</p>
        </section>

        <section className="surface-inspector p-3" aria-label="Planning limits and options comparison">
          <div className="flex items-center justify-between gap-2"><h4 className="text-xs font-semibold text-[var(--text-primary)]">Options A, B & C</h4><span className="type-metadata">{report.currentOption} selected</span></div>
          <p className="mt-1 text-[10px] text-[var(--text-muted)]">Height {report.planning.maxHeight} · FAR {report.planning.maxFAR} · KDB {report.planning.maxCoverage} · KDH {report.planning.minOpenSpace} · {project.site.landscapedPermeableAreaM2 === undefined ? 'KDH not yet demonstrated' : 'landscaped/permeable area entered'}</p>
          <div className="mt-2 space-y-1.5">
            {report.options.map((option) => (
              <div key={option.scenarioId} className={`grid grid-cols-[52px_minmax(0,1fr)_minmax(0,92px)] items-start gap-2 rounded-[var(--radius-control)] border px-2 py-1.5 text-[10px] ${option.selected ? 'border-[var(--spatial-selection)] bg-[var(--spatial-selection-surface)]' : 'border-[var(--border-subtle)]'}`}>
                <strong className="text-[var(--text-primary)]" title={`${option.option}: ${option.scenarioName}`}>{option.option}</strong>
                <span className="min-w-0 text-[var(--text-secondary)]"><span className="block font-mono whitespace-normal leading-tight">{option.floors} Fl · {option.heightMeters}m · {option.gfaM2.toLocaleString()} m² · FAR {option.farKLB.toFixed(2)}x</span><span className="block truncate text-[9px] text-[var(--text-muted)]" title={option.existingAssetStrategy ? `Existing asset strategy: ${option.existingAssetStrategy}` : 'No existing asset strategy'}>{option.existingAssetStrategy ? `Existing asset: ${option.existingAssetStrategy.toLowerCase().replace(/_/g, ' ')}` : 'No existing asset recorded'}</span></span>
                <span className={`min-w-0 text-right text-[9px] leading-tight break-words ${option.compliance.startsWith('Within supplied') || option.compliance.startsWith('Verified planning') ? 'text-[var(--status-verified)]' : 'text-[var(--status-warning)]'}`} title={option.compliance}>{option.compliance}</span>
              </div>
            ))}
          </div>
          <div className="mt-2 border-t border-[var(--border-subtle)] pt-2 text-[10px] leading-relaxed text-[var(--text-secondary)]"><strong className="text-[var(--text-primary)]">Decision statement:</strong> {report.recommendation}</div>
          {(report.missingInputs.length > 0 || report.warnings.length > 0) && <div className="mt-2 rounded-[var(--radius-control)] bg-[var(--status-warning-surface)] p-2 text-[10px] text-[var(--status-warning)]">{report.warnings[0] || `Missing: ${report.missingInputs.join(', ')}`}</div>}
          <p className="mt-2 font-mono text-[9px] text-[var(--text-muted)]">Last updated {new Date(report.generatedAt).toLocaleString()} · {report.options.find((option) => option.selected)?.scenarioRevision ?? 'Study version not recorded'}</p>
        </section>
        {/* Recommended Pre-Offer Strategy */}
        <div className="p-3 bg-[var(--status-evidence-surface)] border border-[color-mix(in_srgb,var(--status-evidence)_55%,transparent)] rounded-[var(--radius-card)]">
          <div className="flex items-center gap-2 text-[var(--status-evidence)] text-xs font-semibold mb-1.5">
            <ArrowRightCircle className="w-4 h-4" />
            <span>Recommended Due Diligence Strategy</span>
          </div>
          <p className="text-xs text-[var(--text-primary)] leading-relaxed font-medium">
            {recommendedNextMove}
          </p>
        </div>

        {/* Strategic Opportunities */}
        <section className="border-t border-[var(--border-subtle)] pt-3">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5 text-[var(--status-verified)] text-xs font-semibold">
              <TrendingUp className="w-3.5 h-3.5" />
              <span>Strategic Opportunities</span>
            </div>
            <span className="type-metadata">
              {topOpportunities.length} {topOpportunities.length === 1 ? 'Item' : 'Items'}
            </span>
          </div>

          <div className="space-y-2.5">
            {topOpportunities.length > 0 ? (
              topOpportunities.map((opp, idx) => (
                <div key={idx} className="surface-inspector p-2.5 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="status-badge status-badge--verified !min-h-0 !px-1.5 !py-0.5 text-[9px]">
                      <CheckCircle2 className="w-2.5 h-2.5" /> OPPORTUNITY
                    </span>
                    <span className="text-[9px] font-mono text-[var(--text-muted)]">
                      {project.isTemplate ? `Item 0${idx + 1}` : 'Intake Analysis'}
                    </span>
                  </div>
                  <p className="text-xs text-[var(--text-primary)] leading-relaxed">
                    {opp}
                  </p>
                </div>
              ))
            ) : (
              <div className="surface-inspector p-3 text-center text-[var(--text-muted)] text-xs">
                No positive development findings extracted yet.
              </div>
            )}
          </div>
        </section>

        {/* Material Risks & Uncertainties */}
        <section className="border-t border-[var(--border-subtle)] pt-3">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5 text-[var(--status-error)] text-xs font-semibold">
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>Material Risks & Uncertainties</span>
            </div>
            <span className="type-metadata">
              {criticalRisks.length || issues.length} Issues
            </span>
          </div>

          <div className="space-y-2.5">
            {issues.length > 0 ? (
              issues.map((iss) => (
                <div key={iss.id} className="surface-inspector p-2.5 border-l-2 border-l-[var(--status-error)] space-y-1">
                  <div className="flex items-center justify-between">
                    <span className={`status-badge !min-h-0 !px-1.5 !py-0.5 text-[9px] ${
                      iss.severity === 'CRITICAL' 
                        ? 'status-badge--error'
                        : 'status-badge--warning'
                    }`}>
                      <AlertTriangle className="w-2.5 h-2.5" /> {iss.severity}
                    </span>
                    <span className="text-[9px] font-mono text-[var(--text-muted)]">{iss.category.replace(/_/g, ' ')}</span>
                  </div>
                  <p className="text-xs text-[var(--text-primary)] font-semibold leading-snug">
                    {iss.title}
                  </p>
                  <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed">
                    {iss.evidenceSummary || iss.implication}
                  </p>
                </div>
              ))
            ) : criticalRisks.length > 0 ? (
              criticalRisks.map((risk, idx) => (
                <div key={idx} className="surface-inspector p-2.5 border-l-2 border-l-[var(--status-warning)] space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="status-badge status-badge--warning !min-h-0 !px-1.5 !py-0.5 text-[9px]">
                      <HelpCircle className="w-2.5 h-2.5" /> UNCERTAINTY
                    </span>
                    <span className="text-[9px] font-mono text-[var(--text-muted)]">Risk Assessment</span>
                  </div>
                  <p className="text-xs text-[var(--text-primary)] leading-relaxed">
                    {risk}
                  </p>
                </div>
              ))
            ) : (
              <div className="surface-inspector p-3 text-center text-[var(--text-muted)] text-xs">
                No critical risks flagged at this stage.
              </div>
            )}
          </div>
        </section>

        {/* Prioritized Investigation Queue */}
        <section className="border-t border-[var(--border-subtle)] pt-3">
          <div className="flex items-center justify-between mb-2.5">
            <div className="flex items-center gap-1.5 text-[var(--status-investigation)] text-xs font-semibold">
              <Clock className="w-3.5 h-3.5" />
              <span>Prioritized Investigation Queue</span>
            </div>
            <span className="type-metadata">{actions.length} Action Items</span>
          </div>

          <div className="space-y-2">
            {actions.length > 0 ? (
              actions.map((act) => (
                <div key={act.id} className="surface-inspector p-2.5 space-y-1.5">
                  <div className="flex items-center justify-between text-xs font-semibold text-[var(--text-primary)]">
                    <span className="truncate pr-2">{act.title}</span>
                    <span className={`status-badge !min-h-0 !px-1.5 !py-0.5 text-[9px] shrink-0 ${
                      act.priority === 'CRITICAL' 
                        ? 'status-badge--error'
                        : 'status-badge--warning'
                    }`}>
                      {act.priority}
                    </span>
                  </div>

                  <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed">{act.reason}</p>

                  <div className="pt-1 border-t border-[var(--border-subtle)] flex flex-wrap items-center justify-between text-[10px] text-[var(--text-muted)] gap-1">
                    <span className="flex items-center gap-1 text-[var(--text-secondary)] font-medium">
                      <User className="w-3 h-3 text-[var(--status-investigation)]" />
                      {act.assignedTo || 'Unassigned'}
                    </span>
                    <span className="font-mono text-[var(--text-muted)]">
                      Status: <span className="text-[var(--status-warning)] font-semibold">{act.status}</span>
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <div className="surface-inspector p-3 text-center text-[var(--text-muted)] text-xs">
                No pending investigation actions queued.
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
