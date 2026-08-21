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
    label: 'Site Boundary',
    category: 'site',
    description: 'Metric parcel boundary polygon centered at origin (0,0)',
    isEditable: false
  },
  'sitepilot:buildable-envelope': {
    kind: 'sitepilot:buildable-envelope',
    label: 'Net Buildable Envelope',
    category: 'envelope',
    description: 'Setback-bounded buildable polygon with directional perimeter clearances',
    isEditable: false
  },
  'sitepilot:access-arterial': {
    kind: 'sitepilot:access-arterial',
    label: 'Primary Street Frontage Access',
    category: 'access',
    description: 'Primary roadway access datum along site frontage',
    isEditable: false
  },
  'sitepilot:access-corridor': {
    kind: 'sitepilot:access-corridor',
    label: 'Secondary Access Corridor',
    category: 'access',
    description: 'Secondary access corridor along site perimeter',
    isEditable: false
  },
  'sitepilot:zoning-envelope': {
    kind: 'sitepilot:zoning-envelope',
    label: 'Regulatory Height Envelope',
    category: 'constraint',
    description: 'Statutory or assumed height cap volume',
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
