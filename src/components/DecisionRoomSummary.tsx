'use client';

import React from 'react';
import { Project } from '@/types';
import { 
  TrendingUp, 
  AlertTriangle, 
  HelpCircle, 
  ArrowRightCircle, 
  Clock, 
  CheckCircle2, 
  Compass, 
  User
} from 'lucide-react';

interface DecisionRoomSummaryProps {
  project: Project;
}

export function DecisionRoomSummary({ project }: DecisionRoomSummaryProps) {
  const { actions = [], executiveSummary, issues = [] } = project;

  const topOpportunities = executiveSummary?.topOpportunities || [];
  const criticalRisks = executiveSummary?.criticalRisks || [];
  const recommendedNextMove = executiveSummary?.recommendedNextMove || 
    'Upload land certificates, topographic surveys, or municipal planning documents to build verified feasibility evidence.';

  return (
    <div className="panel-shell flex flex-col h-full overflow-hidden select-none">
      {/* Header */}
      <div className="p-3.5 border-b border-[var(--border-subtle)] flex items-center justify-between bg-[var(--bg-tertiary)]">
        <div className="flex items-center gap-2">
          <Compass className="w-4 h-4 text-[var(--status-evidence)]" />
          <h3 className="type-section-title">Executive Decision Brief</h3>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="text-[var(--text-muted)]">Site Readiness:</span>
          <span className="font-bold text-[var(--status-verified)] font-mono">{project.siteReadinessPercentage}%</span>
        </div>
      </div>

      <div className="p-3.5 flex-1 overflow-y-auto space-y-3.5">
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
