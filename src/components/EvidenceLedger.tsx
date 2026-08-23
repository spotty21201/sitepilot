'use client';

import { useState } from 'react';
import { Finding, Contradiction, SourceDocument, EvidenceClassification } from '@/types';
import {
  FileText,
  AlertTriangle,
  CheckCircle2,
  HelpCircle,
  Sparkles,
  ShieldCheck,
  Search,
} from 'lucide-react';

interface EvidenceLedgerProps {
  sources: SourceDocument[];
  findings: Finding[];
  contradictions: Contradiction[];
  activeSiteArea?: number;
  onSelectSiteArea?: (newArea: number) => void;
}

const filters = ['ALL', 'FACT', 'CLAIM', 'ASSUMPTION'] as const;
type EvidenceFilter = (typeof filters)[number];

function ClassificationBadge({ classification }: { classification: EvidenceClassification }) {
  switch (classification) {
    case 'FACT':
      return <span className="evidence-badge evidence-badge--fact"><CheckCircle2 className="h-3 w-3" aria-hidden="true" />FACT</span>;
    case 'CLAIM':
      return <span className="evidence-badge evidence-badge--claim"><AlertTriangle className="h-3 w-3" aria-hidden="true" />CLAIM</span>;
    case 'ASSUMPTION':
      return <span className="evidence-badge evidence-badge--assumption"><HelpCircle className="h-3 w-3" aria-hidden="true" />ASSUMPTION</span>;
    case 'INFERENCE':
      return <span className="evidence-badge evidence-badge--inference"><Sparkles className="h-3 w-3" aria-hidden="true" />INFERENCE</span>;
    default:
      return <span className="font-metadata text-[9px] uppercase text-[var(--text-secondary)]">{classification}</span>;
  }
}

function classificationTone(classification: EvidenceClassification) {
  switch (classification) {
    case 'FACT': return 'border-l-[var(--status-verified)]';
    case 'CLAIM': return 'border-l-[var(--status-assumed)]';
    case 'ASSUMPTION': return 'border-l-[var(--status-investigation)]';
    default: return 'border-l-[var(--status-evidence)]';
  }
}

function confidenceTone(confidence: Finding['confidence']) {
  switch (confidence) {
    case 'HIGH': return 'text-[var(--status-verified)]';
    case 'MEDIUM': return 'text-[var(--status-assumed)]';
    case 'LOW': return 'text-[var(--status-error)]';
    default: return 'text-[var(--status-investigation)]';
  }
}

export function EvidenceLedger({
  sources,
  findings,
  contradictions,
  activeSiteArea,
  onSelectSiteArea,
}: EvidenceLedgerProps) {
  const [filter, setFilter] = useState<EvidenceFilter>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const normalizedQuery = searchQuery.trim().toLowerCase();

  const filteredFindings = findings.filter((finding) => {
    const matchesFilter = filter === 'ALL' || finding.classification === filter;
    const matchesSearch = !normalizedQuery ||
      finding.statement.toLowerCase().includes(normalizedQuery) ||
      finding.sourceName.toLowerCase().includes(normalizedQuery);
    return matchesFilter && matchesSearch;
  });

  return (
    <section className="panel-shell flex h-full flex-col overflow-hidden" aria-labelledby="evidence-ledger-title">
      <header className="border-b hairline-rule p-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <span className="font-metadata text-[9px] uppercase text-[var(--text-muted)]">Source trace / 02</span>
            <h3 id="evidence-ledger-title" className="mt-1 text-[22px] font-semibold leading-none text-[var(--text-primary)]">Evidence Ledger</h3>
            <p className="mt-2 max-w-[250px] text-[11px] leading-relaxed text-[var(--text-secondary)]">Every working conclusion stays attached to where it came from.</p>
          </div>
          <div className="shrink-0 text-right">
            <span className="block font-metadata text-[18px] leading-none text-[var(--status-evidence)]">{findings.length.toString().padStart(2, '0')}</span>
            <span className="mt-1 block font-metadata text-[8px] uppercase text-[var(--text-muted)]">findings / {sources.length} sources</span>
          </div>
        </div>

        {(() => {
          const areaContradiction = contradictions.find(c => 
            c.id === 'c-001' || 
            c.title.toLowerCase().includes('site area') ||
            c.impactStatement.toLowerCase().includes('site area')
          );

          if (areaContradiction && onSelectSiteArea) {
            // Find finding values linked to this contradiction
            const contradictionFindings = findings.filter(f => 
              areaContradiction.findings?.some(fnd => fnd.id === f.id) ||
              f.extractedValue?.key === 'gross_site_area'
            );

            const options = contradictionFindings.map(f => ({
              value: f.extractedValue?.numericValue || 0,
              label: `${f.extractedValue?.numericValue?.toLocaleString() || ''} m² / ${f.classification.toLowerCase()}`
            })).filter(o => o.value > 0);

            // Deduplicate options by value
            const uniqueOptions = options.filter((opt, index, self) => 
              index === self.findIndex(o => o.value === opt.value)
            );

            if (uniqueOptions.length > 1) {
              return (
                <label className="flex items-center justify-between gap-3 border-y hairline-rule py-2 text-[10px] text-[var(--text-secondary)]">
                  <span>Working site area basis</span>
                  <select
                    value={activeSiteArea}
                    onChange={(event) => onSelectSiteArea(Number(event.target.value))}
                    className="min-h-[var(--control-height-sm)] border-0 bg-transparent px-1 font-metadata text-[9px] uppercase text-[var(--status-assumed)] cursor-pointer"
                    aria-label="Working site area basis"
                  >
                    {uniqueOptions.map(opt => (
                      <option key={opt.value} value={opt.value} className="bg-[var(--bg-tertiary)] text-[var(--text-primary)]">
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </label>
              );
            }
          }

          if (activeSiteArea !== undefined) {
            return (
              <div className="flex items-center justify-between gap-3 border-y hairline-rule py-2 text-[10px] text-[var(--text-secondary)]">
                <span>Working site area basis</span>
                <span className="font-metadata text-[9px] uppercase text-[var(--status-assumed)]">
                  {activeSiteArea.toLocaleString()} m² ({sources.length > 0 ? 'Document Basis' : 'Intake Assumption'})
                </span>
              </div>
            );
          }

          return null;
        })()}

        <div className="mt-4 flex flex-col gap-3">
          <label className="relative block">
            <span className="sr-only">Search findings and sources</span>
            <Search className="pointer-events-none absolute left-0 top-2 h-3.5 w-3.5 text-[var(--text-muted)]" aria-hidden="true" />
            <input
              type="search"
              placeholder="Search the ledger"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              className="w-full min-h-[var(--control-height-md)] border-b border-[var(--border-default)] bg-transparent py-1.5 pl-6 pr-2 text-[12px] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--focus-ring)]"
            />
          </label>

          <div className="flex items-center gap-4" role="group" aria-label="Filter evidence by classification">
            {filters.map((tab) => {
              const isActive = filter === tab;
              return (
                <button
                  key={tab}
                  type="button"
                  aria-pressed={isActive}
                  onClick={() => setFilter(tab)}
                  className={`relative min-h-[var(--control-height-sm)] px-1 pb-1 text-[10px] font-semibold transition-colors ${
                    isActive ? 'text-[var(--text-primary)]' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  {tab === 'ALL' ? 'All evidence' : tab}
                  {isActive && <span className="absolute inset-x-0 -bottom-px h-px bg-[var(--status-evidence)]" />}
                </button>
              );
            })}
          </div>
        </div>
      </header>

      {contradictions.length > 0 && (
        <div className="border-b border-[var(--status-error)] bg-[var(--status-error-surface)] px-4 py-3" role="alert">
          {contradictions.map((contradiction) => (
            <div key={contradiction.id} className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--status-error)]" aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <h4 className="text-[16px] font-semibold text-[var(--text-primary)]">{contradiction.title}</h4>
                  <span className="status-badge status-badge--error !min-h-0 !px-1.5 !py-0.5 text-[8px] whitespace-nowrap">Open contradiction</span>
                </div>
                <p className="mt-1 text-[11px] leading-relaxed text-[var(--text-secondary)]">{contradiction.impactStatement}</p>
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-[var(--border-default)] pt-2 text-[10px] text-[var(--status-error)]">
                  <span>Next: {contradiction.recommendedAction}</span>
                  {contradiction.workingValueSelected !== undefined && (
                    <span className="font-metadata text-[9px] text-[var(--text-primary)]">Working value: {contradiction.workingValueSelected.toLocaleString()}</span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between border-b hairline-rule px-4 py-2" aria-live="polite">
        <span className="font-metadata text-[9px] uppercase text-[var(--text-muted)]">Showing {filteredFindings.length} of {findings.length}</span>
        <span className="text-[10px] text-[var(--text-muted)]">Fact → claim → working basis</span>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-1">
        {filteredFindings.length > 0 ? filteredFindings.map((finding) => (
          <article key={finding.id} className={`group border-b hairline-rule border-l-2 py-3 pl-3 pr-1 transition-colors last:border-b-0 hover:bg-[var(--bg-hover)] ${classificationTone(finding.classification)}`}>
            <div className="flex items-start justify-between gap-3">
              <ClassificationBadge classification={finding.classification} />
              <span className="font-metadata max-w-[135px] truncate text-right text-[8px] uppercase text-[var(--text-muted)]" title={finding.category}>
                {finding.category.replaceAll('_', ' ')}
              </span>
            </div>

            <p className={`mt-2 leading-relaxed ${finding.classification === 'FACT' ? 'text-[15px] font-semibold text-[var(--text-primary)]' : 'text-[12px] text-[var(--text-secondary)]'}`}>
              {finding.statement}
            </p>

            <footer className="mt-3 flex items-end justify-between gap-3">
              <div className="flex min-w-0 items-center gap-1.5 text-[10px] text-[var(--text-secondary)]">
                <FileText className="h-3 w-3 shrink-0 text-[var(--text-muted)]" aria-hidden="true" />
                <span className="truncate" title={finding.sourceName}>{finding.sourceName}</span>
                {finding.pageLocation && <span className="shrink-0 text-[var(--text-muted)]">· {finding.pageLocation}</span>}
              </div>
              <span className={`shrink-0 font-metadata text-[8px] uppercase ${confidenceTone(finding.confidence)}`}>
                {finding.confidence}
              </span>
            </footer>
          </article>
        )) : (
          <div className="flex h-full min-h-48 flex-col items-center justify-center px-6 text-center">
            <Search className="h-5 w-5 text-[var(--text-muted)]" aria-hidden="true" />
            <p className="mt-3 text-[15px] font-semibold text-[var(--text-primary)]">No matching evidence</p>
            <p className="mt-1 text-[11px] text-[var(--text-muted)]">Try another term or return to all evidence.</p>
          </div>
        )}
      </div>

      <footer className="flex items-center gap-2 border-t hairline-rule px-4 py-2.5 text-[9px] text-[var(--text-muted)]">
        <ShieldCheck className="h-3 w-3 text-[var(--status-verified)]" aria-hidden="true" />
        <span>Classification is explicit; confidence is not certainty.</span>
      </footer>
    </section>
  );
}
