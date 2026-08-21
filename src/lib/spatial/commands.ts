/**
 * SitePilot Canonical Command Engine & Revision Authority
 * Every spatial manipulation or scenario modification produces a typed canonical command.
 * Mutations are executed through a pure deterministic reducer with strict undo/redo and revision hashing.
 */

import { BuildingMass, DevelopmentScenario, SiteGeometry, Setbacks } from '@/types';
import { 
  calculateDevelopmentMetrics, 
  calculateMassPairwiseIntersections, 
  evaluateScenarioCompliance,
  fitMassesToBuildableEnvelope 
} from '@/lib/geometry/engine';
import crypto from 'node:crypto';

export type SpatialCommandType = 
  | 'MOVE_MASS'
  | 'RESIZE_MASS'
  | 'SET_MASS_FLOORS'
  | 'SET_MASS_PROGRAM'
  | 'DUPLICATE_MASS'
  | 'DELETE_MASS'
  | 'SET_SETBACKS'
  | 'FIT_TO_ENVELOPE'
  | 'RESET_SCENARIO';

export interface BaseCommand {
  id: string;
  type: SpatialCommandType;
  scenarioId: string;
  timestamp: string;
  author: 'USER' | 'SYSTEM' | 'AI_PROPOSAL';
  description: string;
}

export interface MoveMassCommand extends BaseCommand {
  type: 'MOVE_MASS';
  massId: string;
  previousPosition: { x: number; y: number; z: number };
  newPosition: { x: number; y: number; z: number };
}

export interface ResizeMassCommand extends BaseCommand {
  type: 'RESIZE_MASS';
  massId: string;
  previousDimensions: { width: number; length: number; height: number };
  newDimensions: { width: number; length: number; height: number };
}

export interface SetMassFloorsCommand extends BaseCommand {
  type: 'SET_MASS_FLOORS';
  massId: string;
  previousFloors: number;
  newFloors: number;
  previousFloorToFloorHeight?: number;
  floorToFloorHeight?: number;
}

export interface SetMassProgramCommand extends BaseCommand {
  type: 'SET_MASS_PROGRAM';
  massId: string;
  previousProgram: string;
  newProgram: string;
}

export interface DuplicateMassCommand extends BaseCommand {
  type: 'DUPLICATE_MASS';
  sourceMassId: string;
  newMass: BuildingMass;
}

export interface DeleteMassCommand extends BaseCommand {
  type: 'DELETE_MASS';
  massId: string;
  deletedMass: BuildingMass;
}

export interface SetSetbacksCommand extends BaseCommand {
  type: 'SET_SETBACKS';
  previousSetbacks: Setbacks;
  newSetbacks: Setbacks;
}

export interface FitToEnvelopeCommand extends BaseCommand {
  type: 'FIT_TO_ENVELOPE';
  previousMasses: BuildingMass[];
}

export interface ResetScenarioCommand extends BaseCommand {
  type: 'RESET_SCENARIO';
  previousMasses: BuildingMass[];
  initialMasses: BuildingMass[];
}

export type SpatialCommand = 
  | MoveMassCommand
  | ResizeMassCommand
  | SetMassFloorsCommand
  | SetMassProgramCommand
  | DuplicateMassCommand
  | DeleteMassCommand
  | SetSetbacksCommand
  | FitToEnvelopeCommand
  | ResetScenarioCommand;

export interface CanonicalRevision {
  revisionId: string;
  revisionHash: string;
  commandId: string;
  scenarioId: string;
  timestamp: string;
  scenarioSnapshot: DevelopmentScenario;
}

export interface CommandExecutionResult {
  success: boolean;
  error?: string;
  updatedScenario: DevelopmentScenario;
  revision: CanonicalRevision;
  inverseCommand: SpatialCommand;
}

/**
 * Computes deterministic SHA-256 hash for a scenario state snapshot.
 */
export function computeScenarioStateHash(scenario: DevelopmentScenario): string {
  const payload = {
    id: scenario.id,
    masses: scenario.masses.map((m) => ({
      id: m.id,
      name: m.name,
      pos: { 
        x: Math.round(m.position.x * 100) / 100, 
        y: Math.round(m.position.y * 100) / 100, 
        z: Math.round(m.position.z * 100) / 100 
      },
      dim: { 
        width: Math.round(m.dimensions.width * 100) / 100, 
        length: Math.round(m.dimensions.length * 100) / 100, 
        height: Math.round(m.dimensions.height * 100) / 100 
      },
      floors: m.floors,
      prog: m.program
    })),
    setbacks: scenario.assumptionsUsed.setbacks,
    totalGFA: Math.round(scenario.metrics.totalGFA),
    farKLB: Math.round(scenario.metrics.farKLB * 100) / 100,
    coverage: Math.round(scenario.metrics.siteCoveragePercentage * 10) / 10
  };
  return crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}

/**
 * Pure deterministic reducer applying a command to a scenario.
 */
export function executeSpatialCommand(
  site: SiteGeometry,
  scenario: DevelopmentScenario,
  command: SpatialCommand,
  baseInitialMasses?: BuildingMass[]
): CommandExecutionResult {
  let updatedMasses = [...scenario.masses];
  let updatedSetbacks = { ...scenario.assumptionsUsed.setbacks };
  let inverseCommand: SpatialCommand;
  const now = new Date().toISOString();

  switch (command.type) {
    case 'MOVE_MASS': {
      const idx = updatedMasses.findIndex((m) => m.id === command.massId);
      if (idx === -1) return fail(scenario, `Mass ${command.massId} not found`);
      const target = updatedMasses[idx];
      updatedMasses[idx] = {
        ...target,
        position: { ...command.newPosition }
      };
      inverseCommand = {
        ...command,
        id: `cmd-inv-${Date.now()}`,
        timestamp: now,
        previousPosition: command.newPosition,
        newPosition: command.previousPosition,
        description: `Undo: Move mass ${target.name}`
      };
      break;
    }

    case 'RESIZE_MASS': {
      const idx = updatedMasses.findIndex((m) => m.id === command.massId);
      if (idx === -1) return fail(scenario, `Mass ${command.massId} not found`);
      const target = updatedMasses[idx];
      const w = command.newDimensions.width;
      const l = command.newDimensions.length;
      const h = command.newDimensions.height;
      const footprint = Math.round(w * l * 10) / 10;
      updatedMasses[idx] = {
        ...target,
        footprintArea: footprint,
        dimensions: { width: w, length: l, height: h },
        gfa: Math.round(footprint * target.floors)
      };
      inverseCommand = {
        ...command,
        id: `cmd-inv-${Date.now()}`,
        timestamp: now,
        previousDimensions: command.newDimensions,
        newDimensions: command.previousDimensions,
        description: `Undo: Resize mass ${target.name}`
      };
      break;
    }

    case 'SET_MASS_FLOORS': {
      const idx = updatedMasses.findIndex((m) => m.id === command.massId);
      if (idx === -1) return fail(scenario, `Mass ${command.massId} not found`);
      const target = updatedMasses[idx];
      const fl = command.newFloors;
      const f2f = command.floorToFloorHeight || target.floorToFloorHeight || 3.5;
      const prevF2F = command.previousFloorToFloorHeight || target.floorToFloorHeight || 3.5;
      const h = fl * f2f;
      updatedMasses[idx] = {
        ...target,
        floors: fl,
        floorToFloorHeight: f2f,
        height: h,
        dimensions: { ...target.dimensions, height: h },
        gfa: Math.round(target.footprintArea * fl)
      };
      inverseCommand = {
        ...command,
        id: `cmd-inv-${Date.now()}`,
        timestamp: now,
        previousFloors: command.newFloors,
        newFloors: command.previousFloors,
        previousFloorToFloorHeight: f2f,
        floorToFloorHeight: prevF2F,
        description: `Undo: Set floors on ${target.name}`
      };
      break;
    }

    case 'SET_MASS_PROGRAM': {
      const idx = updatedMasses.findIndex((m) => m.id === command.massId);
      if (idx === -1) return fail(scenario, `Mass ${command.massId} not found`);
      const target = updatedMasses[idx];
      updatedMasses[idx] = {
        ...target,
        program: command.newProgram as BuildingMass['program']
      };
      inverseCommand = {
        ...command,
        id: `cmd-inv-${Date.now()}`,
        timestamp: now,
        previousProgram: command.newProgram,
        newProgram: command.previousProgram,
        description: `Undo: Change program on ${target.name}`
      };
      break;
    }

    case 'DUPLICATE_MASS': {
      updatedMasses.push(command.newMass);
      inverseCommand = {
        id: `cmd-inv-${Date.now()}`,
        type: 'DELETE_MASS',
        scenarioId: scenario.id,
        timestamp: now,
        author: 'USER',
        massId: command.newMass.id,
        deletedMass: command.newMass,
        description: `Undo: Delete duplicated mass ${command.newMass.name}`
      };
      break;
    }

    case 'DELETE_MASS': {
      const idx = updatedMasses.findIndex((m) => m.id === command.massId);
      if (idx === -1) return fail(scenario, `Mass ${command.massId} not found`);
      const removed = updatedMasses[idx];
      updatedMasses.splice(idx, 1);
      inverseCommand = {
        id: `cmd-inv-${Date.now()}`,
        type: 'DUPLICATE_MASS',
        scenarioId: scenario.id,
        timestamp: now,
        author: 'USER',
        sourceMassId: removed.id,
        newMass: removed,
        description: `Undo: Restore deleted mass ${removed.name}`
      };
      break;
    }

    case 'SET_SETBACKS': {
      updatedSetbacks = { ...command.newSetbacks };
      inverseCommand = {
        ...command,
        id: `cmd-inv-${Date.now()}`,
        timestamp: now,
        previousSetbacks: command.newSetbacks,
        newSetbacks: command.previousSetbacks,
        description: `Undo: Restore setback values`
      };
      break;
    }

    case 'FIT_TO_ENVELOPE': {
      updatedMasses = fitMassesToBuildableEnvelope(
        site.grossSiteArea,
        updatedSetbacks,
        updatedMasses,
        site.frontageLength
      );
      inverseCommand = {
        id: `cmd-inv-${Date.now()}`,
        type: 'RESET_SCENARIO',
        scenarioId: scenario.id,
        timestamp: now,
        author: 'USER',
        previousMasses: updatedMasses,
        initialMasses: command.previousMasses,
        description: `Undo: Restore masses before envelope fit`
      };
      break;
    }

    case 'RESET_SCENARIO': {
      updatedMasses = baseInitialMasses ? [...baseInitialMasses] : [...command.initialMasses];
      inverseCommand = {
        id: `cmd-inv-${Date.now()}`,
        type: 'RESET_SCENARIO',
        scenarioId: scenario.id,
        timestamp: now,
        author: 'USER',
        previousMasses: updatedMasses,
        initialMasses: command.previousMasses,
        description: `Undo: Restore custom scenario edits`
      };
      break;
    }
  }

  // Recalculate deterministic metrics, collisions, setbacks, and compliance
  const newMetrics = calculateDevelopmentMetrics(
    site.grossSiteArea,
    updatedMasses,
    updatedSetbacks,
    site.frontageLength
  );
  const newOverlap = calculateMassPairwiseIntersections(updatedMasses);
  const newCompliance = evaluateScenarioCompliance(
    site.grossSiteArea,
    updatedSetbacks,
    updatedMasses,
    newMetrics,
    newOverlap,
    {
      scenarioName: scenario.name,
      hasZoningEvidence: site.hasZoningEvidence,
      frontageLength: site.frontageLength
    }
  );

  const updatedScenario: DevelopmentScenario = {
    ...scenario,
    masses: updatedMasses,
    metrics: newMetrics,
    pairwiseOverlap: newOverlap,
    complianceReport: newCompliance,
    status: newCompliance.status as DevelopmentScenario['status'],
    assumptionsUsed: {
      ...scenario.assumptionsUsed,
      setbacks: updatedSetbacks,
      heightFloors: newMetrics.totalFloors,
      heightMeters: newMetrics.totalHeightMeters,
      targetFAR: newMetrics.farKLB,
      targetCoverageKDB: newMetrics.siteCoveragePercentage
    },
    updatedAt: now
  };

  const revisionHash = computeScenarioStateHash(updatedScenario);
  const revision: CanonicalRevision = {
    revisionId: `rev-${Date.now()}`,
    revisionHash,
    commandId: command.id,
    scenarioId: scenario.id,
    timestamp: now,
    scenarioSnapshot: updatedScenario
  };

  return {
    success: true,
    updatedScenario,
    revision,
    inverseCommand
  };
}

function fail(scenario: DevelopmentScenario, reason: string): CommandExecutionResult {
  return {
    success: false,
    error: reason,
    updatedScenario: scenario,
    revision: {
      revisionId: `rev-fail-${Date.now()}`,
      revisionHash: computeScenarioStateHash(scenario),
      commandId: 'none',
      scenarioId: scenario.id,
      timestamp: new Date().toISOString(),
      scenarioSnapshot: scenario
    },
    inverseCommand: {
      id: 'inv-none',
      type: 'RESET_SCENARIO',
      scenarioId: scenario.id,
      timestamp: new Date().toISOString(),
      author: 'SYSTEM',
      previousMasses: scenario.masses,
      initialMasses: scenario.masses,
      description: 'No-op'
    }
  };
}

/**
 * In-memory Command History Manager supporting undo/redo with revision lineage.
 */
export class ScenarioCommandHistory {
  private undoStack: SpatialCommand[] = [];
  private redoStack: SpatialCommand[] = [];
  private revisions: CanonicalRevision[] = [];

  constructor(initialScenario: DevelopmentScenario) {
    this.revisions.push({
      revisionId: `rev-0`,
      revisionHash: computeScenarioStateHash(initialScenario),
      commandId: 'init',
      scenarioId: initialScenario.id,
      timestamp: initialScenario.createdAt || new Date().toISOString(),
      scenarioSnapshot: initialScenario
    });
  }

  public recordExecution(command: SpatialCommand, inverse: SpatialCommand, revision: CanonicalRevision) {
    this.undoStack.push(inverse);
    this.redoStack = []; // Clear redo on new branch
    this.revisions.push(revision);
  }

  public get canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  public get canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  public popUndo(): SpatialCommand | undefined {
    return this.undoStack.pop();
  }

  public popRedo(): SpatialCommand | undefined {
    return this.redoStack.pop();
  }

  public pushRedo(command: SpatialCommand) {
    this.redoStack.push(command);
  }

  public get latestRevision(): CanonicalRevision | undefined {
    return this.revisions[this.revisions.length - 1];
  }
}
