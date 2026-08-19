/**
 * SitePilot Pascal Plugin & Scene Node Architecture
 * Integrates SitePilot canonical planning entities into Pascal scene graph definitions.
 * Packages: @pascal-app/core@0.9.2, @pascal-app/viewer@0.9.2, @pascal-app/nodes@0.1.1
 */

export interface PascalNodeDefinition {
  kind: string;
  label: string;
  category: 'site' | 'envelope' | 'access' | 'massing' | 'constraint';
  description: string;
  isEditable: boolean;
}

export const SITEPILOT_PASCAL_NODE_DEFINITIONS: Record<string, PascalNodeDefinition> = {
  'sitepilot:site-boundary': {
    kind: 'sitepilot:site-boundary',
    label: 'Site Cadastral Boundary (16,850 m²)',
    category: 'site',
    description: '110m x 153.18m metric parcel boundary centered at origin (0,0)',
    isEditable: false
  },
  'sitepilot:buildable-envelope': {
    kind: 'sitepilot:buildable-envelope',
    label: 'Net Buildable Envelope (13,718 m²)',
    category: 'envelope',
    description: 'Setback-bounded buildable polygon with 10m front, 6m rear, 5m side clearances',
    isEditable: false
  },
  'sitepilot:access-arterial': {
    kind: 'sitepilot:access-arterial',
    label: 'Jl. Teuku Umar Frontage Access',
    category: 'access',
    description: '110m primary arterial roadway access datum',
    isEditable: false
  },
  'sitepilot:access-corridor': {
    kind: 'sitepilot:access-corridor',
    label: 'Northern Secondary Access Strip (6.5m)',
    category: 'access',
    description: '40m-long secondary access corridor along north perimeter',
    isEditable: false
  },
  'sitepilot:zoning-envelope': {
    kind: 'sitepilot:zoning-envelope',
    label: 'Subzone R.9 Maximum 32m Height Envelope',
    category: 'constraint',
    description: '32.0m height cap translucent volume',
    isEditable: false
  },
  'sitepilot:development-mass': {
    kind: 'sitepilot:development-mass',
    label: 'Architectural Development Mass',
    category: 'massing',
    description: 'Solid massing block with footprint, floors, floor-to-floor height, and program',
    isEditable: true
  },
  'sitepilot:overrun-crown': {
    kind: 'sitepilot:overrun-crown',
    label: 'Zoning Height Overrun Volume',
    category: 'constraint',
    description: 'Glowing crimson volume representing mass exceeding 32m zoning cap',
    isEditable: false
  },
  'sitepilot:collision-volume': {
    kind: 'sitepilot:collision-volume',
    label: 'Mass Pairwise Collision Volume',
    category: 'constraint',
    description: 'Pulsing red intersection volume between overlapping building masses',
    isEditable: false
  }
};

export interface PascalPluginManifest {
  id: string;
  name: string;
  version: string;
  author: string;
  nodeKinds: string[];
}

export const SitePilotDevelopmentPlugin: PascalPluginManifest = {
  id: 'sitepilot-development-plugin',
  name: 'SitePilot Architectural Development & Planning Plugin',
  version: '1.0.0',
  author: 'SitePilot Spatial Engine',
  nodeKinds: Object.keys(SITEPILOT_PASCAL_NODE_DEFINITIONS)
};

import { ManipulationTool, ViewportDisplayMode } from './types';

export interface PascalRuntimeDiagnostics {
  coreVersion: string;
  viewerVersion: string;
  nodesVersion: string;
  loadedPlugins: string[];
  registeredNodeDefinitions: number;
  activeSceneNodeCount: number;
  rendererType: string;
  editorToolState: ManipulationTool;
  interactionMode: ViewportDisplayMode;
  activeScenarioId: string;
}

export function getPascalRuntimeDiagnostics(
  activeNodeCount: number,
  tool: ManipulationTool,
  mode: ViewportDisplayMode,
  scenarioId: string
): PascalRuntimeDiagnostics {
  return {
    coreVersion: '0.9.2',
    viewerVersion: '0.9.2',
    nodesVersion: '0.1.1',
    loadedPlugins: [
      'SitePilotDevelopmentPlugin (v1.0.0)',
      'PascalBuiltinNodesPlugin (v0.1.1)'
    ],
    registeredNodeDefinitions: Object.keys(SITEPILOT_PASCAL_NODE_DEFINITIONS).length,
    activeSceneNodeCount: activeNodeCount,
    rendererType: 'WebGL2 (Antialiased / High-Performance Three.js Pipeline)',
    editorToolState: tool,
    interactionMode: mode,
    activeScenarioId: scenarioId
  };
}
