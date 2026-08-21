/**
 * SitePilot Spatial Editor Adapter Interface
 * Formal boundary separating visual 3D renderers (Three.js/R3F, Pascal, That Open)
 * from the authoritative deterministic SitePilot planning domain.
 */

import { DevelopmentScenario, SiteGeometry } from '@/types';
import { SpatialCommand } from '@/lib/spatial/commands';

export type CameraPreset = 'TOP' | 'NORTH' | 'SOUTH' | 'EAST' | 'WEST' | 'ISOMETRIC' | 'FIT_SITE' | 'FIT_SELECTION';
export type VisualMode = 'SHADED_ARCHITECTURAL' | 'SOLID_XRAY' | 'WIREFRAME_EDGES' | 'PLANNING_CONSTRAINTS';

export interface TransientEditorState {
  selectedMassId: string | null;
  hoveredMassId: string | null;
  activeTool: 'SELECT' | 'MOVE' | 'RESIZE' | 'HEIGHT' | 'ROTATE' | 'MEASURE' | 'SECTION';
  cameraMode: 'PERSPECTIVE' | 'ORTHOGRAPHIC';
  visualMode: VisualMode;
  isDragging: boolean;
  activeSnapTarget?: {
    type: 'PARCEL_EDGE' | 'SETBACK_LINE' | 'MASS_EDGE' | 'GRID' | 'AXIS';
    point: { x: number; y: number; z: number };
    description: string;
  };
  dragPreview?: {
    massId: string;
    proposedPosition?: { x: number; y: number; z: number };
    proposedDimensions?: { width: number; length: number; height: number };
    proposedFloors?: number;
    deltaMeters?: number;
  };
}

export interface SpatialEditorAdapterProps {
  site: SiteGeometry;
  activeScenario: DevelopmentScenario;
  readOnly?: boolean;
  onProposeCommand: (command: SpatialCommand) => void;
  onSelectionChange?: (massId: string | null) => void;
  onCameraChange?: (preset: CameraPreset) => void;
}

export interface SpatialEditorRendererInstance {
  id: string;
  engineName: 'THREEJS_CUSTOM' | 'PASCAL_VIEWER' | 'THAT_OPEN' | 'BABYLON';
  version: string;
  mount: (container: HTMLElement) => Promise<void>;
  unmount: () => void;
  syncCanonicalScenario: (scenario: DevelopmentScenario) => void;
  setCameraPreset: (preset: CameraPreset) => void;
  setVisualMode: (mode: VisualMode) => void;
  selectMass: (massId: string | null) => void;
  cancelActivePreview: () => void;
  getCanvasElement: () => HTMLCanvasElement | null;
}
