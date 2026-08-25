'use client';

import React from 'react';
import { 
  ViewportDisplayMode, 
  CameraProjectionMode, 
  CameraPreset, 
  ManipulationTool 
} from './types';
import { 
  Box, 
  Compass, 
  Layers, 
  RotateCcw, 
  Ruler, 
  Play, 
  Pause
} from 'lucide-react';

interface ToolbarProps {
  displayMode: ViewportDisplayMode;
  projectionMode: CameraProjectionMode;
  cameraPreset: CameraPreset;
  activeTool?: ManipulationTool;
  isRotating: boolean;
  showDimensions: boolean;
  showZoningCap?: boolean;
  hideCameraControls?: boolean;
  onChangeDisplayMode: (mode: ViewportDisplayMode) => void;
  onChangeProjectionMode: (mode: CameraProjectionMode) => void;
  onSetCameraPreset: (preset: CameraPreset) => void;
  onChangeTool?: (tool: ManipulationTool) => void;
  onToggleRotating: () => void;
  onToggleDimensions: () => void;
  onToggleZoningCap?: () => void;
}

export function Toolbar({
  displayMode,
  projectionMode,
  cameraPreset,
  isRotating,
  showDimensions,
  hideCameraControls = false,
  onChangeDisplayMode,
  onChangeProjectionMode,
  onSetCameraPreset,
  onToggleRotating,
  onToggleDimensions
}: ToolbarProps) {
  const isPresetActive = (p: string) => {
    if (p === 'SOUTH') return cameraPreset === 'SOUTH' || cameraPreset === 'FRONT';
    if (p === 'NORTH') return cameraPreset === 'NORTH' || cameraPreset === 'REAR';
    return cameraPreset === p;
  };

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 bg-[var(--bg-secondary)] border-b border-[var(--border-subtle)] text-xs select-none z-20">
      {/* 1. Visual Shading Modes */}
      <div className="ui-segmented">
        <button
          onClick={() => onChangeDisplayMode('DEVELOPMENT')}
          aria-label="Development shading mode"
          aria-pressed={displayMode === 'DEVELOPMENT'}
          className="ui-segment flex items-center gap-1.5 px-2.5 py-1.5 font-medium text-[11px] transition-colors cursor-pointer"
        >
          <Box className="w-3.5 h-3.5" />
          <span>Development</span>
        </button>

        <button
          onClick={() => onChangeDisplayMode('MONOCHROME')}
          aria-label="Monochrome blueprint shading mode"
          aria-pressed={displayMode === 'MONOCHROME'}
          className="ui-segment flex items-center gap-1.5 px-2.5 py-1.5 font-medium text-[11px] transition-colors cursor-pointer"
        >
          <Layers className="w-3.5 h-3.5" />
          <span>Monochrome</span>
        </button>

        <button
          onClick={() => onChangeDisplayMode('CONSTRAINTS')}
          aria-label="Planning checks and zoning envelope mode"
          aria-pressed={displayMode === 'CONSTRAINTS'}
          className="ui-segment flex items-center gap-1.5 px-2.5 py-1.5 font-medium text-[11px] transition-colors cursor-pointer"
        >
          <Compass className="w-3.5 h-3.5" />
          <span>Planning checks</span>
        </button>
      </div>

      {/* 2. Camera Bar (legacy renderer only when the Spatial Console owns its in-canvas camera dock) */}
      {!hideCameraControls && (
      <div className="ui-segmented">
        <button
          onClick={() => onSetCameraPreset('TOP')}
          aria-label="TOP — orthographic plan view"
          aria-pressed={isPresetActive('TOP')}
          className={`ui-segment px-2.5 py-1 text-[11px] font-mono font-semibold transition-colors cursor-pointer ${isPresetActive('TOP') ? 'ui-segment--spatial' : ''}`}
        >
          TOP
        </button>

        <button
          onClick={() => onSetCameraPreset('SOUTH')}
          aria-label="SOUTH — orthographic elevation"
          aria-pressed={isPresetActive('SOUTH')}
          className={`ui-segment px-2.5 py-1 text-[11px] font-mono font-semibold transition-colors cursor-pointer ${isPresetActive('SOUTH') ? 'ui-segment--spatial' : ''}`}
        >
          SOUTH
        </button>

        <button
          onClick={() => onSetCameraPreset('NORTH')}
          aria-label="NORTH — orthographic elevation"
          aria-pressed={isPresetActive('NORTH')}
          className={`ui-segment px-2.5 py-1 text-[11px] font-mono font-semibold transition-colors cursor-pointer ${isPresetActive('NORTH') ? 'ui-segment--spatial' : ''}`}
        >
          NORTH
        </button>

        <button
          onClick={() => onSetCameraPreset('EAST')}
          aria-label="EAST — orthographic elevation"
          aria-pressed={isPresetActive('EAST')}
          className={`ui-segment px-2.5 py-1 text-[11px] font-mono font-semibold transition-colors cursor-pointer ${isPresetActive('EAST') ? 'ui-segment--spatial' : ''}`}
        >
          EAST
        </button>

        <button
          onClick={() => onSetCameraPreset('WEST')}
          aria-label="WEST — orthographic elevation"
          aria-pressed={isPresetActive('WEST')}
          className={`ui-segment px-2.5 py-1 text-[11px] font-mono font-semibold transition-colors cursor-pointer ${isPresetActive('WEST') ? 'ui-segment--spatial' : ''}`}
        >
          WEST
        </button>

        <button
          onClick={() => onSetCameraPreset('ISO')}
          aria-label="ISO — axonometric view"
          aria-pressed={isPresetActive('ISO')}
          className={`ui-segment px-2.5 py-1 text-[11px] font-mono font-semibold transition-colors cursor-pointer ${isPresetActive('ISO') ? 'ui-segment--spatial' : ''}`}
        >
          ISO
        </button>

        <div className="w-px h-4 bg-[var(--border-default)] mx-0.5" />

        <button
          onClick={() => onSetCameraPreset('RESET')}
          aria-label="RESET — restores default view"
          title="Reset camera to default axonometric view"
          className="ui-segment flex items-center gap-1 px-2 py-1 text-[11px] font-mono font-semibold cursor-pointer transition-colors"
        >
          <RotateCcw className="w-3 h-3 text-[var(--status-evidence)]" />
          <span>RESET</span>
        </button>
      </div>
      )}

      {/* 3. Spatial Tools & Overlays Group */}
      <div className="flex items-center gap-1.5">
        {!hideCameraControls && <button
          onClick={() => onChangeProjectionMode(projectionMode === 'PERSPECTIVE' ? 'ORTHOGRAPHIC' : 'PERSPECTIVE')}
          aria-label={projectionMode === 'ORTHOGRAPHIC' ? 'Switch to Perspective Camera' : 'Switch to Orthographic Camera'}
          aria-pressed={projectionMode === 'ORTHOGRAPHIC'}
          className={`px-2.5 py-1.5 rounded-[var(--radius-control)] text-[11px] font-mono font-bold border transition-colors cursor-pointer ${
            projectionMode === 'ORTHOGRAPHIC'
              ? 'bg-[var(--status-investigation-surface)] text-[var(--status-investigation)] border-[var(--status-investigation)]'
              : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)] border-[var(--border-default)] hover:text-[var(--text-primary)]'
          }`}
        >
          {projectionMode === 'ORTHOGRAPHIC' ? 'ORTHO' : 'PERSP'}
        </button>}

        <button
          onClick={onToggleDimensions}
          aria-label="Toggle Dimension Overlays"
          aria-pressed={showDimensions}
          title="Toggle Dimension Overlays"
          className={`p-1.5 rounded-[var(--radius-control)] border transition-colors cursor-pointer ${
            showDimensions
              ? 'bg-[var(--spatial-selection-surface)] text-[var(--spatial-selection)] border-[var(--spatial-selection)]'
              : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)] border-[var(--border-default)] hover:text-[var(--text-primary)]'
          }`}
        >
          <Ruler className="w-3.5 h-3.5" />
        </button>

        {!hideCameraControls && <button
          onClick={onToggleRotating}
          aria-label={isRotating ? 'Pause Orbit Rotation' : 'Start Orbit Rotation'}
          aria-pressed={isRotating}
          title={isRotating ? 'Pause Orbit' : 'Auto-Orbit Scene'}
          className={`p-1.5 rounded-[var(--radius-control)] border transition-colors cursor-pointer ${
            isRotating
              ? 'bg-[var(--spatial-selection-surface)] text-[var(--spatial-selection)] border-[var(--spatial-selection)]'
              : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)] border-[var(--border-default)] hover:text-[var(--text-primary)]'
          }`}
        >
          {isRotating ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
        </button>}
      </div>
    </div>
  );
}
