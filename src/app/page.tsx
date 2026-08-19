'use client';

import React, { useState } from 'react';
import { GOLDEN_PROJECT } from '@/lib/mock-data/golden-project';
import { DecisionRoomHeader } from '@/components/DecisionRoomHeader';
import { DevelopmentWorkspace } from '@/features/development-3d/DevelopmentWorkspace';
import { EvidenceLedger } from '@/components/EvidenceLedger';
import { ScenarioControls } from '@/components/ScenarioControls';
import { DecisionRoomSummary } from '@/components/DecisionRoomSummary';
import { 
  calculateDevelopmentMetrics, 
  fitMassesToBuildableEnvelope,
  calculateMassPairwiseIntersections,
  detectScenarioEditClassification,
  evaluateScenarioCompliance
} from '@/lib/geometry/engine';
import { Compass, ShieldCheck } from 'lucide-react';
import { Project, DevelopmentScenario, BuildingMass } from '@/types';

export default function SitePilotDecisionRoom() {
  const [project, setProject] = useState<Project>(() => {
    // Initialize scenarios with canonical compliance reports
    const initialScenarios = GOLDEN_PROJECT.scenarios.map(s => {
      const pairwiseOverlap = calculateMassPairwiseIntersections(s.masses);
      const complianceReport = evaluateScenarioCompliance(
        GOLDEN_PROJECT.site.grossSiteArea,
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
      ...GOLDEN_PROJECT,
      scenarios: initialScenarios
    };
  });

  const [activeScenarioId, setActiveScenarioId] = useState<string>(GOLDEN_PROJECT.scenarios[1].id); // Default Scenario B (Preferred)
  const [leftTab, setLeftTab] = useState<'DECISION' | 'EVIDENCE'>('DECISION');

  // Handle Working Site Area Basis toggle (e.g. 16,850 m² vs 18,200 m²)
  const handleSelectSiteArea = (newArea: number) => {
    setProject(prev => {
      const updatedSite = { ...prev.site, grossSiteArea: newArea };
      const updatedScenarios: DevelopmentScenario[] = prev.scenarios.map(scen => {
        const originalScen = GOLDEN_PROJECT.scenarios.find(s => s.id === scen.id) || scen;
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
    setProject(prev => {
      const updatedScenarios: DevelopmentScenario[] = prev.scenarios.map(scen => {
        if (scen.id !== scenarioId) return scen;

        const originalScen = GOLDEN_PROJECT.scenarios.find(s => s.id === scenarioId) || scen;
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
    setProject(prev => {
      const updatedScenarios: DevelopmentScenario[] = prev.scenarios.map(scen => {
        if (scen.id !== scenarioId) return scen;
        const originalScen = GOLDEN_PROJECT.scenarios.find(s => s.id === scenarioId) || scen;

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
    setProject(prev => {
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
          fitOverrideReason: `Shifted rearward to achieve 100% containment within ${scen.assumptionsUsed.setbacks.front}m setback envelope.`,
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
    const originalScenario = GOLDEN_PROJECT.scenarios.find(s => s.id === scenarioId);
    if (!originalScenario) return;

    setProject(prev => {
      const updatedScenarios = prev.scenarios.map(s => {
        if (s.id !== scenarioId) return s;
        const baselineMetrics = calculateDevelopmentMetrics(prev.site.grossSiteArea, originalScenario.masses, originalScenario.assumptionsUsed.setbacks);
        const pairwiseOverlap = { hasOverlap: false, overlapVolumeM3: 0, overlaps: [] };
        const complianceReport = evaluateScenarioCompliance(
          prev.site.grossSiteArea,
          originalScenario.assumptionsUsed.setbacks,
          originalScenario.masses,
          baselineMetrics,
          pairwiseOverlap
        );

        return {
          ...originalScenario,
          isFittedOverride: false,
          fitOverrideReason: undefined,
          editClassification: 'BASE_CONCEPT' as const,
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
      {/* Top Header */}
      <DecisionRoomHeader project={project} />

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
    </div>
  );
}
