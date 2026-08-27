'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { GOLDEN_PROJECT } from '@/lib/mock-data/golden-project';
import { DecisionRoomHeader } from '@/components/DecisionRoomHeader';
import { DevelopmentWorkspace } from '@/features/development-3d/DevelopmentWorkspace';
import { EvidenceLedger, type ManualEvidenceInput } from '@/components/EvidenceLedger';
import { ScenarioControls } from '@/components/ScenarioControls';
import { DecisionRoomSummary } from '@/components/DecisionRoomSummary';
import { NewCaseModal } from '@/components/NewCaseModal';
import { ScenarioComparisonModal } from '@/components/ScenarioComparisonModal';
import { SchemeGenerationReview } from '@/components/SchemeGenerationReview';
import { OpportunityInputsModal, type OpportunityInputUpdate } from '@/components/OpportunityInputsModal';
import { 
  getCase, 
  saveCase, 
  listCases, 
  createCase, 
  deleteCase,
  resetDemoCase, 
  getActiveCaseId, 
  setActiveCaseId,
  CreateCaseParams 
} from '@/lib/storage/case-repository';
import { detectScenarioEditClassification } from '@/lib/geometry/engine';
import { ArrowLeft, Compass, ShieldCheck } from 'lucide-react';
import { Project, DevelopmentScenario, CaseSummary } from '@/types';
import type { SchemePriorities } from '@/lib/schemes/proposal-contract';
import { confirmSchemeGenerationInput, isConfirmedSchemeInputCurrent } from '@/lib/schemes/proposal-contract';
import type { PublicTaskmasterRun } from '@/lib/taskmaster/schemas';
import {
  CanonicalSpatialCommand,
  CanonicalCommandResult,
  CanonicalSpatialCommandService,
  createCanonicalCommandId,
  ensureCanonicalProjectRevisions,
} from '@/lib/spatial/canonical-command-service';
import { deriveStreetName, synchronizeProjectDerivedState } from '@/lib/opportunity/canonical-opportunity';

function initializeProjectScenarios(rawProject: Project): Project {
  return ensureCanonicalProjectRevisions(synchronizeProjectDerivedState(rawProject));
}

function taskmasterProgressLabel(run: PublicTaskmasterRun): string {
  if (run.state === 'QUEUED' || run.state === 'PLANNING') return 'Reviewing confirmed inputs';
  if (run.state === 'EXECUTING_TOOLS') {
    const latest = run.activities.at(-1)?.name;
    if (!latest || ['get_opportunity_context', 'get_site_and_planning_inputs', 'list_assumptions_and_missing_information'].includes(latest)) return 'Reviewing confirmed inputs';
    if (latest === 'prepare_scheme_proposals') return 'Developing three strategies';
    if (latest === 'simulate_development_scheme' || latest === 'get_scheme_planning_checks') return 'Testing massing and planning limits';
    if (latest === 'compare_development_schemes') return 'Reconciling development figures';
    return 'Developing three strategies';
  }
  if (run.state === 'VALIDATING') return 'Reconciling development figures';
  if (run.state === 'AWAITING_APPROVAL') return 'Preparing schemes for review';
  if (run.state === 'FAILED_RETRYABLE') return 'A temporary generation failure can be retried';
  if (run.state === 'FAILED_FINAL') return 'Generation failed; review the diagnostic details';
  if (run.state === 'BLOCKED_STALE') return 'The source study changed; regenerate before review';
  if (run.state === 'REJECTED') return 'Study proposals rejected; no accepted study was changed';
  return run.currentStep || 'Taskmaster workflow update';
}

function applyReadyTaskmasterRun(project: Project, run: PublicTaskmasterRun): Project {
  if (!run.generation) return project;
  const informationStillRequired = [...new Set(run.generation.proposals.flatMap((proposal) => proposal.informationStillRequired))];
  const generation = {
    status: 'READY' as const,
    taskmasterRunId: run.runId,
    correlationId: run.correlationId,
    taskmasterState: run.state,
    provider: run.generation.provider,
    model: run.generation.model,
    modelCalled: run.generation.modelCalled,
    disclosure: run.generation.disclosure,
    generatedAt: run.generation.generatedAt,
    opportunityId: run.generation.opportunityId,
    sourceStudyVersion: run.generation.sourceStudyVersion,
    inputHash: run.generation.inputHash,
    userPriorities: run.generation.userPriorities,
    additionalStrategyInstructions: run.generation.additionalStrategyInstructions,
    assumptions: run.generation.assumptions,
    validation: run.generation.validation,
    proposals: run.generation.proposals,
    providerUsage: run.providerUsage,
    preparation: {
      validationResult: run.generation.validation.valid ? 'PASSED' as const : 'FAILED' as const,
      distinctnessResult: run.generation.qualityGate.distinctnessPassed ? 'PASSED' as const : 'FAILED' as const,
      repairAttempted: run.generation.qualityGate.repairAttempted,
      repairSucceeded: run.generation.qualityGate.repairSucceeded,
      informationStillRequired,
    },
  };
  return initializeProjectScenarios({
    ...project,
    taskmasterRunId: run.runId,
    schemeGeneration: generation,
    scenarios: project.scenarios.map((scenario, index) => {
      const proposal = run.generation?.proposals[index];
      const simulation = run.simulations?.find((candidate) => candidate.proposalId === proposal?.id);
      if (!proposal) return scenario;
      return {
        ...scenario,
        name: `Scenario ${String.fromCharCode(65 + index)}: ${proposal.name.replace(/^Scheme [A-C]\s*[—-]\s*/, '')}`,
        description: `${proposal.thesis} ${proposal.rationale}`,
        proposal,
        masses: simulation?.masses || scenario.masses,
        existingAssetStrategy: proposal.existingAssetDecision,
      };
    }),
  });
}

function markUnacceptedSchemesStale(rawProject: Project): Project {
  const generation = rawProject.schemeGeneration;
  if (!generation || generation.status !== 'READY') return rawProject;
  return !isConfirmedSchemeInputCurrent(rawProject)
    ? { ...rawProject, schemeGeneration: { ...generation, status: 'NEEDS_REGENERATION' } }
    : rawProject;
}

function getInitialCases(): CaseSummary[] {
  if (typeof window !== 'undefined') {
    try {
      return listCases();
    } catch {
      // Fallback
    }
  }
  return [{
    id: GOLDEN_PROJECT.id,
    name: GOLDEN_PROJECT.name,
    address: GOLDEN_PROJECT.location.address,
    grossSiteArea: GOLDEN_PROJECT.site.grossSiteArea,
    isTemplate: true,
    createdAt: GOLDEN_PROJECT.createdAt,
    updatedAt: GOLDEN_PROJECT.updatedAt
  }];
}

export default function SitePilotDecisionRoom() {
  const [project, setProject] = useState<Project>(() => initializeProjectScenarios(GOLDEN_PROJECT));
  const [activeScenarioId, setActiveScenarioId] = useState<string>(() => {
    const initialProj = initializeProjectScenarios(GOLDEN_PROJECT);
    const pref = initialProj.scenarios.find(s => s.isPreferred) || initialProj.scenarios[0];
    return pref?.id || 'scen-002';
  });
  const [leftTab, setLeftTab] = useState<'DECISION' | 'EVIDENCE'>('DECISION');
  const [isNewCaseModalOpen, setIsNewCaseModalOpen] = useState(false);
  const [isOpportunityInputsOpen, setIsOpportunityInputsOpen] = useState(false);
  const [isSpatialLabOpen, setIsSpatialLabOpen] = useState(false);
  const [isSpatialLabOpening, setIsSpatialLabOpening] = useState(false);
  const [schemeGenerationProgress, setSchemeGenerationProgress] = useState<string | null>(null);
  const [taskmasterRunState, setTaskmasterRunState] = useState<string | null>(null);
  const [isSchemeReviewOpen, setIsSchemeReviewOpen] = useState(false);
  const [casesList, setCasesList] = useState<CaseSummary[]>(getInitialCases);
  const projectRef = useRef(project);
  const spatialLabOpenTimerRef = useRef<number | null>(null);
  const taskmasterPollTimerRef = useRef<number | null>(null);
  const commandServiceRef = useRef(new CanonicalSpatialCommandService(saveCase));
  const [historyAvailability, setHistoryAvailability] = useState({
    caseId: project.id,
    scenarioId: activeScenarioId,
    canUndo: false,
    canRedo: false,
  });

  const refreshHistoryAvailability = useCallback((caseId: string, scenarioId: string) => {
    setHistoryAvailability({
      caseId,
      scenarioId,
      canUndo: commandServiceRef.current.canUndo(caseId, scenarioId),
      canRedo: commandServiceRef.current.canRedo(caseId, scenarioId),
    });
  }, []);

  const replaceProject = useCallback((nextProject: Project, persist = true) => {
    if (persist && !saveCase(nextProject)) return false;
    projectRef.current = nextProject;
    setProject(nextProject);
    return true;
  }, []);

  useEffect(() => {
    const activeId = getActiveCaseId();
    const loaded = initializeProjectScenarios(getCase(activeId));
    // localStorage is client-only, so hydration deliberately starts from the stable Golden Project snapshot.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    replaceProject(loaded, false);
    const preferred = loaded.scenarios.find((scenario) => scenario.isPreferred) || loaded.scenarios[0];
    if (preferred) {
      setActiveScenarioId(preferred.id);
      refreshHistoryAvailability(loaded.id, preferred.id);
    }
    setCasesList(listCases());
  }, [refreshHistoryAvailability, replaceProject]);

  // A browser refresh can recover an in-flight run from the persisted run ID.
  useEffect(() => {
    const runId = project.taskmasterRunId;
    if (!runId || project.schemeGeneration) return;
    let cancelled = false;
    void fetch(`/api/taskmaster/runs/${runId}`, { headers: { Accept: 'application/json' } })
      .then((response) => response.json() as Promise<{ ok: boolean; run?: PublicTaskmasterRun }>)
      .then((status) => {
        if (cancelled || !status.ok || !status.run) return;
        setTaskmasterRunState(status.run.state);
        setSchemeGenerationProgress(taskmasterProgressLabel(status.run));
        if (status.run.state === 'AWAITING_APPROVAL' && status.run.generation) {
          const updated = applyReadyTaskmasterRun(project, status.run);
          replaceProject(updated);
          setSchemeGenerationProgress(null);
          setIsSchemeReviewOpen(true);
        }
      })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, [project, replaceProject]);

  // Non-editor aggregate updates still invalidate spatial history for the affected case.
  const updateProjectState = useCallback((updater: (prev: Project) => Project) => {
    const updated = ensureCanonicalProjectRevisions({
      ...updater(projectRef.current),
      updatedAt: new Date().toISOString(),
    });
    if (!replaceProject(updated)) return;
    commandServiceRef.current.clearCase(updated.id);
    refreshHistoryAvailability(updated.id, activeScenarioId);
    setCasesList(listCases());
  }, [activeScenarioId, refreshHistoryAvailability, replaceProject]);

  // Case Switching Handler
  const handleSelectCase = useCallback((id: string) => {
    setActiveCaseId(id);
    const loadedProj = getCase(id);
    const initialized = initializeProjectScenarios(loadedProj);
    replaceProject(initialized, false);
    const preferredScen = initialized.scenarios.find(s => s.isPreferred) || initialized.scenarios[0];
    if (preferredScen) {
      setActiveScenarioId(preferredScen.id);
      refreshHistoryAvailability(initialized.id, preferredScen.id);
    }
    setCasesList(listCases());
  }, [refreshHistoryAvailability, replaceProject]);

  // New Case Creation Handler
  const handleCreateCase = useCallback((params: CreateCaseParams, priorities?: SchemePriorities, additionalStrategyInstructions?: string) => {
    const newProj = createCase(params);
    const initialized = initializeProjectScenarios(newProj);
    replaceProject(initialized, false);
    const preferredScen = initialized.scenarios.find(s => s.isPreferred) || initialized.scenarios[0];
    if (preferredScen) {
      setActiveScenarioId(preferredScen.id);
      refreshHistoryAvailability(initialized.id, preferredScen.id);
    }
    setCasesList(listCases());
    if (!priorities) return;
    setSchemeGenerationProgress('Reviewing confirmed inputs');
    const confirmation = confirmSchemeGenerationInput(initialized, priorities, undefined, additionalStrategyInstructions);
    const input = confirmation.input;
    const confirmedProject = { ...initialized, confirmedSchemeInput: confirmation.snapshot };
    replaceProject(confirmedProject);
    const goal = initialized.objective || 'Create and compare three development schemes for this opportunity using the supplied site dimensions, existing assets, planning limits and development intent.';
    void fetch('/api/taskmaster/runs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ input, goal, idempotencyKey: `${initialized.id}:${input.studyVersion}:${input.inputHash}` }),
    }).then(async (response) => {
      if (!response.ok) throw new Error(`Taskmaster run request failed (${response.status})`);
      const result = await response.json() as { run: PublicTaskmasterRun };
      const runId = result.run.runId;
      const current = projectRef.current;
      if (current.id === initialized.id) replaceProject({ ...current, taskmasterRunId: runId });
      setSchemeGenerationProgress('Reviewing confirmed inputs');
      if (taskmasterPollTimerRef.current !== null) window.clearInterval(taskmasterPollTimerRef.current);
      const applyRunStatus = (run: PublicTaskmasterRun) => {
        setTaskmasterRunState(run.state);
        setSchemeGenerationProgress(taskmasterProgressLabel(run));
        if (run.state === 'AWAITING_APPROVAL' && run.generation) {
          const currentProject = projectRef.current;
          if (currentProject.id !== initialized.id) return;
          const updated = applyReadyTaskmasterRun(currentProject, run);
          replaceProject(updated);
          setSchemeGenerationProgress(null);
          setTaskmasterRunState(run.state);
          setIsSchemeReviewOpen(true);
          if (taskmasterPollTimerRef.current !== null) window.clearInterval(taskmasterPollTimerRef.current);
        }
        if (['FAILED_FINAL', 'BLOCKED_STALE', 'CANCELLED'].includes(run.state)) {
          if (taskmasterPollTimerRef.current !== null) window.clearInterval(taskmasterPollTimerRef.current);
        }
      };
      const poll = () => {
        void fetch(`/api/taskmaster/runs/${runId}`, { headers: { Accept: 'application/json' } })
          .then((response) => response.json() as Promise<{ ok: boolean; run?: PublicTaskmasterRun; error?: string }>)
          .then((status) => { if (status.ok && status.run) applyRunStatus(status.run); })
          .catch(() => setSchemeGenerationProgress('Taskmaster status is temporarily unavailable; the run remains persisted for retry.'));
      };
      taskmasterPollTimerRef.current = window.setInterval(poll, 400);
      poll();
    }).catch((error) => {
      setSchemeGenerationProgress(`Scheme generation unavailable: ${error instanceof Error ? error.message : 'unknown error'}`);
      setTaskmasterRunState('FAILED_FINAL');
    });
  }, [refreshHistoryAvailability, replaceProject]);

  const executeSpatialCommand = useCallback((command: CanonicalSpatialCommand): CanonicalCommandResult => {
    const result = commandServiceRef.current.execute(projectRef.current, command);
    if (!result.accepted) {
      console.warn(`[SitePilot Spatial Command] ${result.code}: ${result.reason}`);
      return result;
    }
    replaceProject(markUnacceptedSchemesStale(result.project), false);
    refreshHistoryAvailability(result.project.id, command.scenarioId);
    return result;
  }, [refreshHistoryAvailability, replaceProject]);

  const makeScenarioCommandBase = useCallback((scenarioId: string, targetId: string, prefix: string) => {
    const scenario = projectRef.current.scenarios.find((item) => item.id === scenarioId);
    if (!scenario?.canonicalRevision) return null;
    return {
      id: createCanonicalCommandId(prefix),
      caseId: projectRef.current.id,
      scenarioId,
      targetId,
      expectedSourceRevisionId: scenario.canonicalRevision.revisionId,
      issuedAt: new Date().toISOString(),
      source: 'LEGACY_EDITOR' as const,
    };
  }, []);

  const handleAcceptGeneratedProposal = useCallback(async (proposalId: string) => {
    const current = projectRef.current;
    if (!current.schemeGeneration) return;
    const runId = current.schemeGeneration.taskmasterRunId || current.taskmasterRunId;
    if (runId) {
      const approvalResponse = await fetch(`/api/taskmaster/runs/${runId}/approval`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision: 'APPROVED', proposalId, expectedStudyVersion: current.schemeGeneration.sourceStudyVersion }),
      });
      if (!approvalResponse.ok) {
        const detail = await approvalResponse.json().catch(() => ({})) as { error?: string };
        setSchemeGenerationProgress(detail.error || 'The study could not be accepted because it is stale.');
        return;
      }
    }
    const acceptedScenario = current.scenarios.find((scenario) => scenario.proposal?.id === proposalId);
    if (!acceptedScenario) return;
    const base = makeScenarioCommandBase(acceptedScenario.id, acceptedScenario.id, 'accept-scheme');
    if (!base) return;
    const accepted = executeSpatialCommand({
      ...base,
      type: 'ACCEPT_SCHEME_PROPOSAL',
      payload: { proposalId },
      description: `Accept ${acceptedScenario.name} for editing`,
      source: 'SYSTEM',
    });
    if (!accepted.accepted) {
      setSchemeGenerationProgress(accepted.reason);
      return;
    }
    if (runId) {
      const completionResponse = await fetch(`/api/taskmaster/runs/${runId}/approval`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision: 'APPROVED', proposalId, expectedStudyVersion: current.schemeGeneration.sourceStudyVersion, acceptedStudyVersion: current.schemeGeneration.sourceStudyVersion, applied: true }),
      });
      if (!completionResponse.ok) {
        setSchemeGenerationProgress('The accepted study was saved locally, but the run completion record could not be finalized.');
      }
    }
    const updated = accepted.project;
    setIsSchemeReviewOpen(false);
    setActiveScenarioId(acceptedScenario.id);
    refreshHistoryAvailability(updated.id, acceptedScenario.id);
  }, [executeSpatialCommand, makeScenarioCommandBase, refreshHistoryAvailability]);

  const handleRejectGeneratedProposals = useCallback(async () => {
    const current = projectRef.current;
    const runId = current.schemeGeneration?.taskmasterRunId || current.taskmasterRunId;
    if (runId) {
      await fetch(`/api/taskmaster/runs/${runId}/approval`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision: 'REJECTED' }),
      });
    }
    setIsSchemeReviewOpen(false);
  }, []);

  const handleCancelTaskmaster = useCallback(async () => {
    const runId = projectRef.current.schemeGeneration?.taskmasterRunId || projectRef.current.taskmasterRunId;
    if (!runId) return;
    await fetch(`/api/taskmaster/runs/${runId}/cancel`, { method: 'POST' });
    setTaskmasterRunState('CANCELLED');
    setSchemeGenerationProgress('Taskmaster run cancelled');
    if (taskmasterPollTimerRef.current !== null) window.clearInterval(taskmasterPollTimerRef.current);
  }, []);

  const handleRetryTaskmaster = useCallback(async () => {
    const runId = projectRef.current.schemeGeneration?.taskmasterRunId || projectRef.current.taskmasterRunId;
    if (!runId) return;
    const response = await fetch(`/api/taskmaster/runs/${runId}/retry`, { method: 'POST' });
    if (!response.ok) return;
    setTaskmasterRunState('QUEUED');
    setSchemeGenerationProgress('Queued for a safe retry');
  }, []);

  // Reset Demo Case Handler
  const handleResetDemo = useCallback(() => {
    const reset = resetDemoCase();
    const initialized = initializeProjectScenarios(reset);
    commandServiceRef.current.clearCase(reset.id);
    replaceProject(initialized);
    const resetScenarioId = initialized.scenarios[1]?.id || initialized.scenarios[0].id;
    setActiveScenarioId(resetScenarioId);
    refreshHistoryAvailability(initialized.id, resetScenarioId);
    setCasesList(listCases());
  }, [refreshHistoryAvailability, replaceProject]);

  // Delete Case Handler
  const handleDeleteCase = useCallback((id: string) => {
    deleteCase(id);
    const activeId = getActiveCaseId();
    const loadedProj = getCase(activeId);
    const initialized = initializeProjectScenarios(loadedProj);
    commandServiceRef.current.clearCase(id);
    replaceProject(initialized, false);
    const preferredScen = initialized.scenarios.find(s => s.isPreferred) || initialized.scenarios[0];
    if (preferredScen) {
      setActiveScenarioId(preferredScen.id);
      refreshHistoryAvailability(initialized.id, preferredScen.id);
    }
    setCasesList(listCases());
  }, [refreshHistoryAvailability, replaceProject]);

  // Handle Working Site Area Basis toggle
  const handleSelectSiteArea = (newArea: number) => {
    updateProjectState(prev => {
      const updatedSite = {
        ...prev.site,
        grossSiteArea: newArea,
        lotDepth: prev.site.frontageLength ? newArea / prev.site.frontageLength : prev.site.lotDepth,
        dimensionProvenance: undefined,
      };
      const updatedProject = synchronizeProjectDerivedState({ ...prev, site: updatedSite });
      const updatedScenarios: DevelopmentScenario[] = updatedProject.scenarios.map(scen => {
        const originalScen = prev.scenarios.find(s => s.id === scen.id) || scen;
        const classification = detectScenarioEditClassification(scen, originalScen);

        return {
          ...scen,
          editClassification: classification
        };
      });

      return {
        ...updatedProject,
        scenarios: updatedScenarios
      };
    });
  };

  const handleOpportunityInputUpdate = useCallback((update: OpportunityInputUpdate) => {
    updateProjectState((previous) => {
      const street = deriveStreetName(previous.location.address, update.manualStreetName);
      const planningChanged = previous.site.grossSiteArea !== update.parcel.siteAreaM2
        || previous.site.frontageLength !== update.parcel.frontageMeters
        || previous.site.lotDepth !== update.parcel.depthMeters
        || previous.zoningLimits?.maxHeightMeters !== update.maxHeightMeters
        || previous.zoningLimits?.maxFAR !== update.maxFAR
        || previous.zoningLimits?.maxCoveragePct !== update.maxCoveragePct
        || previous.zoningLimits?.minKDHPct !== update.minKDHPct
        || previous.site.landscapedPermeableAreaM2 !== update.landscapedPermeableAreaM2
        || previous.zoningLimits?.setbacks.front !== update.frontSetbackMeters
        || previous.zoningLimits?.setbacks.rear !== update.rearSetbackMeters
        || previous.zoningLimits?.setbacks.sideLeft !== update.sideSetbackMeters
        || previous.zoningLimits?.setbacks.sideRight !== update.sideSetbackMeters;
      const verifiedArea = previous.findings.find((finding) => finding.extractedValue?.key === 'gross_site_area'
        && finding.classification === 'FACT'
        && finding.confidence === 'HIGH')?.extractedValue?.numericValue;
      const areaEvidenceConflict = verifiedArea !== undefined
        && Math.abs(verifiedArea - update.parcel.siteAreaM2) > 0.01;
      const evidenceWarning = areaEvidenceConflict
        ? `The current rectangular study area (${update.parcel.siteAreaM2.toLocaleString()} m²) differs from confirmed site-area information (${verifiedArea.toLocaleString()} m²). The user-provided working value is active; reconcile the source information before reliance.`
        : undefined;
      const currentTimestamp = new Date().toISOString();
      const sharedSetbacks = {
        ...previous.site.setbacks,
        front: update.frontSetbackMeters,
        rear: update.rearSetbackMeters,
        sideLeft: update.sideSetbackMeters,
        sideRight: update.sideSetbackMeters,
      };
      return synchronizeProjectDerivedState({
        ...previous,
        findings: previous.findings.map((finding) => {
          const isPriorArea = finding.extractedValue?.key === 'gross_site_area';
          const isPriorPlanning = planningChanged && ['max_height_floors', 'max_height', 'max_far', 'max_coverage_pct', 'min_kdh']
            .includes(finding.extractedValue?.key ?? '');
          return isPriorArea || isPriorPlanning ? {
              ...finding,
              userOverridden: isPriorArea
                ? finding.extractedValue?.numericValue !== update.parcel.siteAreaM2
                : true,
            }
            : finding;
        }),
        contradictions: previous.contradictions.map((contradiction) => contradiction.topic === 'gross_site_area'
          ? {
              ...contradiction,
              resolved: true,
              workingValueSelected: update.parcel.siteAreaM2,
            }
          : contradiction),
        assumptions: previous.assumptions.map((assumption) => {
          const parameter = assumption.parameter.toLowerCase();
          if (parameter.includes('land area')) {
            return {
              ...assumption,
              workingValue: update.parcel.siteAreaM2,
              unit: 'm²',
              source: 'Opportunity Inputs (user-entered rectangular study value)',
              classification: 'ASSUMPTION' as const,
              verificationStatus: areaEvidenceConflict ? 'CHALLENGED_BY_NEW_EVIDENCE' as const : 'UNVERIFIED' as const,
              lastUpdated: currentTimestamp,
            };
          }
          if (planningChanged && parameter.includes('maximum height')) {
            return {
              ...assumption,
              workingValue: update.maxHeightMeters ?? 'Not supplied',
              unit: update.maxHeightMeters === undefined ? undefined : 'metres',
              source: 'Opportunity Inputs (user-entered planning parameter)',
              classification: 'ASSUMPTION' as const,
              verificationStatus: 'UNVERIFIED' as const,
              lastUpdated: currentTimestamp,
            };
          }
          return assumption;
        }),
        issues: previous.issues.map((issue) => areaEvidenceConflict && issue.category === 'LEGAL_TITLE'
          ? {
              ...issue,
              status: 'INVESTIGATING' as const,
              implication: `The current user-provided rectangular study area (${update.parcel.siteAreaM2.toLocaleString()} m²) conflicts with confirmed site-area information (${verifiedArea.toLocaleString()} m²). Recalculate acquisition ratios and resolve the working basis before reliance.`,
            }
          : issue),
        evidenceConfidence: planningChanged && previous.site.hasZoningEvidence
          ? 'LOW'
          : previous.evidenceConfidence,
        areaProvenance: {
          value: update.parcel.siteAreaM2,
          sourceType: 'USER_ENTERED_ASSUMPTION',
          sourceName: 'Opportunity Inputs',
          confidence: 'UNVERIFIED',
          adoptedAt: new Date().toISOString(),
          notes: 'Rectangular planning-study dimensions; not surveyed cadastral geometry.',
        },
        site: {
          ...previous.site,
          grossSiteArea: update.parcel.siteAreaM2,
          frontageLength: update.parcel.frontageMeters,
          lotDepth: update.parcel.depthMeters,
          dimensionProvenance: {
            ...update.parcel.provenance,
            warning: [update.parcel.provenance.warning, evidenceWarning].filter(Boolean).join(' ') || undefined,
          },
          streetName: street.value,
          streetNameSource: street.source,
          hasZoningEvidence: planningChanged ? false : previous.site.hasZoningEvidence,
          setbacks: sharedSetbacks,
          landscapedPermeableAreaM2: update.landscapedPermeableAreaM2,
        },
        schemeGeneration: previous.schemeGeneration && planningChanged
          ? { ...previous.schemeGeneration, status: 'NEEDS_REGENERATION' as const }
          : previous.schemeGeneration,
        zoningLimits: {
          zoneCode: previous.zoningLimits?.zoneCode,
          zoneName: previous.zoningLimits?.zoneName,
          maxFAR: update.maxFAR,
          maxCoveragePct: update.maxCoveragePct,
          minKDHPct: update.minKDHPct,
          maxKTBPct: previous.zoningLimits?.maxKTBPct,
          maxHeightMeters: update.maxHeightMeters,
          maxFloors: undefined,
          setbacks: sharedSetbacks,
        },
        scenarios: previous.scenarios.map((scenario) => ({
          ...scenario,
          assumptionsUsed: { ...scenario.assumptionsUsed, setbacks: sharedSetbacks },
        })),
      });
    });
  }, [updateProjectState]);

  const handleAddManualEvidence = useCallback((input: ManualEvidenceInput) => {
    updateProjectState((previous) => ({
      ...previous,
      findings: [
        ...previous.findings,
        {
          id: `fnd-manual-${Date.now()}`,
          projectId: previous.id,
          sourceId: 'src-manual-input',
          sourceName: input.sourceName,
          statement: input.fact,
          category: 'GENERAL_NOTE',
          classification: 'ASSUMPTION',
          confidence: 'UNVERIFIED',
          extractedValue: input.value !== undefined && Number.isFinite(input.value)
            ? { numericValue: input.value, unit: input.unit, key: 'manual_input' }
            : undefined,
          createdAt: new Date().toISOString(),
        },
      ],
    }));
  }, [updateProjectState]);

  const handleOpenSpatialLab = useCallback(() => {
    setIsSpatialLabOpening(true);
    spatialLabOpenTimerRef.current = window.setTimeout(() => {
      setIsSpatialLabOpen(true);
      setIsSpatialLabOpening(false);
      spatialLabOpenTimerRef.current = null;
    }, 50);
  }, []);

  useEffect(() => () => {
    if (spatialLabOpenTimerRef.current !== null) {
      window.clearTimeout(spatialLabOpenTimerRef.current);
    }
    if (taskmasterPollTimerRef.current !== null) window.clearInterval(taskmasterPollTimerRef.current);
  }, []);

  const handleSpatialCommand = useCallback(
    (command: CanonicalSpatialCommand): boolean => executeSpatialCommand(command).accepted,
    [executeSpatialCommand],
  );

  const handleUndoSpatialCommand = useCallback((scenarioId: string) => {
    const current = projectRef.current;
    const result = commandServiceRef.current.undo(
      current,
      current.id,
      scenarioId,
      new Date().toISOString()
    );
    if (!result.accepted) return;
    replaceProject(markUnacceptedSchemesStale(result.project), false);
    refreshHistoryAvailability(result.project.id, scenarioId);
  }, [refreshHistoryAvailability, replaceProject]);

  const handleRedoSpatialCommand = useCallback((scenarioId: string) => {
    const current = projectRef.current;
    const result = commandServiceRef.current.redo(
      current,
      current.id,
      scenarioId,
      new Date().toISOString()
    );
    if (!result.accepted) return;
    replaceProject(markUnacceptedSchemesStale(result.project), false);
    refreshHistoryAvailability(result.project.id, scenarioId);
  }, [refreshHistoryAvailability, replaceProject]);

  // Handle independent scenario parameters through canonical commands.
  const handleUpdateScenarioParam = (
    scenarioId: string, 
    param: 'podiumFloors' | 'towerFloors' | 'frontSetback' | 'sideSetback' | 'rearSetback',
    value: number
  ) => {
    const scenario = projectRef.current.scenarios.find((item) => item.id === scenarioId);
    const base = makeScenarioCommandBase(scenarioId, scenarioId, `scenario-${param}`);
    if (!scenario || !base) return;
    const command: CanonicalSpatialCommand = param === 'podiumFloors' || param === 'towerFloors'
      ? {
          ...base,
          type: 'SET_MASS_TYPE_FLOORS',
          payload: { massType: param === 'podiumFloors' ? 'PODIUM' : 'TOWER', floors: value },
          description: `Set ${scenario.name} ${param === 'podiumFloors' ? 'podium' : 'tower'} to ${value} storeys`,
        }
      : {
          ...base,
          type: 'SET_SETBACKS',
          payload: {
            setbacks: param === 'frontSetback'
              ? { ...scenario.assumptionsUsed.setbacks, front: value }
              : param === 'sideSetback'
                ? { ...scenario.assumptionsUsed.setbacks, sideLeft: value, sideRight: value }
                : { ...scenario.assumptionsUsed.setbacks, rear: value },
          },
          description: `Set ${scenario.name} ${param === 'frontSetback' ? 'front' : param === 'sideSetback' ? 'symmetric side' : 'rear'} setback to ${value}m`,
        };
    handleSpatialCommand(command);
  };

  // One-Click Deterministic "Fit Massing to Setback" Action
  const handleFitMassingToEnvelope = (scenarioId: string) => {
    const scenario = projectRef.current.scenarios.find((item) => item.id === scenarioId);
    const base = makeScenarioCommandBase(scenarioId, scenarioId, 'fit-envelope');
    if (!scenario || !base) return;
    handleSpatialCommand({
      ...base,
      type: 'FIT_TO_ENVELOPE',
      payload: {},
      description: `Fit ${scenario.name} to its setback envelope`,
    });
  };

  // Reset Scenario to Baseline Concept
  const handleResetScenario = (scenarioId: string) => {
    const scenario = projectRef.current.scenarios.find((item) => item.id === scenarioId);
    const base = makeScenarioCommandBase(scenarioId, scenarioId, 'reset-scenario');
    if (!scenario || !base) return;
    handleSpatialCommand({
      ...base,
      type: 'RESET_SCENARIO',
      payload: {},
      description: `Reset ${scenario.name} to its baseline masses`,
    });
  };

  // Duplicate Scenario Handler
  const handleDuplicateScenario = (sourceScenarioId: string) => {
    const scenario = projectRef.current.scenarios.find((item) => item.id === sourceScenarioId);
    const base = makeScenarioCommandBase(sourceScenarioId, sourceScenarioId, 'duplicate-scenario');
    if (!scenario || !base) return;
    const newScenarioId = `scen-${projectRef.current.id}-${createCanonicalCommandId('scenario').split(':').pop()}`;
    const accepted = handleSpatialCommand({
      ...base,
      type: 'DUPLICATE_SCENARIO',
      payload: { newScenarioId, name: `${scenario.name} (Copy)` },
      description: `Duplicate ${scenario.name}`,
    });
    if (accepted) {
      setActiveScenarioId(newScenarioId);
      refreshHistoryAvailability(projectRef.current.id, newScenarioId);
    }
  };

  const handleSelectScenario = useCallback((scenarioId: string) => {
    setActiveScenarioId(scenarioId);
    refreshHistoryAvailability(projectRef.current.id, scenarioId);
  }, [refreshHistoryAvailability]);

  const [isCompareModalOpen, setIsCompareModalOpen] = useState(false);

  const activeScenario = project.scenarios.find(s => s.id === activeScenarioId) || project.scenarios[0];
  const developmentWorkspace = (
    <DevelopmentWorkspace
      caseId={project.id}
      site={{ ...project.site, setbacks: activeScenario.assumptionsUsed.setbacks }}
      activeScenario={activeScenario}
      project={project}
      onProposeCommand={handleSpatialCommand}
      onCommitSpatialCommand={executeSpatialCommand}
      canUndo={historyAvailability.caseId === project.id
        && historyAvailability.scenarioId === activeScenario.id
        && historyAvailability.canUndo}
      canRedo={historyAvailability.caseId === project.id
        && historyAvailability.scenarioId === activeScenario.id
        && historyAvailability.canRedo}
      onUndo={handleUndoSpatialCommand}
      onRedo={handleRedoSpatialCommand}
      zoningHeightLimitMeters={project.zoningLimits?.maxHeightMeters}
    />
  );

  return (
    <div className="flex flex-col min-h-screen lg:h-screen w-full bg-[var(--bg-primary)] text-[var(--text-primary)] overflow-x-hidden select-none">
      {/* Top Header with Case Switcher */}
      <DecisionRoomHeader 
        project={project}
        cases={casesList}
        activeCaseId={project.id}
        onSelectCase={handleSelectCase}
        onOpenNewCaseModal={() => setIsNewCaseModalOpen(true)}
        onResetDemo={handleResetDemo}
        onDeleteCase={handleDeleteCase}
        onOpenOpportunityInputs={() => setIsOpportunityInputsOpen(true)}
        onOpenSpatialLab={handleOpenSpatialLab}
        isSpatialLabOpening={isSpatialLabOpening}
      />

      {schemeGenerationProgress && (
        <div className="mx-3.5 mt-2 flex min-h-[38px] items-center justify-between gap-3 rounded-[var(--radius-control)] border border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-3 py-1.5 text-[10px] text-[var(--text-secondary)]" role="status">
          <span className="truncate"><strong className="text-[var(--text-primary)]">Taskmaster</strong> · {schemeGenerationProgress}</span>
          <span className="flex shrink-0 items-center gap-1.5">
            {taskmasterRunState === 'FAILED_RETRYABLE' && <button type="button" className="button-secondary px-2 py-1 text-[10px]" onClick={() => void handleRetryTaskmaster()}>Retry</button>}
            {['QUEUED', 'PLANNING', 'EXECUTING_TOOLS', 'VALIDATING'].includes(taskmasterRunState || '') && <button type="button" className="button-secondary px-2 py-1 text-[10px]" onClick={() => void handleCancelTaskmaster()}>Cancel</button>}
          </span>
        </div>
      )}
      {project.schemeGeneration && (
        <SchemeGenerationReview
          generation={project.schemeGeneration}
          onAccept={handleAcceptGeneratedProposal}
          onReject={handleRejectGeneratedProposals}
          isOpen={isSchemeReviewOpen}
          onOpen={() => setIsSchemeReviewOpen(true)}
          onClose={() => setIsSchemeReviewOpen(false)}
          scenarios={project.scenarios}
          selectedScenario={activeScenario}
          baselineSummary={project.existingAsset
            ? `${project.existingAsset.gfa.toLocaleString()} m² recorded existing asset${project.existingAsset.floors ? ` · ${project.existingAsset.floors} storeys` : ''}; provided by the user and not yet confirmed.`
            : 'No existing asset was supplied; the low-rise reference is a study baseline.'}
        />
      )}

      {/* Main Responsive 3-Column Decision Workspace */}
      {isSpatialLabOpen ? (
        <main className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-3 p-3 overflow-y-auto lg:overflow-hidden" data-workspace="spatial-lab">
          <section className="col-span-1 lg:col-span-9 min-h-[600px] lg:h-full flex flex-col gap-2 overflow-hidden">
            <div className="surface-inspector flex items-center justify-between gap-3 px-3 py-2">
              <button type="button" onClick={() => setIsSpatialLabOpen(false)} className="button-secondary flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold">
                <ArrowLeft className="h-3.5 w-3.5" /> Return to Decision Room
              </button>
              <div className="min-w-0 text-right text-[10px] text-[var(--text-muted)]">
                <strong className="block truncate text-xs text-[var(--text-primary)]">Spatial Lab · {project.name}</strong>
                <span className="font-mono">{project.site.frontageLength}m frontage × {project.site.lotDepth}m depth · {project.site.streetName}</span>
              </div>
            </div>
            <div className="min-h-0 flex-1">{developmentWorkspace}</div>
          </section>
          <section className="col-span-1 lg:col-span-3 min-h-[600px] lg:h-full overflow-hidden">
            <ScenarioControls
              site={{ ...project.site, setbacks: activeScenario.assumptionsUsed.setbacks, projectName: project.name, address: project.location.address }}
              project={project}
              scenarios={project.scenarios}
              activeScenarioId={activeScenarioId}
              onSelectScenario={handleSelectScenario}
              onUpdateScenarioParam={handleUpdateScenarioParam}
              onFitMassingToEnvelope={handleFitMassingToEnvelope}
              onResetScenario={handleResetScenario}
              onOpenCompareModal={() => setIsCompareModalOpen(true)}
              onDuplicateScenario={handleDuplicateScenario}
              onAssessmentPrepared={(assessment) => updateProjectState((current) => ({ ...current, planningAssessment: assessment }))}
            />
          </section>
        </main>
      ) : (
      <main className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-3 p-3 overflow-y-auto lg:overflow-hidden">
        {/* Left Column: Intelligence / Evidence Ledger (3 cols) */}
        <section className="col-span-1 lg:col-span-3 min-h-[480px] lg:h-full flex flex-col gap-2 overflow-hidden">
          {/* Sub-tab switcher */}
          <div className="ui-segmented shrink-0">
            <button
              onClick={() => setLeftTab('DECISION')}
              aria-pressed={leftTab === 'DECISION'}
              className="ui-segment flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 text-xs font-semibold transition-colors cursor-pointer"
            >
              <Compass className="w-3.5 h-3.5" />
              <span>Executive Brief</span>
            </button>
            <button
              onClick={() => setLeftTab('EVIDENCE')}
              aria-pressed={leftTab === 'EVIDENCE'}
              className="ui-segment flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 text-xs font-semibold transition-colors cursor-pointer"
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Sources &amp; Assumptions</span>
            </button>
          </div>

          <div className="flex-1 overflow-hidden">
            {leftTab === 'DECISION' ? (
              <DecisionRoomSummary project={project} selectedScenarioId={activeScenarioId} />
            ) : (
              <EvidenceLedger
                sources={project.sources}
                findings={project.findings}
                contradictions={project.contradictions}
                activeSiteArea={project.site.grossSiteArea}
                onSelectSiteArea={handleSelectSiteArea}
                project={project}
                onAddManualEvidence={handleAddManualEvidence}
              />
            )}
          </div>
        </section>

        {/* Center Column: 3D Spatial Model Workspace (6 cols) */}
        <section className="col-span-1 lg:col-span-6 min-h-[520px] lg:h-full overflow-hidden">
          {developmentWorkspace}
        </section>

        {/* Right Column: Scenarios & Development Metrics (3 cols) */}
        <section className="col-span-1 lg:col-span-3 min-h-[480px] lg:h-full overflow-hidden">
          <ScenarioControls
            site={{ 
              ...project.site, 
              setbacks: activeScenario.assumptionsUsed.setbacks,
              projectName: project.name,
              address: project.location.address,
            }}
            project={project}
            scenarios={project.scenarios}
            activeScenarioId={activeScenarioId}
            onSelectScenario={handleSelectScenario}
            onUpdateScenarioParam={handleUpdateScenarioParam}
            onFitMassingToEnvelope={handleFitMassingToEnvelope}
            onResetScenario={handleResetScenario}
            onOpenCompareModal={() => setIsCompareModalOpen(true)}
            onDuplicateScenario={handleDuplicateScenario}
            onAssessmentPrepared={(assessment) => updateProjectState((current) => ({ ...current, planningAssessment: assessment }))}
          />
        </section>
      </main>
      )}

      {/* New Opportunity Modal */}
      <NewCaseModal 
        isOpen={isNewCaseModalOpen}
        onClose={() => setIsNewCaseModalOpen(false)}
        onCreateCase={handleCreateCase}
      />

      {isOpportunityInputsOpen && (
        <OpportunityInputsModal
          key={`${project.id}:${project.updatedAt}`}
          project={project}
          onClose={() => setIsOpportunityInputsOpen(false)}
          onSave={handleOpportunityInputUpdate}
        />
      )}

      {/* Scenario Comparison Matrix Modal */}
      <ScenarioComparisonModal
        isOpen={isCompareModalOpen}
        onClose={() => setIsCompareModalOpen(false)}
        project={project}
        activeScenarioId={activeScenarioId}
        onSelectScenario={handleSelectScenario}
      />
    </div>
  );
}
