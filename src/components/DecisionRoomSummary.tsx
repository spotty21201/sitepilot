'use client';

import React from 'react';
import { Project } from '@/types';
import { 
  TrendingUp, 
  AlertTriangle, 
  HelpCircle, 
  ArrowRightCircle, 
  Clock, 
  CheckCircle2,
  Compass,
  User,
  Layers,
  FileCheck,
  Sparkles
} from 'lucide-react';

interface DecisionRoomSummaryProps {
  project: Project;
}

export function DecisionRoomSummary({ project }: DecisionRoomSummaryProps) {
  const { actions } = project;

  return (
    <div className="flex flex-col h-full bg-[#11141d] border border-[#232938] rounded-xl overflow-hidden shadow-lg">
      {/* Header */}
      <div className="p-3.5 border-b border-[#232938] flex items-center justify-between bg-[#141824]">
        <div className="flex items-center gap-2">
          <Compass className="w-4 h-4 text-[#38bdf8]" />
          <h3 className="text-xs font-bold text-slate-100 uppercase tracking-wider">Executive Decision Brief</h3>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="text-slate-400">Site Readiness:</span>
          <span className="font-bold text-emerald-400 font-mono">{project.siteReadinessPercentage}%</span>
        </div>
      </div>

      <div className="p-3.5 flex-1 overflow-y-auto space-y-3.5">
        {/* Recommended Pre-Offer Strategy */}
        <div className="p-3 bg-gradient-to-r from-sky-950/80 to-[#141d2d] border border-sky-600/50 rounded-lg shadow-sm">
          <div className="flex items-center gap-2 text-sky-400 text-xs font-bold uppercase tracking-wider mb-1.5">
            <ArrowRightCircle className="w-4 h-4" />
            Recommended Pre-Offer Strategy
          </div>
          <p className="text-xs text-slate-100 leading-relaxed font-medium">
            Pre-Offer Due Diligence: Confirm cadastral boundary coordinates via official survey and verify Teuku Umar road widening setbacks before issuing formal offer based on certified 16,850 m² area (adjusted price basis: Rp 416B at advertised Rp 24.7M/m²).
          </p>
        </div>

        {/* Strategic Opportunities with Explicit Provenance */}
        <div className="bg-[#161b28] border border-[#273146] rounded-lg p-3">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5 text-emerald-400 text-xs font-bold uppercase tracking-wider">
              <TrendingUp className="w-3.5 h-3.5" />
              Strategic Opportunities
            </div>
            <span className="text-[10px] text-slate-400 font-mono">3 Findings</span>
          </div>

          <div className="space-y-2.5">
            {/* Opp 1 */}
            <div className="bg-[#121622] p-2.5 rounded-lg border border-[#222c40] space-y-1">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-700">
                  <CheckCircle2 className="w-2.5 h-2.5" /> FACT
                </span>
                <span className="text-[9px] font-mono text-slate-400">SHGB #1842 · p.1</span>
              </div>
              <p className="text-xs text-slate-200 leading-relaxed">
                Prime 1.68 ha rectangular parcel in prestigious Menteng submarket with clean cadastral title through 2045.
              </p>
            </div>

            {/* Opp 2 */}
            <div className="bg-[#121622] p-2.5 rounded-lg border border-[#222c40] space-y-1">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-700">
                  <CheckCircle2 className="w-2.5 h-2.5" /> FACT
                </span>
                <span className="text-[9px] font-mono text-slate-400">DKI RDTR 2022 · Table 4.1</span>
              </div>
              <p className="text-xs text-slate-200 leading-relaxed">
                Confirmed Subzone R.9 designation allows up to 8 storeys (32m height) and 3.20 FAR for mixed-use residential.
              </p>
            </div>

            {/* Opp 3 */}
            <div className="bg-[#121622] p-2.5 rounded-lg border border-[#222c40] space-y-1">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-sky-950 text-sky-300 border border-sky-700">
                  <Sparkles className="w-2.5 h-2.5" /> INFERENCE
                </span>
                <span className="text-[9px] font-mono text-slate-400">Scenario B Analysis</span>
              </div>
              <p className="text-xs text-slate-200 leading-relaxed">
                Optimal yield achieved under Scenario B (40,400 m² GFA, 2.40 FAR) with 100% zoning compliance and zero variance required.
              </p>
            </div>
          </div>
        </div>

        {/* Material Risks & Uncertainties with Explicit Provenance */}
        <div className="bg-[#161b28] border border-[#273146] rounded-lg p-3">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5 text-rose-400 text-xs font-bold uppercase tracking-wider">
              <AlertTriangle className="w-3.5 h-3.5" />
              Material Risks & Uncertainties
            </div>
            <span className="text-[10px] text-slate-400 font-mono">2 Critical Issues</span>
          </div>

          <div className="space-y-2.5">
            {/* Risk 1 */}
            <div className="bg-[#121622] p-2.5 rounded-lg border border-rose-900/40 space-y-1">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-rose-950 text-rose-300 border border-rose-800">
                  <AlertTriangle className="w-2.5 h-2.5" /> CONTRADICTION
                </span>
                <span className="text-[9px] font-mono text-slate-400">Broker Pitch (p.2) vs SHGB #1842</span>
              </div>
              <p className="text-xs text-slate-200 leading-relaxed">
                Cadastral discrepancy: True area is 16,850 m² vs 18,200 m² advertised by broker. Discrepancy represents ~4,320 m² in theoretical maximum zoning GFA capacity at 3.20 FAR (1,350 m² × 3.20 FAR) and Rp 34B in unadjusted price variance.
              </p>
            </div>

            {/* Risk 2 */}
            <div className="bg-[#121622] p-2.5 rounded-lg border border-amber-900/40 space-y-1">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-950 text-amber-300 border border-amber-800">
                  <HelpCircle className="w-2.5 h-2.5" /> ASSUMPTION
                </span>
                <span className="text-[9px] font-mono text-slate-400">Site Photo #4 · Access Survey</span>
              </div>
              <p className="text-xs text-slate-200 leading-relaxed">
                Single 6.5m northern access corridor may limit emergency vehicle throughput for large schemes (&gt;30,000 m² GFA) pending dedicated egress loop confirmation.
              </p>
            </div>
          </div>
        </div>

        {/* Prioritized Investigation Queue */}
        <div className="bg-[#161b28] border border-[#273146] rounded-lg p-3">
          <div className="flex items-center justify-between mb-2.5">
            <div className="flex items-center gap-1.5 text-amber-400 text-xs font-bold uppercase tracking-wider">
              <Clock className="w-3.5 h-3.5" />
              Prioritized Investigation Queue
            </div>
            <span className="text-[10px] text-slate-400 font-mono">{actions.length} Action Items</span>
          </div>

          <div className="space-y-2">
            {actions.map((act) => (
              <div key={act.id} className="bg-[#121622] p-2.5 rounded-lg border border-[#222c40] space-y-1.5">
                <div className="flex items-center justify-between text-xs font-semibold text-slate-200">
                  <span className="truncate pr-2">{act.title}</span>
                  <span className={`text-[9px] px-1.5 py-0.5 rounded font-mono shrink-0 ${
                    act.priority === 'CRITICAL' 
                      ? 'bg-rose-950 text-rose-300 border border-rose-800' 
                      : 'bg-amber-950 text-amber-300 border border-amber-800'
                  }`}>
                    {act.priority}
                  </span>
                </div>

                <p className="text-[11px] text-slate-400 leading-relaxed">{act.reason}</p>

                <div className="pt-1 border-t border-[#1e2738] flex flex-wrap items-center justify-between text-[10px] text-slate-400 gap-1">
                  <span className="flex items-center gap-1 text-slate-300 font-medium">
                    <User className="w-3 h-3 text-sky-400" />
                    {act.assignedTo || 'Unassigned'}
                  </span>
                  <span className="font-mono text-slate-500">
                    Status: <span className="text-amber-400 font-semibold">{act.status}</span>
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
