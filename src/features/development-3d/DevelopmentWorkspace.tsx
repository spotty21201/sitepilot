'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { BuildingMass, DevelopmentScenario, SiteGeometry } from '@/types';
import { 
  ViewportDisplayMode, 
  CameraProjectionMode, 
  CameraPreset, 
  ManipulationTool 
} from './types';
import { ViewportCanvas } from './ViewportCanvas';
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
  fitMassesToBuildableEnvelope,
  findNonOverlappingDuplicatePosition
} from '@/lib/geometry/engine';
import { 
  Layers, 
  Box, 
  ShieldAlert, 
  CheckCircle2, 
  Navigation,
  Undo2,
  Redo2,
  Terminal
} from 'lucide-react';

interface DevelopmentWorkspaceProps {
  site: SiteGeometry;
  activeScenario: DevelopmentScenario;
  onUpdateScenarioMasses: (scenarioId: string, updatedMasses: BuildingMass[]) => void;
}

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
  site,
  activeScenario,
  onUpdateScenarioMasses
}: DevelopmentWorkspaceProps) {
  const [viewType, setViewType] = useState<'3D' | '2D'>('3D');
  const [displayMode, setDisplayMode] = useState<ViewportDisplayMode>('DEVELOPMENT');
  const [projectionMode, setProjectionMode] = useState<CameraProjectionMode>('PERSPECTIVE');
  const [cameraPreset, setCameraPreset] = useState<CameraPreset>('ISO');
  const [activeTool, setActiveTool] = useState<ManipulationTool>('SELECT');
  const [selectedMassId, setSelectedMassId] = useState<string | null>(null);
  const [activeLevel, setActiveLevel] = useState<number | null>(null);
  const [isRotating, setIsRotating] = useState(false);
  const [showDimensions, setShowDimensions] = useState(true);
  const [showZoningCap, setShowZoningCap] = useState(false);
  const [showDiagnostics, setShowDiagnostics] = useState(false);

  // Undo / Redo history state stack
  const [history, setHistory] = useState<BuildingMass[][]>([]);
  const [future, setFuture] = useState<BuildingMass[][]>([]);

  const setbacks = activeScenario.assumptionsUsed.setbacks;
  const bounds = getCanonicalParcelBounds(site.grossSiteArea, setbacks, site.frontageLength || 110);
  const selectedMass = activeScenario.masses.find(m => m.id === selectedMassId) || null;

  // Single Authoritative Compliance Source
  const compliance = activeScenario.complianceReport || evaluateScenarioCompliance(
    site.grossSiteArea,
    setbacks,
    activeScenario.masses,
    activeScenario.metrics,
    activeScenario.pairwiseOverlap
  );

  // Mass mutation handlers (translating interaction into deterministic SitePilot model updates)
  const commitMassUpdates = useCallback((updatedMasses: BuildingMass[]) => {
    setHistory(prev => [...prev, activeScenario.masses]);
    setFuture([]);
    onUpdateScenarioMasses(activeScenario.id, updatedMasses);
  }, [activeScenario.id, activeScenario.masses, onUpdateScenarioMasses]);

  const handleUndo = useCallback(() => {
    if (history.length === 0) return;
    const previous = history[history.length - 1];
    setHistory(prev => prev.slice(0, prev.length - 1));
    setFuture(prev => [activeScenario.masses, ...prev]);
    onUpdateScenarioMasses(activeScenario.id, previous);
  }, [history, activeScenario.id, activeScenario.masses, onUpdateScenarioMasses]);

  const handleRedo = useCallback(() => {
    if (future.length === 0) return;
    const next = future[0];
    setFuture(prev => prev.slice(1));
    setHistory(prev => [...prev, activeScenario.masses]);
    onUpdateScenarioMasses(activeScenario.id, next);
  }, [future, activeScenario.id, activeScenario.masses, onUpdateScenarioMasses]);

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
    const updatedMasses = activeScenario.masses.map(m => {
      if (m.id !== massId) return m;
      return {
        ...m,
        ...updates,
        dimensions: {
          ...m.dimensions,
          ...(updates.dimensions || {})
        },
        position: {
          ...m.position,
          ...(updates.position || {})
        }
      };
    });
    commitMassUpdates(updatedMasses);
  };

  const handleDuplicateMass = (massId: string) => {
    const sourceMass = activeScenario.masses.find(m => m.id === massId);
    if (!sourceMass) return;

    const newPos = findNonOverlappingDuplicatePosition(sourceMass, activeScenario.masses, bounds);
    const newMassId = `mass-${Date.now()}`;
    const duplicated: BuildingMass = {
      ...sourceMass,
      id: newMassId,
      name: `${sourceMass.name} (Copy)`,
      position: newPos
    };

    commitMassUpdates([...activeScenario.masses, duplicated]);
    setSelectedMassId(newMassId);
  };

  const handleDeleteMass = (massId: string) => {
    if (activeScenario.masses.length <= 1) return;
    const filtered = activeScenario.masses.filter(m => m.id !== massId);
    commitMassUpdates(filtered);
    if (selectedMassId === massId) {
      setSelectedMassId(null);
    }
  };

  const handleFitMassing = () => {
    const fitted = fitMassesToBuildableEnvelope(site.grossSiteArea, setbacks, activeScenario.masses);
    commitMassUpdates(fitted);
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
    setDisplayMode(mode);
    if (mode === 'CONSTRAINTS') {
      setShowZoningCap(true);
    }
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
      <div className="relative w-full h-full min-h-[460px] bg-[#0c0f17] border border-[#232938] rounded-xl overflow-hidden flex flex-col shadow-inner select-none">
        {/* Top Header Bar: 2D/3D Mode Switcher, Undo/Redo & Live Compliance Pill */}
        <div className="p-2.5 bg-[#121622]/95 border-b border-[#232938] flex flex-wrap items-center justify-between gap-2 z-20">
          <div className="flex items-center gap-1.5 bg-[#161c2b] p-1 rounded-lg border border-[#2b3548]">
            <button
              onClick={() => setViewType('2D')}
              aria-label="2D Site Plan (Illustrative) view"
              aria-pressed={viewType === '2D'}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                viewType === '2D' ? 'bg-[#2563eb] text-white shadow' : 'text-slate-400 hover:text-slate-100 hover:bg-[#1f2738]'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>2D Site Plan (Illustrative)</span>
            </button>
            <button
              onClick={() => setViewType('3D')}
              aria-label="3D Spatial Model view"
              aria-pressed={viewType === '3D'}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                viewType === '3D' ? 'bg-[#2563eb] text-white shadow' : 'text-slate-400 hover:text-slate-100 hover:bg-[#1f2738]'
              }`}
            >
              <Box className="w-3.5 h-3.5" />
              <span>3D Spatial Model</span>
            </button>
          </div>

          {/* Undo / Redo & Diagnostics HUD */}
          <div className="flex items-center gap-1.5">
            <div className="flex items-center gap-1">
              <button
                onClick={handleUndo}
                disabled={history.length === 0}
                title="Undo (Ctrl+Z)"
                aria-label="Undo action"
                className="p-1.5 bg-[#161c28] hover:bg-[#20293a] disabled:opacity-40 disabled:hover:bg-[#161c28] text-slate-300 rounded border border-[#273247] cursor-pointer"
              >
                <Undo2 className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={handleRedo}
                disabled={future.length === 0}
                title="Redo (Ctrl+Shift+Z)"
                aria-label="Redo action"
                className="p-1.5 bg-[#161c28] hover:bg-[#20293a] disabled:opacity-40 disabled:hover:bg-[#161c28] text-slate-300 rounded border border-[#273247] cursor-pointer"
              >
                <Redo2 className="w-3.5 h-3.5" />
              </button>
            </div>

            <button
              onClick={() => setShowDiagnostics(true)}
              title="Inspect System Runtime Diagnostics"
              aria-label="Inspect System Runtime Diagnostics"
              className="flex items-center gap-1 px-2.5 py-1.5 bg-[#182030] hover:bg-[#222d42] text-sky-400 rounded-lg text-[11px] font-mono font-bold border border-[#2b3952] cursor-pointer"
            >
              <Terminal className="w-3 h-3" />
              <span>Diagnostics</span>
            </button>
          </div>

          {/* Single Authoritative Compliance Status Pill */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 bg-[#161c2b] border border-[#2b3548] px-2 py-1 rounded-lg text-slate-300 text-[10px] font-mono font-bold">
              <Navigation className="w-3.5 h-3.5 text-rose-400 rotate-[-45deg]" />
              <span>N</span>
            </div>

            {!compliance.isCompliant ? (
              <div className="flex items-center gap-1.5 bg-rose-950/90 border border-rose-600/70 text-rose-200 px-3 py-1.5 rounded-lg text-xs font-medium backdrop-blur-md shadow">
                <ShieldAlert className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                <span>{compliance.statusPillLabel}</span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 bg-emerald-950/90 border border-emerald-600/70 text-emerald-200 px-3 py-1.5 rounded-lg text-xs font-medium backdrop-blur-md shadow">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>{compliance.statusPillLabel}</span>
              </div>
            )}
          </div>
        </div>

        {/* Workspace Toolbar */}
        {viewType === '3D' && (
          <Toolbar
            displayMode={displayMode}
            projectionMode={projectionMode}
            cameraPreset={cameraPreset}
            activeTool={activeTool}
            isRotating={isRotating}
            showDimensions={showDimensions}
            showZoningCap={showZoningCap}
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
        <div className="relative w-full flex-1 overflow-hidden bg-[#0a0d14]">
          {viewType === '3D' ? (
            <>
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
                onSelectMass={setSelectedMassId}
                onUpdateMassGeometry={handleUpdateMass}
                onSetCameraPreset={setCameraPreset}
              />

              {/* Pascal Floating Action Menu directly over selected mass */}
              {selectedMass && (
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
              <PascalFloatingLevelSelector
                scenario={activeScenario}
                selectedMass={selectedMass}
                activeLevel={activeLevel}
                onSelectLevel={setActiveLevel}
                onAddFloor={handleAddFloor}
                onRemoveFloor={handleRemoveFloor}
              />

              {/* Exact Numeric Mass Properties Panel on right */}
              {selectedMass && (
                <MassPropertiesPanel
                  scenario={activeScenario}
                  selectedMass={selectedMass}
                  setbacks={setbacks}
                  onUpdateMass={handleUpdateMass}
                  onDuplicateMass={handleDuplicateMass}
                  onDeleteMass={handleDeleteMass}
                  onClose={() => setSelectedMassId(null)}
                />
              )}
            </>
          ) : (
            /* 2D Cadastral SVG View with Normalized Non-Colliding Legend */
            <div className="w-full h-full flex flex-col items-center justify-center p-4 bg-[#0a0d14]">
              <svg viewBox="-90 -115 180 230" className="w-full flex-1 max-w-2xl drop-shadow-2xl">
                <rect x="-85" y="76.59" width="170" height="20" fill="#10141e" stroke="#2a3348" strokeWidth="0.8" />
                <text x="0" y="88" fill="#94a3b8" fontSize="4.5" textAnchor="middle" letterSpacing="1" fontWeight="bold">
                  JL. TEUKU UMAR (FRONTAGE: {bounds.width}M)
                </text>

                <rect x="-55" y="-105" width="6.5" height="40" fill="#1e293b" stroke="#38bdf8" strokeWidth="0.8" strokeDasharray="1 1" />
                <text x="-51.75" y="-95" fill="#38bdf8" fontSize="2.5" textAnchor="middle">6.5m Access</text>

                <rect
                  x={bounds.minX}
                  y={bounds.minY}
                  width={bounds.width}
                  height={bounds.length}
                  fill="#161f30"
                  fillOpacity="0.8"
                  stroke="#38bdf8"
                  strokeWidth="1.2"
                />

                <rect
                  x={bounds.buildableMinX}
                  y={bounds.buildableMinY}
                  width={bounds.buildableWidth}
                  height={bounds.buildableLength}
                  fill="#0f172a"
                  fillOpacity="0.6"
                  stroke="#10b981"
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
                        fill={m.type === 'PODIUM' ? '#38bdf8' : isViolation ? '#f43f5e' : '#e2b170'}
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
              </svg>

              {/* Exact Requested Indexed Mass Legend ([1] Podium, [2] East Wing, [3] West Wing) */}
              <div className="flex flex-wrap items-center justify-center gap-3 mt-3 bg-[#121622] px-4 py-2 rounded-lg border border-[#232938] text-[11px] font-mono shadow-md">
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
                      <span className={`w-4 h-4 rounded flex items-center justify-center font-bold text-white text-[10px] ${m.type === 'PODIUM' ? 'bg-[#2563eb]' : 'bg-[#d97706]'}`}>
                        {idx + 1}
                      </span>
                      <span className="text-slate-200 font-semibold">[{idx + 1}] {normalizedLabel}:</span>
                      <span className="text-slate-400">{m.dimensions.width}m × {m.dimensions.length.toFixed(1)}m · {m.floors} Fl ({m.gfa.toLocaleString()} m²)</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Bottom Architectural Inspection Legend & Scale Bar */}
        <div className="p-2.5 bg-[#101420] border-t border-[#232938] flex flex-wrap items-center justify-between gap-2 text-xs text-slate-300 z-10">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#38bdf8]" />
              <span>Site ({bounds.width}m × {bounds.length}m = {bounds.grossSiteArea.toLocaleString()} m²)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#10b981]" />
              <span>Buildable Envelope ({bounds.netBuildableArea.toLocaleString()} m²)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#e2b170]" />
              <span>Massing ({activeScenario.name.split(':')[0]})</span>
            </div>
          </div>

          <div className="flex items-center gap-3 font-mono text-[11px] text-slate-400">
            <div className="flex items-center gap-1.5">
              <div className="w-10 h-1 bg-slate-400 border border-slate-200" />
              <span>50m</span>
            </div>
            <span>SitePilot 3D Engine</span>
          </div>
        </div>
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
