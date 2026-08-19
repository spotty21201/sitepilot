'use client';

import React, { useEffect, useRef } from 'react';
import { PascalRuntimeDiagnostics, SITEPILOT_PASCAL_NODE_DEFINITIONS } from './pascal-plugin';
import { Terminal, X, CheckCircle2, Box, Layers, Cpu, ShieldCheck } from 'lucide-react';

interface PascalDiagnosticsModalProps {
  diagnostics: PascalRuntimeDiagnostics;
  onClose: () => void;
}

export function PascalDiagnosticsModal({ diagnostics, onClose }: PascalDiagnosticsModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);

  // Accessible Keyboard Trap & Escape Dismiss
  useEffect(() => {
    // Focus close button initially
    const focusable = modalRef.current?.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    if (focusable && focusable.length > 0) {
      focusable[0].focus();
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }

      if (e.key === 'Tab') {
        const focusableElements = modalRef.current?.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (!focusableElements || focusableElements.length === 0) return;

        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

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
  }, [onClose]);

  return (
    <div 
      role="dialog"
      aria-modal="true"
      aria-labelledby="diagnostics-modal-title"
      aria-describedby="diagnostics-modal-desc"
      onClick={onClose}
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 select-none"
    >
      <div 
        ref={modalRef}
        onClick={(e) => e.stopPropagation()}
        className="bg-[#10141f] border border-[#2b3952] rounded-xl max-w-2xl w-full max-h-[85vh] flex flex-col shadow-2xl overflow-hidden font-sans"
      >
        {/* Header */}
        <div className="p-3 border-b border-[#232938] flex items-center justify-between bg-[#141926]">
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4 text-[#38bdf8]" />
            <h4 id="diagnostics-modal-title" className="text-xs font-bold text-slate-100 uppercase tracking-wider">
              System Runtime & Architecture Diagnostics
            </h4>
          </div>
          <button
            onClick={onClose}
            aria-label="Close dialog"
            className="p-1 text-slate-400 hover:text-white rounded hover:bg-[#20283b] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div id="diagnostics-modal-desc" className="p-4 flex-1 overflow-y-auto space-y-4 text-xs">
          {/* Version Stack */}
          <div className="bg-[#0b0e17] border border-[#1e2738] rounded-lg p-3 space-y-2">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Cpu className="w-3.5 h-3.5 text-[#38bdf8]" />
              <span>Spatial Engine & Pinned Package Stack</span>
            </div>
            <div className="grid grid-cols-3 gap-2 font-mono text-[11px]">
              <div className="bg-[#141a28] p-2 rounded border border-[#222c40]">
                <span className="text-slate-500 block text-[9px]">CORE</span>
                <span className="text-emerald-400 font-bold">@pascal-app/core</span>
                <span className="text-slate-300 block text-[10px]">v{diagnostics.coreVersion}</span>
              </div>
              <div className="bg-[#141a28] p-2 rounded border border-[#222c40]">
                <span className="text-slate-500 block text-[9px]">VIEWER</span>
                <span className="text-sky-400 font-bold">@pascal-app/viewer</span>
                <span className="text-slate-300 block text-[10px]">v{diagnostics.viewerVersion}</span>
              </div>
              <div className="bg-[#141a28] p-2 rounded border border-[#222c40]">
                <span className="text-slate-500 block text-[9px]">NODES</span>
                <span className="text-amber-400 font-bold">@pascal-app/nodes</span>
                <span className="text-slate-300 block text-[10px]">v{diagnostics.nodesVersion}</span>
              </div>
            </div>
          </div>

          {/* Loaded Plugins */}
          <div className="bg-[#0b0e17] border border-[#1e2738] rounded-lg p-3 space-y-2">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>Active Architecture Plugins</span>
            </div>
            <div className="space-y-1.5 font-mono text-[11px]">
              {diagnostics.loadedPlugins.map((plugin, idx) => (
                <div key={idx} className="flex items-center gap-2 text-slate-200 bg-[#141926] px-2.5 py-1.5 rounded border border-[#222d42]">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span>{plugin}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Registered Node Definitions */}
          <div className="bg-[#0b0e17] border border-[#1e2738] rounded-lg p-3 space-y-2">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-[#e2b170]" />
                <span>Registered Scene Node Definitions ({diagnostics.registeredNodeDefinitions})</span>
              </span>
              <span className="font-mono text-emerald-400">{diagnostics.activeSceneNodeCount} Active Scene Nodes</span>
            </div>
            <div className="grid grid-cols-2 gap-1.5 font-mono text-[10px]">
              {Object.values(SITEPILOT_PASCAL_NODE_DEFINITIONS).map((def) => (
                <div key={def.kind} className="bg-[#131826] p-2 rounded border border-[#1f283d] space-y-0.5">
                  <div className="text-[#38bdf8] font-bold truncate">{def.kind}</div>
                  <div className="text-slate-400 text-[9px] truncate">{def.description}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Renderer Status */}
          <div className="bg-[#0b0e17] border border-[#1e2738] rounded-lg p-3 space-y-2">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Box className="w-3.5 h-3.5 text-[#38bdf8]" />
              <span>Pipeline & State</span>
            </div>
            <div className="grid grid-cols-2 gap-2 font-mono text-[11px]">
              <div className="bg-[#141926] p-2 rounded border border-[#222d42]">
                <span className="text-slate-500 block text-[9px]">RENDERER</span>
                <span className="text-slate-200">{diagnostics.rendererType}</span>
              </div>
              <div className="bg-[#141926] p-2 rounded border border-[#222d42]">
                <span className="text-slate-500 block text-[9px]">TOOL STATE</span>
                <span className="text-emerald-400 font-bold">{diagnostics.editorToolState}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-[#232938] flex items-center justify-between bg-[#141926]">
          <span className="text-[11px] font-mono text-slate-400">
            Scenario ID: <span className="text-slate-200 font-bold">{diagnostics.activeScenarioId}</span>
          </span>
          <button
            onClick={onClose}
            className="px-3.5 py-1.5 bg-[#2563eb] hover:bg-[#1d4ed8] text-white rounded text-xs font-semibold cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
