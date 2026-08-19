import { BuildingMass, DevelopmentScenario, Setbacks, SiteGeometry } from '@/types';

export type ViewportDisplayMode = 'DEVELOPMENT' | 'MONOCHROME' | 'CONSTRAINTS';

export type CameraProjectionMode = 'PERSPECTIVE' | 'ORTHOGRAPHIC';

export type CameraPreset = 'ISO' | 'TOP' | 'SOUTH' | 'NORTH' | 'EAST' | 'WEST' | 'RESET' | 'FRONT' | 'REAR' | 'FIT';

export type ManipulationTool = 'SELECT' | 'MOVE' | 'RESIZE' | 'HEIGHT';

export interface ViewportState {
  displayMode: ViewportDisplayMode;
  projectionMode: CameraProjectionMode;
  cameraPreset: CameraPreset;
  activeTool: ManipulationTool;
  selectedMassId: string | null;
  hoveredMassId: string | null;
  gridSnapMeters: number; // e.g. 1.0 or 0.5
  isRotating: boolean;
  showDimensions: boolean;
  showZoningCap: boolean;
}

export interface PascalSceneNode {
  id: string;
  kind: 
    | 'sitepilot:site-boundary'
    | 'sitepilot:buildable-envelope'
    | 'sitepilot:setback-reserve'
    | 'sitepilot:access-arterial'
    | 'sitepilot:access-corridor'
    | 'sitepilot:development-mass'
    | 'sitepilot:zoning-envelope'
    | 'sitepilot:overrun-crown'
    | 'sitepilot:dimension-callout';
  name: string;
  position: [number, number, number];
  dimensions: [number, number, number];
  rotation?: [number, number, number];
  properties?: Record<string, unknown>;
  massData?: BuildingMass;
}

export interface PascalSceneModel {
  siteAreaM2: number;
  buildableAreaM2: number;
  setbacks: Setbacks;
  zoningHeightCapMeters: number;
  nodes: PascalSceneNode[];
}
