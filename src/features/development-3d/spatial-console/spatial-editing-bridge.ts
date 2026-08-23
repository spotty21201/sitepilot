import type { BuildingMass, DevelopmentScenario, Project } from '@/types';
import {
  type CanonicalSpatialCommand,
  type CommandRejectionCode,
  createCanonicalCommandId,
  executeCanonicalSpatialCommand,
} from '@/lib/spatial/canonical-command-service';
import type { SpatialConsoleSnapshot } from '../spatial-editor-adapter';

export const SPATIAL_SNAP_METERS = 0.5;
export const MIN_MASS_DIMENSION_METERS = 2;
export const MAX_MASS_DIMENSION_METERS = 250;
export const MAX_EDITABLE_FLOORS = 24;
export const MIN_FLOOR_TO_FLOOR_METERS = 2.4;
export const MAX_FLOOR_TO_FLOOR_METERS = 6;

interface ProposalBase {
  caseId: string;
  scenarioId: string;
  targetId: string;
  expectedSourceRevisionId: string;
}

export type SpatialEditProposal =
  | (ProposalBase & { type: 'MOVE_MASS'; position: BuildingMass['position'] })
  | (ProposalBase & { type: 'RESIZE_MASS'; width: number; length: number })
  | (ProposalBase & { type: 'SET_MASS_FLOORS'; floors: number })
  | (ProposalBase & { type: 'SET_FLOOR_TO_FLOOR_HEIGHT'; floorToFloorHeight: number })
  | (ProposalBase & { type: 'ADD_MASS'; mass: BuildingMass })
  | (ProposalBase & { type: 'DUPLICATE_MASS'; sourceMassId: string; mass: BuildingMass })
  | (ProposalBase & { type: 'DELETE_MASS' });

export type SpatialProposalRejectionCode = CommandRejectionCode
  | 'EDIT_LIMIT'
  | 'CONSTRAINT_VIOLATION';

export type SpatialProposalEvaluation =
  | {
      valid: true;
      command: CanonicalSpatialCommand;
      scenario: DevelopmentScenario;
    }
  | {
      valid: false;
      command: CanonicalSpatialCommand;
      scenario?: DevelopmentScenario;
      code: SpatialProposalRejectionCode;
      reason: string;
    };

export type SpatialProposalViewResult = SpatialProposalEvaluation & {
  snapshot?: SpatialConsoleSnapshot;
};

export type SpatialProposalCommitResult =
  | { accepted: true; revisionId: string }
  | { accepted: false; code: SpatialProposalRejectionCode; reason: string };

function description(proposal: SpatialEditProposal): string {
  switch (proposal.type) {
    case 'MOVE_MASS': return `Move ${proposal.targetId}`;
    case 'RESIZE_MASS': return `Resize ${proposal.targetId}`;
    case 'SET_MASS_FLOORS': return `Set ${proposal.targetId} storeys`;
    case 'SET_FLOOR_TO_FLOOR_HEIGHT': return `Set ${proposal.targetId} floor-to-floor height`;
    case 'ADD_MASS': return `Add ${proposal.mass.name}`;
    case 'DUPLICATE_MASS': return `Duplicate ${proposal.sourceMassId}`;
    case 'DELETE_MASS': return `Delete ${proposal.targetId}`;
  }
}

export function spatialProposalToCommand(
  proposal: SpatialEditProposal,
  issuedAt = new Date().toISOString(),
  commandId = createCanonicalCommandId('spatial-console'),
): CanonicalSpatialCommand {
  const base = {
    id: commandId,
    caseId: proposal.caseId,
    scenarioId: proposal.scenarioId,
    targetId: proposal.targetId,
    expectedSourceRevisionId: proposal.expectedSourceRevisionId,
    issuedAt,
    source: 'SPATIAL_EDITOR_ADAPTER' as const,
    description: description(proposal),
  };
  switch (proposal.type) {
    case 'MOVE_MASS': return { ...base, type: proposal.type, payload: { position: { ...proposal.position } } };
    case 'RESIZE_MASS': return { ...base, type: proposal.type, payload: { width: proposal.width, length: proposal.length } };
    case 'SET_MASS_FLOORS': return { ...base, type: proposal.type, payload: { floors: proposal.floors } };
    case 'SET_FLOOR_TO_FLOOR_HEIGHT': return {
      ...base,
      type: proposal.type,
      payload: { floorToFloorHeight: proposal.floorToFloorHeight },
    };
    case 'ADD_MASS': return { ...base, type: proposal.type, payload: { mass: structuredClone(proposal.mass) } };
    case 'DUPLICATE_MASS': return {
      ...base,
      type: proposal.type,
      payload: { sourceMassId: proposal.sourceMassId, mass: structuredClone(proposal.mass) },
    };
    case 'DELETE_MASS': return { ...base, type: proposal.type, payload: {} };
  }
}

function editLimitReason(proposal: SpatialEditProposal): string | null {
  if (proposal.type === 'RESIZE_MASS') {
    if (proposal.width < MIN_MASS_DIMENSION_METERS || proposal.length < MIN_MASS_DIMENSION_METERS) {
      return `Width and depth must each be at least ${MIN_MASS_DIMENSION_METERS}m.`;
    }
    if (proposal.width > MAX_MASS_DIMENSION_METERS || proposal.length > MAX_MASS_DIMENSION_METERS) {
      return `Width and depth must not exceed ${MAX_MASS_DIMENSION_METERS}m.`;
    }
  }
  if (proposal.type === 'SET_MASS_FLOORS' && (proposal.floors < 1 || proposal.floors > MAX_EDITABLE_FLOORS)) {
    return `Storeys must be between 1 and ${MAX_EDITABLE_FLOORS}.`;
  }
  if (proposal.type === 'SET_FLOOR_TO_FLOOR_HEIGHT'
    && (proposal.floorToFloorHeight < MIN_FLOOR_TO_FLOOR_METERS
      || proposal.floorToFloorHeight > MAX_FLOOR_TO_FLOOR_METERS)) {
    return `Floor-to-floor height must be between ${MIN_FLOOR_TO_FLOOR_METERS}m and ${MAX_FLOOR_TO_FLOOR_METERS}m.`;
  }
  return null;
}

function requiresCompliantPreview(proposal: SpatialEditProposal): boolean {
  return proposal.type === 'MOVE_MASS'
    || proposal.type === 'RESIZE_MASS'
    || proposal.type === 'SET_MASS_FLOORS'
    || proposal.type === 'SET_FLOOR_TO_FLOOR_HEIGHT';
}

export function evaluateSpatialProposal(
  project: Project,
  proposal: SpatialEditProposal,
  issuedAt = new Date().toISOString(),
): SpatialProposalEvaluation {
  const command = spatialProposalToCommand(proposal, issuedAt, `preview:${proposal.type}:${proposal.targetId}`);
  const limitReason = editLimitReason(proposal);
  if (limitReason) return { valid: false, command, code: 'EDIT_LIMIT', reason: limitReason };

  const reduced = executeCanonicalSpatialCommand(project, command);
  if (!reduced.accepted) {
    return { valid: false, command, code: reduced.code, reason: reduced.reason };
  }
  if (requiresCompliantPreview(proposal) && !reduced.scenario.complianceReport?.isCompliant) {
    return {
      valid: false,
      command,
      scenario: reduced.scenario,
      code: 'CONSTRAINT_VIOLATION',
      reason: reduced.scenario.complianceReport?.violations[0]
        ?? 'The proposed geometry exceeds the indicative planning envelope.',
    };
  }
  return { valid: true, command, scenario: reduced.scenario };
}

export function snapSpatialValue(value: number, increment = SPATIAL_SNAP_METERS): number {
  return Math.round(value / increment) * increment;
}
