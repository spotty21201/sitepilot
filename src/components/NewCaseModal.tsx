'use client';

import React, { useState, useEffect, useReducer, useRef } from 'react';
import { CreateCaseParams } from '@/lib/storage/case-repository';
import { X, Building2, ShieldCheck, Sparkles, SlidersHorizontal, Calculator, Layers, FileSpreadsheet } from 'lucide-react';
import {
  deriveStreetName,
  resolveRectangularParcel,
} from '@/lib/opportunity/canonical-opportunity';
import type { SchemePriorities } from '@/lib/schemes/proposal-contract';
import {
  clearOpportunityIntakeDraft,
  createOpportunityIntakeDraft,
  intakeSourceLabel,
  loadOpportunityIntakeDraft,
  parseDraftNumber,
  persistOpportunityIntakeDraft,
  reviewOpportunityIntakeDraft,
  updateIntakeDraftField,
  updateIntakeDraftPriorities,
  updateAdditionalStrategyInstructions,
  type IntakeFieldName,
  type OpportunityIntakeDraft,
} from '@/lib/opportunity/intake-draft';

interface NewCaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateCase: (params: CreateCaseParams, priorities?: SchemePriorities, additionalStrategyInstructions?: string) => void;
}

type IntakeTab = 'SITE' | 'EXISTING' | 'ZONING' | 'VALUATION';

type IntakeDraftAction =
  | { type: 'FIELD'; field: IntakeFieldName; value: string }
  | { type: 'PRIORITIES'; value: SchemePriorities }
  | { type: 'STRATEGY_INSTRUCTIONS'; value: string }
  | { type: 'RESET' };

function intakeDraftReducer(draft: OpportunityIntakeDraft, action: IntakeDraftAction): OpportunityIntakeDraft {
  if (action.type === 'FIELD') return updateIntakeDraftField(draft, action.field, action.value);
  if (action.type === 'PRIORITIES') return updateIntakeDraftPriorities(draft, action.value);
  if (action.type === 'STRATEGY_INSTRUCTIONS') return updateAdditionalStrategyInstructions(draft, action.value);
  return createOpportunityIntakeDraft();
}

function formatRupiahHelper(amount: number): string {
  if (isNaN(amount) || amount <= 0) return '';
  if (amount >= 1e9) {
    return `Rp ${(amount / 1e9).toFixed(2)} Billion (~Rp ${amount.toLocaleString()})`;
  }
  if (amount >= 1e6) {
    return `Rp ${(amount / 1e6).toFixed(2)} Million (~Rp ${amount.toLocaleString()})`;
  }
  return `Rp ${amount.toLocaleString()}`;
}

export function NewCaseModal({ isOpen, onClose, onCreateCase }: NewCaseModalProps) {
  const [activeTab, setActiveTab] = useState<IntakeTab>('SITE');
  const [draft, dispatchDraft] = useReducer(
    intakeDraftReducer,
    undefined,
    () => loadOpportunityIntakeDraft(typeof window === 'undefined' ? undefined : window.localStorage),
  );
  const {
    name, address, city, country, objective, grossSiteArea, frontageLength, lotDepth, manualStreetName,
    existingBuildingGFA, existingFloors, existingAssetDescription, existingAssetStatus,
    zoneCode, zoneName, statutoryMaxFAR, statutoryMaxCoveragePct, statutoryMinKDHPct,
    landscapedPermeableAreaM2, statutoryMaxHeightMeters, setbackFront, setbackRear, setbackSide,
    askingPriceAmount, askingPriceCurrency, njopAmount, valuationBasisNotes,
  } = draft.values;
  const priorities = draft.priorities;
  const additionalStrategyInstructions = draft.additionalStrategyInstructions;
  const setField = (field: IntakeFieldName) => (value: string) => dispatchDraft({ type: 'FIELD', field, value });
  const setName = setField('name');
  const setAddress = setField('address');
  const setCity = setField('city');
  const setCountry = setField('country');
  const setObjective = setField('objective');
  const setGrossSiteArea = setField('grossSiteArea');
  const setFrontageLength = setField('frontageLength');
  const setLotDepth = setField('lotDepth');
  const setManualStreetName = setField('manualStreetName');
  const setExistingBuildingGFA = setField('existingBuildingGFA');
  const setExistingFloors = setField('existingFloors');
  const setExistingAssetDescription = setField('existingAssetDescription');
  const setExistingAssetStatus = setField('existingAssetStatus');
  const setZoneCode = setField('zoneCode');
  const setZoneName = setField('zoneName');
  const setStatutoryMaxFAR = setField('statutoryMaxFAR');
  const setStatutoryMaxCoveragePct = setField('statutoryMaxCoveragePct');
  const setStatutoryMinKDHPct = setField('statutoryMinKDHPct');
  const setLandscapedPermeableAreaM2 = setField('landscapedPermeableAreaM2');
  const setStatutoryMaxHeightMeters = setField('statutoryMaxHeightMeters');
  const setSetbackFront = setField('setbackFront');
  const setSetbackRear = setField('setbackRear');
  const setSetbackSide = setField('setbackSide');
  const setAskingPriceAmount = setField('askingPriceAmount');
  const setAskingPriceCurrency = setField('askingPriceCurrency');
  const setNjopAmount = setField('njopAmount');
  const setValuationBasisNotes = setField('valuationBasisNotes');
  const setPriorities = (updater: SchemePriorities | ((value: SchemePriorities) => SchemePriorities)) => {
    dispatchDraft({ type: 'PRIORITIES', value: typeof updater === 'function' ? updater(priorities) : updater });
  };

  const [error, setError] = useState<string | null>(null);
  const [showPriorityConfirmation, setShowPriorityConfirmation] = useState(false);

  const modalRef = useRef<HTMLDivElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    persistOpportunityIntakeDraft(typeof window === 'undefined' ? undefined : window.localStorage, draft);
  }, [draft]);

  const handleClose = React.useCallback(() => {
    setActiveTab('SITE');
    setError(null);
    setShowPriorityConfirmation(false);
    onClose();
  }, [onClose]);

  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        nameInputRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Escape key and tab key handling
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        handleClose();
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleClose]);

  if (!isOpen) return null;

  const parsedArea = parseDraftNumber(grossSiteArea);
  const parsedFrontagePreview = parseDraftNumber(frontageLength);
  const parsedDepthPreview = parseDraftNumber(lotDepth);
  const parcelPreview = resolveRectangularParcel({
    frontageMeters: parsedFrontagePreview,
    depthMeters: parsedDepthPreview,
    siteAreaM2: parsedArea,
  });
  const estimatedDepth = !lotDepth.trim() && parcelPreview.valid
    && parcelPreview.provenance.depth.source === 'ESTIMATED'
    ? parcelPreview.depthMeters.toString()
    : '';
  const estimatedArea = !grossSiteArea.trim() && parcelPreview.valid
    && parcelPreview.provenance.area.source === 'ESTIMATED'
    ? parcelPreview.siteAreaM2.toString()
    : '';
  const effectiveArea = parcelPreview.valid ? parcelPreview.siteAreaM2 : 10000;
  const streetPreview = deriveStreetName(address, manualStreetName);
  const enteredFAR = parseDraftNumber(statutoryMaxFAR);
  const parsedFAR = enteredFAR !== undefined && enteredFAR > 0 ? enteredFAR : 3.20;
  const maxGFA = Math.round(effectiveArea * parsedFAR);
  const parsedExistingGFA = parseDraftNumber(existingBuildingGFA) ?? 0;
  const headroomGFA = parsedExistingGFA > 0 ? Math.max(0, maxGFA - parsedExistingGFA) : maxGFA;
  const parsedPrice = parseDraftNumber(askingPriceAmount) ?? 0;
  const pricePerM2 = parsedPrice > 0 && effectiveArea > 0 ? Math.round(parsedPrice / effectiveArea) : 0;
  const parsedNJOP = parseDraftNumber(njopAmount) ?? 0;
  const intakeReview = reviewOpportunityIntakeDraft(draft);
  const reviewRows = [
    { label: 'Site and dimensions', value: `${name || 'Unnamed'} · ${effectiveArea.toLocaleString()} m² · ${parcelPreview.valid ? `${parcelPreview.frontageMeters}m × ${parcelPreview.depthMeters}m` : 'dimensions incomplete'}`, source: draft.sources.grossSiteArea },
    { label: 'Existing asset', value: parsedExistingGFA > 0 ? `${parsedExistingGFA.toLocaleString()} m²${existingFloors ? ` · ${existingFloors} storeys` : ' · storeys not provided'}` : 'No existing GFA supplied', source: draft.sources.existingBuildingGFA },
    { label: 'Development intent', value: objective.trim() || 'Default viability and yield study', source: draft.sources.objective },
    { label: 'Planning inputs', value: `FAR ${statutoryMaxFAR || 'not supplied'} · KDB ${statutoryMaxCoveragePct || 'not supplied'}% · KDH ${statutoryMinKDHPct || 'not supplied'}% · height ${statutoryMaxHeightMeters || 'not supplied'}m`, source: draft.sources.statutoryMaxFAR },
    { label: 'Setbacks', value: `${setbackFront || 'default'}m front · ${setbackRear || 'default'}m rear · ${setbackSide || 'default'}m sides`, source: draft.sources.setbackFront },
    { label: 'Commercial assumptions', value: `${askingPriceAmount ? `${askingPriceCurrency} ${parsedPrice.toLocaleString()} asking price` : 'Asking price not supplied'} · ${njopAmount ? `IDR ${parsedNJOP.toLocaleString()} NJOP` : 'NJOP not supplied'}`, source: draft.sources.askingPriceAmount },
    { label: 'KDH basis', value: parseDraftNumber(landscapedPermeableAreaM2) !== undefined ? `${Number(landscapedPermeableAreaM2).toLocaleString()} m² landscaped/permeable area supplied` : 'KDH not demonstrated — landscaped/permeable basis not supplied', source: draft.sources.landscapedPermeableAreaM2 },
  ] as const;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedName = name.trim();
    const trimmedAddress = address.trim();
    if (intakeReview.criticalErrors.length > 0) {
      setError(intakeReview.criticalErrors.join(' '));
      setActiveTab('SITE');
      return;
    }

    if (!showPriorityConfirmation) {
      setShowPriorityConfirmation(true);
      return;
    }

    const parsedFrontage = parseDraftNumber(frontageLength);
    const parsedDepth = parseDraftNumber(lotDepth);
    const resolvedParcel = resolveRectangularParcel({
      frontageMeters: parsedFrontage,
      depthMeters: parsedDepth,
      siteAreaM2: parsedArea,
    });
    if (!resolvedParcel.valid) {
      setError(resolvedParcel.errors.join(' '));
      setActiveTab('SITE');
      return;
    }
    const parsedFloors = parseDraftNumber(existingFloors);
    const parsedMaxCoverage = parseDraftNumber(statutoryMaxCoveragePct);
    const parsedMinKDH = parseDraftNumber(statutoryMinKDHPct);
    const parsedLandscapedArea = parseDraftNumber(landscapedPermeableAreaM2);
    const parsedMaxHeight = parseDraftNumber(statutoryMaxHeightMeters);
    const parsedFrontSetback = parseDraftNumber(setbackFront);
    const parsedRearSetback = parseDraftNumber(setbackRear);
    const parsedSideSetback = parseDraftNumber(setbackSide);
    const finalNJOP = parseDraftNumber(njopAmount);

    onCreateCase({
      name: trimmedName,
      address: trimmedAddress,
      city: city.trim() || 'Jakarta',
      country: country.trim() || 'Indonesia',
      objective: objective.trim() || 'Evaluate site viability, development yield, and zoning envelope.',
      grossSiteArea: parsedArea,
      frontageLength: parsedFrontage,
      lotDepth: parsedDepth,
      streetName: manualStreetName.trim() || undefined,
      
      // Existing Asset
      existingBuildingGFA: parsedExistingGFA,
      existingFloors: parsedFloors,
      existingAssetDescription: existingAssetDescription.trim() || undefined,
      existingAssetStatus: existingAssetStatus || 'Operational',

      // Planning & Zoning
      zoneCode: zoneCode.trim() || 'KT + K-1',
      zoneName: zoneName.trim() || 'Commercial / Hospitality',
      statutoryMaxFAR: enteredFAR,
      statutoryMaxCoveragePct: parsedMaxCoverage,
      statutoryMinKDHPct: parsedMinKDH,
      landscapedPermeableAreaM2: parsedLandscapedArea,
      statutoryMaxHeightMeters: parsedMaxHeight,
      setbackFront: parsedFrontSetback,
      setbackRear: parsedRearSetback,
      setbackSideLeft: parsedSideSetback,
      setbackSideRight: parsedSideSetback,

      // Valuation
      askingPriceAmount: parseDraftNumber(askingPriceAmount),
      askingPriceCurrency,
      njopAmount: finalNJOP,
      valuationBasisNotes: valuationBasisNotes.trim() || undefined,
      provenanceType: 'USER_ENTERED_ASSUMPTION',
      intakeValueSources: { ...draft.sources },
    }, priorities, additionalStrategyInstructions.trim() || undefined);

    clearOpportunityIntakeDraft(typeof window === 'undefined' ? undefined : window.localStorage);
    dispatchDraft({ type: 'RESET' });
    handleClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="new-case-modal-title"
      onClick={handleClose}
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4"
    >
      <div
        ref={modalRef}
        onClick={(e) => e.stopPropagation()}
        className="dialog-shell max-w-2xl w-full max-h-[92vh] flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="dialog-header p-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="dialog-icon--action w-8 h-8 flex items-center justify-center font-bold shadow-md">
              <Building2 className="w-4 h-4" />
            </div>
            <div>
              <h3 id="new-case-modal-title" className="text-sm font-bold text-[var(--text-primary)]">
                New Opportunity Intake & Parameter Setup
              </h3>
              <p className="text-[11px] text-[var(--text-secondary)]">
                Capture property facts, existing asset baseline, statutory zoning limits, and valuation benchmarks.
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            aria-label="Close dialog"
            className="dialog-close p-1.5 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="intake-tabs grid grid-cols-4 gap-1 p-2 text-xs font-semibold" role="group" aria-label="Opportunity intake sections">
          <button
            type="button"
            onClick={() => setActiveTab('SITE')}
            aria-pressed={activeTab === 'SITE'}
            className="intake-tab py-2 px-2.5 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
          >
            <Building2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">1. Opportunity</span>
            <span className="sm:hidden">Site</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('EXISTING')}
            aria-pressed={activeTab === 'EXISTING'}
            className="intake-tab py-2 px-2.5 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
          >
            <Layers className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">2. Existing Asset</span>
            <span className="sm:hidden">Asset</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('ZONING')}
            aria-pressed={activeTab === 'ZONING'}
            className="intake-tab py-2 px-2.5 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">3. Planning Limits</span>
            <span className="sm:hidden">Zoning</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('VALUATION')}
            aria-pressed={activeTab === 'VALUATION'}
            className="intake-tab py-2 px-2.5 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">4. Commercials</span>
            <span className="sm:hidden">Price</span>
          </button>
        </div>

        {/* Body Form */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-5 flex-1 overflow-y-auto space-y-4 text-xs">
          {error && (
            <div className="p-3 bg-[var(--status-error-surface)] border border-[var(--status-error)] text-[var(--status-error)] rounded-[var(--radius-card)] text-xs font-medium" role="alert">
              {error}
            </div>
          )}

          {showPriorityConfirmation && (
            <section className="surface-inspector border border-[var(--spatial-selection)] p-3 space-y-3" aria-label="Review and confirm opportunity inputs">
              <div>
                <div className="flex items-center gap-2 text-[var(--status-evidence)] font-semibold">
                  <Sparkles className="w-3.5 h-3.5" />
                  Review confirmed input snapshot
                </div>
                <p className="mt-1 text-[11px] text-[var(--text-secondary)]">
                  Generation will be bound to this exact snapshot, its study version, and input hash. SitePilot remains authoritative for geometry and planning figures.
                </p>
              </div>
              <dl className="grid grid-cols-1 gap-2 sm:grid-cols-2" role="group" aria-label="Confirmed opportunity summary">
                {reviewRows.map((row) => (
                  <div key={row.label} className="rounded-[var(--radius-control)] border border-[var(--border-subtle)] bg-[var(--bg-primary)] p-2">
                    <dt className="text-[9px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">{row.label}</dt>
                    <dd className="mt-0.5 text-[10px] leading-relaxed text-[var(--text-primary)]">{row.value}</dd>
                    <dd className="mt-1 text-[9px] text-[var(--status-assumed)]">{intakeSourceLabel(row.source)}</dd>
                  </div>
                ))}
              </dl>
              <div className="flex flex-wrap gap-1.5" role="group" aria-label="Return to edit intake section">
                {([['SITE', 'Edit site'], ['EXISTING', 'Edit existing asset'], ['ZONING', 'Edit planning'], ['VALUATION', 'Edit commercials']] as const).map(([tab, label]) => (
                  <button key={tab} type="button" className="button-secondary px-2 py-1 text-[9px]" onClick={() => { setActiveTab(tab); setShowPriorityConfirmation(false); }}>{label}</button>
                ))}
              </div>
              {intakeReview.clarifyingQuestions.length > 0 && (
                <div className="rounded-[var(--radius-control)] border border-[var(--status-warning)] bg-[var(--status-warning-surface)] p-2 text-[10px] text-[var(--text-secondary)]">
                  <strong className="text-[var(--status-warning)]">Information still required:</strong>
                  <ul className="mt-1 list-disc space-y-0.5 pl-4">{intakeReview.clarifyingQuestions.map((question) => <li key={question}>{question}</li>)}</ul>
                </div>
              )}
              <div className="rounded-[var(--radius-control)] border border-[var(--border-subtle)] bg-[var(--bg-primary)] p-2 text-[9px] text-[var(--text-muted)]">
                <strong className="text-[var(--text-secondary)]">Defaults and provisional assumptions:</strong>
                <ul className="mt-1 list-disc space-y-0.5 pl-4">{intakeReview.assumptions.map((assumption) => <li key={assumption}>{assumption}</li>)}</ul>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <label className="space-y-1"><span className="block font-semibold text-[var(--text-secondary)]">Existing-building approach</span><select className="intake-control w-full px-2 py-1.5" value={priorities.existingBuildingRetention} onChange={(e) => setPriorities((prev) => ({ ...prev, existingBuildingRetention: e.target.value as SchemePriorities['existingBuildingRetention'] }))}><option value="retain">Retain</option><option value="adapt">Adapt</option><option value="partial">Partial retention</option><option value="replace">Replace</option></select></label>
                <label className="space-y-1"><span className="block font-semibold text-[var(--text-secondary)]">Development yield</span><select className="intake-control w-full px-2 py-1.5" value={priorities.developmentYield} onChange={(e) => setPriorities((prev) => ({ ...prev, developmentYield: e.target.value as SchemePriorities['developmentYield'] }))}><option value="conservative">Conservative</option><option value="balanced">Balanced</option><option value="maximum">Maximum</option></select></label>
                <label className="space-y-1"><span className="block font-semibold text-[var(--text-secondary)]">Public realm</span><select className="intake-control w-full px-2 py-1.5" value={priorities.publicRealm} onChange={(e) => setPriorities((prev) => ({ ...prev, publicRealm: e.target.value as SchemePriorities['publicRealm'] }))}><option value="standard">Standard</option><option value="strong">Strong</option><option value="generous">Generous</option></select></label>
                <label className="space-y-1"><span className="block font-semibold text-[var(--text-secondary)]">Phasing</span><select className="intake-control w-full px-2 py-1.5" value={priorities.phasing} onChange={(e) => setPriorities((prev) => ({ ...prev, phasing: e.target.value as SchemePriorities['phasing'] }))}><option value="phased">Phased</option><option value="single_phase">Single phase</option></select></label>
                <label className="space-y-1"><span className="block font-semibold text-[var(--text-secondary)]">Planning-risk tolerance</span><select className="intake-control w-full px-2 py-1.5" value={priorities.planningRiskTolerance} onChange={(e) => setPriorities((prev) => ({ ...prev, planningRiskTolerance: e.target.value as SchemePriorities['planningRiskTolerance'] }))}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select></label>
                <label className="space-y-1"><span className="block font-semibold text-[var(--text-secondary)]">Investment horizon</span><select className="intake-control w-full px-2 py-1.5" value={priorities.investmentHorizon} onChange={(e) => setPriorities((prev) => ({ ...prev, investmentHorizon: e.target.value as SchemePriorities['investmentHorizon'] }))}><option value="short">Short</option><option value="medium">Medium</option><option value="long">Long</option></select></label>
              </div>
              <label className="block text-[11px] text-[var(--text-secondary)]"><span className="flex items-center gap-2"><input type="checkbox" checked={priorities.allowNonCompliantStretch} onChange={(e) => setPriorities((prev) => ({ ...prev, allowNonCompliantStretch: e.target.checked }))} /> Allow one clearly labelled non-compliant stretch study</span></label>
              <label className="block space-y-1"><span className="block font-semibold text-[var(--text-secondary)]">Program mix priority</span><textarea rows={2} className="intake-control intake-control--textarea w-full p-2" value={priorities.programMix} onChange={(e) => setPriorities((prev) => ({ ...prev, programMix: e.target.value }))} /></label>
              <label className="block space-y-1">
                <span className="block font-semibold text-[var(--text-secondary)]">Additional Strategy Instructions <span className="font-normal text-[var(--text-muted)]">(optional)</span></span>
                <textarea
                  rows={3}
                  maxLength={2000}
                  className="intake-control intake-control--textarea w-full p-2"
                  value={additionalStrategyInstructions}
                  onChange={(event) => dispatchDraft({ type: 'STRATEGY_INSTRUCTIONS', value: event.target.value })}
                  placeholder="For example: retain service access in every option; vary the plaza location; avoid a tower-only solution."
                />
                <span className="block text-[10px] leading-relaxed text-[var(--text-muted)]">Tell Taskmaster what every scheme must respect, what the alternatives should explore, and what should be avoided. These instructions cannot override confirmed planning limits or SitePilot’s calculations.</span>
              </label>
              <p className="text-[10px] text-[var(--status-assumed)]">The model may propose concepts; SitePilot calculates all geometry, figures and planning checks independently.</p>
            </section>
          )}

          {/* TAB 1: SITE & BASIC IDENTITY */}
          {activeTab === 'SITE' && (
            <div className="space-y-3.5">
              <div className="space-y-1">
                <label className="block font-semibold text-[var(--text-secondary)]">
                  Opportunity / Project Title <span className="text-[var(--status-error)]">*</span>
                </label>
                <input
                  ref={nameInputRef}
                  type="text"
                  required
                  placeholder="e.g. Hotel Sofyan Betawi — Acquisition & Expansion"
                  value={name}
                  aria-label="Opportunity title"
                  onChange={(e) => setName(e.target.value)}
                  className="intake-control w-full px-3 py-2"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div className="sm:col-span-2 space-y-1">
                  <label className="block font-semibold text-[var(--text-secondary)]">
                    Site Address <span className="text-[var(--status-error)]">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Jl. Cut Mutiah No. 9, Menteng"
                    value={address}
                    aria-label="Site address"
                    onChange={(e) => setAddress(e.target.value)}
                    className="intake-control w-full px-3 py-2"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block font-semibold text-[var(--text-secondary)]">City</label>
                  <input
                    type="text"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    className="intake-control w-full px-3 py-2"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block font-semibold text-[var(--text-secondary)]">Country</label>
                  <input
                    type="text"
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                    className="intake-control w-full px-3 py-2"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="block font-semibold text-[var(--text-secondary)]">
                    Site Area (m²) {estimatedArea && <span className="text-[var(--status-investigation)] font-normal">Estimated</span>}
                  </label>
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    placeholder="e.g. 2014"
                    value={grossSiteArea}
                    aria-label="Site area"
                    onChange={(e) => setGrossSiteArea(e.target.value)}
                    className="intake-control w-full px-3 py-2 font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block font-semibold text-[var(--text-secondary)]">
                    Street Frontage / Lot Width (m)
                  </label>
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    placeholder="e.g. 40.0"
                    value={frontageLength}
                    aria-label="Street frontage"
                    onChange={(e) => setFrontageLength(e.target.value)}
                    className="intake-control w-full px-3 py-2 font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block font-semibold text-[var(--text-secondary)]">
                    Lot Depth (m) {estimatedDepth && <span className="text-[var(--status-investigation)] font-normal">Estimated</span>}
                  </label>
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    placeholder="Calculated from area ÷ frontage"
                    value={lotDepth}
                    aria-label="Lot depth"
                    onChange={(e) => setLotDepth(e.target.value)}
                    className="intake-control w-full px-3 py-2 font-mono"
                  />
                </div>
              </div>

              {parcelPreview.valid && (
                <div className="surface-inspector p-2.5 text-[11px] text-[var(--text-secondary)]" aria-live="polite">
                  Rectangular study parcel: <span className="font-mono text-[var(--text-primary)]">{parcelPreview.frontageMeters}m × {parcelPreview.depthMeters}m = {parcelPreview.siteAreaM2.toLocaleString()} m²</span>.
                  {' '}This is a planning representation, not surveyed cadastral geometry.
                  {parcelPreview.warning && <p className="mt-1 text-[var(--status-warning)]">{parcelPreview.warning}</p>}
                </div>
              )}

              <div className="space-y-1">
                <label className="block font-semibold text-[var(--text-secondary)]">
                  Street Name Override <span className="text-[var(--text-muted)] font-normal">(optional)</span>
                </label>
                <input
                  type="text"
                  placeholder="Use when the address cannot be parsed reliably"
                  value={manualStreetName}
                  onChange={(e) => setManualStreetName(e.target.value)}
                  className="intake-control w-full px-3 py-2"
                />
                <p className="text-[10px] text-[var(--text-muted)]">Road label: {streetPreview.value} · {streetPreview.source.replace(/_/g, ' ').toLowerCase()}</p>
              </div>

              <div className="space-y-1">
                <label className="block font-semibold text-[var(--text-secondary)]">
                  Development Intent / Investment Thesis
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Evaluate acquisition yield, operational continuity, and 10,000 m² phased lifestyle expansion feasibility."
                  value={objective}
                  aria-label="Development intent"
                  onChange={(e) => setObjective(e.target.value)}
                  className="intake-control intake-control--textarea w-full p-2.5 resize-none"
                />
              </div>
            </div>
          )}

          {/* TAB 2: EXISTING ASSET (BROWNFIELD) */}
          {activeTab === 'EXISTING' && (
            <div className="space-y-3.5">
              <div className="surface-inspector p-3 text-[var(--text-secondary)] space-y-1">
                <div className="font-semibold text-[var(--status-evidence)] flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5" />
                  <span>Existing Asset / Brownfield Structure Baseline</span>
                </div>
                <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed">
                  If this site contains an existing structure (e.g. operational hotel or commercial building), provide its facts to establish Baseline Scenario A and calculate expansion headroom.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block font-semibold text-[var(--text-secondary)]">
                    Existing Building GFA (m²) <span className="text-[var(--text-muted)] font-normal">(e.g. 3,760 m²)</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    placeholder="e.g. 3760"
                    value={existingBuildingGFA}
                    aria-label="Existing building GFA"
                    onChange={(e) => setExistingBuildingGFA(e.target.value)}
                    className="intake-control w-full px-3 py-2 font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block font-semibold text-[var(--text-secondary)]">
                    Existing Storeys / Floors <span className="text-[var(--text-muted)] font-normal">(Optional · leave blank if unknown)</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="50"
                    placeholder="e.g. 4 (leave blank if unconfirmed)"
                    value={existingFloors}
                    aria-label="Existing storeys"
                    onChange={(e) => setExistingFloors(e.target.value)}
                    className="intake-control w-full px-3 py-2 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block font-semibold text-[var(--text-secondary)]">Existing Asset Description</label>
                  <input
                    type="text"
                    placeholder="e.g. Operational Sharia Boutique Hotel"
                    value={existingAssetDescription}
                    onChange={(e) => setExistingAssetDescription(e.target.value)}
                    className="intake-control w-full px-3 py-2"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block font-semibold text-[var(--text-secondary)]">Current Operational Status</label>
                  <select
                    value={existingAssetStatus}
                    onChange={(e) => setExistingAssetStatus(e.target.value)}
                    className="intake-control w-full px-3 py-2"
                  >
                    <option value="Operational">Operational</option>
                    <option value="Vacant">Vacant / Ready for Conversion</option>
                    <option value="Underutilized">Partially Utilized / Brownfield</option>
                    <option value="Greenfield">Greenfield (Vacant Land)</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: PLANNING & ZONING */}
          {activeTab === 'ZONING' && (
            <div className="space-y-3.5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block font-semibold text-[var(--text-secondary)]">Zoning Code / Subzone</label>
                  <input
                    type="text"
                    placeholder="e.g. KT + K-1 (Commercial / Hospitality)"
                    value={zoneCode}
                    onChange={(e) => setZoneCode(e.target.value)}
                    className="intake-control w-full px-3 py-2"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block font-semibold text-[var(--text-secondary)]">Subzone Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Commercial / Hospitality"
                    value={zoneName}
                    onChange={(e) => setZoneName(e.target.value)}
                    className="intake-control w-full px-3 py-2"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="space-y-1">
                  <label className="block font-semibold text-[var(--text-secondary)]">
                    Max FAR / KLB <span className="text-[var(--text-muted)] font-normal">(e.g. 6.65)</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.05"
                    value={statutoryMaxFAR}
                    aria-label="Maximum FAR KLB"
                    onChange={(e) => setStatutoryMaxFAR(e.target.value)}
                    className="intake-control w-full px-3 py-2 font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block font-semibold text-[var(--text-secondary)]">
                    Max KDB % <span className="text-[var(--text-muted)] font-normal">(e.g. 55%)</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="1"
                    value={statutoryMaxCoveragePct}
                    aria-label="Maximum KDB percent"
                    onChange={(e) => setStatutoryMaxCoveragePct(e.target.value)}
                    className="intake-control w-full px-3 py-2 font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block font-semibold text-[var(--text-secondary)]">
                    Min KDH % <span className="text-[var(--text-muted)] font-normal">(e.g. 20%)</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="1"
                    value={statutoryMinKDHPct}
                    aria-label="Minimum KDH percent"
                    onChange={(e) => setStatutoryMinKDHPct(e.target.value)}
                    className="intake-control w-full px-3 py-2 font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block font-semibold text-[var(--text-secondary)]">Max Height (m)</label>
                  <input
                    type="number"
                    min="0"
                    max="300"
                    step="0.5"
                    placeholder="e.g. 48 (leave blank if unknown)"
                    value={statutoryMaxHeightMeters}
                    aria-label="Maximum height"
                    onChange={(e) => setStatutoryMaxHeightMeters(e.target.value)}
                    className="intake-control w-full px-3 py-2 font-mono"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="block font-semibold text-[var(--text-secondary)]">
                  Landscaped / Permeable Area (m²) <span className="text-[var(--text-muted)] font-normal">(required to demonstrate KDH)</span>
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="Leave blank when the KDH basis has not been measured"
                  value={landscapedPermeableAreaM2}
                  aria-label="Landscaped permeable area"
                  onChange={(e) => setLandscapedPermeableAreaM2(e.target.value)}
                  className="intake-control w-full px-3 py-2 font-mono"
                />
                <p className="text-[10px] text-[var(--text-muted)]">Unbuilt site area is reported separately and never substituted for landscaped/permeable area.</p>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="block font-semibold text-[var(--text-secondary)]">Front Setback (m)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    placeholder="e.g. 8 (standard assumption)"
                    value={setbackFront}
                    aria-label="Front setback"
                    onChange={(e) => setSetbackFront(e.target.value)}
                    className="intake-control w-full px-3 py-2 font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block font-semibold text-[var(--text-secondary)]">Rear Setback (m)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    placeholder="e.g. 5 (standard assumption)"
                    value={setbackRear}
                    aria-label="Rear setback"
                    onChange={(e) => setSetbackRear(e.target.value)}
                    className="intake-control w-full px-3 py-2 font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block font-semibold text-[var(--text-secondary)]">Side Setbacks (m)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    placeholder="e.g. 4 (standard assumption)"
                    value={setbackSide}
                    aria-label="Side setbacks"
                    onChange={(e) => setSetbackSide(e.target.value)}
                    className="intake-control w-full px-3 py-2 font-mono"
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: COMMERCIAL & VALUATION */}
          {activeTab === 'VALUATION' && (
            <div className="space-y-3.5">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2 space-y-1">
                  <label className="block font-semibold text-[var(--text-secondary)]">
                    Asking Price <span className="text-[var(--text-muted)] font-normal">(e.g. 125,290,000,000 / Rp 125.29B)</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    placeholder="e.g. 125290000000"
                    value={askingPriceAmount}
                    aria-label="Asking price"
                    onChange={(e) => setAskingPriceAmount(e.target.value)}
                    className="intake-control w-full px-3 py-2 font-mono"
                  />
                  {parsedPrice > 0 && (
                    <span className="text-[10px] text-[var(--status-assumed)] font-mono block">
                      {formatRupiahHelper(parsedPrice)}
                    </span>
                  )}
                </div>
                <div className="space-y-1">
                  <label className="block font-semibold text-[var(--text-secondary)]">Currency</label>
                  <select
                    value={askingPriceCurrency}
                    onChange={(e) => setAskingPriceCurrency(e.target.value)}
                    className="intake-control w-full px-3 py-2"
                  >
                    <option value="IDR">IDR (Rp)</option>
                    <option value="USD">USD ($)</option>
                    <option value="SGD">SGD (S$)</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="block font-semibold text-[var(--text-secondary)]">
                  Government Tax Benchmark / NJOP (IDR) <span className="text-[var(--text-muted)] font-normal">(e.g. Rp 104,405,760,000)</span>
                </label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  placeholder="e.g. 104405760000"
                  value={njopAmount}
                  aria-label="NJOP benchmark"
                  onChange={(e) => setNjopAmount(e.target.value)}
                  className="intake-control w-full px-3 py-2 font-mono"
                />
                {parsedNJOP > 0 && (
                  <span className="text-[10px] text-[var(--status-evidence)] font-mono block">
                    {formatRupiahHelper(parsedNJOP)}
                  </span>
                )}
              </div>

              <div className="space-y-1">
                <label className="block font-semibold text-[var(--text-secondary)]">Valuation Notes & Deal Terms</label>
                <textarea
                  rows={2}
                  placeholder="e.g. Target acquisition price equates to ~Rp 62.21M/m² land basis or Rp 9.35M/m² permissible statutory GFA basis."
                  value={valuationBasisNotes}
                  onChange={(e) => setValuationBasisNotes(e.target.value)}
                  className="intake-control intake-control--textarea w-full p-2.5 resize-none"
                />
              </div>
            </div>
          )}

          {/* LIVE METRIC SUMMARY CARD */}
          <div className="surface-inspector p-3 space-y-2">
            <div className="flex items-center justify-between text-[11px] font-semibold text-[var(--text-secondary)]">
              <div className="flex items-center gap-1.5 text-[var(--status-evidence)]">
                <Calculator className="w-3.5 h-3.5" />
                <span>Current Site &amp; Financial Figures</span>
              </div>
              <span className="status-badge status-badge--assumed !min-h-0 !px-1.5 !py-0.5 text-[10px]">
                PROVISIONAL
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 border-t border-[var(--border-subtle)] text-[11px]">
              <div>
                <span className="text-[10px] text-[var(--text-muted)] block">Site Area Basis</span>
                <span className="font-mono font-bold text-[var(--text-primary)]">{effectiveArea.toLocaleString()} m²</span>
              </div>
              <div>
                <span className="text-[10px] text-[var(--text-muted)] block">Max Permissible GFA</span>
                <span className="font-mono font-bold text-[var(--status-verified)]">{maxGFA.toLocaleString()} m²</span>
                <span className="text-[9px] text-[var(--text-muted)] block">({parsedFAR.toFixed(2)}x FAR)</span>
              </div>
              <div>
                <span className="text-[10px] text-[var(--text-muted)] block">Expansion Headroom</span>
                <span className="font-mono font-bold text-[var(--status-assumed)]">
                  {parsedExistingGFA > 0 ? `+${headroomGFA.toLocaleString()} m²` : `${maxGFA.toLocaleString()} m²`}
                </span>
                <span className="text-[9px] text-[var(--text-muted)] block">
                  {parsedExistingGFA > 0 ? `(Preserving ${parsedExistingGFA.toLocaleString()} m²)` : '(Greenfield)'}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-[var(--text-muted)] block">Derived Land Price</span>
                <span className="font-mono font-bold text-[var(--text-primary)]">
                  {pricePerM2 > 0 ? `Rp ${(pricePerM2 / 1e6).toFixed(1)}M/m²` : 'Unpriced'}
                </span>
                {parsedPrice > 0 && (
                  <span className="text-[9px] text-[var(--text-muted)] block">
                    (Rp {(parsedPrice / 1e9).toFixed(1)}B Total)
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Provenance & Local Storage Notice */}
          <div className="p-3 bg-[var(--status-assumed-surface)] border border-[var(--status-assumed)] rounded-[var(--radius-card)] flex items-start gap-2.5">
            <ShieldCheck className="w-4 h-4 text-[var(--status-assumed)] shrink-0 mt-0.5" />
            <div className="text-[11px] text-[var(--text-secondary)] leading-relaxed space-y-1">
              <div>
                <span className="font-semibold text-[var(--status-assumed)]">Input basis: Provided by the user and not yet confirmed. </span>
                Initial study envelopes are illustrative until confirmed by title documents or cadastral surveys.
              </div>
              <div className="text-[10px] text-[var(--text-secondary)] border-t border-[var(--border-default)] pt-1">
                ⚠️ Release 1 stores cases locally in this browser. Use synthetic test cases for exploration.
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="pt-3 border-t border-[var(--border-subtle)] flex items-center justify-between">
            <div className="text-[11px] text-[var(--text-secondary)]">
              {activeTab === 'SITE' && <span>Next: Existing Asset or Planning Limits →</span>}
              {activeTab === 'EXISTING' && <span>Next: Planning Limits →</span>}
              {activeTab === 'ZONING' && <span>Next: Commercial Valuation →</span>}
              {activeTab === 'VALUATION' && <span>Ready to prepare 3 development options</span>}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleClose}
                className="button-secondary px-4 py-2 text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="button-primary px-4 py-2 text-xs font-semibold shadow-md transition-transform active:scale-95 cursor-pointer flex items-center gap-1.5"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>{showPriorityConfirmation ? 'Confirm snapshot & create opportunity + 3 schemes' : 'Review Opportunity & 3 Schemes'}</span>
              </button>
            </div>
            <p className="col-span-full text-right text-[9px] text-[var(--text-muted)]">The review will identify the provider and model used. If no model is available, proposals are labelled study templates—not model-generated.</p>
          </div>
        </form>
      </div>
    </div>
  );
}
