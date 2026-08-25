'use client';

import { useMemo, useState } from 'react';
import { Finding, Contradiction, SourceDocument, EvidenceClassification, Project } from '@/types';
import { buildEvidenceLedgerRows } from '@/lib/reporting/project-report';
import {
  FileText,
  AlertTriangle,
  CheckCircle2,
  HelpCircle,
  Sparkles,
  ShieldCheck,
  Search,
  Plus,
} from 'lucide-react';

export interface ManualEvidenceInput {
  sourceName: string;
  fact: string;
  value?: number;
  unit?: string;
}

interface EvidenceLedgerProps {
  sources: SourceDocument[];
  findings: Finding[];
  contradictions: Contradiction[];
  activeSiteArea?: number;
  onSelectSiteArea?: (newArea: number) => void;
  project?: Project;
  onAddManualEvidence?: (input: ManualEvidenceInput) => void;
}

const filters = ['ALL', 'FACT', 'CLAIM', 'ASSUMPTION'] as const;
type EvidenceFilter = (typeof filters)[number];

function ClassificationBadge({ classification }: { classification: EvidenceClassification }) {
  switch (classification) {
    case 'FACT':
      return <span className="evidence-badge evidence-badge--fact"><CheckCircle2 className="h-3 w-3" aria-hidden="true" />CONFIRMED</span>;
    case 'CLAIM':
      return <span className="evidence-badge evidence-badge--claim"><AlertTriangle className="h-3 w-3" aria-hidden="true" />PROVIDED</span>;
    case 'ASSUMPTION':
      return <span className="evidence-badge evidence-badge--assumption"><HelpCircle className="h-3 w-3" aria-hidden="true" />ASSUMPTION</span>;
    case 'INFERENCE':
      return <span className="evidence-badge evidence-badge--inference"><Sparkles className="h-3 w-3" aria-hidden="true" />CALCULATED</span>;
    case 'RECOMMENDATION':
      return <span className="evidence-badge evidence-badge--inference"><Sparkles className="h-3 w-3" aria-hidden="true" />GUIDANCE</span>;
    case 'USER_OVERRIDE':
      return <span className="evidence-badge evidence-badge--assumption"><HelpCircle className="h-3 w-3" aria-hidden="true" />USER VALUE</span>;
    default:
      return <span className="font-metadata text-[9px] uppercase text-[var(--text-secondary)]">SOURCE</span>;
  }
}

function filterLabel(filter: EvidenceFilter): string {
  if (filter === 'ALL') return 'All items';
  if (filter === 'FACT') return 'Confirmed';
  if (filter === 'CLAIM') return 'Provided';
  return 'Assumptions';
}

function reliabilityLabel(confidence: Finding['confidence']): string {
  switch (confidence) {
    case 'HIGH': return 'High reliability';
    case 'MEDIUM': return 'Review advised';
    case 'LOW': return 'Limited reliability';
    default: return 'Not yet confirmed';
  }
}

function sourceTypeLabel(type: string): string {
  switch (type) {
    case 'document': return 'Document';
    case 'address-derived': return 'From address';
    case 'calculated': return 'Calculated';
    default: return 'Provided by user';
  }
}

function statusLabel(status: string): string {
  switch (status) {
    case 'current': return 'Current';
    case 'stale': return 'Needs updating';
    case 'conflicting': return 'Conflicting';
    case 'overridden': return 'Replaced';
    case 'assumption': return 'Assumption';
    default: return 'Information needed';
  }
}

function categoryLabel(category: string): string {
  return category
    .toLowerCase()
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase());
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
  project,
  onAddManualEvidence,
}: EvidenceLedgerProps) {
  const [filter, setFilter] = useState<EvidenceFilter>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [manualSource, setManualSource] = useState('');
  const [manualFact, setManualFact] = useState('');
  const [manualValue, setManualValue] = useState('');
  const [manualUnit, setManualUnit] = useState('');
  const ledgerRows = useMemo(() => project ? buildEvidenceLedgerRows(project) : [], [project]);
  const openContradictions = contradictions.filter((contradiction) => !contradiction.resolved);
  const normalizedQuery = searchQuery.trim().toLowerCase();

  const filteredFindings = findings.filter((finding) => {
    const matchesFilter = filter === 'ALL' || finding.classification === filter;
    const matchesSearch = !normalizedQuery ||
      finding.statement.toLowerCase().includes(normalizedQuery) ||
      finding.sourceName.toLowerCase().includes(normalizedQuery);
    return matchesFilter && matchesSearch;
  });

  return (
    <section className="panel-shell flex h-full flex-col overflow-hidden" aria-labelledby="sources-assumptions-title">
      <header className="border-b hairline-rule p-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <span className="font-metadata text-[9px] uppercase text-[var(--text-muted)]">Study basis / 02</span>
            <h3 id="sources-assumptions-title" className="mt-1 text-[22px] font-semibold leading-none text-[var(--text-primary)]">Sources &amp; Assumptions</h3>
            <p className="mt-2 max-w-[250px] text-[11px] leading-relaxed text-[var(--text-secondary)]">See where each working figure came from and what still needs confirmation.</p>
          </div>
          <div className="shrink-0 text-right">
            <span className="block font-metadata text-[18px] leading-none text-[var(--status-evidence)]">{findings.length.toString().padStart(2, '0')}</span>
            <span className="mt-1 block font-metadata text-[8px] uppercase text-[var(--text-muted)]">items / {sources.length} sources</span>
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
              label: `${f.extractedValue?.numericValue?.toLocaleString() || ''} m² / ${f.classification === 'FACT' ? 'confirmed' : f.classification === 'ASSUMPTION' ? 'assumption' : 'provided'}`
            })).filter(o => o.value > 0);

            // Deduplicate options by value
            const uniqueOptions = options.filter((opt, index, self) => 
              index === self.findIndex(o => o.value === opt.value)
            );
            if (activeSiteArea !== undefined && !uniqueOptions.some((option) => option.value === activeSiteArea)) {
              uniqueOptions.unshift({ value: activeSiteArea, label: `${activeSiteArea.toLocaleString()} m² / current working value` });
            }

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
              placeholder="Search sources and assumptions"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              className="w-full min-h-[var(--control-height-md)] border-b border-[var(--border-default)] bg-transparent py-1.5 pl-6 pr-2 text-[12px] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--focus-ring)]"
            />
          </label>

          <div className="flex items-center gap-4" role="group" aria-label="Filter sources and assumptions by source type">
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
                  {filterLabel(tab)}
                  {isActive && <span className="absolute inset-x-0 -bottom-px h-px bg-[var(--status-evidence)]" />}
                </button>
              );
            })}
          </div>
        </div>
      </header>

      {openContradictions.length > 0 && (
        <div className="border-b border-[var(--status-error)] bg-[var(--status-error-surface)] px-4 py-3" role="alert">
          {openContradictions.map((contradiction) => (
            <div key={contradiction.id} className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--status-error)]" aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <h4 className="text-[16px] font-semibold text-[var(--text-primary)]">{contradiction.title}</h4>
                  <span className="status-badge status-badge--error !min-h-0 !px-1.5 !py-0.5 text-[8px] whitespace-nowrap">Information conflict</span>
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
        <span className="text-[10px] text-[var(--text-muted)]">Confirmed → provided → assumed</span>
      </div>

      {project && (
        <section className="border-b hairline-rule px-3 py-2" aria-labelledby="decision-input-trace-title">
          <div className="flex items-center justify-between gap-2 px-1 py-1.5">
            <div><h4 id="decision-input-trace-title" className="text-[11px] font-semibold text-[var(--text-primary)]">How each figure was derived</h4><p className="text-[9px] text-[var(--text-muted)]">Inputs and the study figures they affect</p></div>
            {onAddManualEvidence && <button type="button" onClick={() => setShowManualEntry((visible) => !visible)} className="button-secondary flex items-center gap-1 px-2 py-1 text-[9px]"><Plus className="h-3 w-3" /> Add source or assumption</button>}
          </div>
          {showManualEntry && onAddManualEvidence && (
            <form
              className="mb-2 grid grid-cols-2 gap-2 rounded-[var(--radius-control)] border border-[var(--border-default)] bg-[var(--bg-inspector)] p-2"
              onSubmit={(event) => {
                event.preventDefault();
                if (!manualSource.trim() || !manualFact.trim()) return;
                onAddManualEvidence({
                  sourceName: manualSource.trim(),
                  fact: manualFact.trim(),
                  value: manualValue.trim() ? Number(manualValue) : undefined,
                  unit: manualUnit.trim() || undefined,
                });
                setManualFact(''); setManualValue(''); setManualUnit(''); setShowManualEntry(false);
              }}
            >
              <input aria-label="Source or input name" required placeholder="Source or input name" value={manualSource} onChange={(event) => setManualSource(event.target.value)} className="intake-control px-2 py-1.5 text-[10px]" />
              <input aria-label="Information provided" required placeholder="Information provided" value={manualFact} onChange={(event) => setManualFact(event.target.value)} className="intake-control px-2 py-1.5 text-[10px]" />
              <input aria-label="Provided value" type="number" placeholder="Value (optional)" value={manualValue} onChange={(event) => setManualValue(event.target.value)} className="intake-control px-2 py-1.5 font-mono text-[10px]" />
              <div className="flex gap-1"><input aria-label="Value unit" placeholder="Unit" value={manualUnit} onChange={(event) => setManualUnit(event.target.value)} className="intake-control min-w-0 flex-1 px-2 py-1.5 text-[10px]" /><button className="button-primary px-2 py-1 text-[9px]" type="submit">Record assumption</button></div>
              <p className="col-span-2 text-[9px] text-[var(--text-muted)]">Manual entries are marked as provided by the user and not yet confirmed.</p>
            </form>
          )}
          <div className="max-h-52 space-y-1 overflow-y-auto">
            {ledgerRows.length > 0 ? ledgerRows.slice(0, 8).map((row) => (
              <article key={row.id} className="grid grid-cols-[1fr_auto] gap-2 border-b border-[var(--border-subtle)] px-1 py-2 last:border-b-0">
                <div className="min-w-0"><div className="flex items-center gap-1.5"><strong className="truncate text-[10px] text-[var(--text-primary)]">{row.fact}</strong><span className="status-badge status-badge--assumed !min-h-0 !px-1 !py-0.5 text-[7px]">{sourceTypeLabel(row.evidenceType)}</span></div><p className="mt-0.5 text-[9px] leading-relaxed text-[var(--text-muted)]">{row.sourceName}{row.sourceDate ? ` · ${row.sourceDate}` : ''} · {row.verification} · used for: {row.dependencies}</p>{row.formula && <p className="mt-0.5 font-mono text-[8px] text-[var(--status-investigation)]">Calculated as: {row.formula}</p>}</div>
                <div className="text-right"><strong className="block font-mono text-[10px] text-[var(--text-primary)]">{row.value}</strong><span className="text-[8px] uppercase text-[var(--text-muted)]">{statusLabel(row.status)}</span></div>
              </article>
            )) : <div className="p-3 text-center text-[10px] text-[var(--text-muted)]">No sources or assumptions have been recorded. Add an assumption or source before relying on the study.</div>}
          </div>
        </section>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-1">
        {filteredFindings.length > 0 ? filteredFindings.map((finding) => (
          <article key={finding.id} className={`group border-b hairline-rule border-l-2 py-3 pl-3 pr-1 transition-colors last:border-b-0 hover:bg-[var(--bg-hover)] ${classificationTone(finding.classification)}`}>
            <div className="flex items-start justify-between gap-3">
              <ClassificationBadge classification={finding.classification} />
              {finding.userOverridden && <span className="status-badge status-badge--assumed !min-h-0 !px-1.5 !py-0.5 text-[8px]">Overridden</span>}
              <span className="font-metadata max-w-[135px] truncate text-right text-[8px] uppercase text-[var(--text-muted)]" title={finding.category}>
                {categoryLabel(finding.category)}
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
                {reliabilityLabel(finding.confidence)}
              </span>
            </footer>
          </article>
        )) : (
          <div className="flex h-full min-h-48 flex-col items-center justify-center px-6 text-center">
            <Search className="h-5 w-5 text-[var(--text-muted)]" aria-hidden="true" />
            <p className="mt-3 text-[15px] font-semibold text-[var(--text-primary)]">No matching information</p>
            <p className="mt-1 text-[11px] text-[var(--text-muted)]">Try another term or return to all items.</p>
          </div>
        )}
      </div>

      <footer className="flex items-center gap-2 border-t hairline-rule px-4 py-2.5 text-[9px] text-[var(--text-muted)]">
        <ShieldCheck className="h-3 w-3 text-[var(--status-verified)]" aria-hidden="true" />
        <span>Source type and check status are shown separately; confirm important inputs before reliance.</span>
      </footer>
    </section>
  );
}
