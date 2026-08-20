'use client';

import React, { useState, useCallback } from 'react';
import { GOLDEN_PROJECT } from '@/lib/mock-data/golden-project';
import { DecisionRoomHeader } from '@/components/DecisionRoomHeader';
import { DevelopmentWorkspace } from '@/features/development-3d/DevelopmentWorkspace';
import { EvidenceLedger } from '@/components/EvidenceLedger';
import { ScenarioControls } from '@/components/ScenarioControls';
import { DecisionRoomSummary } from '@/components/DecisionRoomSummary';
import { NewCaseModal } from '@/components/NewCaseModal';
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
  fitMassesToBuildableEnvelope,
  calculateMassPairwiseIntersections,
  detectScenarioEditClassification,
  evaluateScenarioCompliance
} from '@/lib/geometry/engine';
import { Compass, ShieldCheck } from 'lucide-react';
import { Project, DevelopmentScenario, BuildingMass, CaseSummary } from '@/types';

function initializeProjectScenarios(rawProject: Project): Project {
  const initialScenarios = rawProject.scenarios.map(s => {
    const pairwiseOverlap = calculateMassPairwiseIntersections(s.masses);
    const complianceReport = evaluateScenarioCompliance(
      rawProject.site.grossSiteArea,
      s.assumptionsUsed.setbacks,
      s.masses,
      s.metrics,
      pairwiseOverlap
    );
    return {
      ...s,
      complianceReport,
      pairwiseOverlap,
      status: complianceReport.status as DevelopmentScenario['status'],
      warningMessage: complianceReport.primaryWarning
    };
  });

  return {
    ...rawProject,
    scenarios: initialScenarios
  };
}

function getInitialProject(): Project {
  if (typeof window !== 'undefined') {
    try {
      const activeId = getActiveCaseId();
      const loaded = getCase(activeId);
      return initializeProjectScenarios(loaded);
    } catch {
      // Fallback
    }
  }
  return initializeProjectScenarios(GOLDEN_PROJECT);
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
  const [project, setProject] = useState<Project>(getInitialProject);
  const [activeScenarioId, setActiveScenarioId] = useState<string>(() => {
    const initialProj = getInitialProject();
    const pref = initialProj.scenarios.find(s => s.isPreferred) || initialProj.scenarios[0];
    return pref?.id || 'scen-002';
  });
  const [leftTab, setLeftTab] = useState<'DECISION' | 'EVIDENCE'>('DECISION');
  const [isNewCaseModalOpen, setIsNewCaseModalOpen] = useState(false);
  const [casesList, setCasesList] = useState<CaseSummary[]>(getInitialCases);

  // Helper to update project and immediately persist
  const updateProjectState = useCallback((updater: (prev: Project) => Project) => {
    setProject(prev => {
      const updated = updater(prev);
      saveCase(updated);
      return updated;
    });
  }, []);

  // Case Switching Handler
  const handleSelectCase = useCallback((id: string) => {
    setActiveCaseId(id);
    const loadedProj = getCase(id);
    const initialized = initializeProjectScenarios(loadedProj);
    setProject(initialized);
    const preferredScen = initialized.scenarios.find(s => s.isPreferred) || initialized.scenarios[0];
    if (preferredScen) {
      setActiveScenarioId(preferredScen.id);
    }
    setCasesList(listCases());
  }, []);

  // New Case Creation Handler
  const handleCreateCase = useCallback((params: CreateCaseParams) => {
    const newProj = createCase(params);
    const initialized = initializeProjectScenarios(newProj);
    setProject(initialized);
    const preferredScen = initialized.scenarios.find(s => s.isPreferred) || initialized.scenarios[0];
    if (preferredScen) {
      setActiveScenarioId(preferredScen.id);
    }
    setCasesList(listCases());
  }, []);

  // Reset Demo Case Handler
  const handleResetDemo = useCallback(() => {
    const reset = resetDemoCase();
    const initialized = initializeProjectScenarios(reset);
    setProject(initialized);
    setActiveScenarioId(initialized.scenarios[1]?.id || initialized.scenarios[0].id);
    setCasesList(listCases());
  }, []);

  // Delete Case Handler
  const handleDeleteCase = useCallback((id: string) => {
    deleteCase(id);
    const activeId = getActiveCaseId();
    const loadedProj = getCase(activeId);
    const initialized = initializeProjectScenarios(loadedProj);
    setProject(initialized);
    const preferredScen = initialized.scenarios.find(s => s.isPreferred) || initialized.scenarios[0];
    if (preferredScen) {
      setActiveScenarioId(preferredScen.id);
    }
    setCasesList(listCases());
  }, []);

  // Handle Working Site Area Basis toggle
  const handleSelectSiteArea = (newArea: number) => {
    updateProjectState(prev => {
      const updatedSite = { ...prev.site, grossSiteArea: newArea };
      const updatedScenarios: DevelopmentScenario[] = prev.scenarios.map(scen => {
        const originalScen = prev.scenarios.find(s => s.id === scen.id) || scen;
        const newMetrics = calculateDevelopmentMetrics(newArea, scen.masses, scen.assumptionsUsed.setbacks);
        const pairwiseOverlap = calculateMassPairwiseIntersections(scen.masses);
        const complianceReport = evaluateScenarioCompliance(
          newArea,
          scen.assumptionsUsed.setbacks,
          scen.masses,
          newMetrics,
          pairwiseOverlap
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

  // Handle direct mass geometry updates from 3D Development Workspace
  const handleUpdateScenarioMasses = (scenarioId: string, updatedMasses: BuildingMass[]) => {
    updateProjectState(prev => {
      const updatedScenarios: DevelopmentScenario[] = prev.scenarios.map(scen => {
        if (scen.id !== scenarioId) return scen;

        const originalScen = prev.scenarios.find(s => s.id === scenarioId) || scen;
        const newMetrics = calculateDevelopmentMetrics(
          prev.site.grossSiteArea, 
          updatedMasses, 
          scen.assumptionsUsed.setbacks
        );
        const pairwiseOverlap = calculateMassPairwiseIntersections(updatedMasses);
        const complianceReport = evaluateScenarioCompliance(
          prev.site.grossSiteArea,
          scen.assumptionsUsed.setbacks,
          updatedMasses,
          newMetrics,
          pairwiseOverlap
        );

        const tempScen: DevelopmentScenario = {
          ...scen,
          masses: updatedMasses,
          metrics: newMetrics,
          pairwiseOverlap,
          complianceReport,
          originalMasses: scen.originalMasses || originalScen.masses,
          status: complianceReport.status as DevelopmentScenario['status'],
          warningMessage: complianceReport.primaryWarning
        };

        const classification = detectScenarioEditClassification(tempScen, originalScen);

        return {
          ...tempScen,
          editClassification: classification,
          isFittedOverride: classification === 'FITTED_TO_SETBACK'
        };
      });

      return {
        ...prev,
        scenarios: updatedScenarios
      };
    });
  };

  // Handle independent scenario parameter adjustments (Floors, Front Setback)
  const handleUpdateScenarioParam = (
    scenarioId: string, 
    param: 'floors' | 'frontSetback', 
    value: number
  ) => {
    updateProjectState(prev => {
      const updatedScenarios: DevelopmentScenario[] = prev.scenarios.map(scen => {
        if (scen.id !== scenarioId) return scen;
        const originalScen = prev.scenarios.find(s => s.id === scenarioId) || scen;

        const updatedSetbacks = {
          ...scen.assumptionsUsed.setbacks,
          front: param === 'frontSetback' ? value : scen.assumptionsUsed.setbacks.front
        };

        const updatedMasses = scen.masses.map(mass => {
          if (param === 'floors') {
            const newFloors = mass.type === 'PODIUM' ? Math.min(2, value) : Math.max(1, value - (scen.masses.some(m => m.type === 'PODIUM') ? 2 : 0));
            const floorHeight = mass.floorToFloorHeight || 3.5;
            const height = newFloors * floorHeight;
            const gfa = mass.footprintArea * newFloors;
            return {
              ...mass,
              floors: newFloors,
              height,
              gfa,
              dimensions: { ...mass.dimensions, height }
            };
          }
          return mass;
        });

        const newMetrics = calculateDevelopmentMetrics(prev.site.grossSiteArea, updatedMasses, updatedSetbacks);
        const pairwiseOverlap = calculateMassPairwiseIntersections(updatedMasses);
        const complianceReport = evaluateScenarioCompliance(
          prev.site.grossSiteArea,
          updatedSetbacks,
          updatedMasses,
          newMetrics,
          pairwiseOverlap
        );

        const tempScen: DevelopmentScenario = {
          ...scen,
          masses: updatedMasses,
          metrics: newMetrics,
          pairwiseOverlap,
          complianceReport,
          assumptionsUsed: {
            ...scen.assumptionsUsed,
            heightFloors: newMetrics.totalFloors,
            heightMeters: newMetrics.totalHeightMeters,
            setbacks: updatedSetbacks
          },
          status: complianceReport.status as DevelopmentScenario['status'],
          warningMessage: complianceReport.primaryWarning
        };

        const classification = detectScenarioEditClassification(tempScen, originalScen);

        return {
          ...tempScen,
          editClassification: classification,
          isFittedOverride: classification === 'FITTED_TO_SETBACK'
        };
      });

      return {
        ...prev,
        scenarios: updatedScenarios
      };
    });
  };

  // One-Click Deterministic "Fit Massing to Setback" Action
  const handleFitMassingToEnvelope = (scenarioId: string) => {
    updateProjectState(prev => {
      const updatedScenarios: DevelopmentScenario[] = prev.scenarios.map(scen => {
        if (scen.id !== scenarioId) return scen;

        const fittedMasses = fitMassesToBuildableEnvelope(
          prev.site.grossSiteArea, 
          scen.assumptionsUsed.setbacks, 
          scen.masses
        );

        const newMetrics = calculateDevelopmentMetrics(prev.site.grossSiteArea, fittedMasses, scen.assumptionsUsed.setbacks);
        const pairwiseOverlap = calculateMassPairwiseIntersections(fittedMasses);
        const complianceReport = evaluateScenarioCompliance(
          prev.site.grossSiteArea,
          scen.assumptionsUsed.setbacks,
          fittedMasses,
          newMetrics,
          pairwiseOverlap
        );

        return {
          ...scen,
          isFittedOverride: true,
          editClassification: 'FITTED_TO_SETBACK',
          fitOverrideReason: `Shifted and resized to achieve 100% containment within ${scen.assumptionsUsed.setbacks.front}m setback envelope.`,
          originalMasses: scen.originalMasses || scen.masses,
          masses: fittedMasses,
          metrics: newMetrics,
          pairwiseOverlap,
          complianceReport,
          status: complianceReport.status as DevelopmentScenario['status'],
          warningMessage: complianceReport.primaryWarning
        };
      });

      return { ...prev, scenarios: updatedScenarios };
    });
  };

  // Reset Scenario to Baseline Concept
  const handleResetScenario = (scenarioId: string) => {
    updateProjectState(prev => {
      const targetScenario = prev.scenarios.find(s => s.id === scenarioId);
      if (!targetScenario) return prev;

      const baseMasses = targetScenario.originalMasses || targetScenario.masses;
      const baselineMetrics = calculateDevelopmentMetrics(prev.site.grossSiteArea, baseMasses, targetScenario.assumptionsUsed.setbacks);
      const pairwiseOverlap = calculateMassPairwiseIntersections(baseMasses);
      const complianceReport = evaluateScenarioCompliance(
        prev.site.grossSiteArea,
        targetScenario.assumptionsUsed.setbacks,
        baseMasses,
        baselineMetrics,
        pairwiseOverlap
      );

      const updatedScenarios = prev.scenarios.map(s => {
        if (s.id !== scenarioId) return s;
        return {
          ...s,
          isFittedOverride: false,
          fitOverrideReason: undefined,
          editClassification: 'BASE_CONCEPT' as const,
          masses: baseMasses,
          pairwiseOverlap,
          complianceReport,
          status: complianceReport.status as DevelopmentScenario['status'],
          warningMessage: complianceReport.primaryWarning,
          metrics: baselineMetrics
        };
      });

      return { ...prev, scenarios: updatedScenarios };
    });
  };

  const activeScenario = project.scenarios.find(s => s.id === activeScenarioId) || project.scenarios[0];

  return (
    <div className="flex flex-col min-h-screen lg:h-screen w-full bg-[#0a0c10] text-slate-100 overflow-x-hidden select-none">
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
          <div className="flex items-center gap-1 p-1 bg-[#121620] border border-[#232938] rounded-lg shrink-0">
            <button
              onClick={() => setLeftTab('DECISION')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                leftTab === 'DECISION' ? 'bg-[#2563eb] text-white shadow' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Compass className="w-3.5 h-3.5" />
              <span>Executive Brief</span>
            </button>
            <button
              onClick={() => setLeftTab('EVIDENCE')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                leftTab === 'EVIDENCE' ? 'bg-[#2563eb] text-white shadow' : 'text-slate-400 hover:text-slate-200'
              }`}
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
            site={{ ...project.site, setbacks: activeScenario.assumptionsUsed.setbacks }} 
            activeScenario={activeScenario}
            onUpdateScenarioMasses={handleUpdateScenarioMasses}
          />
        </section>

        {/* Right Column: Scenarios & Development Metrics (3 cols) */}
        <section className="col-span-1 lg:col-span-3 min-h-[480px] lg:h-full overflow-hidden">
          <ScenarioControls
            site={{ ...project.site, setbacks: activeScenario.assumptionsUsed.setbacks }}
            scenarios={project.scenarios}
            activeScenarioId={activeScenarioId}
            onSelectScenario={setActiveScenarioId}
            onUpdateScenarioParam={handleUpdateScenarioParam}
            onFitMassingToEnvelope={handleFitMassingToEnvelope}
            onResetScenario={handleResetScenario}
          />
        </section>
      </main>

      {/* New Opportunity Modal */}
      <NewCaseModal 
        isOpen={isNewCaseModalOpen}
        onClose={() => setIsNewCaseModalOpen(false)}
        onCreateCase={handleCreateCase}
      />
    </div>
  );
}
