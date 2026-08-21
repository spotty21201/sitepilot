'use client';

import React, { useState, useEffect, useRef } from 'react';
import { CreateCaseParams } from '@/lib/storage/case-repository';
import { X, Building2, ShieldCheck, Sparkles } from 'lucide-react';

interface NewCaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateCase: (params: CreateCaseParams) => void;
}

export function NewCaseModal({ isOpen, onClose, onCreateCase }: NewCaseModalProps) {
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('Jakarta');
  const [country] = useState('Indonesia');
  const [objective, setObjective] = useState('');
  const [askingPriceAmount, setAskingPriceAmount] = useState<string>('');
  const [askingPriceCurrency, setAskingPriceCurrency] = useState('IDR');
  const [grossSiteArea, setGrossSiteArea] = useState<string>('');
  const [frontageLength, setFrontageLength] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  const modalRef = useRef<HTMLDivElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        nameInputRef.current?.focus();
      }, 50);
    }
  }, [isOpen]);

  // Escape key and tab key handling
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }

      if (e.key === 'Tab') {
        const focusable = modalRef.current?.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (!focusable || focusable.length === 0) return;

        const firstElement = focusable[0];
        const lastElement = focusable[focusable.length - 1];

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
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedName = name.trim();
    const trimmedAddress = address.trim();
    const parsedArea = parseFloat(grossSiteArea);

    if (!trimmedName) {
      setError('Opportunity name is required.');
      return;
    }
    if (!trimmedAddress) {
      setError('Site address is required.');
      return;
    }

    // In accordance with PRD AC-01 and AC-02, default site area to 10,000 m² if omitted
    const effectiveArea = !isNaN(parsedArea) && parsedArea > 0 ? parsedArea : 10000;

    const parsedPrice = askingPriceAmount ? parseFloat(askingPriceAmount) : undefined;
    const parsedFrontage = frontageLength ? parseFloat(frontageLength) : undefined;

    onCreateCase({
      name: trimmedName,
      address: trimmedAddress,
      city: city.trim() || 'Jakarta',
      country: country.trim() || 'Indonesia',
      objective: objective.trim() || 'Evaluate site viability, development yield, and zoning envelope.',
      askingPriceAmount: parsedPrice && !isNaN(parsedPrice) ? parsedPrice : undefined,
      askingPriceCurrency,
      grossSiteArea: effectiveArea,
      frontageLength: parsedFrontage && !isNaN(parsedFrontage) ? parsedFrontage : undefined
    });

    // Reset form state
    setName('');
    setAddress('');
    setObjective('');
    setAskingPriceAmount('');
    setGrossSiteArea('');
    setFrontageLength('');
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="new-case-modal-title"
      onClick={onClose}
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
    >
      <div
        ref={modalRef}
        onClick={(e) => e.stopPropagation()}
        className="bg-[#121622] border border-[#2b3548] rounded-xl max-w-xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="p-4 border-b border-[#232938] flex items-center justify-between bg-[#161c2b]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#2563eb] to-[#38bdf8] flex items-center justify-center font-bold text-white shadow-md">
              <Building2 className="w-4 h-4" />
            </div>
            <div>
              <h3 id="new-case-modal-title" className="text-sm font-bold text-slate-100">
                New Opportunity Intake
              </h3>
              <p className="text-[11px] text-slate-400">
                Create a new due diligence case with verified provenance tracking.
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

        {/* Body Form */}
        <form onSubmit={handleSubmit} className="p-5 flex-1 overflow-y-auto space-y-4 text-xs">
          {error && (
            <div className="p-3 bg-rose-950/80 border border-rose-700 text-rose-200 rounded-lg text-xs font-medium">
              {error}
            </div>
          )}

          {/* Provenance & Local Storage Notice */}
          <div className="p-3 bg-[#161d2c] border border-[#26344d] rounded-lg flex items-start gap-2.5">
            <ShieldCheck className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div className="text-[11px] text-slate-300 leading-relaxed space-y-1">
              <div>
                <span className="font-semibold text-amber-300">Provenance: [USER_ENTERED_ASSUMPTION]. </span>
                Initial study envelopes are generated as illustrative study baselines until confirmed by title scans or cadastral surveys.
              </div>
              <div className="text-[10px] text-slate-400 border-t border-[#232f44] pt-1">
                ⚠️ Release 1 stores cases only in this browser using local storage. Cases are not account-synced, cross-device, shareable, or suitable for confidential live opportunity data. Use synthetic testing data only.
              </div>
            </div>
          </div>

          {/* Opportunity Name */}
          <div className="space-y-1">
            <label className="block font-semibold text-slate-300">
              Opportunity / Case Name <span className="text-rose-400">*</span>
            </label>
            <input
              ref={nameInputRef}
              type="text"
              required
              placeholder="e.g. Surabaya CBD Mixed-Use Parcel"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-[#0c0f17] border border-[#252f44] rounded-lg px-3 py-2 text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-[#38bdf8]"
            />
          </div>

          {/* Address & City */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2 space-y-1">
              <label className="block font-semibold text-slate-300">
                Site Address <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Jl. Pemuda No. 10"
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
          </div>

          {/* Initial Site Area & Frontage */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="block font-semibold text-slate-300">
                Initial Gross Land Area (m²) <span className="text-slate-500 font-normal">(Optional · Defaults to 10,000 m²)</span>
              </label>
              <input
                type="number"
                min="100"
                step="1"
                placeholder="e.g. 10000 (Defaults to 10,000)"
                value={grossSiteArea}
                onChange={(e) => setGrossSiteArea(e.target.value)}
                className="w-full bg-[#0c0f17] border border-[#252f44] rounded-lg px-3 py-2 text-slate-100 font-mono placeholder:text-slate-600 focus:outline-none focus:border-[#38bdf8]"
              />
            </div>
            <div className="space-y-1">
              <label className="block font-semibold text-slate-300">
                Frontage Width (meters) <span className="text-slate-500 font-normal">(Optional)</span>
              </label>
              <input
                type="number"
                min="5"
                step="0.5"
                placeholder="Auto-calculated if blank"
                value={frontageLength}
                onChange={(e) => setFrontageLength(e.target.value)}
                className="w-full bg-[#0c0f17] border border-[#252f44] rounded-lg px-3 py-2 text-slate-100 font-mono placeholder:text-slate-600 focus:outline-none focus:border-[#38bdf8]"
              />
            </div>
          </div>

          {/* Asking Price */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2 space-y-1">
              <label className="block font-semibold text-slate-300">
                Asking Price <span className="text-slate-500 font-normal">(Optional)</span>
              </label>
              <input
                type="number"
                min="0"
                step="1000000"
                placeholder="e.g. 250000000000"
                value={askingPriceAmount}
                onChange={(e) => setAskingPriceAmount(e.target.value)}
                className="w-full bg-[#0c0f17] border border-[#252f44] rounded-lg px-3 py-2 text-slate-100 font-mono placeholder:text-slate-600 focus:outline-none focus:border-[#38bdf8]"
              />
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

          {/* Planning Objective */}
          <div className="space-y-1">
            <label className="block font-semibold text-slate-300">
              Planning Objective & Commercial Intent <span className="text-slate-500 font-normal">(Optional)</span>
            </label>
            <textarea
              rows={2}
              placeholder="e.g. Assess yield feasibility for luxury residential development with lifestyle retail podium."
              value={objective}
              onChange={(e) => setObjective(e.target.value)}
              className="w-full bg-[#0c0f17] border border-[#252f44] rounded-lg p-2.5 text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-[#38bdf8] resize-none"
            />
          </div>

          {/* Actions */}
          <div className="pt-3 border-t border-[#232938] flex items-center justify-end gap-2.5">
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
              <span>Create Opportunity</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
