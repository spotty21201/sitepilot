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
      return <span className="font-metadata text-[9px] uppercase text-[#a6a29a]">{classification}</span>;
  }
}

function classificationTone(classification: EvidenceClassification) {
  switch (classification) {
    case 'FACT': return 'border-l-[#91b89f]';
    case 'CLAIM': return 'border-l-[#d2af78]';
    case 'ASSUMPTION': return 'border-l-[#a7a0c4]';
    default: return 'border-l-[#8db8c5]';
  }
}

function confidenceTone(confidence: Finding['confidence']) {
  switch (confidence) {
    case 'HIGH': return 'text-[#91b89f]';
    case 'MEDIUM': return 'text-[#d2af78]';
    case 'LOW': return 'text-[#c77b72]';
    default: return 'text-[#a7a0c4]';
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
            <span className="font-metadata text-[9px] uppercase text-[#77756f]">Source trace / 02</span>
            <h3 id="evidence-ledger-title" className="font-editorial mt-1 text-[22px] leading-none text-[#eeeae1]">Evidence Ledger</h3>
            <p className="mt-2 max-w-[250px] text-[11px] leading-relaxed text-[#8f8c84]">Every working conclusion stays attached to where it came from.</p>
          </div>
          <div className="shrink-0 text-right">
            <span className="block font-metadata text-[18px] leading-none text-[#d2af78]">{findings.length.toString().padStart(2, '0')}</span>
            <span className="mt-1 block font-metadata text-[8px] uppercase text-[#77756f]">findings / {sources.length} sources</span>
          </div>
        </div>

        {activeSiteArea !== undefined && onSelectSiteArea && (
          <label className="flex items-center justify-between gap-3 border-y hairline-rule py-2 text-[10px] text-[#8f8c84]">
            <span>Working site area basis</span>
            <select
              value={activeSiteArea}
              onChange={(event) => onSelectSiteArea(Number(event.target.value))}
              className="border-0 bg-transparent font-metadata text-[9px] uppercase text-[#d2af78] outline-none"
              aria-label="Working site area basis"
            >
              <option value="16850">16,850 m² / title</option>
              <option value="18200">18,200 m² / claim</option>
            </select>
          </label>
        )}

        <div className="mt-4 flex flex-col gap-3">
          <label className="relative block">
            <span className="sr-only">Search findings and sources</span>
            <Search className="pointer-events-none absolute left-0 top-2 h-3.5 w-3.5 text-[#77756f]" aria-hidden="true" />
            <input
              type="search"
              placeholder="Search the ledger"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              className="w-full border-b border-[#44443e] bg-transparent py-1.5 pl-6 pr-2 text-[12px] text-[#eeeae1] outline-none placeholder:text-[#706f6a] focus:border-[#d2af78]"
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
                  className={`relative pb-1 font-metadata text-[9px] uppercase tracking-[0.12em] transition-colors ${
                    isActive ? 'text-[#eeeae1]' : 'text-[#77756f] hover:text-[#c8c3b7]'
                  }`}
                >
                  {tab === 'ALL' ? 'All evidence' : tab}
                  {isActive && <span className="absolute inset-x-0 -bottom-px h-px bg-[#d2af78]" />}
                </button>
              );
            })}
          </div>
        </div>
      </header>

      {contradictions.length > 0 && (
        <div className="border-b border-[#70443f] bg-[#21191a] px-4 py-3" role="alert">
          {contradictions.map((contradiction) => (
            <div key={contradiction.id} className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[#c77b72]" aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <h4 className="font-editorial text-[16px] text-[#edd2cc]">{contradiction.title}</h4>
                  <span className="font-metadata text-[8px] uppercase text-[#c77b72]">open contradiction</span>
                </div>
                <p className="mt-1 text-[11px] leading-relaxed text-[#c79a94]">{contradiction.impactStatement}</p>
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-[#70443f]/60 pt-2 text-[10px] text-[#b87972]">
                  <span>Next: {contradiction.recommendedAction}</span>
                  {contradiction.workingValueSelected !== undefined && (
                    <span className="font-metadata text-[9px] text-[#edd2cc]">Working value: {contradiction.workingValueSelected.toLocaleString()}</span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between border-b hairline-rule px-4 py-2" aria-live="polite">
        <span className="font-metadata text-[9px] uppercase text-[#77756f]">Showing {filteredFindings.length} of {findings.length}</span>
        <span className="text-[10px] text-[#706f6a]">Fact → claim → working basis</span>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-1">
        {filteredFindings.length > 0 ? filteredFindings.map((finding) => (
          <article key={finding.id} className={`group border-b hairline-rule border-l-2 py-3 pl-3 pr-1 transition-colors last:border-b-0 hover:bg-[#1a1d20] ${classificationTone(finding.classification)}`}>
            <div className="flex items-start justify-between gap-3">
              <ClassificationBadge classification={finding.classification} />
              <span className="font-metadata max-w-[135px] truncate text-right text-[8px] uppercase text-[#706f6a]" title={finding.category}>
                {finding.category.replaceAll('_', ' ')}
              </span>
            </div>

            <p className={`mt-2 leading-relaxed ${finding.classification === 'FACT' ? 'font-editorial text-[16px] text-[#eeeae1]' : 'text-[12px] text-[#c8c3b7]'}`}>
              {finding.statement}
            </p>

            <footer className="mt-3 flex items-end justify-between gap-3">
              <div className="flex min-w-0 items-center gap-1.5 text-[10px] text-[#9a978f]">
                <FileText className="h-3 w-3 shrink-0 text-[#77756f]" aria-hidden="true" />
                <span className="truncate" title={finding.sourceName}>{finding.sourceName}</span>
                {finding.pageLocation && <span className="shrink-0 text-[#706f6a]">· {finding.pageLocation}</span>}
              </div>
              <span className={`shrink-0 font-metadata text-[8px] uppercase ${confidenceTone(finding.confidence)}`}>
                {finding.confidence}
              </span>
            </footer>
          </article>
        )) : (
          <div className="flex h-full min-h-48 flex-col items-center justify-center px-6 text-center">
            <Search className="h-5 w-5 text-[#706f6a]" aria-hidden="true" />
            <p className="font-editorial mt-3 text-[17px] text-[#c8c3b7]">No matching evidence</p>
            <p className="mt-1 text-[11px] text-[#77756f]">Try another term or return to all evidence.</p>
          </div>
        )}
      </div>

      <footer className="flex items-center gap-2 border-t hairline-rule px-4 py-2.5 text-[9px] text-[#77756f]">
        <ShieldCheck className="h-3 w-3 text-[#91b89f]" aria-hidden="true" />
        <span>Classification is explicit; confidence is not certainty.</span>
      </footer>
    </section>
  );
}
