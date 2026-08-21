'use client';

import React, { useEffect, useRef } from 'react';
import { Project } from '@/types';
import { X, Scale, CheckCircle2, AlertTriangle, Building2, Check, ArrowRight } from 'lucide-react';

interface ScenarioComparisonModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: Project;
  activeScenarioId: string;
  onSelectScenario: (scenarioId: string) => void;
}

export function ScenarioComparisonModal({
  isOpen,
  onClose,
  project,
  activeScenarioId,
  onSelectScenario
}: ScenarioComparisonModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);

  // Escape key handling
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const scenarios = project.scenarios || [];
  const statMaxFAR = project.zoningLimits?.maxFAR || 3.20;
  const statMaxCoverage = project.zoningLimits?.maxCoveragePct || 55.0;
  const statMinKDH = project.zoningLimits?.minKDHPct || 20.0;
  const askingPrice = project.valuation?.askingPriceAmount || project.askingPrice?.amount;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="scenario-comparison-title"
      onClick={onClose}
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6"
    >
      <div
        ref={modalRef}
        onClick={(e) => e.stopPropagation()}
        className="bg-[#10141e] border border-[#2b3548] rounded-xl max-w-5xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="p-4 border-b border-[#232938] flex items-center justify-between bg-[#151a27]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-600 to-indigo-600 flex items-center justify-center font-bold text-white shadow-md">
              <Scale className="w-4 h-4" />
            </div>
            <div>
              <h3 id="scenario-comparison-title" className="text-sm font-bold text-slate-100 flex items-center gap-2">
                <span>Scenario Comparison Matrix</span>
                <span className="text-[11px] font-normal text-slate-400 font-mono">
                  ({project.name})
                </span>
              </h3>
              <p className="text-[11px] text-slate-400">
                Side-by-side evaluation of yield, height, statutory compliance, and investment economics.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close dialog"
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-[#20283b] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Table */}
        <div className="p-4 sm:p-5 flex-1 overflow-auto">
          <div className="min-w-[650px] space-y-4">
            {/* Grid Header with Scenarios */}
            <div className={`grid gap-3 grid-cols-${scenarios.length + 1}`}>
              <div className="p-3 bg-[#0c0f17] border border-[#232d40] rounded-xl flex flex-col justify-end">
                <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Metrics / Schemes</span>
                <span className="text-xs font-semibold text-slate-300">Site: {project.site.grossSiteArea.toLocaleString()} m²</span>
              </div>

              {scenarios.map((scen) => {
                const isActive = scen.id === activeScenarioId;
                return (
                  <div
                    key={scen.id}
                    className={`p-3 rounded-xl border flex flex-col justify-between transition-all ${
                      isActive
                        ? 'bg-[#182338] border-[#38bdf8] shadow-lg ring-1 ring-[#38bdf8]/40'
                        : 'bg-[#121622] border-[#252f44]'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-1 mb-1">
                        <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded font-bold ${
                          scen.isPreferred ? 'bg-indigo-950 text-indigo-300 border border-indigo-700/60' : 'bg-slate-800 text-slate-400'
                        }`}>
                          {scen.isPreferred ? 'PREFERRED' : 'STUDY'}
                        </span>
                        {isActive && (
                          <span className="text-[9px] font-mono text-[#38bdf8] font-bold flex items-center gap-0.5">
                            <Check className="w-3 h-3" /> ACTIVE
                          </span>
                        )}
                      </div>
                      <h4 className="text-xs font-bold text-slate-100 line-clamp-2">{scen.name}</h4>
                    </div>

                    <div className="mt-3 pt-2 border-t border-[#232938] flex items-center justify-between">
                      <button
                        onClick={() => {
                          onSelectScenario(scen.id);
                          onClose();
                        }}
                        className={`w-full py-1 px-2 rounded text-[11px] font-semibold transition-all cursor-pointer flex items-center justify-center gap-1 ${
                          isActive
                            ? 'bg-[#2563eb] text-white shadow'
                            : 'bg-[#1e2738] hover:bg-[#28354c] text-slate-200 border border-[#2e3b52]'
                        }`}
                      >
                        <span>{isActive ? 'Current View' : 'Switch to Scheme'}</span>
                        {!isActive && <ArrowRight className="w-3 h-3" />}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Comparison Rows */}
            <div className="border border-[#222b3d] rounded-xl overflow-hidden divide-y divide-[#1e2638] text-xs">
              {/* Row 1: Total GFA */}
              <div className={`grid gap-3 p-3 bg-[#0d1017] grid-cols-${scenarios.length + 1}`}>
                <div className="font-semibold text-slate-300 flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-[#38bdf8]" />
                  <span>Total Gross Floor Area (GFA)</span>
                </div>
                {scenarios.map((scen) => (
                  <div key={scen.id} className="font-mono font-bold text-slate-100 text-right sm:text-left">
                    {scen.metrics.totalGFA.toLocaleString()} m²
                  </div>
                ))}
              </div>

              {/* Row 2: FAR / KLB */}
              <div className={`grid gap-3 p-3 bg-[#111622] grid-cols-${scenarios.length + 1}`}>
                <div className="font-semibold text-slate-300">
                  <span>Floor Area Ratio (KLB)</span>
                  <span className="text-[10px] text-slate-500 block">(Statutory Cap: {statMaxFAR.toFixed(2)}x)</span>
                </div>
                {scenarios.map((scen) => {
                  const farExceeded = scen.metrics.farKLB > statMaxFAR + 0.01;
                  return (
                    <div key={scen.id} className="font-mono text-right sm:text-left">
                      <span className={`font-bold ${farExceeded ? 'text-rose-400' : 'text-emerald-400'}`}>
                        {scen.metrics.farKLB.toFixed(2)}x
                      </span>
                      {farExceeded && (
                        <span className="text-[10px] text-rose-400 block">
                          (+{(scen.metrics.farKLB - statMaxFAR).toFixed(2)}x overrun)
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Row 3: Floors & Total Height */}
              <div className={`grid gap-3 p-3 bg-[#0d1017] grid-cols-${scenarios.length + 1}`}>
                <div className="font-semibold text-slate-300">
                  <span>Building Floors & Height</span>
                </div>
                {scenarios.map((scen) => (
                  <div key={scen.id} className="font-mono text-slate-200 text-right sm:text-left">
                    <span className="font-bold">{scen.metrics.totalFloors} Floors</span>
                    <span className="text-[10px] text-slate-400 block">({scen.metrics.totalHeightMeters.toFixed(1)}m total)</span>
                  </div>
                ))}
              </div>

              {/* Row 4: Site Coverage (KDB) */}
              <div className={`grid gap-3 p-3 bg-[#111622] grid-cols-${scenarios.length + 1}`}>
                <div className="font-semibold text-slate-300">
                  <span>Site Coverage (KDB)</span>
                  <span className="text-[10px] text-slate-500 block">(Statutory Limit: {statMaxCoverage}%)</span>
                </div>
                {scenarios.map((scen) => {
                  const covExceeded = scen.metrics.siteCoveragePercentage > statMaxCoverage + 0.1;
                  return (
                    <div key={scen.id} className="font-mono text-right sm:text-left">
                      <span className={`font-bold ${covExceeded ? 'text-rose-400' : 'text-slate-200'}`}>
                        {scen.metrics.siteCoveragePercentage}%
                      </span>
                      <span className="text-[10px] text-slate-500 block">
                        ({scen.metrics.buildingFootprintArea.toLocaleString()} m² footprint)
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Row 5: Open Space & KDH */}
              <div className={`grid gap-3 p-3 bg-[#0d1017] grid-cols-${scenarios.length + 1}`}>
                <div className="font-semibold text-slate-300">
                  <span>Open Space (KDH Basis)</span>
                  <span className="text-[10px] text-slate-500 block">(Target: ≥{statMinKDH}%)</span>
                </div>
                {scenarios.map((scen) => (
                  <div key={scen.id} className="font-mono text-slate-200 text-right sm:text-left">
                    <span className="font-bold text-emerald-400">{scen.metrics.openSpacePercentage}%</span>
                    <span className="text-[10px] text-slate-400 block">({scen.metrics.openSpaceArea.toLocaleString()} m² unbuilt)</span>
                  </div>
                ))}
              </div>

              {/* Row 6: Land Cost per GFA */}
              {askingPrice && (
                <div className={`grid gap-3 p-3 bg-[#111622] grid-cols-${scenarios.length + 1}`}>
                  <div className="font-semibold text-slate-300">
                    <span>Land Cost Allocation / GFA</span>
                    <span className="text-[10px] text-slate-500 block">(At Rp {(askingPrice / 1e9).toFixed(1)}B asking price)</span>
                  </div>
                  {scenarios.map((scen) => {
                    const costPerGFA = scen.metrics.totalGFA > 0 ? Math.round(askingPrice / scen.metrics.totalGFA) : 0;
                    return (
                      <div key={scen.id} className="font-mono text-right sm:text-left">
                        <span className="font-bold text-[#e2b170]">
                          Rp {(costPerGFA / 1e6).toFixed(1)}M / m²
                        </span>
                        <span className="text-[10px] text-slate-500 block">per buildable m²</span>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Row 7: Compliance Status */}
              <div className={`grid gap-3 p-3 bg-[#0d1017] grid-cols-${scenarios.length + 1}`}>
                <div className="font-semibold text-slate-300">
                  <span>Compliance Verdict</span>
                </div>
                {scenarios.map((scen) => {
                  const isCompliant = scen.complianceReport?.isCompliant ?? (scen.status === 'VALID');
                  return (
                    <div key={scen.id} className="text-right sm:text-left">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                        isCompliant
                          ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-700/60'
                          : 'bg-rose-950/80 text-rose-300 border border-rose-700/60'
                      }`}>
                        {isCompliant ? <CheckCircle2 className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
                        <span>{isCompliant ? 'COMPLIANT' : 'CONSTRAINED'}</span>
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Row 8: Key Strategic Consideration */}
              <div className={`grid gap-3 p-3 bg-[#111622] grid-cols-${scenarios.length + 1}`}>
                <div className="font-semibold text-slate-300">
                  <span>Strategic Intent</span>
                </div>
                {scenarios.map((scen) => (
                  <div key={scen.id} className="text-[11px] text-slate-400 leading-relaxed text-right sm:text-left">
                    {scen.description}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-[#232938] flex items-center justify-between bg-[#151a27] text-xs">
          <span className="text-slate-400 text-[11px]">
            Switching schemes updates 3D massing, metrics, and DAE export immediately.
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-[#2563eb] hover:bg-[#1d4ed8] text-white rounded-lg font-semibold cursor-pointer"
          >
            Close Matrix
          </button>
        </div>
      </div>
    </div>
  );
}
