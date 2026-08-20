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
  User
} from 'lucide-react';

interface DecisionRoomSummaryProps {
  project: Project;
}

export function DecisionRoomSummary({ project }: DecisionRoomSummaryProps) {
  const { actions = [], executiveSummary, issues = [] } = project;

  const topOpportunities = executiveSummary?.topOpportunities || [];
  const criticalRisks = executiveSummary?.criticalRisks || [];
  const recommendedNextMove = executiveSummary?.recommendedNextMove || 
    'Upload land certificates, topographic surveys, or municipal planning documents to build verified feasibility evidence.';

  return (
    <div className="flex flex-col h-full bg-[#11141d] border border-[#232938] rounded-xl overflow-hidden shadow-lg select-none">
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
            <span>Recommended Due Diligence Strategy</span>
          </div>
          <p className="text-xs text-slate-100 leading-relaxed font-medium">
            {recommendedNextMove}
          </p>
        </div>

        {/* Strategic Opportunities */}
        <div className="bg-[#161b28] border border-[#273146] rounded-lg p-3">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5 text-emerald-400 text-xs font-bold uppercase tracking-wider">
              <TrendingUp className="w-3.5 h-3.5" />
              <span>Strategic Opportunities</span>
            </div>
            <span className="text-[10px] text-slate-400 font-mono">
              {topOpportunities.length} {topOpportunities.length === 1 ? 'Item' : 'Items'}
            </span>
          </div>

          <div className="space-y-2.5">
            {topOpportunities.length > 0 ? (
              topOpportunities.map((opp, idx) => (
                <div key={idx} className="bg-[#121622] p-2.5 rounded-lg border border-[#222c40] space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-700">
                      <CheckCircle2 className="w-2.5 h-2.5" /> OPPORTUNITY
                    </span>
                    <span className="text-[9px] font-mono text-slate-400">
                      {project.isTemplate ? `Item 0${idx + 1}` : 'Intake Analysis'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-200 leading-relaxed">
                    {opp}
                  </p>
                </div>
              ))
            ) : (
              <div className="p-3 text-center text-slate-400 text-xs bg-[#121622] rounded-lg border border-[#222c40]">
                No positive development findings extracted yet.
              </div>
            )}
          </div>
        </div>

        {/* Material Risks & Uncertainties */}
        <div className="bg-[#161b28] border border-[#273146] rounded-lg p-3">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5 text-rose-400 text-xs font-bold uppercase tracking-wider">
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>Material Risks & Uncertainties</span>
            </div>
            <span className="text-[10px] text-slate-400 font-mono">
              {criticalRisks.length || issues.length} Issues
            </span>
          </div>

          <div className="space-y-2.5">
            {issues.length > 0 ? (
              issues.map((iss) => (
                <div key={iss.id} className="bg-[#121622] p-2.5 rounded-lg border border-rose-900/40 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold ${
                      iss.severity === 'CRITICAL' 
                        ? 'bg-rose-950 text-rose-300 border border-rose-800' 
                        : 'bg-amber-950 text-amber-300 border border-amber-800'
                    }`}>
                      <AlertTriangle className="w-2.5 h-2.5" /> {iss.severity}
                    </span>
                    <span className="text-[9px] font-mono text-slate-400">{iss.category.replace(/_/g, ' ')}</span>
                  </div>
                  <p className="text-xs text-slate-200 font-semibold leading-snug">
                    {iss.title}
                  </p>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    {iss.evidenceSummary || iss.implication}
                  </p>
                </div>
              ))
            ) : criticalRisks.length > 0 ? (
              criticalRisks.map((risk, idx) => (
                <div key={idx} className="bg-[#121622] p-2.5 rounded-lg border border-amber-900/40 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-950 text-amber-300 border border-amber-800">
                      <HelpCircle className="w-2.5 h-2.5" /> UNCERTAINTY
                    </span>
                    <span className="text-[9px] font-mono text-slate-400">Risk Assessment</span>
                  </div>
                  <p className="text-xs text-slate-200 leading-relaxed">
                    {risk}
                  </p>
                </div>
              ))
            ) : (
              <div className="p-3 text-center text-slate-400 text-xs bg-[#121622] rounded-lg border border-[#222c40]">
                No critical risks flagged at this stage.
              </div>
            )}
          </div>
        </div>

        {/* Prioritized Investigation Queue */}
        <div className="bg-[#161b28] border border-[#273146] rounded-lg p-3">
          <div className="flex items-center justify-between mb-2.5">
            <div className="flex items-center gap-1.5 text-amber-400 text-xs font-bold uppercase tracking-wider">
              <Clock className="w-3.5 h-3.5" />
              <span>Prioritized Investigation Queue</span>
            </div>
            <span className="text-[10px] text-slate-400 font-mono">{actions.length} Action Items</span>
          </div>

          <div className="space-y-2">
            {actions.length > 0 ? (
              actions.map((act) => (
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
              ))
            ) : (
              <div className="p-3 text-center text-slate-400 text-xs bg-[#121622] rounded-lg border border-[#222c40]">
                No pending investigation actions queued.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
