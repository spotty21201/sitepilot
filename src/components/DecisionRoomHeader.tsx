'use client';

import React, { useState } from 'react';
import { Project, CaseSummary } from '@/types';
import { 
  MapPin, 
  CheckCircle, 
  AlertCircle, 
  ShieldCheck, 
  ChevronDown, 
  Plus, 
  RotateCcw,
  Sparkles,
  HelpCircle,
  FileCheck,
  Trash2
} from 'lucide-react';

interface DecisionRoomHeaderProps {
  project: Project;
  cases?: CaseSummary[];
  activeCaseId?: string;
  onSelectCase?: (id: string) => void;
  onOpenNewCaseModal?: () => void;
  onResetDemo?: () => void;
  onDeleteCase?: (id: string) => void;
}

export function DecisionRoomHeader({
  project,
  cases = [],
  activeCaseId = project.id,
  onSelectCase,
  onOpenNewCaseModal,
  onResetDemo,
  onDeleteCase
}: DecisionRoomHeaderProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const getRecommendationBadge = (status: Project['recommendation']) => {
    switch (status) {
      case 'PROCEED':
        return (
          <span className="px-2.5 py-0.5 bg-emerald-950/80 border border-emerald-500 text-emerald-300 font-semibold text-[11px] rounded-full flex items-center gap-1 shadow-sm">
            <CheckCircle className="w-3 h-3" /> PROCEED
          </span>
        );
      case 'CONDITIONAL_PROCEED':
        return (
          <span className="px-2.5 py-0.5 bg-amber-950/80 border border-amber-500 text-amber-300 font-semibold text-[11px] rounded-full flex items-center gap-1 shadow-sm">
            <AlertCircle className="w-3 h-3" /> CONDITIONAL PROCEED
          </span>
        );
      case 'INVESTIGATE':
        return (
          <span className="px-2.5 py-0.5 bg-sky-950/80 border border-sky-500 text-sky-300 font-semibold text-[11px] rounded-full flex items-center gap-1 shadow-sm">
            <Sparkles className="w-3 h-3" /> INVESTIGATE
          </span>
        );
      case 'HOLD':
      case 'DO_NOT_PROCEED':
        return (
          <span className="px-2.5 py-0.5 bg-rose-950/80 border border-rose-600 text-rose-300 font-semibold text-[11px] rounded-full flex items-center gap-1">
            HOLD
          </span>
        );
      default:
        return null;
    }
  };

  const formatPriceInfo = () => {
    if (!project.askingPrice?.amount) return null;
    const amt = project.askingPrice.amount;
    const curr = project.askingPrice.currency || 'IDR';
    const area = project.site.grossSiteArea;
    const pricePerM2 = area > 0 ? amt / area : 0;
    
    let formattedTotal = '';
    if (curr === 'IDR') {
      if (amt >= 1e12) formattedTotal = `Rp ${(amt / 1e12).toFixed(1)}T`;
      else if (amt >= 1e9) formattedTotal = `Rp ${(amt / 1e9).toFixed(1)}B`;
      else if (amt >= 1e6) formattedTotal = `Rp ${(amt / 1e6).toFixed(1)}M`;
      else formattedTotal = `Rp ${amt.toLocaleString()}`;
    } else {
      formattedTotal = `${curr} ${amt.toLocaleString()}`;
    }

    let formattedPerM2 = '';
    if (curr === 'IDR') {
      if (pricePerM2 >= 1e6) formattedPerM2 = `~Rp ${(pricePerM2 / 1e6).toFixed(1)}M/m²`;
      else formattedPerM2 = `~Rp ${Math.round(pricePerM2).toLocaleString()}/m²`;
    } else {
      formattedPerM2 = `~${curr} ${Math.round(pricePerM2).toLocaleString()}/m²`;
    }

    return `Asking: ${formattedTotal} (${formattedPerM2})`;
  };

  const priceText = formatPriceInfo();

  return (
    <header className="h-16 bg-[#0f121a] border-b border-[#232938] px-4 lg:px-6 flex items-center justify-between shrink-0 z-30">
      {/* Left: App Identity, Case Switcher & Project Title */}
      <div className="flex items-center gap-3 lg:gap-4 min-w-0">
        <div className="flex items-center gap-2 pr-3 lg:pr-4 border-r border-[#232938] shrink-0">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#2563eb] to-[#38bdf8] flex items-center justify-center font-bold text-white shadow-md">
            SP
          </div>
          <div className="hidden sm:block">
            <h1 className="text-sm font-bold text-slate-100 tracking-tight">SitePilot</h1>
            <span className="text-[10px] text-slate-400 block font-mono">DECISION ROOM</span>
          </div>
        </div>

        {/* Case Switcher Dropdown */}
        <div className="relative">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              aria-label="Select Opportunity Case"
              aria-haspopup="listbox"
              aria-expanded={dropdownOpen}
              className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-[#151a27] hover:bg-[#1c2333] border border-[#273248] text-slate-200 text-xs font-semibold transition-all cursor-pointer max-w-[220px] lg:max-w-[280px]"
            >
              <span className="truncate">{project.name}</span>
              {project.isTemplate && (
                <span className="px-1.5 py-0.2 rounded text-[9px] font-mono bg-purple-950 text-purple-300 border border-purple-700 shrink-0">
                  DEMO
                </span>
              )}
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0 ml-auto" />
            </button>

            {onOpenNewCaseModal && (
              <button
                onClick={onOpenNewCaseModal}
                title="Create New Opportunity"
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#2563eb] hover:bg-[#1d4ed8] text-white text-xs font-semibold shadow-sm transition-all active:scale-95 cursor-pointer shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                <span className="hidden md:inline">New Opportunity</span>
              </button>
            )}
          </div>

          {/* Dropdown Menu */}
          {dropdownOpen && (
            <>
              <div 
                className="fixed inset-0 z-40" 
                onClick={() => setDropdownOpen(false)} 
              />
              <div className="absolute left-0 top-full mt-1.5 w-72 bg-[#121622] border border-[#2b3548] rounded-xl shadow-2xl z-50 p-1.5 space-y-1">
                <div className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Saved Opportunities ({cases.length})
                </div>

                <div className="max-h-60 overflow-y-auto space-y-0.5">
                  {cases.map((c) => {
                    const isSelected = c.id === activeCaseId;
                    return (
                      <div
                        key={c.id}
                        className={`group w-full px-2.5 py-2 rounded-lg text-xs transition-colors flex items-center justify-between ${
                          isSelected 
                            ? 'bg-[#2563eb]/20 text-[#38bdf8] font-bold border border-[#38bdf8]/40' 
                            : 'text-slate-300 hover:bg-[#1a2130] hover:text-white'
                        }`}
                      >
                        <button
                          onClick={() => {
                            onSelectCase?.(c.id);
                            setDropdownOpen(false);
                          }}
                          className="min-w-0 flex-1 text-left cursor-pointer pr-2"
                        >
                          <div className="truncate font-medium">{c.name}</div>
                          <div className="text-[10px] text-slate-400 truncate font-normal">
                            {c.grossSiteArea.toLocaleString()} m² · {c.address}
                          </div>
                        </button>
                        <div className="flex items-center gap-1 shrink-0">
                          {c.isTemplate ? (
                            <span className="px-1.5 py-0.5 rounded text-[8px] font-mono bg-purple-950 text-purple-300 border border-purple-800">
                              DEMO
                            </span>
                          ) : onDeleteCase ? (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onDeleteCase(c.id);
                              }}
                              title={`Delete ${c.name}`}
                              aria-label={`Delete ${c.name}`}
                              className="p-1 text-slate-500 hover:text-rose-400 hover:bg-rose-950/40 rounded transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="pt-1.5 border-t border-[#232938] flex items-center justify-between gap-1">
                  {onOpenNewCaseModal && (
                    <button
                      onClick={() => {
                        setDropdownOpen(false);
                        onOpenNewCaseModal();
                      }}
                      className="flex-1 flex items-center justify-center gap-1 py-1.5 px-2 rounded-md bg-[#1e2738] hover:bg-[#26334a] text-sky-400 text-xs font-semibold cursor-pointer"
                    >
                      <Plus className="w-3 h-3" />
                      <span>New Opportunity</span>
                    </button>
                  )}

                  {onResetDemo && (
                    <button
                      onClick={() => {
                        setDropdownOpen(false);
                        onResetDemo();
                      }}
                      title="Reset Demo to Original Dataset"
                      className="flex items-center justify-center gap-1 py-1.5 px-2 rounded-md bg-[#1e2738] hover:bg-[#26334a] text-slate-300 text-xs font-semibold cursor-pointer"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>Reset Demo</span>
                    </button>
                  )}
                </div>

                <div className="px-2 py-1 text-[9px] text-slate-500 border-t border-[#232938] leading-tight">
                  🔒 Local browser storage only (not account-synced).
                </div>
              </div>
            </>
          )}
        </div>

        {/* Project Meta Subheader */}
        <div className="hidden xl:flex items-center gap-3 text-xs text-slate-400">
          <span className="flex items-center gap-1 truncate max-w-[200px]">
            <MapPin className="w-3.5 h-3.5 text-slate-500 shrink-0" />
            <span className="truncate">{project.location.address}</span>
          </span>
          {priceText && (
            <>
              <span className="font-mono text-slate-600">|</span>
              <span className="text-slate-300 font-mono">{priceText}</span>
            </>
          )}
          {project.areaProvenance && (
            <>
              <span className="font-mono text-slate-600">|</span>
              <span className="inline-flex items-center gap-1 text-[10px] font-mono text-amber-300 bg-amber-950/60 border border-amber-800/60 px-1.5 py-0.5 rounded">
                {project.areaProvenance.sourceType === 'VERIFIED_TITLE' ? (
                  <FileCheck className="w-2.5 h-2.5 text-emerald-400" />
                ) : (
                  <HelpCircle className="w-2.5 h-2.5 text-amber-400" />
                )}
                <span>{project.site.grossSiteArea.toLocaleString()} m² ({project.areaProvenance.sourceType.replace(/_/g, ' ')})</span>
              </span>
            </>
          )}
        </div>
      </div>

      {/* Right: Recommendation Status, Confidence & Readiness */}
      <div className="flex items-center gap-3 lg:gap-5 shrink-0">
        <div className="hidden sm:block">
          {getRecommendationBadge(project.recommendation)}
        </div>

        {/* Readiness Meter */}
        <div className="hidden md:flex items-center gap-2 bg-[#161a26] px-3 py-1.5 rounded-lg border border-[#273044]">
          <span className="text-[11px] text-slate-400">Site Readiness</span>
          <div className="w-16 lg:w-20 bg-slate-800 h-2 rounded-full overflow-hidden">
            <div 
              className="bg-gradient-to-r from-sky-400 to-emerald-400 h-full rounded-full" 
              style={{ width: `${project.siteReadinessPercentage}%` }}
            />
          </div>
          <span className="text-xs font-bold text-slate-200 font-mono">{project.siteReadinessPercentage}%</span>
        </div>

        {/* Evidence Confidence */}
        <div className="flex items-center gap-1.5 bg-[#161a26] px-2.5 lg:px-3 py-1.5 rounded-lg border border-[#273044] text-xs">
          <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
          <span className="text-slate-400 hidden sm:inline">Confidence:</span>
          <span className="font-semibold text-amber-300 uppercase font-mono text-[11px]">{project.evidenceConfidence}</span>
        </div>
      </div>
    </header>
  );
}
