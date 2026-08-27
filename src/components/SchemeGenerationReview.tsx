'use client';

import React, { useEffect, useRef } from 'react';
import { AlertTriangle, Check, CheckCircle2, Sparkles, X } from 'lucide-react';
import type { DevelopmentScenario, SchemeGenerationMetadata } from '@/types';

interface SchemeGenerationReviewProps {
  generation: SchemeGenerationMetadata;
  onAccept: (proposalId: string) => void | Promise<void>;
  onReject?: () => void | Promise<void>;
  baselineSummary?: string;
  scenarios?: DevelopmentScenario[];
  selectedScenario?: DevelopmentScenario;
  isOpen: boolean;
  onOpen: () => void;
  onClose: () => void;
}

function providerStatus(generation: SchemeGenerationMetadata) {
  if (generation.providerUsage?.outcome === 'VALIDATED_STRATEGIES') return 'Live Gemini proposals';
  if (generation.providerUsage?.outcome === 'REQUEST_FAILED') return 'Gemini request failed';
  if (generation.providerUsage?.outcome === 'OUTPUT_INVALID') return 'Invalid Gemini proposal';
  return 'Template fallback';
}

function planningStatus(scenario?: DevelopmentScenario) {
  if (!scenario) return 'Planning check pending';
  return scenario.complianceReport?.statusPillLabel
    || (scenario.status === 'VALID' ? 'Within supplied study envelope' : 'Outside supplied study envelope');
}

function selectedLabel(generation: SchemeGenerationMetadata, selectedScenario?: DevelopmentScenario) {
  const accepted = generation.proposals.find((proposal) => proposal.id === generation.acceptedProposalId);
  if (accepted) return accepted.name.replace(/^Scheme ([A-C])\s*[—-]\s*/, 'Option $1 · ');
  if (selectedScenario) return `${selectedScenario.name.replace(/^Scenario ([A-C])\s*[—-]\s*/, 'Option $1 · ')} · current view`;
  return 'No study selected';
}

export function SchemeGenerationReview({
  generation,
  onAccept,
  onReject,
  baselineSummary,
  scenarios = [],
  selectedScenario,
  isOpen,
  onOpen,
  onClose,
}: SchemeGenerationReviewProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const openButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const restoreFocus = openButtonRef.current;
    const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    focusable?.[0]?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== 'Tab' || !focusable || focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      (previouslyFocused || restoreFocus)?.focus();
    };
  }, [isOpen, onClose]);

  if (generation.status !== 'READY' && generation.status !== 'NEEDS_REGENERATION') return null;

  const needsRegeneration = generation.status === 'NEEDS_REGENERATION';
  const accepted = generation.acceptedProposalId;

  return (
    <>
      <div
        className="mx-3 mt-2 flex min-h-[42px] items-center justify-between gap-2 rounded-[var(--radius-control)] border border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-2.5 py-1.5 text-[10px]"
        aria-label="Development study review status"
      >
        <div className="flex min-w-0 items-center gap-2">
          <Sparkles className="h-3.5 w-3.5 shrink-0 text-[var(--status-evidence)]" aria-hidden="true" />
          <span className="truncate font-semibold text-[var(--text-primary)]">
            {needsRegeneration ? 'Studies need updating' : '3 development studies ready'}
          </span>
          <span className="hidden truncate text-[var(--text-secondary)] sm:inline">· {selectedLabel(generation, selectedScenario)}</span>
          <span className={`status-badge !min-h-0 !px-1.5 !py-0.5 text-[9px] ${accepted && !needsRegeneration ? 'status-badge--verified' : 'status-badge--investigation'}`}>
            {accepted && !needsRegeneration ? 'ACCEPTED' : 'PENDING REVIEW'}
          </span>
          <span className="hidden truncate text-[var(--text-muted)] md:inline">· {providerStatus(generation)}</span>
        </div>
        <button
          ref={openButtonRef}
          type="button"
          onClick={onOpen}
          className="button-secondary shrink-0 px-2.5 py-1 text-[10px] font-semibold"
          aria-haspopup="dialog"
          aria-expanded={isOpen}
        >
          Review studies
        </button>
      </div>

      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-3 backdrop-blur-sm sm:p-5"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) onClose();
          }}
        >
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="generated-studies-title"
            className="dialog-shell max-h-[calc(100vh-1.5rem)] w-full max-w-5xl overflow-hidden sm:max-h-[calc(100vh-2.5rem)]"
          >
            <div className="dialog-header flex items-start justify-between gap-3 p-3.5 sm:p-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 shrink-0 text-[var(--status-evidence)]" aria-hidden="true" />
                  <h2 id="generated-studies-title" className="text-sm font-bold text-[var(--text-primary)]">Three development studies ready for review</h2>
                </div>
                <p className="mt-1 text-[10px] leading-relaxed text-[var(--text-secondary)]">Review the positioning, assumptions, and planning check for each study before accepting one for editing.</p>
                <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[9px] text-[var(--text-muted)]">
                  <span>{providerStatus(generation)}</span>
                  {generation.modelCalled ? <span>{generation.model}</span> : <span>Model not called · template schemes used</span>}
                  <span>Study version {generation.sourceStudyVersion.replace(/^Study version\s*/i, '')}</span>
                </div>
              </div>
              <button type="button" onClick={onClose} aria-label="Close study review" className="dialog-close shrink-0 p-1.5">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="max-h-[calc(100vh-9rem)] overflow-y-auto p-3 sm:p-4">
              {needsRegeneration && (
                <div className="mb-3 flex items-start gap-2 rounded-[var(--radius-control)] border border-[var(--status-warning)] bg-[var(--status-warning-surface)] p-2.5 text-[10px] text-[var(--status-warning)]" role="alert">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  <span><strong>Inputs changed after these studies were prepared.</strong> Generate a new set before relying on the proposals.</span>
                </div>
              )}

              <details className="mb-3 rounded-[var(--radius-control)] border border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-2.5 py-2 text-[9px] text-[var(--text-secondary)]">
                <summary className="cursor-pointer font-semibold text-[var(--text-primary)]">How these schemes were prepared</summary>
                <dl className="mt-2 grid grid-cols-1 gap-x-4 gap-y-1 leading-relaxed sm:grid-cols-2">
                  <div><dt className="inline font-semibold">Source: </dt><dd className="inline">{providerStatus(generation)} · {generation.provider}</dd></div>
                  <div><dt className="inline font-semibold">Disclosure: </dt><dd className="inline">{generation.disclosure}</dd></div>
                  {generation.modelCalled && <div><dt className="inline font-semibold">Model: </dt><dd className="inline">{generation.model}</dd></div>}
                  <div><dt className="inline font-semibold">Run / correlation: </dt><dd className="inline font-mono break-all">{generation.taskmasterRunId || 'Not recorded'} / {generation.correlationId || 'Not recorded'}</dd></div>
                  <div><dt className="inline font-semibold">Confirmed input: </dt><dd className="inline font-mono break-all">{generation.inputHash}</dd></div>
                  <div><dt className="inline font-semibold">Validation: </dt><dd className="inline">{generation.preparation?.validationResult || (generation.validation.valid ? 'PASSED' : 'FAILED')} · distinctness {generation.preparation?.distinctnessResult || 'not recorded'}</dd></div>
                  <div><dt className="inline font-semibold">Repair: </dt><dd className="inline">{generation.preparation?.repairAttempted ? (generation.preparation.repairSucceeded ? 'One bounded repair passed' : 'One bounded repair failed') : 'Not required'}</dd></div>
                  <div><dt className="inline font-semibold">Provider usage: </dt><dd className="inline">{generation.providerUsage?.providerRequests ?? 0} attempted · {generation.providerUsage?.providerResponses ?? 0} responses · {generation.providerUsage?.modelOutputsReceived ?? 0} outputs · {generation.providerUsage?.modelOutputsSchemaAccepted ?? 0} schema accepted · {generation.providerUsage?.repairRequests ?? 0} repairs · {(generation.providerUsage?.totalTokens ?? 0).toLocaleString()} tokens{generation.providerUsage?.location ? ` · ${generation.providerUsage.location}` : ''}{generation.providerUsage?.estimatedCostUsd !== undefined ? ` · approximately $${generation.providerUsage.estimatedCostUsd.toFixed(6)}` : ''}</dd></div>
                  <div className="sm:col-span-2"><dt className="inline font-semibold">Inputs and assumptions used: </dt><dd className="inline">{generation.assumptions.join(' · ') || 'No additional assumptions recorded'}</dd></div>
                  <div className="sm:col-span-2"><dt className="inline font-semibold">Additional strategy instructions: </dt><dd className="inline">{generation.additionalStrategyInstructions || 'None supplied'}{!generation.modelCalled && generation.additionalStrategyInstructions ? ' · Templates did not interpret nuanced instructions.' : ''}</dd></div>
                  <div className="sm:col-span-2"><dt className="inline font-semibold">Information still required: </dt><dd className="inline">{generation.preparation?.informationStillRequired.join(' · ') || 'None recorded'}</dd></div>
                </dl>
              </details>

              <div className="grid grid-cols-1 gap-2.5 lg:grid-cols-3">
                {generation.proposals.map((proposal, index) => {
                  const scenario = scenarios.find((item) => item.proposal?.id === proposal.id) || scenarios[index];
                  const isAccepted = accepted === proposal.id;
                  return (
                    <article key={proposal.id} className={`flex min-w-0 flex-col rounded-[var(--radius-control)] border p-3 ${isAccepted ? 'border-[var(--status-verified)] bg-[var(--status-verified-surface)]' : 'border-[var(--border-subtle)] bg-[var(--bg-secondary)]'}`}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="mb-1 text-[9px] font-mono uppercase tracking-wider text-[var(--text-muted)]">Option {String.fromCharCode(65 + index)}</div>
                          <h3 className="text-xs font-bold text-[var(--text-primary)]">{proposal.name.replace(/^Scheme [A-C]\s*[—-]\s*/, '')}</h3>
                        </div>
                        {isAccepted && <CheckCircle2 className="h-4 w-4 shrink-0 text-[var(--status-verified)]" aria-label="Accepted study" />}
                      </div>
                      <p className="mt-2 text-[10px] font-semibold leading-relaxed text-[var(--status-evidence)]">{proposal.schemePoint}</p>
                      <p className="mt-1.5 text-[10px] leading-relaxed text-[var(--text-secondary)]">{proposal.rationale}</p>

                      <dl className="mt-2.5 space-y-1.5 text-[9px] leading-relaxed text-[var(--text-muted)]">
                        <div><dt className="inline font-semibold text-[var(--text-secondary)]">Existing asset: </dt><dd className="inline">{proposal.existingAssetDecision.toLowerCase().replace('_', ' ')} · {proposal.existingGfaRetainedM2.toLocaleString()} m² retained · {proposal.existingGfaRemovedM2.toLocaleString()} m² removed — {proposal.existingAssetScope}</dd></div>
                        <div><dt className="inline font-semibold text-[var(--text-secondary)]">Development figure: </dt><dd className="inline">{proposal.achievedGFA.toLocaleString()} m² achieved · {proposal.targetGFA.toLocaleString()} m² target · {proposal.varianceGFA > 0 ? '+' : ''}{proposal.varianceGFA.toLocaleString()} m² variance. {proposal.varianceExplanation}</dd></div>
                        <div><dt className="inline font-semibold text-[var(--text-secondary)]">Public realm: </dt><dd className="inline">{proposal.publicRealmIntent}</dd></div>
                        <div><dt className="inline font-semibold text-[var(--text-secondary)]">Priorities addressed: </dt><dd className="inline">{proposal.ownerPrioritiesAddressed.join(' · ')}</dd></div>
                        <div><dt className="inline font-semibold text-[var(--text-secondary)]">Phasing: </dt><dd className="inline">{proposal.phasingConcept}</dd></div>
                        <div><dt className="inline font-semibold text-[var(--text-secondary)]">Commercial premise: </dt><dd className="inline">{proposal.commercialPremise}</dd></div>
                        <div><dt className="inline font-semibold text-[var(--text-secondary)]">Planning check: </dt><dd className="inline">{planningStatus(scenario)}</dd></div>
                      </dl>

                      <details className="mt-2.5 rounded-[var(--radius-control)] border border-[var(--border-subtle)] bg-[var(--bg-primary)] px-2 py-1.5 text-[9px] text-[var(--text-secondary)]">
                        <summary className="cursor-pointer font-semibold text-[var(--text-primary)]">More study detail</summary>
                        <div className="mt-1.5 space-y-1.5 leading-relaxed">
                          <p><strong>Mass roles:</strong> {proposal.proposedMassRoles.join(' · ')}</p>
                          <p><strong>Program allocation:</strong> {Object.entries(proposal.programGFAByUse).map(([use, gfa]) => `${use} ${gfa.toLocaleString()} m² (${(proposal.programSharePct[use] || 0).toFixed(1)}%)`).join(' · ')}</p>
                          <p><strong>Access and servicing:</strong> {proposal.accessServicingConcept}</p>
                          <p><strong>Operational continuity:</strong> {proposal.operationalContinuityConcept}</p>
                          <p><strong>Landscape and KDH:</strong> {proposal.landscapedPermeableKDHIntent}</p>
                          <p><strong>Response to supplied limits:</strong> {proposal.planningResponse}</p>
                          <p><strong>Expected advantages — pre-simulation hypotheses:</strong> {proposal.expectedAdvantagesHypotheses.join(' · ')}</p>
                          <p><strong>Expected trade-offs — pre-simulation hypotheses:</strong> {proposal.expectedTradeOffHypotheses.join(' · ')}</p>
                          <p><strong>Assumptions:</strong> {proposal.assumptionsIntroduced.join(' · ') || 'None recorded'}</p>
                          <p><strong>Rejection conditions:</strong> {proposal.rejectionConditions.join(' · ')}</p>
                          <p><strong>Information still required:</strong> {proposal.informationStillRequired.join(' · ') || 'None recorded'}</p>
                          <p><strong>Provenance:</strong> {generation.modelCalled ? `Model-generated with ${generation.model}; deterministic checks remain authoritative.` : 'Template schemes used; nuanced design instructions were not interpreted by a model.'}</p>
                        </div>
                      </details>

                      <div className="mt-auto flex items-center justify-between gap-2 pt-3">
                        <span className="flex items-center gap-1 text-[9px] text-[var(--status-assumed)]"><Check className="h-3 w-3" aria-hidden="true" /> Independently checked</span>
                        <div className="flex items-center gap-1.5">
                          {onReject && index === generation.proposals.length - 1 && !accepted && !needsRegeneration && (
                            <button type="button" className="button-secondary px-2 py-1 text-[10px]" onClick={() => { void onReject(); onClose(); }}>Reject set</button>
                          )}
                          <button type="button" className="button-secondary px-2 py-1 text-[10px]" onClick={() => { void onAccept(proposal.id); }} disabled={isAccepted || needsRegeneration}>
                            {isAccepted ? 'Accepted study' : 'Accept for editing'}
                          </button>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>

              {baselineSummary && <p className="mt-3 rounded-[var(--radius-control)] border border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-2.5 py-2 text-[10px] leading-relaxed text-[var(--text-secondary)]"><strong className="text-[var(--text-primary)]">Existing asset baseline · reference only:</strong> {baselineSummary}</p>}
              {generation.validation.errors.length > 0 && <p className="mt-2 flex items-center gap-1 text-[10px] text-[var(--status-warning)]"><AlertTriangle className="h-3 w-3" aria-hidden="true" />{generation.validation.errors.join(' ')}</p>}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
