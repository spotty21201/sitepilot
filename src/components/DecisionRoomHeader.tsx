'use client';

import React from 'react';
import { Project } from '@/types';
import { 
  MapPin, 
  DollarSign, 
  CheckCircle, 
  AlertCircle, 
  ShieldCheck, 
  Share2, 
  Building 
} from 'lucide-react';

interface DecisionRoomHeaderProps {
  project: Project;
}

export function DecisionRoomHeader({ project }: DecisionRoomHeaderProps) {
  const getRecommendationBadge = (status: Project['recommendation']) => {
    switch (status) {
      case 'PROCEED':
        return (
          <span className="px-3 py-1 bg-emerald-950/80 border border-emerald-500 text-emerald-300 font-semibold text-xs rounded-full flex items-center gap-1.5 shadow-sm">
            <CheckCircle className="w-3.5 h-3.5" /> PROCEED
          </span>
        );
      case 'CONDITIONAL_PROCEED':
        return (
          <span className="px-3 py-1 bg-amber-950/80 border border-amber-500 text-amber-300 font-semibold text-xs rounded-full flex items-center gap-1.5 shadow-sm">
            <AlertCircle className="w-3.5 h-3.5" /> CONDITIONAL PROCEED
          </span>
        );
      case 'HOLD':
        return (
          <span className="px-3 py-1 bg-slate-800 border border-slate-600 text-slate-300 font-semibold text-xs rounded-full">
            HOLD
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <header className="h-16 bg-[#0f121a] border-b border-[#232938] px-6 flex items-center justify-between shrink-0">
      {/* Left: App & Project Identity */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 pr-4 border-r border-[#232938]">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#2563eb] to-[#38bdf8] flex items-center justify-center font-bold text-white shadow-md">
            SP
          </div>
          <div>
            <h1 className="text-sm font-bold text-slate-100 tracking-tight">SitePilot</h1>
            <span className="text-[10px] text-slate-400 block font-mono">DECISION ROOM v1.0</span>
          </div>
        </div>

        <div>
          <div className="flex items-center gap-2.5">
            <h2 className="text-base font-semibold text-slate-100">{project.name}</h2>
            {getRecommendationBadge(project.recommendation)}
          </div>
          <div className="flex items-center gap-4 text-xs text-slate-400 mt-0.5">
            <span className="flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5 text-slate-500" />
              {project.location.address}
            </span>
            <span className="font-mono text-slate-500">|</span>
            <span className="text-slate-300 font-mono">
              Asking: Rp 450B (~Rp 26.7M/m²)
            </span>
          </div>
        </div>
      </div>

      {/* Right: Confidence, Readiness & Action */}
      <div className="flex items-center gap-5">
        {/* Readiness Meter */}
        <div className="flex items-center gap-2 bg-[#161a26] px-3 py-1.5 rounded-lg border border-[#273044]">
          <span className="text-[11px] text-slate-400">Site Readiness</span>
          <div className="w-20 bg-slate-800 h-2 rounded-full overflow-hidden">
            <div 
              className="bg-gradient-to-r from-sky-400 to-emerald-400 h-full rounded-full" 
              style={{ width: `${project.siteReadinessPercentage}%` }}
            />
          </div>
          <span className="text-xs font-bold text-slate-200 font-mono">{project.siteReadinessPercentage}%</span>
        </div>

        {/* Evidence Confidence */}
        <div className="flex items-center gap-1.5 bg-[#161a26] px-3 py-1.5 rounded-lg border border-[#273044] text-xs">
          <ShieldCheck className="w-4 h-4 text-amber-400" />
          <span className="text-slate-400">Confidence:</span>
          <span className="font-semibold text-amber-300 uppercase font-mono text-[11px]">{project.evidenceConfidence}</span>
        </div>
      </div>
    </header>
  );
}
