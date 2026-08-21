'use client';

import React, { useState, useEffect, useRef } from 'react';
import { CreateCaseParams } from '@/lib/storage/case-repository';
import { X, Building2, ShieldCheck, Sparkles, SlidersHorizontal, Calculator, Layers, FileSpreadsheet } from 'lucide-react';

interface NewCaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateCase: (params: CreateCaseParams) => void;
}

type IntakeTab = 'SITE' | 'EXISTING' | 'ZONING' | 'VALUATION';

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

  // Basic Site
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('Jakarta');
  const [country, setCountry] = useState('Indonesia');
  const [objective, setObjective] = useState('');
  const [grossSiteArea, setGrossSiteArea] = useState<string>('');
  const [frontageLength, setFrontageLength] = useState<string>('');

  // Existing Asset Facts
  const [existingBuildingGFA, setExistingBuildingGFA] = useState<string>('');
  const [existingFloors, setExistingFloors] = useState<string>('');
  const [existingAssetDescription, setExistingAssetDescription] = useState<string>('');
  const [existingAssetStatus, setExistingAssetStatus] = useState<string>('Operational');

  // Planning & Zoning Controls
  const [zoneCode, setZoneCode] = useState<string>('KT + K-1');
  const [zoneName, setZoneName] = useState<string>('Commercial / Hospitality');
  const [statutoryMaxFAR, setStatutoryMaxFAR] = useState<string>('6.65');
  const [statutoryMaxCoveragePct, setStatutoryMaxCoveragePct] = useState<string>('55');
  const [statutoryMinKDHPct, setStatutoryMinKDHPct] = useState<string>('20');
  const [statutoryMaxFloors, setStatutoryMaxFloors] = useState<string>('');
  const [statutoryMaxHeightMeters, setStatutoryMaxHeightMeters] = useState<string>('');
  const [setbackFront, setSetbackFront] = useState<string>('');
  const [setbackRear, setSetbackRear] = useState<string>('');
  const [setbackSide, setSetbackSide] = useState<string>('');

  // Commercial & Valuation
  const [askingPriceAmount, setAskingPriceAmount] = useState<string>('');
  const [askingPriceCurrency, setAskingPriceCurrency] = useState('IDR');
  const [njopAmount, setNjopAmount] = useState<string>('');
  const [valuationBasisNotes, setValuationBasisNotes] = useState<string>('');

  const [error, setError] = useState<string | null>(null);

  const modalRef = useRef<HTMLDivElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);

  const handleClose = React.useCallback(() => {
    setActiveTab('SITE');
    setError(null);
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

  const parsedArea = parseFloat(grossSiteArea) || 0;
  const effectiveArea = parsedArea > 0 ? parsedArea : 10000;
  const parsedFAR = parseFloat(statutoryMaxFAR) || 3.20;
  const maxGFA = Math.round(effectiveArea * parsedFAR);
  const parsedExistingGFA = parseFloat(existingBuildingGFA) || 0;
  const headroomGFA = parsedExistingGFA > 0 ? Math.max(0, maxGFA - parsedExistingGFA) : maxGFA;
  const parsedPrice = parseFloat(askingPriceAmount) || 0;
  const pricePerM2 = parsedPrice > 0 && effectiveArea > 0 ? Math.round(parsedPrice / effectiveArea) : 0;
  const parsedNJOP = parseFloat(njopAmount) || 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedName = name.trim();
    const trimmedAddress = address.trim();

    if (!trimmedName) {
      setError('Opportunity name is required.');
      setActiveTab('SITE');
      return;
    }
    if (!trimmedAddress) {
      setError('Site address is required.');
      setActiveTab('SITE');
      return;
    }

    const parsedFrontage = frontageLength.trim() ? parseFloat(frontageLength) : undefined;
    const parsedFloors = existingFloors.trim() ? parseInt(existingFloors, 10) : undefined;
    const parsedMaxCoverage = statutoryMaxCoveragePct.trim() ? parseFloat(statutoryMaxCoveragePct) : 55.0;
    const parsedMinKDH = statutoryMinKDHPct.trim() ? parseFloat(statutoryMinKDHPct) : 20.0;
    const parsedMaxFloors = statutoryMaxFloors.trim() ? parseInt(statutoryMaxFloors, 10) : undefined;
    const parsedMaxHeight = statutoryMaxHeightMeters.trim() ? parseFloat(statutoryMaxHeightMeters) : undefined;
    const parsedFrontSetback = setbackFront.trim() ? parseFloat(setbackFront) : undefined;
    const parsedRearSetback = setbackRear.trim() ? parseFloat(setbackRear) : undefined;
    const parsedSideSetback = setbackSide.trim() ? parseFloat(setbackSide) : undefined;
    const finalNJOP = njopAmount.trim() ? parseFloat(njopAmount) : undefined;

    onCreateCase({
      name: trimmedName,
      address: trimmedAddress,
      city: city.trim() || 'Jakarta',
      country: country.trim() || 'Indonesia',
      objective: objective.trim() || 'Evaluate site viability, development yield, and zoning envelope.',
      grossSiteArea: effectiveArea,
      frontageLength: parsedFrontage && !isNaN(parsedFrontage) ? parsedFrontage : undefined,
      
      // Existing Asset
      existingBuildingGFA: parsedExistingGFA > 0 ? parsedExistingGFA : undefined,
      existingFloors: parsedFloors && !isNaN(parsedFloors) && parsedFloors > 0 ? parsedFloors : undefined,
      existingAssetDescription: existingAssetDescription.trim() || undefined,
      existingAssetStatus: existingAssetStatus || 'Operational',

      // Planning & Zoning
      zoneCode: zoneCode.trim() || 'KT + K-1',
      zoneName: zoneName.trim() || 'Commercial / Hospitality',
      statutoryMaxFAR: parsedFAR,
      statutoryMaxCoveragePct: parsedMaxCoverage,
      statutoryMinKDHPct: parsedMinKDH,
      statutoryMaxFloors: parsedMaxFloors,
      statutoryMaxHeightMeters: parsedMaxHeight,
      setbackFront: parsedFrontSetback,
      setbackRear: parsedRearSetback,
      setbackSideLeft: parsedSideSetback,
      setbackSideRight: parsedSideSetback,

      // Valuation
      askingPriceAmount: parsedPrice > 0 ? parsedPrice : undefined,
      askingPriceCurrency,
      njopAmount: finalNJOP && !isNaN(finalNJOP) ? finalNJOP : undefined,
      valuationBasisNotes: valuationBasisNotes.trim() || undefined,
      provenanceType: 'USER_ENTERED_ASSUMPTION'
    });

    handleClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="new-case-modal-title"
      onClick={onClose}
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4"
    >
      <div
        ref={modalRef}
        onClick={(e) => e.stopPropagation()}
        className="bg-[#121622] border border-[#2b3548] rounded-xl max-w-2xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="p-4 border-b border-[#232938] flex items-center justify-between bg-[#161c2b]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#2563eb] to-[#38bdf8] flex items-center justify-center font-bold text-white shadow-md">
              <Building2 className="w-4 h-4" />
            </div>
            <div>
              <h3 id="new-case-modal-title" className="text-sm font-bold text-slate-100">
                New Opportunity Intake & Parameter Setup
              </h3>
              <p className="text-[11px] text-slate-400">
                Capture property facts, existing asset baseline, statutory zoning limits, and valuation benchmarks.
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

        {/* Tab Navigation */}
        <div className="grid grid-cols-4 gap-1 p-2 bg-[#0e121a] border-b border-[#232938] text-xs font-semibold">
          <button
            type="button"
            onClick={() => setActiveTab('SITE')}
            className={`py-2 px-2.5 rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'SITE' ? 'bg-[#2563eb] text-white shadow-md' : 'text-slate-400 hover:text-slate-200 hover:bg-[#182030]'
            }`}
          >
            <Building2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">1. Opportunity</span>
            <span className="sm:hidden">Site</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('EXISTING')}
            className={`py-2 px-2.5 rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'EXISTING' ? 'bg-[#2563eb] text-white shadow-md' : 'text-slate-400 hover:text-slate-200 hover:bg-[#182030]'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">2. Existing Asset</span>
            <span className="sm:hidden">Asset</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('ZONING')}
            className={`py-2 px-2.5 rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'ZONING' ? 'bg-[#2563eb] text-white shadow-md' : 'text-slate-400 hover:text-slate-200 hover:bg-[#182030]'
            }`}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">3. Planning Limits</span>
            <span className="sm:hidden">Zoning</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('VALUATION')}
            className={`py-2 px-2.5 rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'VALUATION' ? 'bg-[#2563eb] text-white shadow-md' : 'text-slate-400 hover:text-slate-200 hover:bg-[#182030]'
            }`}
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">4. Commercials</span>
            <span className="sm:hidden">Price</span>
          </button>
        </div>

        {/* Body Form */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-5 flex-1 overflow-y-auto space-y-4 text-xs">
          {error && (
            <div className="p-3 bg-rose-950/80 border border-rose-700 text-rose-200 rounded-lg text-xs font-medium">
              {error}
            </div>
          )}

          {/* TAB 1: SITE & BASIC IDENTITY */}
          {activeTab === 'SITE' && (
            <div className="space-y-3.5">
              <div className="space-y-1">
                <label className="block font-semibold text-slate-300">
                  Opportunity / Project Title <span className="text-rose-400">*</span>
                </label>
                <input
                  ref={nameInputRef}
                  type="text"
                  required
                  placeholder="e.g. Hotel Sofyan Betawi — Acquisition & Expansion"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-[#0c0f17] border border-[#252f44] rounded-lg px-3 py-2 text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-[#38bdf8]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div className="sm:col-span-2 space-y-1">
                  <label className="block font-semibold text-slate-300">
                    Site Address <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Jl. Cut Mutiah No. 9, Menteng"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    className="w-full bg-[#0c0f17] border border-[#252f44] rounded-lg px-3 py-2 text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-[#38bdf8]"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block font-semibold text-slate-300">City</label>
                  <input
                    type="text"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    className="w-full bg-[#0c0f17] border border-[#252f44] rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-[#38bdf8]"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block font-semibold text-slate-300">Country</label>
                  <input
                    type="text"
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                    className="w-full bg-[#0c0f17] border border-[#252f44] rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-[#38bdf8]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block font-semibold text-slate-300">
                    Gross Land Area (m²) <span className="text-slate-500 font-normal">(e.g. 2,014 m²)</span>
                  </label>
                  <input
                    type="number"
                    min="100"
                    step="1"
                    placeholder="e.g. 2014"
                    value={grossSiteArea}
                    onChange={(e) => setGrossSiteArea(e.target.value)}
                    className="w-full bg-[#0c0f17] border border-[#252f44] rounded-lg px-3 py-2 text-slate-100 font-mono placeholder:text-slate-600 focus:outline-none focus:border-[#38bdf8]"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block font-semibold text-slate-300">
                    Primary Frontage Width (m) <span className="text-slate-500 font-normal">(e.g. 40m)</span>
                  </label>
                  <input
                    type="number"
                    min="5"
                    step="0.5"
                    placeholder="e.g. 40.0"
                    value={frontageLength}
                    onChange={(e) => setFrontageLength(e.target.value)}
                    className="w-full bg-[#0c0f17] border border-[#252f44] rounded-lg px-3 py-2 text-slate-100 font-mono placeholder:text-slate-600 focus:outline-none focus:border-[#38bdf8]"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="block font-semibold text-slate-300">
                  Development Intent / Investment Thesis
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Evaluate acquisition yield, operational continuity, and 10,000 m² phased lifestyle expansion feasibility."
                  value={objective}
                  onChange={(e) => setObjective(e.target.value)}
                  className="w-full bg-[#0c0f17] border border-[#252f44] rounded-lg p-2.5 text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-[#38bdf8] resize-none"
                />
              </div>
            </div>
          )}

          {/* TAB 2: EXISTING ASSET (BROWNFIELD) */}
          {activeTab === 'EXISTING' && (
            <div className="space-y-3.5">
              <div className="p-3 bg-[#161d2c] border border-[#26344d] rounded-lg text-slate-300 space-y-1">
                <div className="font-semibold text-blue-300 flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5" />
                  <span>Existing Asset / Brownfield Structure Baseline</span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  If this site contains an existing structure (e.g. operational hotel or commercial building), provide its facts to establish Baseline Scenario A and calculate expansion headroom.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block font-semibold text-slate-300">
                    Existing Building GFA (m²) <span className="text-slate-500 font-normal">(e.g. 3,760 m²)</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    placeholder="e.g. 3760"
                    value={existingBuildingGFA}
                    onChange={(e) => setExistingBuildingGFA(e.target.value)}
                    className="w-full bg-[#0c0f17] border border-[#252f44] rounded-lg px-3 py-2 text-slate-100 font-mono placeholder:text-slate-600 focus:outline-none focus:border-[#38bdf8]"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block font-semibold text-slate-300">
                    Existing Storeys / Floors <span className="text-slate-500 font-normal">(Optional · leave blank if unknown)</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="50"
                    placeholder="e.g. 4 (leave blank if unconfirmed)"
                    value={existingFloors}
                    onChange={(e) => setExistingFloors(e.target.value)}
                    className="w-full bg-[#0c0f17] border border-[#252f44] rounded-lg px-3 py-2 text-slate-100 font-mono placeholder:text-slate-600 focus:outline-none focus:border-[#38bdf8]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block font-semibold text-slate-300">Existing Asset Description</label>
                  <input
                    type="text"
                    placeholder="e.g. Operational Sharia Boutique Hotel"
                    value={existingAssetDescription}
                    onChange={(e) => setExistingAssetDescription(e.target.value)}
                    className="w-full bg-[#0c0f17] border border-[#252f44] rounded-lg px-3 py-2 text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-[#38bdf8]"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block font-semibold text-slate-300">Current Operational Status</label>
                  <select
                    value={existingAssetStatus}
                    onChange={(e) => setExistingAssetStatus(e.target.value)}
                    className="w-full bg-[#0c0f17] border border-[#252f44] rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-[#38bdf8]"
                  >
                    <option value="Operational">Operational (Cash-flowing)</option>
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
                  <label className="block font-semibold text-slate-300">Zoning Code / Subzone</label>
                  <input
                    type="text"
                    placeholder="e.g. KT + K-1 (Commercial / Hospitality)"
                    value={zoneCode}
                    onChange={(e) => setZoneCode(e.target.value)}
                    className="w-full bg-[#0c0f17] border border-[#252f44] rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-[#38bdf8]"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block font-semibold text-slate-300">Subzone Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Commercial / Hospitality"
                    value={zoneName}
                    onChange={(e) => setZoneName(e.target.value)}
                    className="w-full bg-[#0c0f17] border border-[#252f44] rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-[#38bdf8]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                <div className="space-y-1">
                  <label className="block font-semibold text-slate-300">
                    Max FAR / KLB <span className="text-slate-500 font-normal">(e.g. 6.65)</span>
                  </label>
                  <input
                    type="number"
                    min="0.5"
                    step="0.05"
                    value={statutoryMaxFAR}
                    onChange={(e) => setStatutoryMaxFAR(e.target.value)}
                    className="w-full bg-[#0c0f17] border border-[#252f44] rounded-lg px-3 py-2 text-slate-100 font-mono focus:outline-none focus:border-[#38bdf8]"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block font-semibold text-slate-300">
                    Max KDB % <span className="text-slate-500 font-normal">(e.g. 55%)</span>
                  </label>
                  <input
                    type="number"
                    min="10"
                    max="100"
                    step="1"
                    value={statutoryMaxCoveragePct}
                    onChange={(e) => setStatutoryMaxCoveragePct(e.target.value)}
                    className="w-full bg-[#0c0f17] border border-[#252f44] rounded-lg px-3 py-2 text-slate-100 font-mono focus:outline-none focus:border-[#38bdf8]"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block font-semibold text-slate-300">
                    Min KDH % <span className="text-slate-500 font-normal">(e.g. 20%)</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="1"
                    value={statutoryMinKDHPct}
                    onChange={(e) => setStatutoryMinKDHPct(e.target.value)}
                    className="w-full bg-[#0c0f17] border border-[#252f44] rounded-lg px-3 py-2 text-slate-100 font-mono focus:outline-none focus:border-[#38bdf8]"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block font-semibold text-slate-300">Max Floors</label>
                  <input
                    type="number"
                    min="1"
                    max="80"
                    placeholder="e.g. 14 (leave blank if unknown)"
                    value={statutoryMaxFloors}
                    onChange={(e) => setStatutoryMaxFloors(e.target.value)}
                    className="w-full bg-[#0c0f17] border border-[#252f44] rounded-lg px-3 py-2 text-slate-100 font-mono placeholder:text-slate-600 focus:outline-none focus:border-[#38bdf8]"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block font-semibold text-slate-300">Max Height (m)</label>
                  <input
                    type="number"
                    min="3"
                    max="300"
                    step="0.5"
                    placeholder="e.g. 48 (leave blank if unknown)"
                    value={statutoryMaxHeightMeters}
                    onChange={(e) => setStatutoryMaxHeightMeters(e.target.value)}
                    className="w-full bg-[#0c0f17] border border-[#252f44] rounded-lg px-3 py-2 text-slate-100 font-mono placeholder:text-slate-600 focus:outline-none focus:border-[#38bdf8]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="block font-semibold text-slate-300">Front Setback (m)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    placeholder="e.g. 8 (standard assumption)"
                    value={setbackFront}
                    onChange={(e) => setSetbackFront(e.target.value)}
                    className="w-full bg-[#0c0f17] border border-[#252f44] rounded-lg px-3 py-2 text-slate-100 font-mono placeholder:text-slate-600 focus:outline-none focus:border-[#38bdf8]"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block font-semibold text-slate-300">Rear Setback (m)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    placeholder="e.g. 5 (standard assumption)"
                    value={setbackRear}
                    onChange={(e) => setSetbackRear(e.target.value)}
                    className="w-full bg-[#0c0f17] border border-[#252f44] rounded-lg px-3 py-2 text-slate-100 font-mono placeholder:text-slate-600 focus:outline-none focus:border-[#38bdf8]"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block font-semibold text-slate-300">Side Setbacks (m)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    placeholder="e.g. 4 (standard assumption)"
                    value={setbackSide}
                    onChange={(e) => setSetbackSide(e.target.value)}
                    className="w-full bg-[#0c0f17] border border-[#252f44] rounded-lg px-3 py-2 text-slate-100 font-mono placeholder:text-slate-600 focus:outline-none focus:border-[#38bdf8]"
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
                  <label className="block font-semibold text-slate-300">
                    Asking Price <span className="text-slate-500 font-normal">(e.g. 125,290,000,000 / Rp 125.29B)</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    placeholder="e.g. 125290000000"
                    value={askingPriceAmount}
                    onChange={(e) => setAskingPriceAmount(e.target.value)}
                    className="w-full bg-[#0c0f17] border border-[#252f44] rounded-lg px-3 py-2 text-slate-100 font-mono placeholder:text-slate-600 focus:outline-none focus:border-[#38bdf8]"
                  />
                  {parsedPrice > 0 && (
                    <span className="text-[10px] text-amber-400 font-mono block">
                      {formatRupiahHelper(parsedPrice)}
                    </span>
                  )}
                </div>
                <div className="space-y-1">
                  <label className="block font-semibold text-slate-300">Currency</label>
                  <select
                    value={askingPriceCurrency}
                    onChange={(e) => setAskingPriceCurrency(e.target.value)}
                    className="w-full bg-[#0c0f17] border border-[#252f44] rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-[#38bdf8]"
                  >
                    <option value="IDR">IDR (Rp)</option>
                    <option value="USD">USD ($)</option>
                    <option value="SGD">SGD (S$)</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="block font-semibold text-slate-300">
                  Government Tax Benchmark / NJOP (IDR) <span className="text-slate-500 font-normal">(e.g. Rp 104,405,760,000)</span>
                </label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  placeholder="e.g. 104405760000"
                  value={njopAmount}
                  onChange={(e) => setNjopAmount(e.target.value)}
                  className="w-full bg-[#0c0f17] border border-[#252f44] rounded-lg px-3 py-2 text-slate-100 font-mono placeholder:text-slate-600 focus:outline-none focus:border-[#38bdf8]"
                />
                {parsedNJOP > 0 && (
                  <span className="text-[10px] text-sky-400 font-mono block">
                    {formatRupiahHelper(parsedNJOP)}
                  </span>
                )}
              </div>

              <div className="space-y-1">
                <label className="block font-semibold text-slate-300">Valuation Notes & Deal Terms</label>
                <textarea
                  rows={2}
                  placeholder="e.g. Target acquisition price equates to ~Rp 62.21M/m² land basis or Rp 9.35M/m² permissible statutory GFA basis."
                  value={valuationBasisNotes}
                  onChange={(e) => setValuationBasisNotes(e.target.value)}
                  className="w-full bg-[#0c0f17] border border-[#252f44] rounded-lg p-2.5 text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-[#38bdf8] resize-none"
                />
              </div>
            </div>
          )}

          {/* LIVE METRIC SUMMARY CARD */}
          <div className="p-3 bg-[#0d1017] border border-[#222b3d] rounded-xl space-y-2">
            <div className="flex items-center justify-between text-[11px] font-semibold text-slate-300">
              <div className="flex items-center gap-1.5 text-[#38bdf8]">
                <Calculator className="w-3.5 h-3.5" />
                <span>Live Intake Yield & Financial Synthesis</span>
              </div>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-blue-950/80 border border-blue-800/60 text-blue-300">
                PROVISIONAL
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 border-t border-[#1d2536] text-[11px]">
              <div>
                <span className="text-[10px] text-slate-500 block">Site Area Basis</span>
                <span className="font-mono font-bold text-slate-200">{effectiveArea.toLocaleString()} m²</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 block">Max Permissible GFA</span>
                <span className="font-mono font-bold text-emerald-400">{maxGFA.toLocaleString()} m²</span>
                <span className="text-[9px] text-slate-500 block">({parsedFAR.toFixed(2)}x FAR)</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 block">Expansion Headroom</span>
                <span className="font-mono font-bold text-amber-300">
                  {parsedExistingGFA > 0 ? `+${headroomGFA.toLocaleString()} m²` : `${maxGFA.toLocaleString()} m²`}
                </span>
                <span className="text-[9px] text-slate-500 block">
                  {parsedExistingGFA > 0 ? `(Preserving ${parsedExistingGFA.toLocaleString()} m²)` : '(Greenfield)'}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 block">Derived Land Price</span>
                <span className="font-mono font-bold text-slate-200">
                  {pricePerM2 > 0 ? `Rp ${(pricePerM2 / 1e6).toFixed(1)}M/m²` : 'Unpriced'}
                </span>
                {parsedPrice > 0 && (
                  <span className="text-[9px] text-slate-500 block">
                    (Rp {(parsedPrice / 1e9).toFixed(1)}B Total)
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Provenance & Local Storage Notice */}
          <div className="p-3 bg-[#161d2c] border border-[#26344d] rounded-lg flex items-start gap-2.5">
            <ShieldCheck className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div className="text-[11px] text-slate-300 leading-relaxed space-y-1">
              <div>
                <span className="font-semibold text-amber-300">Provenance: [USER_ENTERED_ASSUMPTION]. </span>
                Initial study envelopes are generated as illustrative study baselines until confirmed by title scans or cadastral surveys.
              </div>
              <div className="text-[10px] text-slate-400 border-t border-[#232f44] pt-1">
                ⚠️ Release 1 stores cases locally in this browser. Use synthetic test cases for exploration.
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="pt-3 border-t border-[#232938] flex items-center justify-between">
            <div className="text-[11px] text-slate-400">
              {activeTab === 'SITE' && <span>Next: Existing Asset or Planning Limits →</span>}
              {activeTab === 'EXISTING' && <span>Next: Planning Limits →</span>}
              {activeTab === 'ZONING' && <span>Next: Commercial Valuation →</span>}
              {activeTab === 'VALUATION' && <span>Ready to initialize 3 parametric schemes</span>}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-[#161c28] hover:bg-[#202838] text-slate-300 rounded-lg text-xs font-semibold border border-[#273247] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-[#2563eb] hover:bg-[#1d4ed8] text-white rounded-lg text-xs font-semibold shadow-md transition-all active:scale-95 cursor-pointer flex items-center gap-1.5"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Create Opportunity & 3 Schemes</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

