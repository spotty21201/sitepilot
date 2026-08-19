'use client';

import React, { useState } from 'react';
import { BuildingMass, DevelopmentScenario, Setbacks } from '@/types';
import { ArchitecturalNumericInput } from './ArchitecturalNumericInput';
import { 
  Box, 
  Layers, 
  Move, 
  Maximize2, 
  ArrowUpRight, 
  Trash2, 
  Copy, 
  ShieldAlert, 
  X,
  ChevronDown,
  ChevronUp,
  AlertTriangle
} from 'lucide-react';

interface MassPropertiesPanelProps {
  scenario: DevelopmentScenario;
  selectedMass: BuildingMass | null;
  setbacks: Setbacks;
  onUpdateMass: (massId: string, updates: Partial<BuildingMass>) => void;
  onDuplicateMass: (massId: string) => void;
  onDeleteMass: (massId: string) => void;
  onClose: () => void;
}

export function MassPropertiesPanel({
  scenario,
  selectedMass,
  setbacks,
  onUpdateMass,
  onDuplicateMass,
  onDeleteMass,
  onClose
}: MassPropertiesPanelProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  if (!selectedMass) return null;

  const w = selectedMass.dimensions.width;
  const l = selectedMass.dimensions.length;
  const h = selectedMass.dimensions.height;
  const f = selectedMass.floors;
  const f2f = selectedMass.floorToFloorHeight || 3.5;
  const posX = selectedMass.position.x;
  const posZ = selectedMass.position.z;
  const footprint = Math.round(w * l * 10) / 10;
  const gfa = Math.round(footprint * f * 10) / 10;

  // Setback Encroachment check
  const halfW = w / 2;
  const halfL = l / 2;
  const massMaxY = posZ + halfL;
  const massMinY = posZ - halfL;
  const massMaxX = posX + halfW;
  const massMinX = posX - halfW;

  const isFrontEncroached = massMaxY > (76.59 - setbacks.front);
  const isRearEncroached = massMinY < (-76.59 + setbacks.rear);
  const isSideEncroached = massMaxX > (55 - setbacks.sideRight) || massMinX < (-55 + setbacks.sideLeft);
  const hasEncroachment = isFrontEncroached || isRearEncroached || isSideEncroached;

  // Mass Pairwise Collision Check
  const massOverlap = scenario.pairwiseOverlap?.overlaps.find(
    o => o.massA === selectedMass.name || o.massB === selectedMass.name
  );

  const handleWidthChange = (val: number) => {
    const newFootprint = Math.round(val * l * 10) / 10;
    const newGfa = Math.round(newFootprint * f * 10) / 10;
    onUpdateMass(selectedMass.id, {
      footprintArea: newFootprint,
      gfa: newGfa,
      dimensions: { ...selectedMass.dimensions, width: val }
    });
  };

  const handleLengthChange = (val: number) => {
    const newFootprint = Math.round(w * val * 10) / 10;
    const newGfa = Math.round(newFootprint * f * 10) / 10;
    onUpdateMass(selectedMass.id, {
      footprintArea: newFootprint,
      gfa: newGfa,
      dimensions: { ...selectedMass.dimensions, length: val }
    });
  };

  const handleFloorsChange = (val: number) => {
    const newHeight = Math.round(val * f2f * 10) / 10;
    const newGfa = Math.round(footprint * val * 10) / 10;
    onUpdateMass(selectedMass.id, {
      floors: val,
      height: newHeight,
      gfa: newGfa,
      dimensions: { ...selectedMass.dimensions, height: newHeight }
    });
  };

  const handleFloorToFloorChange = (val: number) => {
    const newHeight = Math.round(f * val * 10) / 10;
    onUpdateMass(selectedMass.id, {
      floorToFloorHeight: val,
      height: newHeight,
      dimensions: { ...selectedMass.dimensions, height: newHeight }
    });
  };

  const handlePosXChange = (val: number) => {
    onUpdateMass(selectedMass.id, {
      position: { ...selectedMass.position, x: val }
    });
  };

  const handlePosZChange = (val: number) => {
    onUpdateMass(selectedMass.id, {
      position: { ...selectedMass.position, z: val }
    });
  };

  const handleProgramChange = (program: BuildingMass['program']) => {
    onUpdateMass(selectedMass.id, { program });
  };

  return (
    <aside 
      aria-label="Mass Development Properties" 
      className={`absolute top-14 right-3 w-80 bg-[#121622]/98 border border-[#2e3b52] rounded-xl shadow-2xl backdrop-blur-md flex flex-col z-30 overflow-hidden select-none transition-all duration-200 ${
        isCollapsed ? 'max-h-[50px]' : 'max-h-[85vh]'
      }`}
    >
      {/* Panel Header */}
      <div className="p-3 border-b border-[#232938] bg-[#161c2b] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Box className={`w-4 h-4 ${selectedMass.type === 'PODIUM' ? 'text-[#38bdf8]' : 'text-[#e2b170]'}`} />
          <div>
            <h4 className="text-xs font-bold text-slate-100 uppercase tracking-wide truncate max-w-[150px]">
              {selectedMass.name}
            </h4>
            <span className="text-[9px] text-slate-400 font-mono">
              {f} Storeys ({h.toFixed(1)}m) · {footprint.toLocaleString()} m²
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            title={isCollapsed ? "Expand Inspector" : "Collapse Inspector"}
            className="p-1 text-slate-400 hover:text-white rounded hover:bg-[#222b3d] cursor-pointer"
          >
            {isCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          </button>
          <button
            onClick={onClose}
            title="Close Inspector"
            className="p-1 text-slate-400 hover:text-white rounded hover:bg-[#222b3d] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {!isCollapsed && (
        <>
          {/* Overlap / Collision Alert */}
          {massOverlap && (
            <div className="p-2.5 bg-rose-950 border-b border-rose-700 text-rose-200 text-[11px] flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold block">Mass Collision Detected!</span>
                <span className="text-[10px] text-rose-300">
                  Intersects with other mass (Overlap: {massOverlap.overlapVolumeM3.toLocaleString()} m³).
                </span>
              </div>
            </div>
          )}

          {/* Setback Alert */}
          {hasEncroachment && (
            <div className="p-2 bg-amber-950/90 border-b border-amber-800/80 text-amber-200 text-[11px] flex items-center gap-1.5 px-3">
              <ShieldAlert className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span>Mass boundary encroaches setback reserve!</span>
            </div>
          )}

          {/* Panel Body with Architectural Inputs */}
          <div className="p-3 overflow-y-auto space-y-3 text-xs">
            {/* Program Selection */}
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                Program & Use
              </label>
              <select
                value={selectedMass.program}
                onChange={(e) => handleProgramChange(e.target.value as BuildingMass['program'])}
                className="w-full bg-[#182030] border border-[#2b3952] rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-[#38bdf8]"
              >
                <option value="RESIDENTIAL">Residential Units</option>
                <option value="RETAIL">Boutique Retail & Dining</option>
                <option value="COMMERCIAL">Commercial Office</option>
                <option value="MIXED_USE">Mixed-Use Commercial</option>
                <option value="HOTEL">Boutique Hospitality</option>
                <option value="PARKING">Structured Parking</option>
              </select>
            </div>

            {/* Exact Numeric Dimensions Grid with Safe Bounds */}
            <div className="bg-[#0f1420] border border-[#222c40] rounded-lg p-2.5 space-y-2.5">
              <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                <span className="flex items-center gap-1">
                  <Maximize2 className="w-3 h-3 text-[#38bdf8]" /> Exact Dimensions
                </span>
                <span className="font-mono text-emerald-400">Metric (M)</span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <ArchitecturalNumericInput
                  label="Width (X)"
                  value={w}
                  min={2}
                  max={110}
                  step={0.5}
                  unit="m"
                  helperText="Parcel: 110m"
                  onChange={handleWidthChange}
                />

                <ArchitecturalNumericInput
                  label="Length (Z)"
                  value={Number(l.toFixed(2))}
                  min={2}
                  max={153}
                  step={0.5}
                  unit="m"
                  helperText="Parcel: 153m"
                  onChange={handleLengthChange}
                />

                <ArchitecturalNumericInput
                  label="Storeys"
                  value={f}
                  min={1}
                  max={24}
                  step={1}
                  unit="Fl"
                  helperText="Cap: 8 Fl"
                  onChange={handleFloorsChange}
                />

                <ArchitecturalNumericInput
                  label="Floor-to-Floor"
                  value={f2f}
                  min={2.5}
                  max={6.0}
                  step={0.1}
                  unit="m"
                  helperText={`H: ${h.toFixed(1)}m`}
                  onChange={handleFloorToFloorChange}
                />
              </div>
            </div>

            {/* Spatial Coordinates Entry */}
            <div className="bg-[#0f1420] border border-[#222c40] rounded-lg p-2.5 space-y-2">
              <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                <span className="flex items-center gap-1">
                  <Move className="w-3 h-3 text-[#e2b170]" /> Center Coordinates
                </span>
                <span className="font-mono text-slate-500">Origin (0,0)</span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <ArchitecturalNumericInput
                  label="East / West (X)"
                  value={Number(posX.toFixed(1))}
                  min={-55}
                  max={55}
                  step={1}
                  unit="m"
                  helperText="[-55, +55]"
                  onChange={handlePosXChange}
                />

                <ArchitecturalNumericInput
                  label="North / South (Y)"
                  value={Number(posZ.toFixed(1))}
                  min={-76}
                  max={76}
                  step={1}
                  unit="m"
                  helperText="[-76, +76]"
                  onChange={handlePosZChange}
                />
              </div>
            </div>

            {/* Yield Contribution Card */}
            <div className="bg-[#141a28] border border-[#243048] rounded-lg p-2.5 space-y-1.5">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                <span>Mass Yield Contribution</span>
                <ArrowUpRight className="w-3 h-3 text-sky-400" />
              </div>

              <div className="flex justify-between text-xs font-mono">
                <span className="text-slate-400">Footprint:</span>
                <span className="text-slate-100 font-bold">{footprint.toLocaleString()} m²</span>
              </div>

              <div className="flex justify-between text-xs font-mono">
                <span className="text-slate-400">Gross Floor Area:</span>
                <span className="text-emerald-400 font-bold">{gfa.toLocaleString()} m²</span>
              </div>
            </div>

            {/* Actions */}
            <div className="pt-2 border-t border-[#232938] flex items-center justify-between gap-2">
              <button
                onClick={() => onDuplicateMass(selectedMass.id)}
                className="flex-1 flex items-center justify-center gap-1 py-1.5 bg-[#1a2233] hover:bg-[#243048] text-slate-200 rounded text-[11px] font-medium border border-[#2b3850] transition-all cursor-pointer shadow-sm"
              >
                <Copy className="w-3 h-3 text-sky-400" />
                Duplicate
              </button>

              {scenario.masses.length > 1 && (
                <button
                  onClick={() => onDeleteMass(selectedMass.id)}
                  className="flex items-center justify-center gap-1 px-3 py-1.5 bg-rose-950/60 hover:bg-rose-900/80 text-rose-300 rounded text-[11px] font-medium border border-rose-800 transition-all cursor-pointer shadow-sm"
                >
                  <Trash2 className="w-3 h-3 text-rose-400" />
                  Delete
                </button>
              )}
            </div>
          </div>
        </>
      )}
    </aside>
  );
}
