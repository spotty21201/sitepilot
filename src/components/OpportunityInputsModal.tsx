'use client';

import { useMemo, useState } from 'react';
import { AlertTriangle, Ruler, X } from 'lucide-react';

import {
  deriveStreetName,
  resolveRectangularParcel,
  type RectangularParcelResolution,
} from '@/lib/opportunity/canonical-opportunity';
import type { Project } from '@/types';

export interface OpportunityInputUpdate {
  parcel: Extract<RectangularParcelResolution, { valid: true }>;
  manualStreetName?: string;
  maxHeightMeters?: number;
  maxFAR?: number;
  maxCoveragePct?: number;
  minKDHPct?: number;
  frontSetbackMeters: number;
  sideSetbackMeters: number;
  rearSetbackMeters: number;
  landscapedPermeableAreaM2?: number;
}

interface OpportunityInputsModalProps {
  project: Project;
  onClose: () => void;
  onSave: (update: OpportunityInputUpdate) => void;
}

function numericOrUndefined(value: string): number | undefined {
  if (!value.trim()) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function describeStreetSource(source: ReturnType<typeof deriveStreetName>['source']): string {
  if (source === 'USER_ENTERED') return 'Provided by user';
  if (source === 'ADDRESS_DERIVED') return 'Derived from address';
  return 'Not provided';
}

export function OpportunityInputsModal({
  project,
  onClose,
  onSave,
}: OpportunityInputsModalProps) {
  const [siteArea, setSiteArea] = useState(() => String(project.site.dimensionProvenance?.suppliedAreaM2 ?? project.site.grossSiteArea));
  const [frontage, setFrontage] = useState(() => String(project.site.frontageLength ?? ''));
  const [depth, setDepth] = useState(() => project.site.dimensionProvenance?.depth.source === 'ESTIMATED'
    ? ''
    : String(project.site.lotDepth ?? ''));
  const [manualStreetName, setManualStreetName] = useState(() => project.site.streetNameSource === 'USER_ENTERED' ? project.site.streetName ?? '' : '');
  const [maxHeight, setMaxHeight] = useState(() => String(project.zoningLimits?.maxHeightMeters ?? ''));
  const [maxFAR, setMaxFAR] = useState(() => String(project.zoningLimits?.maxFAR ?? ''));
  const [maxCoverage, setMaxCoverage] = useState(() => String(project.zoningLimits?.maxCoveragePct ?? ''));
  const [minKDH, setMinKDH] = useState(() => String(project.zoningLimits?.minKDHPct ?? ''));
  const [landscapedArea, setLandscapedArea] = useState(() => String(project.site.landscapedPermeableAreaM2 ?? ''));
  const [frontSetback, setFrontSetback] = useState(() => String(project.zoningLimits?.setbacks.front ?? project.site.setbacks.front));
  const [sideSetback, setSideSetback] = useState(() => String(project.zoningLimits?.setbacks.sideLeft ?? project.site.setbacks.sideLeft ?? 4));
  const [rearSetback, setRearSetback] = useState(() => String(project.zoningLimits?.setbacks.rear ?? project.site.setbacks.rear ?? 6));
  const [error, setError] = useState<string | null>(null);

  const parcel = useMemo(() => resolveRectangularParcel({
    siteAreaM2: numericOrUndefined(siteArea),
    frontageMeters: numericOrUndefined(frontage),
    depthMeters: numericOrUndefined(depth),
    areaSource: 'USER_ENTERED',
    frontageSource: 'USER_ENTERED',
    depthSource: depth.trim() ? 'USER_ENTERED' : 'ESTIMATED',
  }), [depth, frontage, siteArea]);
  const street = deriveStreetName(project.location.address, manualStreetName);

  const handleSave = () => {
    if (!parcel.valid) {
      setError(parcel.errors.join(' '));
      return;
    }
    const planningValues = [
      ['Maximum building height', numericOrUndefined(maxHeight)],
      ['FAR/KLB', numericOrUndefined(maxFAR)],
      ['Coverage/KDB', numericOrUndefined(maxCoverage)],
      ['Open-space/KDH requirement', numericOrUndefined(minKDH)],
    ] as const;
    const invalid = planningValues.find(([, value]) => value !== undefined && value <= 0);
    if (invalid) {
      setError(`${invalid[0]} must be greater than zero or left blank.`);
      return;
    }
    const frontSetbackMeters = numericOrUndefined(frontSetback);
    const sideSetbackMeters = numericOrUndefined(sideSetback);
    const rearSetbackMeters = numericOrUndefined(rearSetback);
    if (frontSetbackMeters === undefined || frontSetbackMeters < 0
      || sideSetbackMeters === undefined || sideSetbackMeters < 0
      || rearSetbackMeters === undefined || rearSetbackMeters < 0) {
      setError('Front, side and rear setbacks must be non-negative numbers. Front may be 0 m.');
      return;
    }
    onSave({
      parcel,
      manualStreetName: manualStreetName.trim() || undefined,
      maxHeightMeters: numericOrUndefined(maxHeight),
      maxFAR: numericOrUndefined(maxFAR),
      maxCoveragePct: numericOrUndefined(maxCoverage),
      minKDHPct: numericOrUndefined(minKDH),
      frontSetbackMeters,
      sideSetbackMeters,
      rearSetbackMeters,
      landscapedPermeableAreaM2: numericOrUndefined(landscapedArea),
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="opportunity-inputs-title">
      <div className="dialog-shell flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden">
        <header className="dialog-header flex items-center justify-between p-4">
          <div className="flex items-center gap-2.5">
            <Ruler className="h-4 w-4 text-[var(--status-evidence)]" />
            <div>
              <h2 id="opportunity-inputs-title" className="type-section-title">Opportunity & Planning Inputs</h2>
              <p className="mt-1 text-[11px] text-[var(--text-secondary)]">One rectangular study parcel drives the plans, development options, planning checks, and downloads.</p>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close opportunity inputs" className="dialog-close p-1.5"><X className="h-4 w-4" /></button>
        </header>

        <div className="space-y-5 overflow-y-auto p-5 text-xs">
          {error && <div className="rounded-[var(--radius-card)] border border-[var(--status-error)] bg-[var(--status-error-surface)] p-3 text-[var(--status-error)]" role="alert">{error}</div>}

          <section className="space-y-3" aria-labelledby="parcel-input-heading">
            <div>
              <h3 id="parcel-input-heading" className="font-semibold text-[var(--text-primary)]">Rectangular lot dimensions</h3>
              <p className="mt-1 text-[11px] text-[var(--text-muted)]">Enter width + depth, or area + frontage. Entered values take precedence over estimates.</p>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <label className="space-y-1"><span className="font-semibold text-[var(--text-secondary)]">Site area (m²)</span><input aria-label="Site area in square metres" type="number" min="0.01" step="0.01" value={siteArea} onChange={(event) => setSiteArea(event.target.value)} className="intake-control w-full px-3 py-2 font-mono" /></label>
              <label className="space-y-1"><span className="font-semibold text-[var(--text-secondary)]">Street frontage / width (m)</span><input aria-label="Street frontage in metres" type="number" min="0.01" step="0.01" value={frontage} onChange={(event) => setFrontage(event.target.value)} className="intake-control w-full px-3 py-2 font-mono" /></label>
              <label className="space-y-1"><span className="font-semibold text-[var(--text-secondary)]">Lot depth (m) {!depth.trim() && parcel.valid && <em className="font-normal text-[var(--status-investigation)]">Estimated</em>}</span><input aria-label="Lot depth in metres" type="number" min="0.01" step="0.01" value={depth || (parcel.valid ? String(parcel.depthMeters) : '')} onChange={(event) => setDepth(event.target.value)} className="intake-control w-full px-3 py-2 font-mono" /></label>
            </div>
            {parcel.valid && <div className="surface-inspector p-3 text-[11px] text-[var(--text-secondary)]" aria-live="polite"><strong className="text-[var(--text-primary)]">Site geometry:</strong> {parcel.frontageMeters}m × {parcel.depthMeters}m = {parcel.siteAreaM2.toLocaleString()} m². Not surveyed cadastral geometry.{parcel.warning && <p className="mt-2 flex items-start gap-1.5 text-[var(--status-warning)]"><AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />{parcel.warning}</p>}</div>}
          </section>

          <section className="space-y-3 border-t border-[var(--border-subtle)] pt-4">
            <div><h3 className="font-semibold text-[var(--text-primary)]">Street-facing edge</h3><p className="mt-1 text-[11px] text-[var(--text-muted)]">Parsed from the address unless manually corrected.</p></div>
            <label className="space-y-1"><span className="font-semibold text-[var(--text-secondary)]">Street name override</span><input aria-label="Street name override" value={manualStreetName} onChange={(event) => setManualStreetName(event.target.value)} placeholder="Optional manual correction" className="intake-control w-full px-3 py-2" /></label>
            <p className="text-[10px] text-[var(--text-muted)]">Road label: <span className="text-[var(--text-primary)]">{street.value}</span> · {describeStreetSource(street.source)}</p>
          </section>

          <section className="space-y-3 border-t border-[var(--border-subtle)] pt-4">
            <div><h3 className="font-semibold text-[var(--text-primary)]">Planning limits</h3><p className="mt-1 text-[11px] text-[var(--text-muted)]">Leave height blank to derive only a FAR/KDB planning study floor count—not a legal maximum.</p></div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <label className="space-y-1"><span className="text-[var(--text-secondary)]">Max height (m)</span><input aria-label="Maximum building height in metres" type="number" min="0.01" step="0.1" value={maxHeight} onChange={(event) => setMaxHeight(event.target.value)} className="intake-control w-full px-3 py-2 font-mono" /></label>
              <label className="space-y-1"><span className="text-[var(--text-secondary)]">FAR / KLB</span><input aria-label="Maximum FAR KLB" type="number" min="0.01" step="0.01" value={maxFAR} onChange={(event) => setMaxFAR(event.target.value)} className="intake-control w-full px-3 py-2 font-mono" /></label>
              <label className="space-y-1"><span className="text-[var(--text-secondary)]">Coverage / KDB (%)</span><input aria-label="Maximum coverage KDB percent" type="number" min="0.01" max="100" step="0.1" value={maxCoverage} onChange={(event) => setMaxCoverage(event.target.value)} className="intake-control w-full px-3 py-2 font-mono" /></label>
              <label className="space-y-1"><span className="text-[var(--text-secondary)]">Open space / KDH (%)</span><input aria-label="Minimum KDH percent" type="number" min="0.01" max="100" step="0.1" value={minKDH} onChange={(event) => setMinKDH(event.target.value)} className="intake-control w-full px-3 py-2 font-mono" /></label>
              <label className="space-y-1"><span className="text-[var(--text-secondary)]">Landscaped / permeable area (m²)</span><input aria-label="Landscaped permeable area in square metres" type="number" min="0" step="0.01" value={landscapedArea} onChange={(event) => setLandscapedArea(event.target.value)} className="intake-control w-full px-3 py-2 font-mono" /><span className="block text-[9px] text-[var(--text-muted)]">Enter only when this area is explicitly supported; unbuilt area alone does not demonstrate KDH.</span></label>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <label className="space-y-1"><span className="text-[var(--text-secondary)]">Front setback (m)</span><input aria-label="Front setback in metres" type="number" min="0" step="0.5" value={frontSetback} onChange={(event) => setFrontSetback(event.target.value)} className="intake-control w-full px-3 py-2 font-mono" /><span className="block text-[9px] leading-relaxed text-[var(--text-muted)]">Building setback from the street-facing boundary; 0 m is valid. This study input is not represented as a registered legal easement.</span></label>
              <label className="space-y-1"><span className="text-[var(--text-secondary)]">Side setback (m)</span><input aria-label="Symmetric side setback in metres" type="number" min="0" step="0.5" value={sideSetback} onChange={(event) => setSideSetback(event.target.value)} className="intake-control w-full px-3 py-2 font-mono" /><span className="block text-[9px] leading-relaxed text-[var(--text-muted)]">Applied equally to left and right sides. New opportunities default to 4 m.</span></label>
              <label className="space-y-1"><span className="text-[var(--text-secondary)]">Rear setback (m)</span><input aria-label="Rear setback in metres" type="number" min="0" step="0.5" value={rearSetback} onChange={(event) => setRearSetback(event.target.value)} className="intake-control w-full px-3 py-2 font-mono" /><span className="block text-[9px] leading-relaxed text-[var(--text-muted)]">Study setback from the rear parcel boundary; not surveyed cadastral geometry.</span></label>
            </div>
          </section>
        </div>

        <footer className="flex items-center justify-between border-t border-[var(--border-subtle)] bg-[var(--bg-tertiary)] p-4">
          <span className="text-[10px] text-[var(--text-muted)]">Saving recalculates all three options from the same study inputs.</span>
          <div className="flex gap-2"><button type="button" onClick={onClose} className="button-secondary px-3 py-2">Cancel</button><button type="button" onClick={handleSave} className="button-primary px-3 py-2">Save & recalculate</button></div>
        </footer>
      </div>
    </div>
  );
}
