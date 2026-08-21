'use client';

import React, { useState } from 'react';
import { BuildingMass, DevelopmentScenario } from '@/types';
import { Layers, Plus, Minus, ChevronUp, ChevronDown } from 'lucide-react';

interface PascalFloatingLevelSelectorProps {
  scenario: DevelopmentScenario;
  selectedMass: BuildingMass | null;
  activeLevel: number | null;
  onSelectLevel: (level: number | null) => void;
  onAddFloor: (massId: string) => void;
  onRemoveFloor: (massId: string) => void;
}

export function PascalFloatingLevelSelector({
  scenario,
  selectedMass,
  activeLevel,
  onSelectLevel,
  onAddFloor,
  onRemoveFloor
}: PascalFloatingLevelSelectorProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  // Derive total floors from scenario metrics
  const totalFloors = scenario.metrics.totalFloors || 8;
  const f2f = selectedMass?.floorToFloorHeight || 3.5;

  const levels = Array.from({ length: totalFloors }, (_, i) => {
    const floorNum = totalFloors - i;
    const elevation = (floorNum - 1) * f2f;
    const isPodium = floorNum <= 2;
    const isOverCap = elevation + f2f > 32.0;

    return {
      floorNum,
      elevation,
      isPodium,
      isOverCap,
      label: isPodium ? `L${floorNum} · Podium` : `L${floorNum} · Tower`,
      use: isPodium ? 'Commercial / Retail' : 'Residential'
    };
  });

  return (
    <div className="absolute left-4 bottom-14 z-20 flex flex-col items-start select-none">
      <div className="bg-[#121622]/95 border border-[#2b3548] rounded-xl shadow-2xl backdrop-blur-md overflow-hidden min-w-[210px]">
        {/* Header Bar */}
        <div 
          onClick={() => setIsExpanded(!isExpanded)}
          className="px-3 py-2 bg-[#161c2b] border-b border-[#252f42] flex items-center justify-between cursor-pointer hover:bg-[#1c2438] transition-colors"
        >
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-[#38bdf8]" />
            <span className="text-xs font-mono font-bold text-slate-100">
              LEVEL SELECTOR
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-mono text-[#38bdf8] font-bold bg-[#1e293b] px-1.5 py-0.5 rounded">
              {totalFloors} Fl
            </span>
            {isExpanded ? (
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            ) : (
              <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
            )}
          </div>
        </div>

        {/* Floor Level Stack */}
        {isExpanded && (
          <div className="p-1.5 max-h-[220px] overflow-y-auto space-y-1">
            {levels.map((lvl) => {
              const isSelected = activeLevel === lvl.floorNum;
              return (
                <div
                  key={lvl.floorNum}
                  onClick={() => onSelectLevel(isSelected ? null : lvl.floorNum)}
                  className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-mono transition-all cursor-pointer ${
                    isSelected 
                      ? 'bg-[#2563eb] text-white font-bold shadow' 
                      : lvl.isOverCap 
                      ? 'bg-rose-950/40 text-rose-300 hover:bg-rose-900/50 border border-rose-900/60' 
                      : 'bg-[#182030] text-slate-300 hover:bg-[#202b40] hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className={`w-5 h-5 rounded flex items-center justify-center text-[10px] font-bold ${
                      lvl.isOverCap ? 'bg-rose-600 text-white' : lvl.isPodium ? 'bg-sky-600 text-white' : 'bg-amber-600 text-white'
                    }`}>
                      {lvl.floorNum}
                    </span>
                    <div>
                      <span className="block text-[11px] leading-tight font-semibold">
                        {lvl.label}
                      </span>
                      <span className="block text-[9px] text-slate-400 leading-tight">
                        +{lvl.elevation.toFixed(1)}m elevation
                      </span>
                    </div>
                  </div>

                  {lvl.isOverCap && (
                    <span className="text-[9px] font-bold text-rose-400 bg-rose-950 px-1 py-0.5 rounded border border-rose-800">
                      &gt;32m
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Quick Floor Increment / Decrement Tools */}
        {selectedMass && isExpanded && (
          <div className="p-2 bg-[#141926] border-t border-[#232938] flex items-center justify-between gap-1.5">
            <span className="text-[10px] font-mono text-slate-400 truncate max-w-[90px]">
              {selectedMass.name}
            </span>

            <div className="flex items-center gap-1">
              <button
                onClick={() => onRemoveFloor(selectedMass.id)}
                disabled={selectedMass.floors <= 1}
                title="Remove Floor (-1 Fl)"
                className="p-1 bg-[#1e2738] hover:bg-[#28354c] disabled:opacity-30 text-slate-200 rounded border border-[#2b3952] cursor-pointer"
              >
                <Minus className="w-3 h-3" />
              </button>
              <span className="text-[10px] font-mono font-bold text-white px-1.5">
                {selectedMass.floors} Fl
              </span>
              <button
                onClick={() => onAddFloor(selectedMass.id)}
                disabled={selectedMass.floors >= 24}
                title="Add Floor (+1 Fl)"
                className="p-1 bg-[#1e2738] hover:bg-[#28354c] disabled:opacity-30 text-slate-200 rounded border border-[#2b3952] cursor-pointer"
              >
                <Plus className="w-3 h-3" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
