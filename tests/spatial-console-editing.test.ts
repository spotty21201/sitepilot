import { describe, expect, it, vi } from 'vitest';

import {
  evaluateSpatialProposal,
  snapSpatialValue,
  spatialProposalToCommand,
  type SpatialEditProposal,
} from '@/features/development-3d/spatial-console/spatial-editing-bridge';
import { GOLDEN_PROJECT } from '@/lib/mock-data/golden-project';
import {
  CanonicalSpatialCommandService,
  computeCanonicalScenarioHash,
  ensureCanonicalProjectRevisions,
} from '@/lib/spatial/canonical-command-service';
import type { BuildingMass, Project } from '@/types';

function projectFixture(caseId = GOLDEN_PROJECT.id): Project {
  const project = structuredClone(GOLDEN_PROJECT);
  project.id = caseId;
  project.scenarios = project.scenarios.map((scenario) => ({ ...scenario, projectId: caseId }));
  return ensureCanonicalProjectRevisions(project);
}

function proposalBase(project: Project, scenarioIndex = 0, massIndex = 0) {
  const scenario = project.scenarios[scenarioIndex];
  const mass = scenario.masses[massIndex];
  if (!scenario.canonicalRevision) throw new Error('Canonical revision is required by the fixture.');
  return {
    scenario,
    mass,
    base: {
      caseId: project.id,
      scenarioId: scenario.id,
      targetId: mass.id,
      expectedSourceRevisionId: scenario.canonicalRevision.revisionId,
    },
  };
}

describe('Spatial Console canonical editing bridge', () => {
  it('snaps direct manipulation deterministically at the documented half-metre increment', () => {
    expect(snapSpatialValue(12.24)).toBe(12);
    expect(snapSpatialValue(12.26)).toBe(12.5);
    expect(snapSpatialValue(-12.26)).toBe(-12.5);
  });

  it('previews move, resize, floors, and floor-to-floor changes without mutating canonical input', () => {
    const project = projectFixture();
    const { scenario, mass, base } = proposalBase(project);
    const beforeHash = computeCanonicalScenarioHash(scenario);
    const proposals: SpatialEditProposal[] = [
      { ...base, type: 'MOVE_MASS', position: { ...mass.position, x: mass.position.x - 0.5 } },
      { ...base, type: 'RESIZE_MASS', width: mass.dimensions.width - 1, length: mass.dimensions.length },
      { ...base, type: 'SET_MASS_FLOORS', floors: Math.max(1, mass.floors - 1) },
      { ...base, type: 'SET_FLOOR_TO_FLOOR_HEIGHT', floorToFloorHeight: 3.6 },
    ];

    for (const proposal of proposals) {
      const preview = evaluateSpatialProposal(project, proposal, '2026-08-22T04:00:00.000Z');
      expect(preview.valid).toBe(true);
      expect(preview.scenario?.canonicalRevision?.sequence).toBe((scenario.canonicalRevision?.sequence ?? 0) + 1);
      expect(computeCanonicalScenarioHash(project.scenarios[0])).toBe(beforeHash);
    }
  });

  it('rejects edit limits, stale revisions, wrong scope, and canonical constraint violations', () => {
    const project = projectFixture();
    const { mass, base } = proposalBase(project);
    const proposals: Array<[SpatialEditProposal, string]> = [
      [{ ...base, type: 'RESIZE_MASS', width: 1, length: mass.dimensions.length }, 'EDIT_LIMIT'],
      [{ ...base, type: 'SET_MASS_FLOORS', floors: 25 }, 'EDIT_LIMIT'],
      [{ ...base, type: 'MOVE_MASS', position: mass.position, expectedSourceRevisionId: 'stale' }, 'STALE_REVISION'],
      [{ ...base, type: 'MOVE_MASS', position: mass.position, caseId: 'another-case' }, 'CASE_MISMATCH'],
      [{ ...base, type: 'MOVE_MASS', position: { ...mass.position, x: 500 } }, 'CONSTRAINT_VIOLATION'],
    ];

    for (const [proposal, code] of proposals) {
      const result = evaluateSpatialProposal(project, proposal);
      expect(result.valid).toBe(false);
      if (!result.valid) expect(result.code).toBe(code);
    }
  });

  it('commits one accepted proposal exactly once through the canonical service', () => {
    const project = projectFixture();
    const { scenario, mass, base } = proposalBase(project);
    const proposal: SpatialEditProposal = {
      ...base,
      type: 'MOVE_MASS',
      position: { ...mass.position, x: mass.position.x - 0.5 },
    };
    const command = spatialProposalToCommand(
      proposal,
      '2026-08-22T04:01:00.000Z',
      'spatial-console:exactly-once',
    );
    const persist = vi.fn(() => true);
    const service = new CanonicalSpatialCommandService(persist);
    const first = service.execute(project, command);
    expect(first.accepted).toBe(true);
    expect(persist).toHaveBeenCalledTimes(1);
    expect(service.canUndo(project.id, scenario.id)).toBe(true);
    if (!first.accepted) return;

    const duplicate = service.execute(first.project, command);
    expect(duplicate.accepted).toBe(false);
    if (!duplicate.accepted) expect(duplicate.code).toBe('DUPLICATE_COMMAND');
    expect(persist).toHaveBeenCalledTimes(1);
  });

  it('does not create history or change canonical bytes when persistence rejects a commit', () => {
    const project = projectFixture();
    const { scenario, mass, base } = proposalBase(project);
    const original = JSON.stringify(project);
    const command = spatialProposalToCommand({
      ...base,
      type: 'MOVE_MASS',
      position: { ...mass.position, x: mass.position.x - 0.5 },
    }, '2026-08-22T04:02:00.000Z', 'spatial-console:persistence-failure');
    const service = new CanonicalSpatialCommandService(() => false);
    const result = service.execute(project, command);

    expect(result.accepted).toBe(false);
    if (!result.accepted) expect(result.code).toBe('PERSISTENCE_FAILED');
    expect(JSON.stringify(project)).toBe(original);
    expect(service.canUndo(project.id, scenario.id)).toBe(false);
  });

  it('supports add, duplicate, and delete with stable canonical identities', () => {
    let project = projectFixture();
    const { scenario, mass, base } = proposalBase(project);
    const compact: BuildingMass = {
      ...structuredClone(mass),
      id: 'spatial-added-stable',
      name: 'Spatial Added Mass',
      footprintPolygon: undefined,
      footprintArea: 4,
      floors: 1,
      floorToFloorHeight: 3.5,
      height: 3.5,
      gfa: 4,
      dimensions: { width: 2, length: 2, height: 3.5 },
      position: { x: 0, y: 0, z: 60 },
    };
    const service = new CanonicalSpatialCommandService(() => true);
    const addProposal: SpatialEditProposal = {
      ...base,
      type: 'ADD_MASS',
      targetId: compact.id,
      mass: compact,
    };
    const addEvaluation = evaluateSpatialProposal(project, addProposal);
    expect(addEvaluation.valid).toBe(true);
    const added = service.execute(project, spatialProposalToCommand(addProposal, undefined, 'spatial:add'));
    expect(added.accepted).toBe(true);
    if (!added.accepted) return;
    project = added.project;

    const addedScenario = project.scenarios.find((item) => item.id === scenario.id)!;
    const duplicateMass = { ...structuredClone(compact), id: 'spatial-copy-stable', position: { x: 4, y: 0, z: 60 } };
    const duplicateProposal: SpatialEditProposal = {
      caseId: project.id,
      scenarioId: scenario.id,
      targetId: duplicateMass.id,
      expectedSourceRevisionId: addedScenario.canonicalRevision!.revisionId,
      type: 'DUPLICATE_MASS',
      sourceMassId: compact.id,
      mass: duplicateMass,
    };
    expect(evaluateSpatialProposal(project, duplicateProposal).valid).toBe(true);
    const duplicated = service.execute(project, spatialProposalToCommand(duplicateProposal, undefined, 'spatial:duplicate'));
    expect(duplicated.accepted).toBe(true);
    if (!duplicated.accepted) return;
    project = duplicated.project;
    expect(duplicated.scenario.masses.map((item) => item.id)).toContain(duplicateMass.id);

    const deleteProposal: SpatialEditProposal = {
      caseId: project.id,
      scenarioId: scenario.id,
      targetId: duplicateMass.id,
      expectedSourceRevisionId: duplicated.scenario.canonicalRevision!.revisionId,
      type: 'DELETE_MASS',
    };
    const deleted = service.execute(project, spatialProposalToCommand(deleteProposal, undefined, 'spatial:delete'));
    expect(deleted.accepted).toBe(true);
    if (!deleted.accepted) return;
    expect(deleted.scenario.masses.map((item) => item.id)).not.toContain(duplicateMass.id);
    const undo = service.undo(deleted.project, project.id, scenario.id, '2026-08-22T04:03:00.000Z');
    expect(undo.project.scenarios[0].masses.map((item) => item.id)).toContain(duplicateMass.id);
  });

  it('keeps case and scenario history isolated when Spatial Console commands are committed', () => {
    const caseA = projectFixture('case-a');
    const caseB = projectFixture('case-b');
    const service = new CanonicalSpatialCommandService(() => true);
    const first = proposalBase(caseA, 0, 0);
    const second = proposalBase(caseA, 1, 0);
    const committed = service.execute(caseA, spatialProposalToCommand({
      ...first.base,
      type: 'MOVE_MASS',
      position: { ...first.mass.position, x: first.mass.position.x - 0.5 },
    }, undefined, 'spatial:scope'));
    expect(committed.accepted).toBe(true);
    expect(service.canUndo(caseA.id, first.scenario.id)).toBe(true);
    expect(service.canUndo(caseA.id, second.scenario.id)).toBe(false);
    expect(service.canUndo(caseB.id, first.scenario.id)).toBe(false);
    expect(service.undo(caseB, caseA.id, first.scenario.id).accepted).toBe(false);
  });

  it('rebases revision lineage across sequential undo and redo operations', () => {
    let project = projectFixture();
    const { scenario, mass, base } = proposalBase(project);
    const service = new CanonicalSpatialCommandService(() => true);
    const moved = service.execute(project, spatialProposalToCommand({
      ...base,
      type: 'MOVE_MASS',
      position: { ...mass.position, x: mass.position.x - 0.5 },
    }, '2026-08-22T04:10:00.000Z', 'spatial:sequential-move'));
    expect(moved.accepted).toBe(true);
    if (!moved.accepted) return;
    project = moved.project;

    const movedScenario = project.scenarios.find((item) => item.id === scenario.id)!;
    const resized = service.execute(project, spatialProposalToCommand({
      caseId: project.id,
      scenarioId: scenario.id,
      targetId: mass.id,
      expectedSourceRevisionId: movedScenario.canonicalRevision!.revisionId,
      type: 'RESIZE_MASS',
      width: mass.dimensions.width - 1,
      length: mass.dimensions.length,
    }, '2026-08-22T04:11:00.000Z', 'spatial:sequential-resize'));
    expect(resized.accepted).toBe(true);
    if (!resized.accepted) return;

    const undoResize = service.undo(resized.project, project.id, scenario.id, '2026-08-22T04:12:00.000Z');
    expect(undoResize.accepted).toBe(true);
    const undoMove = service.undo(undoResize.project, project.id, scenario.id, '2026-08-22T04:13:00.000Z');
    expect(undoMove.accepted).toBe(true);
    expect(undoMove.project.scenarios[0].masses[0].position).toEqual(mass.position);

    const redoMove = service.redo(undoMove.project, project.id, scenario.id, '2026-08-22T04:14:00.000Z');
    expect(redoMove.accepted).toBe(true);
    const redoResize = service.redo(redoMove.project, project.id, scenario.id, '2026-08-22T04:15:00.000Z');
    expect(redoResize.accepted).toBe(true);
    expect(redoResize.project.scenarios[0].masses[0].dimensions.width).toBe(mass.dimensions.width - 1);
  });
});
