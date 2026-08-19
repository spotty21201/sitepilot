'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { DevelopmentScenario, SiteGeometry } from '@/types';
import { checkSetbackEncroachments, exportToColladaDAE } from '@/lib/geometry/engine';
import { 
  Building2, 
  Download, 
  Sliders, 
  CheckCircle2, 
  ShieldAlert, 
  RefreshCw, 
  Copy, 
  Check, 
  Code2, 
  X, 
  RotateCcw, 
  AlertTriangle 
} from 'lucide-react';

interface ScenarioControlsProps {
  site: SiteGeometry;
  scenarios: DevelopmentScenario[];
  activeScenarioId: string;
  onSelectScenario: (id: string) => void;
  onUpdateScenarioParam: (scenarioId: string, param: 'floors' | 'frontSetback', value: number) => void;
  onFitMassingToEnvelope: (scenarioId: string) => void;
  onResetScenario: (scenarioId: string) => void;
}

export function ScenarioControls({
  site,
  scenarios,
  activeScenarioId,
  onSelectScenario,
  onUpdateScenarioParam,
  onFitMassingToEnvelope,
  onResetScenario
}: ScenarioControlsProps) {
  const [copied, setCopied] = useState(false);
  const [showXmlModal, setShowXmlModal] = useState(false);
  const [rawXml, setRawXml] = useState('');
  
  const modalRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);

  const activeScenario = scenarios.find(s => s.id === activeScenarioId) || scenarios[0];
  const metrics = activeScenario.metrics;
  const currentSetback = activeScenario.assumptionsUsed.setbacks.front;

  const baselineFloors = activeScenario.id === 'scen-001' ? 4 : activeScenario.id === 'scen-002' ? 8 : 12;
  const baselineGFA = activeScenario.id === 'scen-001' ? 24000 : activeScenario.id === 'scen-002' ? 40400 : 50400;

  const isFittedToSetback = activeScenario.isFittedOverride === true || activeScenario.editClassification === 'FITTED_TO_SETBACK';
  const isUserOverride = 
    (metrics.totalFloors !== baselineFloors || 
     activeScenario.assumptionsUsed.setbacks.front !== 10 ||
     activeScenario.assumptionsUsed.setbacks.rear !== 6 ||
     activeScenario.assumptionsUsed.setbacks.sideLeft !== 5 ||
     activeScenario.assumptionsUsed.setbacks.sideRight !== 5 ||
     activeScenario.editClassification === 'USER_GEOMETRY_EDIT' ||
     activeScenario.editClassification === 'HEIGHT_OVERRIDE' ||
     activeScenario.editClassification === 'PROGRAM_OVERRIDE') &&
    !isFittedToSetback;

  const isOverridden = isUserOverride || isFittedToSetback;
  const hasCollision = activeScenario.pairwiseOverlap?.hasOverlap;
  const isOutOfBounds = (metrics.outOfBoundsAreaM2 || 0) > 0;

  const encroachments = checkSetbackEncroachments(
    site.grossSiteArea, 
    activeScenario.assumptionsUsed.setbacks, 
    activeScenario.masses
  );

  const exportFilename = `SitePilot_${activeScenario.name.split(':')[0].replace(/[^a-zA-Z0-9_-]/g, '_')}_${metrics.totalFloors}Fl${isOverridden ? '_Override' : ''}.dae`;

  // Dynamic description deriving from live geometry
  const dynamicDescription = (() => {
    if (hasCollision) {
      return `⚠️ Geometry Conflict: Massing blocks intersect (${activeScenario.pairwiseOverlap?.overlapVolumeM3.toLocaleString()} m³ overlap volume).`;
    }
    if (isOutOfBounds) {
      return `⚠️ Out of Bounds: Massing extends ${metrics.outOfBoundsAreaM2?.toLocaleString()} m² beyond parcel perimeter.`;
    }
    if (metrics.totalHeightMeters > 32.0) {
      const overrun = Math.round((metrics.totalHeightMeters - 32.0) * 10) / 10;
      return `⚠️ Non-compliant: Height (${metrics.totalHeightMeters.toFixed(1)}m / ${metrics.totalFloors} Fl) exceeds Subzone R.9 32m limit by ${overrun}m.`;
    }
    if (encroachments.length > 0) {
      return `⚠️ Non-compliant: ${encroachments[0].description}`;
    }
    return activeScenario.description;
  })();

  // Generate canonical DAE XML from live activeScenario masses
  const generateLiveXml = () => {
    return exportToColladaDAE(
      site,
      activeScenario.masses,
      exportFilename.replace('.dae', ''),
      activeScenario.assumptionsUsed.setbacks
    );
  };

  // Direct client-side blob download
  const handleClientDownloadBlob = () => {
    const xml = generateLiveXml();
    const blob = new Blob([xml], { type: 'model/vnd.collada+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = exportFilename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleCopyXML = async () => {
    const xml = generateLiveXml();
    setRawXml(xml);

    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(xml);
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
      } else {
        setShowXmlModal(true);
      }
    } catch (e) {
      console.warn('Clipboard API blocked, showing XML viewer modal:', e);
      setShowXmlModal(true);
    }
  };

  const handleOpenXmlModal = (e: React.MouseEvent<HTMLButtonElement>) => {
    triggerRef.current = e.currentTarget;
    const xml = generateLiveXml();
    setRawXml(xml);
    setShowXmlModal(true);
  };

  const handleCloseXmlModal = useCallback(() => {
    setShowXmlModal(false);
    setTimeout(() => {
      triggerRef.current?.focus();
    }, 0);
  }, []);

  // Keyboard Trap & Escape Dismiss for Accessible Modal
  useEffect(() => {
    if (!showXmlModal) return;

    // Focus first focusable element inside modal
    const focusable = modalRef.current?.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    if (focusable && focusable.length > 0) {
      focusable[0].focus();
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        handleCloseXmlModal();
        return;
      }

      if (e.key === 'Tab') {
        const focusableElements = modalRef.current?.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (!focusableElements || focusableElements.length === 0) return;

        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === firstElement) {
            e.preventDefault();
            lastElement.focus();
          }
        } else {
          if (document.activeElement === lastElement) {
            e.preventDefault();
            firstElement.focus();
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showXmlModal, handleCloseXmlModal]);

  return (
    <div className="flex flex-col h-full bg-[#11141d] border border-[#232938] rounded-xl overflow-hidden shadow-lg select-none">
      {/* Header & Export Actions */}
      <div className="p-3 border-b border-[#232938] bg-[#141824]">
        <div className="flex items-center justify-between mb-2.5">
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-[#e2b170]" />
            <h3 className="text-xs font-bold text-slate-100 uppercase tracking-wider">Development Scenarios</h3>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={handleOpenXmlModal}
              title="Inspect & Copy Raw COLLADA XML"
              aria-label="Inspect and Copy Raw COLLADA XML"
              className="flex items-center gap-1 px-2 py-1.5 rounded-lg bg-[#182030] hover:bg-[#222d42] text-slate-300 text-[11px] font-semibold border border-[#2e3b52] shadow-sm transition-all active:scale-95 cursor-pointer"
            >
              <Code2 className="w-3.5 h-3.5 text-slate-400" />
              <span>XML</span>
            </button>

            <button
              onClick={handleCopyXML}
              title="Copy DAE to Clipboard"
              aria-label="Copy DAE to Clipboard"
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#182030] hover:bg-[#222d42] text-slate-300 text-[11px] font-semibold border border-[#2e3b52] shadow-sm transition-all active:scale-95 cursor-pointer"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-slate-400" />}
              <span>{copied ? 'Copied' : 'Copy'}</span>
            </button>

            <button
              onClick={handleClientDownloadBlob}
              title="Download COLLADA DAE File"
              aria-label="Download COLLADA DAE File"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1e2738] hover:bg-[#28354c] text-[#38bdf8] text-xs font-semibold border border-[#38bdf8]/40 shadow-sm transition-all active:scale-95 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export DAE</span>
            </button>
          </div>
        </div>

        {/* Scenario Switcher Tabs */}
        <div className="grid grid-cols-3 gap-1.5 p-1 bg-[#181d2a] rounded-lg border border-[#272f42]">
          {scenarios.map((s) => {
            const isSelected = s.id === activeScenario.id;
            const sOrigFloors = s.id === 'scen-001' ? 4 : s.id === 'scen-002' ? 8 : 12;
            const sOverridden = s.metrics.totalFloors !== sOrigFloors || s.isFittedOverride;

            return (
              <button
                key={s.id}
                onClick={() => onSelectScenario(s.id)}
                aria-pressed={isSelected}
                className={`py-2 px-1.5 rounded-md text-[11px] font-semibold transition-all text-center truncate cursor-pointer ${
                  isSelected
                    ? 'bg-[#2563eb] text-white shadow-md'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-[#1e2434]'
                }`}
              >
                <span className="block truncate">{s.name.split(':')[0]}</span>
                {s.isPreferred ? (
                  <span className="block text-[9px] text-sky-200 font-normal">Preferred · {s.metrics.totalFloors} Fl</span>
                ) : sOverridden ? (
                  <span className="block text-[9px] text-indigo-300 font-normal">{s.metrics.totalFloors} Fl [Override]</span>
                ) : (
                  <span className="block text-[9px] text-slate-400 font-normal">{s.metrics.totalFloors} Fl</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Active Scenario Overview & Explicit State Strip */}
      <div className="p-3 border-b border-[#232938] bg-[#121620]/50 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-1">
            <h4 className="text-xs font-bold text-slate-100">{activeScenario.name}</h4>

            {/* Explicit State Badges Strip */}
            <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
              <span className="px-2 py-0.5 rounded text-[9px] font-mono font-bold bg-[#151a26] text-slate-300 border border-[#263147]">
                [BASE CONCEPT]
              </span>

              {isUserOverride && (
                <span className="px-2 py-0.5 rounded text-[9px] font-mono font-bold bg-indigo-950/80 text-indigo-300 border border-indigo-700/60">
                  [USER OVERRIDE]
                </span>
              )}

              {isFittedToSetback && (
                <span className="px-2 py-0.5 rounded text-[9px] font-mono font-bold bg-sky-950/80 text-sky-300 border border-sky-700/60">
                  [FITTED TO SETBACK]
                </span>
              )}
            </div>

            <p className={`text-[11px] mt-1 leading-relaxed ${
              hasCollision || isOutOfBounds || metrics.totalHeightMeters > 32.0 
                ? 'text-rose-300 font-medium' 
                : 'text-slate-400'
            }`}>
              {dynamicDescription}
            </p>
          </div>

          {/* Reset Button (Restores Active Scenario to Baseline Concept) */}
          <button
            onClick={() => onResetScenario(activeScenario.id)}
            title="Reset active scenario to original baseline concept"
            aria-label="Reset scenario to baseline concept"
            className="flex items-center gap-1 px-2.5 py-1 text-slate-300 hover:text-white bg-[#182030] hover:bg-[#222d42] rounded-lg border border-[#2b3952] text-[11px] font-mono font-semibold transition-all cursor-pointer shrink-0"
          >
            <RotateCcw className="w-3.5 h-3.5 text-[#38bdf8]" />
            <span>Reset</span>
          </button>
        </div>

        {/* Base Concept vs Working Override Geometry Readout */}
        {isOverridden ? (
          <div className="p-2.5 bg-indigo-950/30 border border-indigo-800/50 rounded-lg space-y-1 text-xs">
            <div className="flex items-center justify-between text-slate-300 text-[11px]">
              <span className="text-slate-400">Base Concept:</span>
              <span className="font-mono">{baselineFloors} Storeys ({baselineGFA.toLocaleString()} m² GFA)</span>
            </div>
            <div className="flex items-center justify-between text-indigo-200 font-semibold text-[11px]">
              <span className="text-indigo-300">Working Geometry:</span>
              <span className="font-mono font-bold">{metrics.totalFloors} Storeys ({metrics.totalGFA.toLocaleString()} m² GFA)</span>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between text-[10px] text-slate-400 bg-[#161c28] px-2.5 py-1.5 rounded border border-[#222c40]">
            <span>Base Concept: {baselineFloors} Storeys</span>
            <span className="font-mono text-emerald-400 font-semibold">Active Baseline</span>
          </div>
        )}

        {/* Pairwise Collision Alert Banner */}
        {hasCollision && (
          <div className="p-2.5 bg-rose-950/90 border border-rose-600 rounded-lg space-y-1.5 text-xs text-rose-200 shadow-md">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-rose-200 block">Mass Collision Active!</span>
                <span className="text-[11px] text-rose-300">
                  {activeScenario.pairwiseOverlap?.overlaps[0]?.massA} intersects with {activeScenario.pairwiseOverlap?.overlaps[0]?.massB} (Overlap volume: {activeScenario.pairwiseOverlap?.overlapVolumeM3.toLocaleString()} m³).
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Setback Encroachment Alert & Fit Action */}
        {(activeScenario.status === 'WARNING_EXCEEDS_CONSTRAINT' || encroachments.length > 0) && (
          <div className="p-2.5 bg-rose-950/70 border border-rose-800 rounded-lg space-y-2 text-xs text-rose-200 shadow-sm">
            <div className="flex items-start gap-2">
              <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div className="flex-1 leading-snug">
                {encroachments.length > 0 
                  ? encroachments[0].description 
                  : (activeScenario.warningMessage || 'Exceeds zoning constraints.')}
              </div>
            </div>

            {encroachments.length > 0 && (
              <button
                onClick={() => onFitMassingToEnvelope(activeScenario.id)}
                className="w-full py-1.5 px-2.5 bg-rose-900/80 hover:bg-rose-800 text-white rounded text-[11px] font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Fit Massing to Setback Envelope
              </button>
            )}
          </div>
        )}
      </div>

      {/* Main Content: Metrics & Interactive Parameter Adjuster */}
      <div className="p-3 flex-1 overflow-y-auto space-y-3.5">
        {/* Interactive Parameter Adjuster */}
        <div className="bg-[#161b28] border border-[#273146] rounded-lg p-3 shadow-inner">
          <div className="flex items-center justify-between mb-2.5">
            <div className="flex items-center gap-1.5 text-[#38bdf8] text-xs font-bold uppercase tracking-wider">
              <Sliders className="w-3.5 h-3.5" />
              Scenario Parameters ({activeScenario.name.split(':')[0]})
            </div>
            <span className="text-[10px] text-slate-400 font-mono">Independent</span>
          </div>

          <div className="space-y-3">
            {/* Floors Slider */}
            <div>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-slate-300">Building Height (Storeys)</span>
                <span className="font-mono font-bold text-slate-100 bg-[#1f283d] px-2 py-0.5 rounded text-[11px]">
                  {metrics.totalFloors} Floors ({metrics.totalHeightMeters.toFixed(1)}m)
                </span>
              </div>
              <input
                type="range"
                min="2"
                max="16"
                step="1"
                value={metrics.totalFloors}
                aria-label="Building Height in Storeys"
                onChange={(e) => onUpdateScenarioParam(activeScenario.id, 'floors', parseInt(e.target.value))}
                className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-[#38bdf8]"
              />
              <div className="flex justify-between text-[9px] text-slate-500 font-mono mt-0.5">
                <span>Min: 2 Fl</span>
                <span className="text-amber-400 font-semibold">Subzone R.9 Cap: 8 Fl (32m)</span>
                <span>Max: 16 Fl</span>
              </div>
            </div>

            {/* Front Setback Slider */}
            <div>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-slate-300">Front Setback (Teuku Umar Frontage)</span>
                <span className="font-mono font-bold text-slate-100 bg-[#1f283d] px-2 py-0.5 rounded text-[11px]">
                  {currentSetback} Meters
                </span>
              </div>
              <input
                type="range"
                min="5"
                max="60"
                step="1"
                value={currentSetback}
                aria-label="Front Setback in Meters"
                onChange={(e) => onUpdateScenarioParam(activeScenario.id, 'frontSetback', parseInt(e.target.value))}
                className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-[#e2b170]"
              />
              <div className="flex justify-between text-[9px] text-slate-500 font-mono mt-0.5">
                <span>5m</span>
                <span className="text-emerald-400">10m (Standard)</span>
                <span className="text-rose-400">47m (Encroaches)</span>
                <span>60m</span>
              </div>
            </div>

            {/* Encroachment Status Line */}
            <div className="pt-2 border-t border-[#222c40] flex items-center justify-between text-[11px]">
              <span className="text-slate-400">Buildable: {metrics.netBuildableArea.toLocaleString()} m²</span>
              {encroachments.length === 0 ? (
                <span className="text-emerald-400 text-[10px] flex items-center gap-1 font-semibold">
                  <CheckCircle2 className="w-3 h-3" /> Fully Contained
                </span>
              ) : (
                <button
                  onClick={() => onFitMassingToEnvelope(activeScenario.id)}
                  aria-label="Fit massing to setback"
                  className="text-[10px] text-rose-400 hover:text-rose-300 flex items-center gap-1 font-semibold bg-rose-950/80 px-2 py-1 rounded border border-rose-800 transition-all cursor-pointer"
                >
                  <RefreshCw className="w-3 h-3" /> Fit to Setback
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Live Yield Metrics Grid */}
        <div>
          <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2.5">
            Deterministic Yield Metrics
          </h4>

          <div className="grid grid-cols-2 gap-2">
            <div className="bg-[#161b28] border border-[#273146] p-2.5 rounded-lg">
              <span className="text-[10px] text-slate-400 block">Total GFA</span>
              <span className="text-base font-bold text-slate-100 font-mono">
                {metrics.totalGFA.toLocaleString()} <span className="text-xs font-normal text-slate-400">m²</span>
              </span>
            </div>

            <div className="bg-[#161b28] border border-[#273146] p-2.5 rounded-lg">
              <span className="text-[10px] text-slate-400 block">FAR / KLB Ratio</span>
              <span className={`text-base font-bold font-mono ${metrics.farKLB > 3.2 ? 'text-rose-400' : 'text-[#38bdf8]'}`}>
                {metrics.farKLB.toFixed(2)}x
              </span>
              <span className="text-[9px] text-slate-500 block">Zoning Max: 3.20x</span>
            </div>

            <div className="bg-[#161b28] border border-[#273146] p-2.5 rounded-lg">
              <span className="text-[10px] text-slate-400 block">Site Coverage (KDB)</span>
              <span className={`text-base font-bold font-mono ${metrics.siteCoveragePercentage > 55 ? 'text-rose-400' : 'text-slate-100'}`}>
                {metrics.siteCoveragePercentage}%
              </span>
              <span className="text-[9px] text-slate-500 block">Zoning Max: 55%</span>
            </div>

            <div className="bg-[#161b28] border border-[#273146] p-2.5 rounded-lg">
              <span className="text-[10px] text-slate-400 block">Unbuilt Site Area</span>
              <span className="text-base font-bold text-emerald-400 font-mono">
                {metrics.openSpaceArea.toLocaleString()} <span className="text-xs font-normal text-slate-400">m²</span>
              </span>
              <span className="text-[9px] text-slate-500 block">({metrics.openSpacePercentage}% unbuilt)</span>
            </div>
          </div>
        </div>

        {/* Building Mass Composition */}
        <div className="pt-2 border-t border-[#232938]">
          <h5 className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
            {hasCollision ? 'Massing Blocks (Collision Active)' : 'Massing Blocks (Zero Overlap)'}
          </h5>
          <div className="space-y-1.5">
            {activeScenario.masses.map((m) => (
              <div key={m.id} className="flex items-center justify-between text-xs bg-[#141926] px-3 py-2 rounded-lg border border-[#222c40]">
                <div className="flex items-center gap-2">
                  <span className={`w-2.5 h-2.5 rounded-sm ${m.type === 'PODIUM' ? 'bg-[#38bdf8]' : 'bg-[#e2b170]'}`} />
                  <span className="text-slate-200 font-medium">{m.name}</span>
                </div>
                <div className="text-slate-400 font-mono text-[11px]">
                  {m.floors} Fl · {m.gfa.toLocaleString()} m²
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Accessible COLLADA XML Viewer Modal */}
      {showXmlModal && (
        <div 
          role="dialog"
          aria-modal="true"
          aria-labelledby="xml-modal-title"
          aria-describedby="xml-modal-desc"
          onClick={handleCloseXmlModal}
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <div 
            ref={modalRef}
            onClick={(e) => e.stopPropagation()}
            className="bg-[#121622] border border-[#2b3548] rounded-xl max-w-2xl w-full max-h-[80vh] flex flex-col shadow-2xl overflow-hidden"
          >
            <div className="p-3 border-b border-[#232938] flex items-center justify-between bg-[#161c2b]">
              <div className="flex items-center gap-2">
                <Code2 className="w-4 h-4 text-[#38bdf8]" />
                <h4 id="xml-modal-title" className="text-xs font-bold text-slate-100 uppercase tracking-wider">
                  COLLADA XML ({exportFilename})
                </h4>
              </div>
              <button
                onClick={handleCloseXmlModal}
                aria-label="Close dialog"
                className="p-1 text-slate-400 hover:text-white rounded hover:bg-[#20283b] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 flex-1 overflow-hidden flex flex-col">
              <p id="xml-modal-desc" className="text-[11px] text-slate-400 mb-2">
                Click inside the code box to select all, then press <kbd className="bg-slate-800 px-1 py-0.5 rounded text-white font-mono text-[10px]">Ctrl+C</kbd> (or <kbd className="bg-slate-800 px-1 py-0.5 rounded text-white font-mono text-[10px]">Cmd+C</kbd>):
              </p>
              <textarea
                readOnly
                value={rawXml}
                onClick={(e) => (e.target as HTMLTextAreaElement).select()}
                className="w-full flex-1 min-h-[300px] bg-[#0c0f17] border border-[#252f44] rounded-lg p-3 text-xs font-mono text-slate-300 focus:outline-none focus:border-[#38bdf8] resize-none"
              />
            </div>

            <div className="p-3 border-t border-[#232938] flex justify-between items-center bg-[#161c2b]">
              <button
                onClick={handleClientDownloadBlob}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-[#1e2738] hover:bg-[#28354c] text-[#38bdf8] rounded text-xs font-semibold border border-[#38bdf8]/40 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Save .dae File</span>
              </button>

              <button
                onClick={handleCloseXmlModal}
                className="px-3 py-1.5 bg-[#2563eb] hover:bg-[#1d4ed8] text-white rounded text-xs font-semibold cursor-pointer"
              >
                Close (Esc)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
