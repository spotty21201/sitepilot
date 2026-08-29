'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { BuildingMass, DevelopmentScenario, Project, SiteGeometry } from '@/types';
import { 
  ViewportDisplayMode, 
  CameraProjectionMode, 
  CameraPreset, 
  ManipulationTool 
} from './types';
import { ViewportCanvas } from './ViewportCanvas';
import { SpatialConsoleViewport } from './spatial-console/SpatialConsoleViewport';
import {
  buildSpatialConsoleSnapshot,
  resolveSpatialEditorEngine,
} from './spatial-editor-adapter';
import { Toolbar } from './Toolbar';
import { MassPropertiesPanel } from './MassPropertiesPanel';
import { PascalFloatingLevelSelector } from './PascalFloatingLevelSelector';
import { PascalFloatingActionMenu } from './PascalFloatingActionMenu';
import { Development3DErrorBoundary } from './ErrorBoundary';
import { PascalDiagnosticsModal } from './PascalDiagnosticsModal';
import { getPascalRuntimeDiagnostics } from './pascal-plugin';
import { 
  getCanonicalParcelBounds, 
  evaluateScenarioCompliance,
  findNonOverlappingDuplicatePosition
} from '@/lib/geometry/engine';
import {
  CanonicalSpatialCommand,
  CanonicalCommandResult,
  createCanonicalCommandId,
} from '@/lib/spatial/canonical-command-service';
import { getScenarioFloorLimit } from '@/lib/opportunity/canonical-opportunity';
import {
  evaluateSpatialProposal,
  spatialProposalToCommand,
  type SpatialEditProposal,
  type SpatialProposalCommitResult,
  type SpatialProposalViewResult,
} from './spatial-console/spatial-editing-bridge';
import { 
  Layers, 
  Box, 
  ShieldAlert, 
  CheckCircle2, 
  Undo2,
  Redo2,
  Terminal
} from 'lucide-react';

interface DevelopmentWorkspaceProps {
  caseId: string;
  site: SiteGeometry;
  activeScenario: DevelopmentScenario;
  project: Project;
  onProposeCommand: (command: CanonicalSpatialCommand) => boolean;
  onCommitSpatialCommand: (command: CanonicalSpatialCommand) => CanonicalCommandResult;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: (scenarioId: string) => void;
  onRedo: (scenarioId: string) => void;
  zoningHeightLimitMeters?: number;
}

const configuredSpatialEditorEngine = resolveSpatialEditorEngine(
  process.env.NEXT_PUBLIC_SPATIAL_EDITOR_ENGINE,
);

function getNormalizedMassName(mass: BuildingMass, index: number): string {
  const nameLower = mass.name.toLowerCase();
  if (mass.type === 'PODIUM' || nameLower.includes('podium')) {
    return 'Podium';
  }
  if (nameLower.includes('east')) {
    return 'East Wing';
  }
  if (nameLower.includes('west')) {
    return 'West Wing';
  }
  return mass.name || `Building Wing ${index + 1}`;
}

export function DevelopmentWorkspace({
  caseId,
  site,
  activeScenario,
  project,
  onProposeCommand,
  onCommitSpatialCommand,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  zoningHeightLimitMeters,
}: DevelopmentWorkspaceProps) {
  const [viewType, setViewType] = useState<'3D' | '2D'>('3D');
  const [displayMode, setDisplayMode] = useState<ViewportDisplayMode>('DEVELOPMENT');
  const [projectionMode, setProjectionMode] = useState<CameraProjectionMode>('PERSPECTIVE');
  const [cameraPreset, setCameraPreset] = useState<CameraPreset>('ISO');
  const [activeTool, setActiveTool] = useState<ManipulationTool>('SELECT');
  const selectionScope = `${caseId}:${activeScenario.id}`;
  const [massSelection, setMassSelection] = useState<{ scope: string; massId: string } | null>(null);
  const selectedMassId = massSelection?.scope === selectionScope ? massSelection.massId : null;
  const setSelectedMassId = useCallback((massId: string | null) => {
    setMassSelection(massId ? { scope: selectionScope, massId } : null);
  }, [selectionScope]);
  const [activeLevel, setActiveLevel] = useState<number | null>(null);
  const [isRotating, setIsRotating] = useState(false);
  const [showDimensions, setShowDimensions] = useState(true);
  const [showZoningCap, setShowZoningCap] = useState(false);
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [activeSpatialEngine, setActiveSpatialEngine] = useState(configuredSpatialEditorEngine);
  const [spatialConsoleDiagnostic, setSpatialConsoleDiagnostic] = useState<string | null>(null);

  const setbacks = activeScenario.assumptionsUsed.setbacks;
  const bounds = getCanonicalParcelBounds(site.grossSiteArea, setbacks, site.frontageLength || 110);
  const streetName = site.streetName || 'Street name not provided';
  const planPadding = Math.max(16, Math.min(bounds.width, bounds.length) * 0.15);
  const planRoadDepth = 20;
  const planViewBox = [
    bounds.minX - planPadding,
    bounds.minY - planPadding,
    bounds.width + planPadding * 2,
    bounds.length + planPadding * 2 + planRoadDepth,
  ].join(' ');
  const selectedMass = activeScenario.masses.find(m => m.id === selectedMassId) || null;

  // Single Authoritative Compliance Source
  const compliance = activeScenario.complianceReport || evaluateScenarioCompliance(
    site.grossSiteArea,
    setbacks,
    activeScenario.masses,
    activeScenario.metrics,
    activeScenario.pairwiseOverlap
  );

  const spatialConsoleSnapshotResult = useMemo(() => {
    if (activeSpatialEngine !== 'spatial-console') return { snapshot: null, error: null };
    try {
      return {
        snapshot: buildSpatialConsoleSnapshot({
          caseId,
          site,
          scenario: activeScenario,
          complianceReport: compliance,
          zoningHeightLimitMeters,
        }),
        error: null,
      };
    } catch (error) {
      return {
        snapshot: null,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }, [activeScenario, activeSpatialEngine, caseId, compliance, site, zoningHeightLimitMeters]);

  const handleSpatialConsoleInitializationError = useCallback((error: Error) => {
    const message = `Spatial Console initialization failed: ${error.message}`;
    console.warn(`[SitePilot Spatial Console] ${message}`);
    setSpatialConsoleDiagnostic(message);
    setActiveSpatialEngine('legacy');
  }, []);

  const effectiveSpatialDiagnostic = spatialConsoleDiagnostic
    ?? (spatialConsoleSnapshotResult.error
      ? `Spatial Console snapshot rejected: ${spatialConsoleSnapshotResult.error.message}`
      : null);

  const handlePreviewSpatialProposal = useCallback((proposal: SpatialEditProposal): SpatialProposalViewResult => {
    const evaluation = evaluateSpatialProposal(project, proposal);
    const previewScenario = evaluation.scenario;
    if (!previewScenario?.complianceReport) return evaluation;
    return {
      ...evaluation,
      snapshot: buildSpatialConsoleSnapshot({
        caseId,
        site,
        scenario: previewScenario,
        complianceReport: previewScenario.complianceReport,
        zoningHeightLimitMeters,
      }),
    };
  }, [caseId, project, site, zoningHeightLimitMeters]);

  const handleCommitSpatialProposal = useCallback((proposal: SpatialEditProposal): SpatialProposalCommitResult => {
    const evaluation = evaluateSpatialProposal(project, proposal);
    if (!evaluation.valid) {
      return { accepted: false, code: evaluation.code, reason: evaluation.reason };
    }
    const result = onCommitSpatialCommand(spatialProposalToCommand(proposal));
    if (!result.accepted) return { accepted: false, code: result.code, reason: result.reason };
    return { accepted: true, revisionId: result.committedCommand.resultingRevisionId };
  }, [onCommitSpatialCommand, project]);

  const handleAddSpatialMass = useCallback((): SpatialProposalCommitResult => {
    const sourceMass = selectedMass ?? activeScenario.masses[0];
    const revision = activeScenario.canonicalRevision;
    if (!sourceMass || !revision) {
      return { accepted: false, code: 'TARGET_NOT_FOUND', reason: 'No source mass is available.' };
    }
    const id = createCanonicalCommandId('mass');
    const mass: BuildingMass = {
      ...structuredClone(sourceMass),
      id,
      name: 'New Mass',
      position: findNonOverlappingDuplicatePosition(sourceMass, activeScenario.masses, bounds),
      footprintPolygon: undefined,
    };
    const result = handleCommitSpatialProposal({
      type: 'ADD_MASS', caseId, scenarioId: activeScenario.id, targetId: id,
      expectedSourceRevisionId: revision.revisionId, mass,
    });
    if (result.accepted) setSelectedMassId(id);
    return result;
  }, [activeScenario, bounds, caseId, handleCommitSpatialProposal, selectedMass, setSelectedMassId]);

  const handleDuplicateSpatialMass = useCallback((): SpatialProposalCommitResult => {
    const sourceMass = selectedMass;
    const revision = activeScenario.canonicalRevision;
    if (!sourceMass || !revision) {
      return { accepted: false, code: 'TARGET_NOT_FOUND', reason: 'Select a mass to duplicate.' };
    }
    const id = createCanonicalCommandId('mass');
    const mass = {
      ...structuredClone(sourceMass),
      id,
      name: `${sourceMass.name} (Copy)`,
      position: findNonOverlappingDuplicatePosition(sourceMass, activeScenario.masses, bounds),
    };
    const result = handleCommitSpatialProposal({
      type: 'DUPLICATE_MASS', caseId, scenarioId: activeScenario.id, targetId: id,
      expectedSourceRevisionId: revision.revisionId, sourceMassId: sourceMass.id, mass,
    });
    if (result.accepted) setSelectedMassId(id);
    return result;
  }, [activeScenario, bounds, caseId, handleCommitSpatialProposal, selectedMass, setSelectedMassId]);

  const handleDeleteSpatialMass = useCallback((): SpatialProposalCommitResult => {
    const revision = activeScenario.canonicalRevision;
    if (!selectedMass || !revision) {
      return { accepted: false, code: 'TARGET_NOT_FOUND', reason: 'Select a mass to delete.' };
    }
    const result = handleCommitSpatialProposal({
      type: 'DELETE_MASS', caseId, scenarioId: activeScenario.id, targetId: selectedMass.id,
      expectedSourceRevisionId: revision.revisionId,
    });
    if (result.accepted) setSelectedMassId(null);
    return result;
  }, [activeScenario.canonicalRevision, activeScenario.id, caseId, handleCommitSpatialProposal, selectedMass, setSelectedMassId]);

  const handleUndo = useCallback(() => {
    if (canUndo) onUndo(activeScenario.id);
  }, [activeScenario.id, canUndo, onUndo]);

  const handleRedo = useCallback(() => {
    if (canRedo) onRedo(activeScenario.id);
  }, [activeScenario.id, canRedo, onRedo]);

  // Keyboard shortcut listener for Ctrl+Z / Ctrl+Shift+Z / Cmd+Z
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        if (e.shiftKey) {
          handleRedo();
        } else {
          handleUndo();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleUndo, handleRedo]);

  const handleUpdateMass = (massId: string, updates: Partial<BuildingMass>) => {
    const mass = activeScenario.masses.find((item) => item.id === massId);
    const revision = activeScenario.canonicalRevision;
    if (!mass || !revision) return false;
    const base = {
      id: createCanonicalCommandId('legacy-mass'),
      caseId,
      scenarioId: activeScenario.id,
      targetId: massId,
      expectedSourceRevisionId: revision.revisionId,
      issuedAt: new Date().toISOString(),
      source: 'LEGACY_EDITOR' as const,
    };
    let command: CanonicalSpatialCommand;
    if (updates.position) {
      command = {
        ...base,
        type: 'MOVE_MASS',
        payload: { position: { ...mass.position, ...updates.position } },
        description: `Move ${mass.name}`,
      };
    } else if (updates.floorToFloorHeight !== undefined) {
      command = {
        ...base,
        type: 'SET_FLOOR_TO_FLOOR_HEIGHT',
        payload: { floorToFloorHeight: updates.floorToFloorHeight },
        description: `Set ${mass.name} floor-to-floor height`,
      };
    } else if (updates.floors !== undefined) {
      command = {
        ...base,
        type: 'SET_MASS_FLOORS',
        payload: { floors: updates.floors },
        description: `Set ${mass.name} storeys`,
      };
    } else if (updates.program !== undefined) {
      command = {
        ...base,
        type: 'SET_MASS_PROGRAM',
        payload: { program: updates.program },
        description: `Set ${mass.name} programme`,
      };
    } else if (updates.dimensions) {
      command = {
        ...base,
        type: 'RESIZE_MASS',
        payload: {
          width: updates.dimensions.width ?? mass.dimensions.width,
          length: updates.dimensions.length ?? mass.dimensions.length,
        },
        description: `Resize ${mass.name}`,
      };
    } else {
      return false;
    }
    return onProposeCommand(command);
  };

  const handleDuplicateMass = (massId: string) => {
    const sourceMass = activeScenario.masses.find(m => m.id === massId);
    if (!sourceMass) return;

    const newPos = findNonOverlappingDuplicatePosition(sourceMass, activeScenario.masses, bounds);
    const newMassId = createCanonicalCommandId('mass');
    const duplicated: BuildingMass = {
      ...sourceMass,
      id: newMassId,
      name: `${sourceMass.name} (Copy)`,
      position: newPos
    };

    const revision = activeScenario.canonicalRevision;
    if (!revision) return;
    const accepted = onProposeCommand({
      id: createCanonicalCommandId('duplicate-mass'),
      type: 'DUPLICATE_MASS',
      caseId,
      scenarioId: activeScenario.id,
      targetId: newMassId,
      expectedSourceRevisionId: revision.revisionId,
      issuedAt: new Date().toISOString(),
      source: 'LEGACY_EDITOR',
      description: `Duplicate ${sourceMass.name}`,
      payload: { sourceMassId: sourceMass.id, mass: duplicated },
    });
    if (accepted) setSelectedMassId(newMassId);
  };

  const handleDeleteMass = (massId: string) => {
    if (activeScenario.masses.length <= 1) return;
    const revision = activeScenario.canonicalRevision;
    if (!revision) return;
    const accepted = onProposeCommand({
      id: createCanonicalCommandId('delete-mass'),
      type: 'DELETE_MASS',
      caseId,
      scenarioId: activeScenario.id,
      targetId: massId,
      expectedSourceRevisionId: revision.revisionId,
      issuedAt: new Date().toISOString(),
      source: 'LEGACY_EDITOR',
      description: `Delete ${activeScenario.masses.find((mass) => mass.id === massId)?.name || massId}`,
      payload: {},
    });
    if (accepted && selectedMassId === massId) {
      setSelectedMassId(null);
    }
  };

  const handleFitMassing = () => {
    const revision = activeScenario.canonicalRevision;
    if (!revision) return;
    onProposeCommand({
      id: createCanonicalCommandId('fit-envelope'),
      type: 'FIT_TO_ENVELOPE',
      caseId,
      scenarioId: activeScenario.id,
      targetId: activeScenario.id,
      expectedSourceRevisionId: revision.revisionId,
      issuedAt: new Date().toISOString(),
      source: 'LEGACY_EDITOR',
      description: `Fit ${activeScenario.name} to its setback envelope`,
      payload: {},
    });
  };

  const handleAddFloor = (massId: string) => {
    const mass = activeScenario.masses.find(m => m.id === massId);
    if (!mass || mass.floors >= 24) return;
    const f2f = mass.floorToFloorHeight || 3.5;
    const newFloors = mass.floors + 1;
    const newH = Math.round(newFloors * f2f * 10) / 10;
    const gfa = Math.round(mass.footprintArea * newFloors * 10) / 10;
    handleUpdateMass(massId, {
      floors: newFloors,
      height: newH,
      gfa,
      dimensions: { ...mass.dimensions, height: newH }
    });
  };

  const handleRemoveFloor = (massId: string) => {
    const mass = activeScenario.masses.find(m => m.id === massId);
    if (!mass || mass.floors <= 1) return;
    const f2f = mass.floorToFloorHeight || 3.5;
    const newFloors = mass.floors - 1;
    const newH = Math.round(newFloors * f2f * 10) / 10;
    const gfa = Math.round(mass.footprintArea * newFloors * 10) / 10;
    handleUpdateMass(massId, {
      floors: newFloors,
      height: newH,
      gfa,
      dimensions: { ...mass.dimensions, height: newH }
    });
  };

  const handleDisplayModeChange = (mode: ViewportDisplayMode) => {
    const isTurningPlanningChecksOff = mode === 'CONSTRAINTS'
      && displayMode === 'CONSTRAINTS'
      && showZoningCap;
    setDisplayMode(isTurningPlanningChecksOff ? 'DEVELOPMENT' : mode);
    setShowZoningCap(mode === 'CONSTRAINTS' && !isTurningPlanningChecksOff);
  };

  // Node count for Pascal scene graph
  const activePascalNodeCount = 5 + activeScenario.masses.length + (activeScenario.metrics.totalHeightMeters > 32 ? 1 : 0);
  const diagnostics = getPascalRuntimeDiagnostics(
    activePascalNodeCount,
    activeTool,
    displayMode,
    activeScenario.id
  );

  return (
    <Development3DErrorBoundary fallbackTitle="3D Spatial Development Workspace">
      <div className="relative w-full h-full min-h-[460px] bg-[var(--bg-primary)] border border-[var(--border-subtle)] rounded-[var(--radius-panel)] overflow-hidden flex flex-col select-none">
        {/* Primary workspace toolbar. The Spatial Console keeps secondary controls in canvas context. */}
        <div className={`bg-[var(--bg-secondary)] border-b border-[var(--border-subtle)] flex items-center justify-between gap-2 z-20 ${
          activeSpatialEngine === 'spatial-console' && viewType === '3D'
            ? 'min-h-[44px] px-2 py-1.5 flex-nowrap'
            : 'p-2.5 flex-wrap'
        }`}>
          <div className="ui-segmented">
            <button
              onClick={() => setViewType('2D')}
              aria-label="2D Site Plan (Illustrative) view"
              aria-pressed={viewType === '2D'}
              className="ui-segment flex items-center gap-1.5 px-2 py-1 text-xs font-semibold transition-colors cursor-pointer"
            >
              <Layers className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">2D Site Plan (Illustrative)</span><span className="sm:hidden">2D</span>
            </button>
            <button
              onClick={() => setViewType('3D')}
              aria-label="3D Spatial Model view"
              aria-pressed={viewType === '3D'}
              className="ui-segment flex items-center gap-1.5 px-2 py-1 text-xs font-semibold transition-colors cursor-pointer"
            >
              <Box className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">3D Spatial Model</span><span className="sm:hidden">3D</span>
            </button>
          </div>

          <div className="flex min-w-0 items-center gap-1.5">
            {!compliance.isCompliant ? (
              <div className="status-badge status-badge--error !min-h-[var(--control-height-sm)] !rounded-[var(--radius-control)] !px-2 !py-1 !font-sans text-[11px] font-medium whitespace-nowrap">
                <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
                <span>{compliance.statusPillLabel}</span>
              </div>
            ) : (
              <div className="status-badge status-badge--verified !min-h-[var(--control-height-sm)] !rounded-[var(--radius-control)] !px-2 !py-1 !font-sans text-[11px] font-medium whitespace-nowrap">
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                <span>{compliance.statusPillLabel}</span>
              </div>
            )}

            <div className="flex items-center gap-1">
              <button
                onClick={handleUndo}
                disabled={!canUndo}
                title="Undo (Ctrl+Z)"
                aria-label="Undo action"
                className="button-secondary p-1.5 disabled:opacity-50 text-[var(--text-secondary)] cursor-pointer"
              >
                <Undo2 className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={handleRedo}
                disabled={!canRedo}
                title="Redo (Ctrl+Shift+Z)"
                aria-label="Redo action"
                className="button-secondary p-1.5 disabled:opacity-50 text-[var(--text-secondary)] cursor-pointer"
              >
                <Redo2 className="w-3.5 h-3.5" />
              </button>
            </div>

            <button
              onClick={() => setShowDiagnostics(true)}
              title="Inspect System Runtime Diagnostics"
              aria-label="Inspect System Runtime Diagnostics"
              className="button-secondary p-1.5 text-[var(--status-evidence)] cursor-pointer"
            >
              <Terminal className="w-3 h-3" />
              <span className="sr-only">Diagnostics</span>
            </button>
          </div>
        </div>

        {/* Legacy renderer retains its existing toolbar; Spatial Console owns display and camera controls in canvas. */}
        {viewType === '3D' && activeSpatialEngine === 'legacy' && (
          <Toolbar
            displayMode={displayMode}
            projectionMode={projectionMode}
            cameraPreset={cameraPreset}
            activeTool={activeTool}
            isRotating={isRotating}
            showDimensions={showDimensions}
            showZoningCap={showZoningCap}
            hideCameraControls={false}
            onChangeDisplayMode={handleDisplayModeChange}
            onChangeProjectionMode={setProjectionMode}
            onSetCameraPreset={setCameraPreset}
            onChangeTool={setActiveTool}
            onToggleRotating={() => setIsRotating(!isRotating)}
            onToggleDimensions={() => setShowDimensions(!showDimensions)}
            onToggleZoningCap={() => setShowZoningCap(!showZoningCap)}
          />
        )}

        {/* Viewport Area */}
        <div className="relative w-full flex-1 overflow-hidden bg-[var(--bg-primary)]">
          {viewType === '3D' ? (
            <>
              {activeSpatialEngine === 'spatial-console' && spatialConsoleSnapshotResult.snapshot ? (
                <SpatialConsoleViewport
                  snapshot={spatialConsoleSnapshotResult.snapshot}
                  displayMode={displayMode}
                  projectionMode={projectionMode}
                  cameraPreset={cameraPreset}
                  selectedMassId={selectedMassId}
                  activeTool={activeTool}
                  showZoningCap={showZoningCap}
                  onSelectMass={setSelectedMassId}
                  onChangeTool={setActiveTool}
                  onSetCameraPreset={setCameraPreset}
                  onChangeProjectionMode={setProjectionMode}
                  onChangeDisplayMode={handleDisplayModeChange}
                  onPreviewProposal={handlePreviewSpatialProposal}
                  onCommitProposal={handleCommitSpatialProposal}
                  onAddMass={handleAddSpatialMass}
                  onDuplicateMass={handleDuplicateSpatialMass}
                  onDeleteMass={handleDeleteSpatialMass}
                  onInitializationError={handleSpatialConsoleInitializationError}
                />
              ) : (
                <div
                  className="absolute inset-0"
                  data-spatial-engine="legacy"
                  data-case-id={caseId}
                  data-scenario-id={activeScenario.id}
                  data-canonical-revision={activeScenario.canonicalRevision?.revisionId}
                >
                  <ViewportCanvas
                    site={site}
                    scenario={activeScenario}
                    displayMode={displayMode}
                    projectionMode={projectionMode}
                    cameraPreset={cameraPreset}
                    activeTool={activeTool}
                    selectedMassId={selectedMassId}
                    isRotating={isRotating}
                    showDimensions={showDimensions}
                    showZoningCap={showZoningCap}
                    zoningHeightLimitMeters={zoningHeightLimitMeters}
                    onSelectMass={setSelectedMassId}
                    onUpdateMassGeometry={handleUpdateMass}
                    onSetCameraPreset={setCameraPreset}
                  />
                </div>
              )}

              {effectiveSpatialDiagnostic
                && (activeSpatialEngine === 'legacy' || spatialConsoleSnapshotResult.error)
                && (
                <div
                  role="status"
          className="absolute top-3 left-3 z-30 max-w-md border border-[var(--status-warning)] bg-[var(--status-warning-surface)] px-2.5 py-1.5 text-[10px] font-mono text-[var(--status-warning)]"
                  title="The Spatial Console could not start. The fallback 3D view is active."
                >
                  Spatial Console unavailable · Fallback 3D view active
                </div>
              )}

              {/* Pascal Floating Action Menu directly over selected mass */}
              {activeSpatialEngine === 'legacy' && selectedMass && (
                <PascalFloatingActionMenu
                  scenario={activeScenario}
                  selectedMass={selectedMass}
                  setbacks={setbacks}
                  onUpdateMass={handleUpdateMass}
                  onDuplicateMass={handleDuplicateMass}
                  onDeleteMass={handleDeleteMass}
                  onFitMass={handleFitMassing}
                  onClose={() => setSelectedMassId(null)}
                />
              )}

              {/* Pascal Floating Level Selector on bottom-left */}
              {activeSpatialEngine === 'legacy' && (
                <PascalFloatingLevelSelector
                  scenario={activeScenario}
                  selectedMass={selectedMass}
                  activeLevel={activeLevel}
                  onSelectLevel={setActiveLevel}
                  onAddFloor={handleAddFloor}
                  onRemoveFloor={handleRemoveFloor}
                />
              )}

              {/* Exact Numeric Mass Properties Panel on right */}
              {activeSpatialEngine === 'legacy' && selectedMass && (
                <MassPropertiesPanel
                  scenario={activeScenario}
                  selectedMass={selectedMass}
                  site={site}
                  floorLimit={getScenarioFloorLimit(project, activeScenario)}
                  onUpdateMass={handleUpdateMass}
                  onDuplicateMass={handleDuplicateMass}
                  onDeleteMass={handleDeleteMass}
                  onClose={() => setSelectedMassId(null)}
                />
              )}
            </>
          ) : (
            /* 2D Cadastral SVG View with Normalized Non-Colliding Legend */
            <div className="w-full h-full flex flex-col items-center justify-center p-4 bg-[var(--bg-primary)]">
              <svg viewBox={planViewBox} className="w-full flex-1 max-w-2xl drop-shadow-2xl" role="img" aria-label={`Illustrative rectangular site plan fronting ${streetName}`}>
                <rect data-study-road-width="20" x={bounds.minX - planPadding / 2} y={bounds.maxY} width={bounds.width + planPadding} height={planRoadDepth} fill="#252a31" stroke="#3b424d" strokeWidth="0.8" />
                <text x="0" y={bounds.maxY + planRoadDepth * 0.62} fill="#c9a96a" fontSize={Math.max(3, Math.min(5, bounds.width / 24))} textAnchor="middle" letterSpacing="0.5" fontWeight="bold">
                  {`${streetName.toUpperCase()} · FRONTAGE ${bounds.width}M`}
                </text>

                <rect
                  x={bounds.minX}
                  y={bounds.minY}
                  width={bounds.width}
                  height={bounds.length}
                  fill="#161f30"
                  fillOpacity="0.8"
                  stroke="var(--status-evidence)"
                  strokeWidth="1.2"
                />
                <line x1={bounds.minX} y1={bounds.maxY} x2={bounds.maxX} y2={bounds.maxY} stroke="var(--action-primary)" strokeWidth="1.6" />

                <text x={bounds.minX - 3} y="0" fill="var(--text-secondary)" fontSize="3" textAnchor="middle" transform={`rotate(-90 ${bounds.minX - 3} 0)`}>
                  DEPTH {bounds.length}M
                </text>

                <rect
                  x={bounds.buildableMinX}
                  y={bounds.buildableMinY}
                  width={bounds.buildableWidth}
                  height={bounds.buildableLength}
                  fill="#0f172a"
                  fillOpacity="0.6"
                  stroke="var(--status-verified)"
                  strokeWidth="0.8"
                  strokeDasharray="2 2"
                />

                {activeScenario.masses.map((m, idx) => {
                  const w = m.dimensions.width;
                  const l = m.dimensions.length;
                  const posX = m.position.x - w / 2;
                  const posY = m.position.z - l / 2;
                  const isViolation = !compliance.isCompliant;

                  return (
                    <g 
                      key={m.id} 
                      onClick={() => {
                        setSelectedMassId(m.id);
                        setViewType('3D');
                      }}
                      className="cursor-pointer hover:opacity-80 transition-opacity"
                    >
                      <rect
                        x={posX}
                        y={posY}
                        width={w}
                        height={l}
                        fill={m.type === 'PODIUM' ? 'var(--status-evidence)' : isViolation ? 'var(--status-error)' : 'var(--spatial-selection)'}
                        fillOpacity="0.85"
                        stroke="#ffffff"
                        strokeWidth="0.8"
                        rx="0.5"
                      />
                      <circle cx={posX + w / 2} cy={posY + l / 2} r="4" fill="#0f172a" stroke="#ffffff" strokeWidth="0.6" />
                      <text
                        x={posX + w / 2}
                        y={posY + l / 2 + 1.2}
                        fill="#ffffff"
                        fontSize="3.2"
                        fontWeight="bold"
                        textAnchor="middle"
                      >
                        {idx + 1}
                      </text>
                    </g>
                  );
                })}

                <g aria-label={`Study setback lines: front ${setbacks.front} metres, sides ${setbacks.sideLeft} metres, rear ${setbacks.rear} metres`} pointerEvents="none">
                  <line x1={bounds.minX} y1={bounds.buildableMaxY} x2={bounds.maxX} y2={bounds.buildableMaxY} stroke="#d9a7b7" strokeWidth="0.9" strokeDasharray="2 1.5" />
                  <line x1={bounds.buildableMinX} y1={bounds.minY} x2={bounds.buildableMinX} y2={bounds.maxY} stroke="#d9a7b7" strokeWidth="0.9" strokeDasharray="2 1.5" />
                  <line x1={bounds.buildableMaxX} y1={bounds.minY} x2={bounds.buildableMaxX} y2={bounds.maxY} stroke="#d9a7b7" strokeWidth="0.9" strokeDasharray="2 1.5" />
                  <line x1={bounds.minX} y1={bounds.buildableMinY} x2={bounds.maxX} y2={bounds.buildableMinY} stroke="#d9a7b7" strokeWidth="0.9" strokeDasharray="2 1.5" />
                  <text x="0" y={bounds.buildableMaxY - 2} fill="#efc4d1" fontSize="2.6" textAnchor="middle">FRONT SETBACK {setbacks.front} M</text>
                  <text x={bounds.buildableMinX + 2} y="0" fill="#efc4d1" fontSize="2.5" textAnchor="middle" transform={`rotate(-90 ${bounds.buildableMinX + 2} 0)`}>SIDE {setbacks.sideLeft} M</text>
                  <text x={bounds.buildableMaxX - 2} y="0" fill="#efc4d1" fontSize="2.5" textAnchor="middle" transform={`rotate(90 ${bounds.buildableMaxX - 2} 0)`}>SIDE {setbacks.sideRight} M</text>
                  <text x="0" y={bounds.buildableMinY + 3} fill="#efc4d1" fontSize="2.6" textAnchor="middle">REAR SETBACK {setbacks.rear} M</text>
                </g>
              </svg>

              {/* Exact Requested Indexed Mass Legend ([1] Podium, [2] East Wing, [3] West Wing) */}
              <div className="flex flex-wrap items-center justify-center gap-3 mt-3 bg-[var(--bg-secondary)] px-4 py-2 rounded-[var(--radius-card)] border border-[var(--border-subtle)] text-[11px] font-mono">
                {activeScenario.masses.map((m, idx) => {
                  const normalizedLabel = getNormalizedMassName(m, idx);
                  return (
                    <div 
                      key={m.id} 
                      onClick={() => {
                        setSelectedMassId(m.id);
                        setViewType('3D');
                      }}
                      className="flex items-center gap-2 cursor-pointer hover:text-white transition-colors"
                    >
                      <span className={`w-4 h-4 rounded-[var(--radius-control)] flex items-center justify-center font-bold text-[#101316] text-[10px] ${m.type === 'PODIUM' ? 'bg-[var(--status-evidence)]' : 'bg-[var(--spatial-selection)]'}`}>
                        {idx + 1}
                      </span>
                      <span className="text-[var(--text-primary)] font-semibold">[{idx + 1}] {normalizedLabel}:</span>
                      <span className="text-[var(--text-secondary)]">{m.dimensions.width}m × {m.dimensions.length.toFixed(1)}m · {m.floors} Fl ({m.gfa.toLocaleString()} m²)</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Legacy and 2D retain their established fixed legend; Spatial Console uses its collapsible in-canvas legend and scale. */}
        {(activeSpatialEngine === 'legacy' || viewType === '2D') && <div className="p-2.5 bg-[var(--bg-secondary)] border-t border-[var(--border-subtle)] flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--text-secondary)] z-10">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[var(--status-evidence)]" />
              <span>Site ({bounds.width}m × {bounds.length}m = {bounds.grossSiteArea.toLocaleString()} m²)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[var(--status-verified)]" />
              <span>Buildable Envelope ({bounds.netBuildableArea.toLocaleString()} m²)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[var(--spatial-selection)]" />
              <span>Massing ({activeScenario.name.split(':')[0]})</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-5 border-t border-dashed border-[#d9a7b7]" />
              <span>Study setbacks · front {setbacks.front} m · sides {setbacks.sideLeft}/{setbacks.sideRight} m · rear {setbacks.rear} m</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-[#252a31]" />
              <span>20 m study road · user/address-derived context, not cadastral data</span>
            </div>
          </div>

          <div className="flex items-center gap-3 font-mono text-[11px] text-[var(--text-muted)]">
            <div className="flex items-center gap-1.5">
              <div className="w-10 h-1 bg-slate-400 border border-slate-200" />
              <span>50m</span>
            </div>
            <span>SitePilot 3D Engine</span>
          </div>
        </div>}
      </div>

      {/* Diagnostics Modal */}
      {showDiagnostics && (
        <PascalDiagnosticsModal
          diagnostics={diagnostics}
          onClose={() => setShowDiagnostics(false)}
        />
      )}
    </Development3DErrorBoundary>
  );
}
