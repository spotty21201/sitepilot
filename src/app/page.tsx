'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { GOLDEN_PROJECT } from '@/lib/mock-data/golden-project';
import { DecisionRoomHeader } from '@/components/DecisionRoomHeader';
import { DevelopmentWorkspace } from '@/features/development-3d/DevelopmentWorkspace';
import { EvidenceLedger } from '@/components/EvidenceLedger';
import { ScenarioControls } from '@/components/ScenarioControls';
import { DecisionRoomSummary } from '@/components/DecisionRoomSummary';
import { NewCaseModal } from '@/components/NewCaseModal';
import { ScenarioComparisonModal } from '@/components/ScenarioComparisonModal';
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
import { 
  calculateDevelopmentMetrics, 
  calculateMassPairwiseIntersections,
  detectScenarioEditClassification,
  evaluateScenarioCompliance
} from '@/lib/geometry/engine';
import { Compass, ShieldCheck } from 'lucide-react';
import { Project, DevelopmentScenario, CaseSummary } from '@/types';
import {
  CanonicalSpatialCommand,
  CanonicalCommandResult,
  CanonicalSpatialCommandService,
  createCanonicalCommandId,
  ensureCanonicalProjectRevisions,
} from '@/lib/spatial/canonical-command-service';

function initializeProjectScenarios(rawProject: Project): Project {
  const initialScenarios = rawProject.scenarios.map(s => {
    const pairwiseOverlap = calculateMassPairwiseIntersections(s.masses);
    const complianceReport = evaluateScenarioCompliance(
      rawProject.site.grossSiteArea,
      s.assumptionsUsed.setbacks,
      s.masses,
      s.metrics,
      pairwiseOverlap,
      {
        scenarioName: s.name,
        hasZoningEvidence: Boolean(rawProject.site.hasZoningEvidence),
        maxFAR: rawProject.zoningLimits?.maxFAR,
        maxCoveragePct: rawProject.zoningLimits?.maxCoveragePct,
        minKDHPct: rawProject.zoningLimits?.minKDHPct,
        maxHeightMeters: rawProject.zoningLimits?.maxHeightMeters,
        maxFloors: rawProject.zoningLimits?.maxFloors,
        zoningName: rawProject.zoningLimits?.zoneName,
        frontageLength: rawProject.site.frontageLength
      }
    );
    return {
      ...s,
      complianceReport,
      pairwiseOverlap,
      status: complianceReport.status as DevelopmentScenario['status'],
      warningMessage: complianceReport.primaryWarning
    };
  });

  return ensureCanonicalProjectRevisions({
    ...rawProject,
    scenarios: initialScenarios
  });
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
  const [casesList, setCasesList] = useState<CaseSummary[]>(getInitialCases);
  const projectRef = useRef(project);
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

  // Non-editor aggregate updates still invalidate spatial history for the affected case.
  const updateProjectState = useCallback((updater: (prev: Project) => Project) => {
    const updated = ensureCanonicalProjectRevisions({
      ...updater(projectRef.current),
      updatedAt: new Date().toISOString(),
    });
    if (!replaceProject(updated)) return;
    commandServiceRef.current.clearCase(updated.id);
    refreshHistoryAvailability(updated.id, activeScenarioId);
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
  const handleCreateCase = useCallback((params: CreateCaseParams) => {
    const newProj = createCase(params);
    const initialized = initializeProjectScenarios(newProj);
    replaceProject(initialized, false);
    const preferredScen = initialized.scenarios.find(s => s.isPreferred) || initialized.scenarios[0];
    if (preferredScen) {
      setActiveScenarioId(preferredScen.id);
      refreshHistoryAvailability(initialized.id, preferredScen.id);
    }
    setCasesList(listCases());
  }, [refreshHistoryAvailability, replaceProject]);

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
      const updatedSite = { ...prev.site, grossSiteArea: newArea };
      const updatedScenarios: DevelopmentScenario[] = prev.scenarios.map(scen => {
        const originalScen = prev.scenarios.find(s => s.id === scen.id) || scen;
        const newMetrics = calculateDevelopmentMetrics(newArea, scen.masses, scen.assumptionsUsed.setbacks, prev.site.frontageLength);
        const pairwiseOverlap = calculateMassPairwiseIntersections(scen.masses);
        const complianceReport = evaluateScenarioCompliance(
          newArea,
          scen.assumptionsUsed.setbacks,
          scen.masses,
          newMetrics,
          pairwiseOverlap,
          {
            scenarioName: scen.name,
            hasZoningEvidence: Boolean(prev.site.hasZoningEvidence),
            maxFAR: prev.zoningLimits?.maxFAR,
            maxCoveragePct: prev.zoningLimits?.maxCoveragePct,
            minKDHPct: prev.zoningLimits?.minKDHPct,
            maxHeightMeters: prev.zoningLimits?.maxHeightMeters,
            maxFloors: prev.zoningLimits?.maxFloors,
            zoningName: prev.zoningLimits?.zoneName,
            frontageLength: prev.site.frontageLength
          }
        );

        const updatedScenObj = {
          ...scen,
          metrics: newMetrics,
          pairwiseOverlap,
          complianceReport,
          status: complianceReport.status as DevelopmentScenario['status'],
          warningMessage: complianceReport.primaryWarning
        };

        const classification = detectScenarioEditClassification(updatedScenObj, originalScen);

        return {
          ...updatedScenObj,
          editClassification: classification
        };
      });

      return {
        ...prev,
        site: updatedSite,
        scenarios: updatedScenarios
      };
    });
  };

  const executeSpatialCommand = useCallback((command: CanonicalSpatialCommand): CanonicalCommandResult => {
    const result = commandServiceRef.current.execute(projectRef.current, command);
    if (!result.accepted) {
      console.warn(`[SitePilot Spatial Command] ${result.code}: ${result.reason}`);
      return result;
    }
    replaceProject(result.project, false);
    refreshHistoryAvailability(result.project.id, command.scenarioId);
    return result;
  }, [refreshHistoryAvailability, replaceProject]);

  const handleSpatialCommand = useCallback(
    (command: CanonicalSpatialCommand): boolean => executeSpatialCommand(command).accepted,
    [executeSpatialCommand],
  );

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

  const handleUndoSpatialCommand = useCallback((scenarioId: string) => {
    const current = projectRef.current;
    const result = commandServiceRef.current.undo(
      current,
      current.id,
      scenarioId,
      new Date().toISOString()
    );
    if (!result.accepted) return;
    replaceProject(result.project, false);
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
    replaceProject(result.project, false);
    refreshHistoryAvailability(result.project.id, scenarioId);
  }, [refreshHistoryAvailability, replaceProject]);

  // Handle independent scenario parameter adjustments (Floors, Front Setback)
  const handleUpdateScenarioParam = (
    scenarioId: string, 
    param: 'floors' | 'frontSetback', 
    value: number
  ) => {
    const scenario = projectRef.current.scenarios.find((item) => item.id === scenarioId);
    const base = makeScenarioCommandBase(scenarioId, scenarioId, `scenario-${param}`);
    if (!scenario || !base) return;
    const command: CanonicalSpatialCommand = param === 'floors'
      ? {
          ...base,
          type: 'SET_SCENARIO_FLOORS',
          payload: { floors: value },
          description: `Set ${scenario.name} to ${value} storeys`,
        }
      : {
          ...base,
          type: 'SET_SETBACKS',
          payload: { setbacks: { ...scenario.assumptionsUsed.setbacks, front: value } },
          description: `Set ${scenario.name} front setback to ${value}m`,
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
      />

      {/* Main Responsive 3-Column Decision Workspace */}
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
              <span>Evidence Ledger</span>
            </button>
          </div>

          <div className="flex-1 overflow-hidden">
            {leftTab === 'DECISION' ? (
              <DecisionRoomSummary project={project} />
            ) : (
              <EvidenceLedger
                sources={project.sources}
                findings={project.findings}
                contradictions={project.contradictions}
                activeSiteArea={project.site.grossSiteArea}
                onSelectSiteArea={handleSelectSiteArea}
              />
            )}
          </div>
        </section>

        {/* Center Column: 3D Spatial Model Workspace (6 cols) */}
        <section className="col-span-1 lg:col-span-6 min-h-[520px] lg:h-full overflow-hidden">
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
        </section>

        {/* Right Column: Scenarios & Development Metrics (3 cols) */}
        <section className="col-span-1 lg:col-span-3 min-h-[480px] lg:h-full overflow-hidden">
          <ScenarioControls
            site={{ 
              ...project.site, 
              setbacks: activeScenario.assumptionsUsed.setbacks,
              projectName: project.name,
              address: project.location.address,
              hasZoningEvidence: project.id === 'proj-001' || project.sources.some(s => s.status === 'PROCESSED')
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
          />
        </section>
      </main>

      {/* New Opportunity Modal */}
      <NewCaseModal 
        isOpen={isNewCaseModalOpen}
        onClose={() => setIsNewCaseModalOpen(false)}
        onCreateCase={handleCreateCase}
      />

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
