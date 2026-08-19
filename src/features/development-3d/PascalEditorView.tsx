'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { BuildingMass, DevelopmentScenario, SiteGeometry } from '@/types';
import { getCanonicalParcelBounds } from '@/lib/geometry/engine';
import { Activity, ShieldAlert, CheckCircle2, RotateCcw, Box, Layers, Terminal } from 'lucide-react';
import { PascalDiagnosticsModal } from './PascalDiagnosticsModal';
import { getPascalRuntimeDiagnostics } from './pascal-plugin';

// Dynamically import the native Pascal Editor to ensure client-only WebGL execution
const NativePascalEditor = dynamic(
  () => import('@pascal-app/editor').then((mod) => mod.Editor),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-full min-h-[480px] bg-[#0a0d14] flex flex-col items-center justify-center text-slate-400 gap-2">
        <Activity className="w-6 h-6 animate-pulse text-[#38bdf8]" />
        <span className="text-xs font-mono">Loading Official Pascal Editor (pascalorg/editor)...</span>
      </div>
    )
  }
);

interface PascalEditorViewProps {
  site: SiteGeometry;
  activeScenario: DevelopmentScenario;
  onUpdateScenarioMasses: (scenarioId: string, updatedMasses: BuildingMass[]) => void;
}

export function PascalEditorView({
  site,
  activeScenario,
  onUpdateScenarioMasses
}: PascalEditorViewProps) {
  const [editorReady, setEditorReady] = useState(false);
  const [showDiagnostics, setShowDiagnostics] = useState(false);

  const setbacks = activeScenario.assumptionsUsed.setbacks;
  const bounds = getCanonicalParcelBounds(site.grossSiteArea, setbacks, site.frontageLength || 110);

  const diagnostics = getPascalRuntimeDiagnostics(
    8 + activeScenario.masses.length,
    'SELECT',
    'DEVELOPMENT',
    activeScenario.id
  );

  return (
    <div className="relative w-full h-full min-h-[500px] bg-[#0b0e17] border border-[#232938] rounded-xl overflow-hidden flex flex-col shadow-2xl select-none">
      {/* Top Pascal Editor Shell Header */}
      <div className="p-2.5 bg-[#121622] border-b border-[#232938] flex flex-wrap items-center justify-between gap-2 z-20">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 bg-[#182030] px-2.5 py-1.5 rounded-lg border border-[#2e3b52]">
            <Box className="w-4 h-4 text-[#38bdf8]" />
            <span className="text-xs font-bold text-slate-100 font-mono">
              Pascal Editor <span className="text-[10px] text-sky-400 font-normal">(pascalorg/editor v0.9.2)</span>
            </span>
          </div>

          <button
            onClick={() => setShowDiagnostics(true)}
            className="flex items-center gap-1 px-2 py-1 bg-[#182030] hover:bg-[#222d42] text-sky-400 rounded text-[10px] font-mono font-bold border border-[#2b3952] cursor-pointer"
          >
            <Terminal className="w-3 h-3" />
            <span>Diagnostics</span>
          </button>
        </div>

        {/* Live Planning Context Badge */}
        <div className="flex items-center gap-2 font-mono text-[11px]">
          <div className="bg-[#182030] border border-[#2b3952] px-2.5 py-1 rounded-lg text-slate-300">
            <span>Site: </span>
            <span className="text-emerald-400 font-bold">{bounds.grossSiteArea.toLocaleString()} m²</span>
          </div>
          <div className="bg-[#182030] border border-[#2b3952] px-2.5 py-1 rounded-lg text-slate-300">
            <span>Scenario: </span>
            <span className="text-amber-400 font-bold">{activeScenario.name.split(':')[0]}</span>
          </div>
        </div>
      </div>

      {/* Embedded Official Pascal Editor Canvas */}
      <div className="relative w-full flex-1 overflow-hidden bg-[#070a10]">
        <NativePascalEditor
          layoutVersion="v2"
          projectId={`sitepilot-${activeScenario.id}`}
          isLoading={false}
          onSave={async () => {}}
        />
      </div>

      {/* Pascal Diagnostics Modal */}
      {showDiagnostics && (
        <PascalDiagnosticsModal
          diagnostics={diagnostics}
          onClose={() => setShowDiagnostics(false)}
        />
      )}
    </div>
  );
}
