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
    <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 bg-[#10141f] border-b border-[#232938] text-xs select-none z-20">
      {/* 1. Visual Shading Modes */}
      <div className="flex items-center gap-1 bg-[#151a27] p-1 rounded-lg border border-[#263147]">
        <button
          onClick={() => onChangeDisplayMode('DEVELOPMENT')}
          aria-label="Development shading mode"
          aria-pressed={displayMode === 'DEVELOPMENT'}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md font-medium text-[11px] transition-all cursor-pointer ${
            displayMode === 'DEVELOPMENT'
              ? 'bg-[#2563eb] text-white shadow-sm font-semibold'
              : 'text-slate-400 hover:text-slate-200 hover:bg-[#1f283d]'
          }`}
        >
          <Box className="w-3.5 h-3.5" />
          <span>Development</span>
        </button>

        <button
          onClick={() => onChangeDisplayMode('MONOCHROME')}
          aria-label="Monochrome blueprint shading mode"
          aria-pressed={displayMode === 'MONOCHROME'}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md font-medium text-[11px] transition-all cursor-pointer ${
            displayMode === 'MONOCHROME'
              ? 'bg-[#2563eb] text-white shadow-sm font-semibold'
              : 'text-slate-400 hover:text-slate-200 hover:bg-[#1f283d]'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>Monochrome</span>
        </button>

        <button
          onClick={() => onChangeDisplayMode('CONSTRAINTS')}
          aria-label="Constraints & zoning envelope mode"
          aria-pressed={displayMode === 'CONSTRAINTS'}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md font-medium text-[11px] transition-all cursor-pointer ${
            displayMode === 'CONSTRAINTS'
              ? 'bg-[#2563eb] text-white shadow-sm font-semibold'
              : 'text-slate-400 hover:text-slate-200 hover:bg-[#1f283d]'
          }`}
        >
          <Compass className="w-3.5 h-3.5" />
          <span>Constraints</span>
        </button>
      </div>

      {/* 2. Camera Bar (Exact Presets: TOP, SOUTH, NORTH, EAST, WEST, ISO, RESET) */}
      <div className="flex items-center gap-1 bg-[#151a27] p-1 rounded-lg border border-[#263147]">
        <button
          onClick={() => onSetCameraPreset('TOP')}
          aria-label="TOP — orthographic plan view"
          aria-pressed={isPresetActive('TOP')}
          className={`px-2.5 py-1 rounded text-[11px] font-mono font-semibold transition-all cursor-pointer ${
            isPresetActive('TOP')
              ? 'bg-[#2563eb] text-white shadow-sm'
              : 'text-slate-300 hover:text-white hover:bg-[#1e273a]'
          }`}
        >
          TOP
        </button>

        <button
          onClick={() => onSetCameraPreset('SOUTH')}
          aria-label="SOUTH — orthographic elevation"
          aria-pressed={isPresetActive('SOUTH')}
          className={`px-2.5 py-1 rounded text-[11px] font-mono font-semibold transition-all cursor-pointer ${
            isPresetActive('SOUTH')
              ? 'bg-[#2563eb] text-white shadow-sm'
              : 'text-slate-300 hover:text-white hover:bg-[#1e273a]'
          }`}
        >
          SOUTH
        </button>

        <button
          onClick={() => onSetCameraPreset('NORTH')}
          aria-label="NORTH — orthographic elevation"
          aria-pressed={isPresetActive('NORTH')}
          className={`px-2.5 py-1 rounded text-[11px] font-mono font-semibold transition-all cursor-pointer ${
            isPresetActive('NORTH')
              ? 'bg-[#2563eb] text-white shadow-sm'
              : 'text-slate-300 hover:text-white hover:bg-[#1e273a]'
          }`}
        >
          NORTH
        </button>

        <button
          onClick={() => onSetCameraPreset('EAST')}
          aria-label="EAST — orthographic elevation"
          aria-pressed={isPresetActive('EAST')}
          className={`px-2.5 py-1 rounded text-[11px] font-mono font-semibold transition-all cursor-pointer ${
            isPresetActive('EAST')
              ? 'bg-[#2563eb] text-white shadow-sm'
              : 'text-slate-300 hover:text-white hover:bg-[#1e273a]'
          }`}
        >
          EAST
        </button>

        <button
          onClick={() => onSetCameraPreset('WEST')}
          aria-label="WEST — orthographic elevation"
          aria-pressed={isPresetActive('WEST')}
          className={`px-2.5 py-1 rounded text-[11px] font-mono font-semibold transition-all cursor-pointer ${
            isPresetActive('WEST')
              ? 'bg-[#2563eb] text-white shadow-sm'
              : 'text-slate-300 hover:text-white hover:bg-[#1e273a]'
          }`}
        >
          WEST
        </button>

        <button
          onClick={() => onSetCameraPreset('ISO')}
          aria-label="ISO — axonometric view"
          aria-pressed={isPresetActive('ISO')}
          className={`px-2.5 py-1 rounded text-[11px] font-mono font-semibold transition-all cursor-pointer ${
            isPresetActive('ISO')
              ? 'bg-[#2563eb] text-white shadow-sm'
              : 'text-slate-300 hover:text-white hover:bg-[#1e273a]'
          }`}
        >
          ISO
        </button>

        <div className="w-px h-4 bg-[#2e3b52] mx-0.5" />

        <button
          onClick={() => onSetCameraPreset('RESET')}
          aria-label="RESET — restores default view"
          title="Reset camera to default axonometric view"
          className="flex items-center gap-1 px-2 py-1 text-slate-400 hover:text-white hover:bg-[#1e273a] rounded text-[11px] font-mono font-semibold cursor-pointer transition-colors"
        >
          <RotateCcw className="w-3 h-3 text-[#38bdf8]" />
          <span>RESET</span>
        </button>
      </div>

      {/* 3. Spatial Tools & Overlays Group */}
      <div className="flex items-center gap-1.5">
        <button
          onClick={() => onChangeProjectionMode(projectionMode === 'PERSPECTIVE' ? 'ORTHOGRAPHIC' : 'PERSPECTIVE')}
          aria-label={projectionMode === 'ORTHOGRAPHIC' ? 'Switch to Perspective Camera' : 'Switch to Orthographic Camera'}
          aria-pressed={projectionMode === 'ORTHOGRAPHIC'}
          className={`px-2.5 py-1.5 rounded-lg text-[11px] font-mono font-bold border transition-all cursor-pointer ${
            projectionMode === 'ORTHOGRAPHIC'
              ? 'bg-indigo-950/80 text-indigo-300 border-indigo-700'
              : 'bg-[#151a27] text-slate-400 border-[#263147] hover:text-white'
          }`}
        >
          {projectionMode === 'ORTHOGRAPHIC' ? 'ORTHO' : 'PERSP'}
        </button>

        <button
          onClick={onToggleDimensions}
          aria-label="Toggle Dimension Overlays"
          aria-pressed={showDimensions}
          title="Toggle Dimension Overlays"
          className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
            showDimensions
              ? 'bg-sky-950/80 text-sky-300 border-sky-700'
              : 'bg-[#151a27] text-slate-400 border-[#263147] hover:text-white'
          }`}
        >
          <Ruler className="w-3.5 h-3.5" />
        </button>

        <button
          onClick={onToggleRotating}
          aria-label={isRotating ? 'Pause Orbit Rotation' : 'Start Orbit Rotation'}
          aria-pressed={isRotating}
          title={isRotating ? 'Pause Orbit' : 'Auto-Orbit Scene'}
          className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
            isRotating
              ? 'bg-amber-950/80 text-amber-300 border-amber-700'
              : 'bg-[#151a27] text-slate-400 border-[#263147] hover:text-white'
          }`}
        >
          {isRotating ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
        </button>
      </div>
    </div>
  );
}
