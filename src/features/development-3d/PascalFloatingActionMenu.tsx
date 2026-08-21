'use client';

import React from 'react';
import { BuildingMass, DevelopmentScenario, Setbacks } from '@/types';
import { 
  Copy, 
  Trash2, 
  Plus, 
  Minus, 
  Sparkles, 
  Building2, 
  X 
} from 'lucide-react';

interface PascalFloatingActionMenuProps {
  scenario: DevelopmentScenario;
  selectedMass: BuildingMass;
  setbacks?: Setbacks;
  onUpdateMass: (massId: string, updates: Partial<BuildingMass>) => void;
  onDuplicateMass: (massId: string) => void;
  onDeleteMass: (massId: string) => void;
  onFitMass: () => void;
  onClose: () => void;
}

export function PascalFloatingActionMenu({
  scenario,
  selectedMass,
  onUpdateMass,
  onDuplicateMass,
  onDeleteMass,
  onFitMass,
  onClose
}: PascalFloatingActionMenuProps) {
  const f2f = selectedMass.floorToFloorHeight || 3.5;

  const handleAddFloor = () => {
    if (selectedMass.floors >= 24) return;
    const newFloors = selectedMass.floors + 1;
    const newH = Math.round(newFloors * f2f * 10) / 10;
    const gfa = Math.round(selectedMass.footprintArea * newFloors * 10) / 10;
    onUpdateMass(selectedMass.id, {
      floors: newFloors,
      height: newH,
      gfa,
      dimensions: { ...selectedMass.dimensions, height: newH }
    });
  };

  const handleRemoveFloor = () => {
    if (selectedMass.floors <= 1) return;
    const newFloors = selectedMass.floors - 1;
    const newH = Math.round(newFloors * f2f * 10) / 10;
    const gfa = Math.round(selectedMass.footprintArea * newFloors * 10) / 10;
    onUpdateMass(selectedMass.id, {
      floors: newFloors,
      height: newH,
      gfa,
      dimensions: { ...selectedMass.dimensions, height: newH }
    });
  };

  return (
    <div className="absolute top-14 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1.5 bg-[#121622]/95 border border-[#2b3548] p-1.5 rounded-xl shadow-2xl backdrop-blur-md font-mono text-xs text-slate-200 select-none animate-in fade-in zoom-in-95 duration-100">
      {/* Mass Name & Badge */}
      <div className="flex items-center gap-1.5 px-2 py-1 bg-[#182030] rounded-lg border border-[#2e3b52]">
        <Building2 className="w-3.5 h-3.5 text-[#38bdf8]" />
        <span className="font-bold text-white max-w-[130px] truncate">
          {selectedMass.name}
        </span>
        <span className="text-[10px] text-sky-400 font-bold bg-[#121824] px-1 rounded">
          {selectedMass.dimensions.width}m × {selectedMass.dimensions.length}m
        </span>
      </div>

      {/* Floor Extrusion Controls */}
      <div className="flex items-center gap-1 bg-[#182030] p-0.5 rounded-lg border border-[#2e3b52]">
        <button
          onClick={handleRemoveFloor}
          disabled={selectedMass.floors <= 1}
          title="Extrude Down (-1 Floor)"
          className="p-1.5 hover:bg-[#253046] disabled:opacity-30 rounded text-slate-300 hover:text-white cursor-pointer"
        >
          <Minus className="w-3.5 h-3.5" />
        </button>

        <span className="px-1.5 font-bold text-emerald-400 text-xs">
          {selectedMass.floors} Fl <span className="text-[10px] text-slate-400">({selectedMass.height.toFixed(1)}m)</span>
        </span>

        <button
          onClick={handleAddFloor}
          disabled={selectedMass.floors >= 24}
          title="Extrude Up (+1 Floor)"
          className="p-1.5 hover:bg-[#253046] disabled:opacity-30 rounded text-slate-300 hover:text-white cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Setback Fit Button */}
      <button
        onClick={onFitMass}
        title="Shift and fit inside zoning setback envelope"
        className="flex items-center gap-1 px-2.5 py-1.5 bg-[#182030] hover:bg-[#253046] text-amber-300 rounded-lg border border-[#2e3b52] cursor-pointer transition-colors"
      >
        <Sparkles className="w-3.5 h-3.5 text-amber-400" />
        <span>Fit Setback</span>
      </button>

      {/* Duplicate Mass Button */}
      <button
        onClick={() => onDuplicateMass(selectedMass.id)}
        title="Duplicate Wing (Non-overlapping placement)"
        className="flex items-center gap-1 px-2.5 py-1.5 bg-[#182030] hover:bg-[#253046] text-sky-300 rounded-lg border border-[#2e3b52] cursor-pointer transition-colors"
      >
        <Copy className="w-3.5 h-3.5 text-sky-400" />
        <span>Duplicate</span>
      </button>

      {/* Delete Mass Button */}
      {scenario.masses.length > 1 && (
        <button
          onClick={() => onDeleteMass(selectedMass.id)}
          title="Delete Mass"
          className="p-1.5 bg-[#182030] hover:bg-rose-950 hover:text-rose-300 text-slate-400 rounded-lg border border-[#2e3b52] cursor-pointer transition-colors"
        >
          <Trash2 className="w-3.5 h-3.5 text-rose-400" />
        </button>
      )}

      {/* Close Menu */}
      <button
        onClick={onClose}
        title="Deselect"
        className="p-1 hover:bg-[#253046] text-slate-400 hover:text-slate-200 rounded cursor-pointer"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
