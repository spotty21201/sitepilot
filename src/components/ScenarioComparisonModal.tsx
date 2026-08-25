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
  const statMaxFAR = project.zoningLimits?.maxFAR;
  const statMaxCoverage = project.zoningLimits?.maxCoveragePct;
  const statMinKDH = project.zoningLimits?.minKDHPct;
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
        className="dialog-shell max-w-5xl w-full max-h-[90vh] flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="dialog-header p-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="dialog-icon--spatial w-8 h-8 flex items-center justify-center font-bold shadow-md">
              <Scale className="w-4 h-4" />
            </div>
            <div>
              <h3 id="scenario-comparison-title" className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-2">
                <span>Scenario Comparison Matrix</span>
                <span className="text-[11px] font-normal text-[var(--text-muted)] font-mono">
                  ({project.name})
                </span>
              </h3>
              <p className="text-[11px] text-[var(--text-secondary)]">
              Side-by-side evaluation of development figures, supplied planning limits, verification status, and investment economics.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close dialog"
            className="dialog-close p-1.5 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Table */}
        <div className="p-4 sm:p-5 flex-1 overflow-auto">
          <div className="min-w-[650px] space-y-4">
            {/* Grid Header with Scenarios */}
            <div className={`grid gap-3 grid-cols-${scenarios.length + 1}`}>
              <div className="surface-inspector p-3 flex flex-col justify-end">
                <span className="text-[10px] uppercase font-bold text-[var(--text-muted)] tracking-wider">Metrics / Schemes</span>
                <span className="text-xs font-semibold text-[var(--text-secondary)]">Site: <span className="font-mono tabular-nums">{project.site.grossSiteArea.toLocaleString()} m²</span></span>
              </div>

              {scenarios.map((scen) => {
                const isActive = scen.id === activeScenarioId;
                return (
                  <div
                    key={scen.id}
                    className={`p-3 rounded-[var(--radius-card)] border flex flex-col justify-between transition-colors ${
                      isActive
                        ? 'bg-[var(--spatial-selection-surface)] border-[var(--spatial-selection)] shadow-[var(--shadow-elevated)] ring-1 ring-[var(--spatial-selection)]'
                        : 'bg-[var(--bg-tertiary)] border-[var(--border-subtle)]'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-1 mb-1">
                        <span className={`status-badge !min-h-0 !px-1.5 !py-0.5 text-[9px] ${
                          scen.isPreferred ? 'status-badge--verified' : 'status-badge--investigation'
                        }`}>
                          {scen.isPreferred ? 'PREFERRED' : 'STUDY'}
                        </span>
                        {isActive && (
                          <span className="text-[9px] font-mono text-[var(--spatial-selection-strong)] font-bold flex items-center gap-0.5">
                            <Check className="w-3 h-3" /> ACTIVE
                          </span>
                        )}
                      </div>
                      <h4 className="text-xs font-bold text-[var(--text-primary)] line-clamp-2">{scen.name}</h4>
                    </div>

                    <div className="mt-3 pt-2 border-t border-[var(--border-subtle)] flex items-center justify-between">
                      <button
                        onClick={() => {
                          onSelectScenario(scen.id);
                          onClose();
                        }}
                        aria-current={isActive ? 'true' : undefined}
                        className={`button-secondary w-full min-h-[var(--control-height-sm)] py-1 px-2 text-[11px] font-semibold transition-colors cursor-pointer flex items-center justify-center gap-1 ${
                          isActive
                            ? '!text-[var(--spatial-selection-strong)] !bg-[var(--spatial-selection-surface)] !border-[var(--spatial-selection)]'
                            : ''
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
            <div className="border border-[var(--border-default)] rounded-[var(--radius-card)] overflow-hidden divide-y divide-[var(--border-subtle)] text-xs">
              {/* Row 1: Total GFA */}
              <div className={`grid gap-3 p-3 bg-[var(--bg-primary)] grid-cols-${scenarios.length + 1}`}>
                <div className="font-semibold text-[var(--text-secondary)] flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-[var(--status-evidence)]" />
                  <span>Total Gross Floor Area (GFA)</span>
                </div>
                {scenarios.map((scen) => (
                  <div key={scen.id} className="font-mono tabular-nums font-bold text-[var(--text-primary)] text-right sm:text-left">
                    {scen.metrics.totalGFA.toLocaleString()} m²
                  </div>
                ))}
              </div>

              {/* Row 2: FAR / KLB */}
              <div className={`grid gap-3 p-3 bg-[var(--bg-secondary)] grid-cols-${scenarios.length + 1}`}>
                <div className="font-semibold text-[var(--text-secondary)]">
                  <span>Floor Area Ratio (KLB)</span>
                  <span className="text-[10px] text-[var(--text-muted)] block">({statMaxFAR === undefined ? 'Limit not provided' : `Supplied cap: ${statMaxFAR.toFixed(2)}x`})</span>
                </div>
                {scenarios.map((scen) => {
                  const farExceeded = statMaxFAR !== undefined && scen.metrics.farKLB > statMaxFAR + 0.01;
                  return (
                    <div key={scen.id} className="font-mono tabular-nums text-right sm:text-left">
                      <span className={`font-bold ${farExceeded ? 'text-[var(--status-error)]' : 'text-[var(--status-verified)]'}`}>
                        {scen.metrics.farKLB.toFixed(2)}x
                      </span>
                      {farExceeded && (
                        <span className="text-[10px] text-[var(--status-error)] block">
                          (+{(scen.metrics.farKLB - statMaxFAR).toFixed(2)}x overrun)
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Row 3: Floors & Total Height */}
              <div className={`grid gap-3 p-3 bg-[var(--bg-primary)] grid-cols-${scenarios.length + 1}`}>
                <div className="font-semibold text-[var(--text-secondary)]">
                  <span>Building Floors & Height</span>
                </div>
                {scenarios.map((scen) => (
                  <div key={scen.id} className="font-mono tabular-nums text-[var(--text-secondary)] text-right sm:text-left">
                    <span className="font-bold">{scen.metrics.totalFloors} Floors</span>
                    <span className="text-[10px] text-[var(--text-muted)] block">({scen.metrics.totalHeightMeters.toFixed(1)}m total)</span>
                  </div>
                ))}
              </div>

              {/* Row 4: Site Coverage (KDB) */}
              <div className={`grid gap-3 p-3 bg-[var(--bg-secondary)] grid-cols-${scenarios.length + 1}`}>
                <div className="font-semibold text-[var(--text-secondary)]">
                  <span>Site Coverage (KDB)</span>
                  <span className="text-[10px] text-[var(--text-muted)] block">({statMaxCoverage === undefined ? 'Limit not provided' : `Supplied limit: ${statMaxCoverage}%`})</span>
                </div>
                {scenarios.map((scen) => {
                  const covExceeded = statMaxCoverage !== undefined && scen.metrics.siteCoveragePercentage > statMaxCoverage + 0.1;
                  return (
                    <div key={scen.id} className="font-mono tabular-nums text-right sm:text-left">
                      <span className={`font-bold ${covExceeded ? 'text-[var(--status-error)]' : 'text-[var(--text-primary)]'}`}>
                        {scen.metrics.siteCoveragePercentage}%
                      </span>
                      <span className="text-[10px] text-[var(--text-muted)] block">
                        ({scen.metrics.buildingFootprintArea.toLocaleString()} m² footprint)
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Row 5: Open Space & KDH */}
              <div className={`grid gap-3 p-3 bg-[var(--bg-primary)] grid-cols-${scenarios.length + 1}`}>
                <div className="font-semibold text-[var(--text-secondary)]">
                  <span>Unbuilt site area</span>
                  <span className="text-[10px] text-[var(--text-muted)] block">({statMinKDH === undefined ? 'Requirement not provided' : `Supplied minimum: ≥${statMinKDH}%`})</span>
                </div>
                {scenarios.map((scen) => (
                  <div key={scen.id} className="font-mono tabular-nums text-[var(--text-secondary)] text-right sm:text-left">
                    <span className="font-bold text-[var(--status-verified)]">{scen.metrics.openSpacePercentage}%</span>
                    <span className="text-[10px] text-[var(--text-muted)] block">({scen.metrics.openSpaceArea.toLocaleString()} m² unbuilt)</span>
                    <span className="text-[10px] text-[var(--status-warning)] block">{scen.metrics.kdhDemonstrated ? 'KDH area entered' : 'KDH not yet demonstrated'}</span>
                  </div>
                ))}
              </div>

              <div className={`grid gap-3 p-3 bg-[var(--bg-secondary)] grid-cols-${scenarios.length + 1}`}>
                <div className="font-semibold text-[var(--text-secondary)]"><span>Setbacks</span><span className="text-[10px] text-[var(--text-muted)] block">Front · sides · rear</span></div>
                {scenarios.map((scen) => <div key={scen.id} className="font-mono text-right sm:text-left">{scen.assumptionsUsed.setbacks.front} m · {scen.assumptionsUsed.setbacks.sideLeft} m · {scen.assumptionsUsed.setbacks.rear} m</div>)}
              </div>

              {/* Row 6: Land Cost per GFA */}
              {askingPrice && (
                <div className={`grid gap-3 p-3 bg-[var(--bg-secondary)] grid-cols-${scenarios.length + 1}`}>
                  <div className="font-semibold text-[var(--text-secondary)]">
                    <span>Land Cost Allocation / GFA</span>
                    <span className="text-[10px] text-[var(--text-muted)] block">(At Rp {(askingPrice / 1e9).toFixed(1)}B asking price)</span>
                  </div>
                  {scenarios.map((scen) => {
                    const costPerGFA = scen.metrics.totalGFA > 0 ? Math.round(askingPrice / scen.metrics.totalGFA) : 0;
                    return (
                      <div key={scen.id} className="font-mono tabular-nums text-right sm:text-left">
                        <span className="font-bold text-[var(--status-assumed)]">
                          Rp {(costPerGFA / 1e6).toFixed(1)}M / m²
                        </span>
                        <span className="text-[10px] text-[var(--text-muted)] block">per buildable m²</span>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Row 7: Compliance Status */}
              <div className={`grid gap-3 p-3 bg-[var(--bg-primary)] grid-cols-${scenarios.length + 1}`}>
                <div className="font-semibold text-[var(--text-secondary)]">
                  <span>Planning check</span>
                </div>
                {scenarios.map((scen) => {
                  const isCompliant = scen.complianceReport?.isCompliant ?? (scen.status === 'VALID');
                  return (
                    <div key={scen.id} className="text-right sm:text-left">
                      <span className={`status-badge ${
                        isCompliant
                          ? 'status-badge--verified'
                          : 'status-badge--error'
                      }`}>
                        {isCompliant ? <CheckCircle2 className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
                        <span>{isCompliant ? (project.site.hasZoningEvidence ? 'WITHIN SUPPLIED LIMITS' : 'STUDY LIMITS ONLY') : 'OUTSIDE SUPPLIED LIMITS'}</span>
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Row 8: Key Strategic Consideration */}
              <div className={`grid gap-3 p-3 bg-[var(--bg-secondary)] grid-cols-${scenarios.length + 1}`}>
                <div className="font-semibold text-[var(--text-secondary)]">
                  <span>Strategic Intent</span>
                </div>
                {scenarios.map((scen) => (
                  <div key={scen.id} className="text-[11px] text-[var(--text-secondary)] leading-relaxed text-right sm:text-left">
                    {scen.description}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="dialog-header p-3 flex items-center justify-between text-xs">
          <span className="text-[var(--text-secondary)] text-[11px]">
            Switching schemes updates 3D massing, metrics, and DAE export immediately.
          </span>
          <button
            onClick={onClose}
            className="button-primary px-4 py-1.5 font-semibold cursor-pointer"
          >
            Close Matrix
          </button>
        </div>
      </div>
    </div>
  );
}
