'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
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
  Trash2,
  Box,
  PencilRuler,
  LoaderCircle,
  BookOpen,
} from 'lucide-react';

interface DecisionRoomHeaderProps {
  project: Project;
  cases?: CaseSummary[];
  activeCaseId?: string;
  onSelectCase?: (id: string) => void;
  onOpenNewCaseModal?: () => void;
  onResetDemo?: () => void;
  onDeleteCase?: (id: string) => void;
  onOpenOpportunityInputs?: () => void;
  onOpenSpatialLab?: () => void;
  isSpatialLabOpening?: boolean;
}

function areaBasisLabel(sourceType: string): string {
  if (sourceType === 'VERIFIED_TITLE') return 'Confirmed title information';
  if (sourceType === 'USER_ENTERED_ASSUMPTION') return 'Provided by user';
  return sourceType.replace(/_/g, ' ').toLowerCase();
}

function checkStatusLabel(status: Project['evidenceConfidence']): string {
  switch (status) {
    case 'HIGH': return 'Confirmed';
    case 'MEDIUM': return 'Review advised';
    case 'LOW': return 'Limited';
    default: return 'Not confirmed';
  }
}

export function DecisionRoomHeader({
  project,
  cases = [],
  activeCaseId = project.id,
  onSelectCase,
  onOpenNewCaseModal,
  onResetDemo,
  onDeleteCase,
  onOpenOpportunityInputs,
  onOpenSpatialLab,
  isSpatialLabOpening = false,
}: DecisionRoomHeaderProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false);

  useEffect(() => {
    if (!dropdownOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setDropdownOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [dropdownOpen]);

  const getRecommendationBadge = (status: Project['recommendation']) => {
    switch (status) {
      case 'PROCEED':
        return (
          <span className="status-badge status-badge--verified">
            <CheckCircle className="w-3 h-3" /> PROCEED
          </span>
        );
      case 'CONDITIONAL_PROCEED':
        return (
          <span className="status-badge status-badge--warning">
            <AlertCircle className="w-3 h-3" /> CONDITIONAL PROCEED
          </span>
        );
      case 'INVESTIGATE':
        return (
          <span className="status-badge status-badge--investigation">
            <Sparkles className="w-3 h-3" /> INVESTIGATE
          </span>
        );
      case 'HOLD':
      case 'DO_NOT_PROCEED':
        return (
          <span className="status-badge status-badge--error">
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
    <header className="h-16 bg-[var(--bg-primary)] border-b border-[var(--border-subtle)] px-4 lg:px-6 flex items-center justify-between shrink-0 z-30">
      {/* Left: App Identity, Case Switcher & Project Title */}
      <div className="flex items-center gap-3 lg:gap-4 min-w-0">
        <div className="flex items-center gap-2 pr-3 lg:pr-4 border-r border-[var(--border-subtle)] shrink-0">
          <div className="w-8 h-8 rounded-[var(--radius-card)] bg-[var(--action-primary)] text-[#101316] flex items-center justify-center font-bold">
            SP
          </div>
          <div className="hidden sm:block">
            <h1 className="type-page-title">SitePilot</h1>
            <span className="type-metadata block uppercase">Decision Room</span>
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
              className="button-secondary flex items-center gap-2 px-2.5 py-1.5 text-xs font-semibold transition-colors cursor-pointer max-w-[220px] lg:max-w-[280px]"
            >
              <span className="truncate">{project.name}</span>
              {project.isTemplate && (
                <span className="status-badge status-badge--investigation !min-h-0 !px-1.5 !py-0.5 text-[9px] shrink-0">
                  DEMO
                </span>
              )}
              <ChevronDown className="w-3.5 h-3.5 text-[var(--text-muted)] shrink-0 ml-auto" />
            </button>

            {onOpenNewCaseModal && (
              <button
                onClick={onOpenNewCaseModal}
                title="Create New Opportunity"
                className="button-primary flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold transition-colors cursor-pointer shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                <span className="hidden md:inline">New Opportunity</span>
              </button>
            )}
            {onOpenOpportunityInputs && (
              <button
                type="button"
                onClick={onOpenOpportunityInputs}
                title="Edit opportunity and planning inputs"
                className="button-secondary flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold"
              >
                <PencilRuler className="h-3.5 w-3.5" />
                <span className="hidden xl:inline">Edit Inputs</span>
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
              <div className="absolute left-0 top-full mt-1.5 w-72 bg-[var(--bg-tertiary)] border border-[var(--border-default)] rounded-[var(--radius-card)] shadow-[var(--shadow-elevated)] z-50 p-1.5 space-y-1">
                <div className="px-2.5 py-1 type-metadata uppercase">
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
                            ? 'bg-[var(--action-primary-surface)] text-[var(--status-evidence)] font-bold border border-[color-mix(in_srgb,var(--action-primary)_55%,transparent)]'
                            : 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]'
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
                          <div className="text-[10px] text-[var(--text-muted)] truncate font-normal">
                            {c.grossSiteArea.toLocaleString()} m² · {c.address}
                          </div>
                        </button>
                        <div className="flex items-center gap-1 shrink-0">
                          {c.isTemplate ? (
                            <span className="status-badge status-badge--investigation !min-h-0 !px-1.5 !py-0.5 text-[8px]">
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
                              className="p-1 text-[var(--text-muted)] hover:text-[var(--status-error)] hover:bg-[var(--status-error-surface)] rounded-[var(--radius-control)] transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="pt-1.5 border-t border-[var(--border-subtle)] flex items-center justify-between gap-1">
                  {onOpenNewCaseModal && (
                    <button
                      onClick={() => {
                        setDropdownOpen(false);
                        onOpenNewCaseModal();
                      }}
                      className="button-secondary flex-1 flex items-center justify-center gap-1 py-1.5 px-2 text-[var(--status-evidence)] text-xs font-semibold cursor-pointer"
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
                      className="button-secondary flex items-center justify-center gap-1 py-1.5 px-2 text-xs font-semibold cursor-pointer"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>Reset Demo</span>
                    </button>
                  )}
                </div>

                <div className="px-2 py-1 text-[9px] text-[var(--text-muted)] border-t border-[var(--border-subtle)] leading-tight">
                  🔒 Local browser storage only (not account-synced).
                </div>
              </div>
            </>
          )}
        </div>

        {/* Project Meta Subheader */}
        <div className="hidden 2xl:flex items-center gap-3 text-xs text-[var(--text-muted)]">
          <span className="flex items-center gap-1 truncate max-w-[200px]">
            <MapPin className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">{project.location.address}</span>
          </span>
          {priceText && (
            <>
              <span className="font-mono text-[var(--border-strong)]">|</span>
              <span className="text-[var(--text-secondary)] font-mono">{priceText}</span>
            </>
          )}
          {project.areaProvenance && (
            <>
              <span className="font-mono text-[var(--border-strong)]">|</span>
              <span className="status-badge status-badge--assumed !min-h-0 !rounded-[var(--radius-control)] !px-1.5 !py-0.5">
                {project.areaProvenance.sourceType === 'VERIFIED_TITLE' ? (
                  <FileCheck className="w-2.5 h-2.5 text-[var(--status-verified)]" />
                ) : (
                  <HelpCircle className="w-2.5 h-2.5 text-[var(--status-assumed)]" />
                )}
                <span>{project.site.grossSiteArea.toLocaleString()} m² ({areaBasisLabel(project.areaProvenance.sourceType)})</span>
              </span>
            </>
          )}
        </div>
      </div>

      {/* Right: Recommendation Status, Confidence, Readiness & Spatial Lab */}
      <div className="flex items-center gap-2.5 lg:gap-4 shrink-0">
        <Link
          href="/guide"
          aria-label="Open the illustrated SitePilot guide"
          title="Open the illustrated SitePilot guide"
          className="button-secondary flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold transition-colors"
        >
          <BookOpen className="h-3.5 w-3.5 text-[var(--status-evidence)]" />
          <span className="hidden xl:inline">Guide</span>
        </Link>

        <button
          type="button"
          onClick={onOpenSpatialLab}
          disabled={!onOpenSpatialLab || isSpatialLabOpening}
          title="Open expanded Spatial Lab workspace"
          className="button-secondary hidden lg:flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold transition-colors cursor-pointer"
        >
          {isSpatialLabOpening
            ? <LoaderCircle className="h-3.5 w-3.5 animate-spin text-[var(--status-investigation)]" />
            : <Box className="h-3.5 w-3.5 text-[var(--status-investigation)]" />}
          <span className="hidden sm:inline">{isSpatialLabOpening ? 'Opening…' : 'Spatial Lab'}</span>
        </button>

        <div className="hidden sm:block">
          {getRecommendationBadge(project.recommendation)}
        </div>

        {/* Readiness Meter */}
        <div className="hidden md:flex items-center gap-2 bg-[var(--bg-secondary)] px-3 py-1.5 rounded-[var(--radius-card)] border border-[var(--border-subtle)]">
          <span className="text-[11px] text-[var(--text-muted)]">Site Readiness</span>
          <div className="w-16 lg:w-20 bg-[var(--bg-hover)] h-1.5 rounded-full overflow-hidden">
            <div 
              className="bg-[var(--status-verified)] h-full rounded-full"
              style={{ width: `${project.siteReadinessPercentage}%` }}
            />
          </div>
          <span className="text-xs font-bold text-[var(--text-primary)] font-mono">{project.siteReadinessPercentage}%</span>
        </div>

        {/* User-facing source check status */}
        <div className="flex items-center gap-1.5 bg-[var(--bg-secondary)] px-2.5 lg:px-3 py-1.5 rounded-[var(--radius-card)] border border-[var(--border-subtle)] text-xs">
          <ShieldCheck className="w-3.5 h-3.5 text-[var(--status-assumed)]" />
          <span className="text-[var(--text-muted)] hidden sm:inline">Check status:</span>
          <span className="font-semibold text-[var(--status-assumed)] uppercase font-mono text-[11px]">{checkStatusLabel(project.evidenceConfidence)}</span>
        </div>
      </div>
    </header>
  );
}
