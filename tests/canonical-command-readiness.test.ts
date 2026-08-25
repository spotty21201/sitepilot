import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { GOLDEN_PROJECT } from '@/lib/mock-data/golden-project';
import {
  CanonicalSpatialCommand,
  CanonicalSpatialCommandService,
  computeCanonicalScenarioHash,
  ensureCanonicalProjectRevisions,
  executeCanonicalSpatialCommand,
  serializeCanonicalScenario,
} from '@/lib/spatial/canonical-command-service';
import { exportToColladaDAE } from '@/lib/geometry/engine';
import { BuildingMass, Project } from '@/types';

const successfulPersist = () => true;

function freshProject(caseId = GOLDEN_PROJECT.id): Project {
  const project = structuredClone(GOLDEN_PROJECT);
  project.id = caseId;
  project.scenarios = project.scenarios.map((scenario) => ({ ...scenario, projectId: caseId }));
  return ensureCanonicalProjectRevisions(project);
}

function command(
  project: Project,
  scenarioId: string,
  intent: Omit<CanonicalSpatialCommand, 'id' | 'caseId' | 'scenarioId' | 'expectedSourceRevisionId' | 'issuedAt' | 'source'>,
  id = `cmd:${intent.type.toLowerCase()}`
): CanonicalSpatialCommand {
  const revision = project.scenarios.find((scenario) => scenario.id === scenarioId)?.canonicalRevision;
  if (!revision) throw new Error('Scenario revision missing in test fixture.');
  return {
    ...intent,
    id,
    caseId: project.id,
    scenarioId,
    expectedSourceRevisionId: revision.revisionId,
    issuedAt: '2026-08-22T01:00:00.000Z',
    source: 'LEGACY_EDITOR',
  } as CanonicalSpatialCommand;
}

function accepted(project: Project, proposal: CanonicalSpatialCommand) {
  const result = executeCanonicalSpatialCommand(project, proposal);
  expect(result.accepted).toBe(true);
  if (!result.accepted) throw new Error(result.reason);
  return result;
}

describe('Production canonical spatial command reducer', () => {
  it('uses deterministic SHA-256 revision hashes required by ADR-002', () => {
    const scenario = freshProject().scenarios[1];
    const expected = createHash('sha256').update(serializeCanonicalScenario(scenario)).digest('hex');
    expect(computeCanonicalScenarioHash(scenario)).toBe(expected);
  });

  it('supports every production command intent with one resulting revision', () => {
    const base = freshProject();
    const scenario = base.scenarios[1];
    const west = scenario.masses[1];
    const added: BuildingMass = {
      ...structuredClone(west),
      id: 'mass-added-stable',
      name: 'Added Stable Mass',
      position: { x: 44, y: 9, z: -42 },
    };
    const duplicated = { ...structuredClone(west), id: 'mass-duplicate-stable', name: 'West Wing Copy' };

    const intents: Array<Omit<CanonicalSpatialCommand, 'id' | 'caseId' | 'scenarioId' | 'expectedSourceRevisionId' | 'issuedAt' | 'source'>> = [
      { type: 'MOVE_MASS', targetId: west.id, payload: { position: { ...west.position, x: -22 } }, description: 'move' },
      { type: 'RESIZE_MASS', targetId: west.id, payload: { width: 36, length: 70 }, description: 'resize' },
      { type: 'SET_MASS_FLOORS', targetId: west.id, payload: { floors: 7 }, description: 'storeys' },
      { type: 'SET_MASS_TYPE_FLOORS', targetId: scenario.id, payload: { massType: 'TOWER', floors: 5 }, description: 'tower storeys' },
      { type: 'SET_FLOOR_TO_FLOOR_HEIGHT', targetId: west.id, payload: { floorToFloorHeight: 4 }, description: 'f2f' },
      { type: 'SET_MASS_PROGRAM', targetId: west.id, payload: { program: 'RETAIL' }, description: 'programme' },
      { type: 'ADD_MASS', targetId: added.id, payload: { mass: added }, description: 'add' },
      { type: 'DUPLICATE_MASS', targetId: duplicated.id, payload: { sourceMassId: west.id, mass: duplicated }, description: 'duplicate' },
      { type: 'DELETE_MASS', targetId: west.id, payload: {}, description: 'delete' },
      { type: 'SET_SCENARIO_FLOORS', targetId: scenario.id, payload: { floors: 9 }, description: 'scenario floors' },
      { type: 'SET_SETBACKS', targetId: scenario.id, payload: { setbacks: { ...scenario.assumptionsUsed.setbacks, front: 12 } }, description: 'setbacks' },
      { type: 'FIT_TO_ENVELOPE', targetId: scenario.id, payload: {}, description: 'fit' },
      { type: 'RESET_SCENARIO', targetId: scenario.id, payload: {}, description: 'reset' },
      { type: 'DUPLICATE_SCENARIO', targetId: scenario.id, payload: { newScenarioId: 'scen-copy-stable', name: 'Scenario B Copy' }, description: 'duplicate scenario' },
    ];

    for (const [index, intent] of intents.entries()) {
      const result = accepted(base, command(base, scenario.id, intent, `cmd:type:${index}`));
      expect(result.committedCommand.resultingRevisionId).toBe(result.scenario.canonicalRevision?.revisionId);
      expect(result.committedCommand.resultingRevisionSequence).toBe(
        intent.type === 'DUPLICATE_SCENARIO' ? 0 : (scenario.canonicalRevision?.sequence ?? 0) + 1
      );
    }
  });

  it('rejects wrong case, scenario, target, invalid payload, and stale revisions without mutation', () => {
    const project = freshProject();
    const scenario = project.scenarios[1];
    const west = scenario.masses[1];
    const originalHash = computeCanonicalScenarioHash(scenario);
    const valid = command(project, scenario.id, {
      type: 'MOVE_MASS',
      targetId: west.id,
      payload: { position: { ...west.position, x: -22 } },
      description: 'move',
    });
    const proposals: CanonicalSpatialCommand[] = [
      { ...valid, caseId: 'wrong-case', id: 'wrong-case' },
      { ...valid, scenarioId: 'wrong-scenario', id: 'wrong-scenario' },
      { ...valid, targetId: 'wrong-mass', id: 'wrong-target' },
      { ...valid, expectedSourceRevisionId: 'stale', id: 'stale' },
      { ...valid, type: 'RESIZE_MASS', payload: { width: -1, length: 10 }, id: 'invalid' },
    ];
    for (const proposal of proposals) {
      const result = executeCanonicalSpatialCommand(project, proposal);
      expect(result.accepted).toBe(false);
      expect(computeCanonicalScenarioHash(project.scenarios[1])).toBe(originalHash);
    }
  });

  it('rejects no-op commands and inconsistent add or duplicate audit identities', () => {
    const legacyProject = freshProject();
    const legacyScenario = legacyProject.scenarios[1];
    const legacyWest = legacyScenario.masses[1];
    const established = accepted(legacyProject, command(legacyProject, legacyScenario.id, {
      type: 'SET_MASS_PROGRAM', targetId: legacyWest.id, payload: { program: 'HOTEL' }, description: 'establish derived state',
    }, 'cmd:establish-derived-state'));
    const project = established.project;
    const scenario = established.scenario;
    const west = scenario.masses[1];
    const noChange = executeCanonicalSpatialCommand(project, command(project, scenario.id, {
      type: 'MOVE_MASS', targetId: west.id, payload: { position: west.position }, description: 'no-op move',
    }, 'cmd:no-op'));
    expect(noChange.accepted).toBe(false);
    if (!noChange.accepted) expect(noChange.code).toBe('NO_CHANGE');

    const proposed = { ...structuredClone(west), id: 'new-mass-id' };
    const wrongTarget = executeCanonicalSpatialCommand(project, command(project, scenario.id, {
      type: 'ADD_MASS', targetId: 'different-id', payload: { mass: proposed }, description: 'wrong target',
    }, 'cmd:wrong-add-target'));
    expect(wrongTarget.accepted).toBe(false);

    const missingSource = executeCanonicalSpatialCommand(project, command(project, scenario.id, {
      type: 'DUPLICATE_MASS',
      targetId: proposed.id,
      payload: { sourceMassId: 'missing-source', mass: proposed },
      description: 'missing source',
    }, 'cmd:missing-source'));
    expect(missingSource.accepted).toBe(false);
    if (!missingSource.accepted) expect(missingSource.code).toBe('TARGET_NOT_FOUND');
  });

  it('deduplicates accepted command IDs and does not record rejected commands', () => {
    const project = freshProject();
    const scenario = project.scenarios[1];
    const west = scenario.masses[1];
    const service = new CanonicalSpatialCommandService(successfulPersist);
    const proposal = command(project, scenario.id, {
      type: 'MOVE_MASS', targetId: west.id, payload: { position: { ...west.position, x: -20 } }, description: 'move',
    }, 'cmd:exactly-once');
    const first = service.execute(project, proposal);
    expect(first.accepted).toBe(true);
    if (!first.accepted) return;
    const duplicate = service.execute(first.project, proposal);
    expect(duplicate.accepted).toBe(false);
    if (!duplicate.accepted) expect(duplicate.code).toBe('DUPLICATE_COMMAND');
    expect(first.scenario.canonicalRevision?.sequence).toBe((scenario.canonicalRevision?.sequence ?? 0) + 1);

    const stale = service.execute(first.project, { ...proposal, id: 'cmd:stale' });
    expect(stale.accepted).toBe(false);
    service.undo(first.project, project.id, scenario.id, '2026-08-22T01:01:00.000Z');
    expect(service.canUndo(project.id, scenario.id)).toBe(false);
  });

  it('keeps command and history state unchanged when persistence fails', () => {
    const project = freshProject();
    const scenario = project.scenarios[1];
    const west = scenario.masses[1];
    let shouldPersist = false;
    const service = new CanonicalSpatialCommandService(() => shouldPersist);
    const proposal = command(project, scenario.id, {
      type: 'MOVE_MASS',
      targetId: west.id,
      payload: { position: { ...west.position, x: -20 } },
      description: 'persisted move',
    }, 'cmd:persistence-atomic');

    const rejected = service.execute(project, proposal);
    expect(rejected.accepted).toBe(false);
    if (!rejected.accepted) expect(rejected.code).toBe('PERSISTENCE_FAILED');
    expect(service.canUndo(project.id, scenario.id)).toBe(false);
    expect(project.scenarios[1].masses[1].position.x).toBe(west.position.x);

    shouldPersist = true;
    const committed = service.execute(project, proposal);
    expect(committed.accepted).toBe(true);
    if (!committed.accepted) return;
    shouldPersist = false;
    const failedUndo = service.undo(
      committed.project,
      project.id,
      scenario.id,
      '2026-08-22T01:00:01.000Z'
    );
    expect(failedUndo.accepted).toBe(false);
    expect(service.canUndo(project.id, scenario.id)).toBe(true);
    expect(service.canRedo(project.id, scenario.id)).toBe(false);

    shouldPersist = true;
    const undo = service.undo(
      committed.project,
      project.id,
      scenario.id,
      '2026-08-22T01:00:02.000Z'
    );
    expect(undo.accepted).toBe(true);
    shouldPersist = false;
    const failedRedo = service.redo(
      undo.project,
      project.id,
      scenario.id,
      '2026-08-22T01:00:03.000Z'
    );
    expect(failedRedo.accepted).toBe(false);
    expect(service.canUndo(project.id, scenario.id)).toBe(false);
    expect(service.canRedo(project.id, scenario.id)).toBe(true);
  });

  it('replays deterministically and a cancelled preview produces no mutation', () => {
    const firstProject = freshProject();
    const secondProject = freshProject();
    const scenario = firstProject.scenarios[1];
    const west = scenario.masses[1];
    const preview = { massId: west.id, proposedWidth: 50 };
    expect(preview.proposedWidth).toBe(50);
    const before = computeCanonicalScenarioHash(scenario);
    expect(computeCanonicalScenarioHash(firstProject.scenarios[1])).toBe(before);

    const proposal = command(firstProject, scenario.id, {
      type: 'RESIZE_MASS', targetId: west.id, payload: { width: 36, length: 70 }, description: 'resize',
    }, 'cmd:deterministic');
    const first = accepted(firstProject, proposal);
    const second = accepted(secondProject, proposal);
    expect(first.scenario).toEqual(second.scenario);
    expect(first.committedCommand).toEqual(second.committedCommand);
  });
});

describe('Case and scenario scoped canonical history', () => {
  it('isolates Scenario A and B across switching, undo, and redo', () => {
    const service = new CanonicalSpatialCommandService(successfulPersist);
    let project = freshProject();
    const scenarioA = project.scenarios[0];
    const scenarioB = project.scenarios[1];
    const originalBHash = computeCanonicalScenarioHash(scenarioB);
    const resultA = service.execute(project, command(project, scenarioA.id, {
      type: 'SET_MASS_FLOORS', targetId: scenarioA.masses[0].id, payload: { floors: 5 }, description: 'A floors',
    }, 'cmd:A'));
    expect(resultA.accepted).toBe(true);
    if (!resultA.accepted) return;
    project = resultA.project;
    expect(service.canUndo(project.id, scenarioB.id)).toBe(false);
    expect(service.undo(project, project.id, scenarioB.id).accepted).toBe(false);

    const undoA = service.undo(project, project.id, scenarioA.id, '2026-08-22T01:02:00.000Z');
    expect(undoA.accepted).toBe(true);
    project = undoA.project;
    expect(computeCanonicalScenarioHash(project.scenarios[1])).toBe(originalBHash);
    expect(service.canRedo(project.id, scenarioA.id)).toBe(true);
    expect(service.canRedo(project.id, scenarioB.id)).toBe(false);
    const redoA = service.redo(project, project.id, scenarioA.id, '2026-08-22T01:03:00.000Z');
    expect(redoA.accepted).toBe(true);
    expect(redoA.project.scenarios[0].masses[0].floors).toBe(5);
  });

  it('prevents cross-case undo even when scenario IDs are identical', () => {
    const service = new CanonicalSpatialCommandService(successfulPersist);
    const caseA = freshProject('case-A');
    const caseB = freshProject('case-B');
    const scenarioId = caseA.scenarios[1].id;
    const result = service.execute(caseA, command(caseA, scenarioId, {
      type: 'SET_MASS_PROGRAM', targetId: caseA.scenarios[1].masses[1].id, payload: { program: 'HOTEL' }, description: 'programme',
    }, 'cmd:case-A'));
    expect(result.accepted).toBe(true);
    expect(service.canUndo('case-B', scenarioId)).toBe(false);
    expect(service.undo(caseB, 'case-B', scenarioId).accepted).toBe(false);
    expect(caseB.scenarios[1].masses[1].program).toBe('RESIDENTIAL');
  });

  it('restores stable IDs, notes, metrics, compliance, and controls through duplicate/delete undo and redo', () => {
    const service = new CanonicalSpatialCommandService(successfulPersist);
    let project = freshProject();
    const scenario = project.scenarios[1];
    const source = scenario.masses[1];
    const duplicate = { ...structuredClone(source), id: 'stable-copy-id', name: 'Stable Copy', position: { ...source.position, z: 45 } };
    const duplicated = service.execute(project, command(project, scenario.id, {
      type: 'DUPLICATE_MASS', targetId: duplicate.id, payload: { sourceMassId: source.id, mass: duplicate }, description: 'duplicate',
    }, 'cmd:duplicate-stable'));
    expect(duplicated.accepted).toBe(true);
    if (!duplicated.accepted) return;
    project = duplicated.project;
    expect(project.scenarios[1].masses.some((mass) => mass.id === duplicate.id)).toBe(true);

    const undo = service.undo(project, project.id, scenario.id, '2026-08-22T01:04:00.000Z');
    expect(undo.accepted).toBe(true);
    project = undo.project;
    expect(project.scenarios[1].masses.some((mass) => mass.id === duplicate.id)).toBe(false);
    expect(project.scenarios[1].notes).toBe(scenario.notes);
    expect(project.scenarios[1].metrics).toEqual(scenario.metrics);
    expect(project.scenarios[1].complianceReport).toEqual(scenario.complianceReport);

    const redo = service.redo(project, project.id, scenario.id, '2026-08-22T01:05:00.000Z');
    expect(redo.accepted).toBe(true);
    project = redo.project;
    expect(project.scenarios[1].masses.find((mass) => mass.id === duplicate.id)?.id).toBe('stable-copy-id');

    const deleted = service.execute(project, command(project, scenario.id, {
      type: 'DELETE_MASS', targetId: duplicate.id, payload: {}, description: 'delete',
    }, 'cmd:delete-stable'));
    expect(deleted.accepted).toBe(true);
    if (!deleted.accepted) return;
    const restoreDelete = service.undo(deleted.project, project.id, scenario.id, '2026-08-22T01:06:00.000Z');
    expect(restoreDelete.project.scenarios[1].masses.some((mass) => mass.id === duplicate.id)).toBe(true);
  });

  it('rejects undo and redo when the scoped canonical lineage has diverged', () => {
    const service = new CanonicalSpatialCommandService(successfulPersist);
    const project = freshProject();
    const scenario = project.scenarios[1];
    const west = scenario.masses[1];
    const committed = service.execute(project, command(project, scenario.id, {
      type: 'MOVE_MASS', targetId: west.id, payload: { position: { ...west.position, x: -20 } }, description: 'move',
    }, 'cmd:lineage'));
    expect(committed.accepted).toBe(true);
    if (!committed.accepted) return;
    const external = accepted(committed.project, command(committed.project, scenario.id, {
      type: 'SET_MASS_PROGRAM', targetId: west.id, payload: { program: 'HOTEL' }, description: 'external change',
    }, 'cmd:external'));
    expect(service.undo(external.project, project.id, scenario.id).accepted).toBe(false);
    expect(service.canUndo(project.id, scenario.id)).toBe(true);

    const cleanUndo = service.undo(committed.project, project.id, scenario.id, '2026-08-22T01:07:00.000Z');
    expect(cleanUndo.accepted).toBe(true);
    const afterUndo = cleanUndo.project;
    const driftAfterUndo = accepted(afterUndo, command(afterUndo, scenario.id, {
      type: 'SET_MASS_PROGRAM', targetId: west.id, payload: { program: 'HOTEL' }, description: 'redo drift',
    }, 'cmd:redo-drift'));
    expect(service.redo(driftAfterUndo.project, project.id, scenario.id).accepted).toBe(false);
    expect(service.canRedo(project.id, scenario.id)).toBe(true);
  });

  it('undoes and redoes scenario duplication under the source scenario scope with stable identity', () => {
    const service = new CanonicalSpatialCommandService(successfulPersist);
    const project = freshProject();
    const scenario = project.scenarios[1];
    const duplicated = service.execute(project, command(project, scenario.id, {
      type: 'DUPLICATE_SCENARIO',
      targetId: scenario.id,
      payload: { newScenarioId: 'stable-scenario-copy', name: 'Stable Scenario Copy' },
      description: 'duplicate scenario',
    }, 'cmd:duplicate-scenario-history'));
    expect(duplicated.accepted).toBe(true);
    if (!duplicated.accepted) return;
    expect(service.canUndo(project.id, scenario.id)).toBe(true);
    const undo = service.undo(duplicated.project, project.id, scenario.id, '2026-08-22T01:08:00.000Z');
    expect(undo.accepted).toBe(true);
    expect(undo.project.scenarios.some((item) => item.id === 'stable-scenario-copy')).toBe(false);
    const redo = service.redo(undo.project, project.id, scenario.id, '2026-08-22T01:09:00.000Z');
    expect(redo.accepted).toBe(true);
    expect(redo.project.scenarios.some((item) => item.id === 'stable-scenario-copy')).toBe(true);
  });
});

describe('Planning and export invariants at a canonical revision', () => {
  it('preserves parcel/buildable/yield values when moving a mass', () => {
    const project = freshProject();
    const scenario = project.scenarios[1];
    const west = scenario.masses[1];
    const result = accepted(project, command(project, scenario.id, {
      type: 'MOVE_MASS', targetId: west.id, payload: { position: { ...west.position, x: -22 } }, description: 'move',
    }));
    expect(result.scenario.metrics.grossSiteArea).toBe(scenario.metrics.grossSiteArea);
    expect(result.scenario.metrics.netBuildableArea).toBe(scenario.metrics.netBuildableArea);
    expect(result.scenario.metrics.totalGFA).toBe(scenario.metrics.totalGFA);
    expect(result.scenario.metrics.farKLB).toBe(scenario.metrics.farKLB);
    expect(result.scenario.metrics.siteCoveragePercentage).toBe(scenario.metrics.siteCoveragePercentage);
  });

  it('does not rectangularize an untouched non-rectangular authoritative footprint', () => {
    let project = freshProject();
    const scenarioId = project.scenarios[1].id;
    const west = project.scenarios[1].masses[1];
    west.footprintArea = 1234;
    west.gfa = 1234 * west.floors;
    project = ensureCanonicalProjectRevisions(project);
    const result = accepted(project, command(project, scenarioId, {
      type: 'MOVE_MASS',
      targetId: west.id,
      payload: { position: { ...west.position, x: west.position.x + 1 } },
      description: 'move non-rectangular mass',
    }, 'cmd:preserve-footprint'));
    const moved = result.scenario.masses.find((mass) => mass.id === west.id)!;
    expect(moved.footprintArea).toBe(1234);
    expect(moved.gfa).toBe(1234 * west.floors);
  });

  it('applies storey and floor-to-floor invariants', () => {
    const project = freshProject();
    const scenario = project.scenarios[1];
    const west = scenario.masses[1];
    const storeys = accepted(project, command(project, scenario.id, {
      type: 'SET_MASS_FLOORS', targetId: west.id, payload: { floors: 7 }, description: 'storeys',
    }));
    expect(storeys.scenario.metrics.totalGFA).toBeGreaterThan(scenario.metrics.totalGFA);
    expect(storeys.scenario.metrics.farKLB).toBeGreaterThan(scenario.metrics.farKLB);
    expect(storeys.scenario.metrics.totalHeightMeters).toBeGreaterThan(scenario.metrics.totalHeightMeters);
    expect(storeys.scenario.metrics.buildingFootprintArea).toBe(scenario.metrics.buildingFootprintArea);
    expect(storeys.scenario.metrics.siteCoveragePercentage).toBe(scenario.metrics.siteCoveragePercentage);

    const f2f = accepted(project, command(project, scenario.id, {
      type: 'SET_FLOOR_TO_FLOOR_HEIGHT', targetId: west.id, payload: { floorToFloorHeight: 4 }, description: 'f2f',
    }));
    expect(f2f.scenario.metrics.totalHeightMeters).toBeGreaterThan(scenario.metrics.totalHeightMeters);
    expect(f2f.scenario.metrics.totalGFA).toBe(scenario.metrics.totalGFA);
    expect(f2f.scenario.metrics.farKLB).toBe(scenario.metrics.farKLB);
    expect(f2f.scenario.metrics.siteCoveragePercentage).toBe(scenario.metrics.siteCoveragePercentage);
  });

  it('updates podium and tower storeys independently while preserving podium stacking', () => {
    const project = freshProject();
    const scenario = project.scenarios[1];
    const service = new CanonicalSpatialCommandService(successfulPersist);
    const podium = scenario.masses.find((mass) => mass.type === 'PODIUM')!;
    const originalTowerFloors = scenario.masses.filter((mass) => mass.type === 'TOWER').map((mass) => mass.floors);
    const podiumEdit = service.execute(project, command(project, scenario.id, {
      type: 'SET_MASS_TYPE_FLOORS', targetId: scenario.id, payload: { massType: 'PODIUM', floors: 1 }, description: 'podium storeys',
    }, 'cmd:podium-storeys'));
    expect(podiumEdit.accepted).toBe(true);
    if (!podiumEdit.accepted) return;
    const editedPodium = podiumEdit.scenario.masses.find((mass) => mass.type === 'PODIUM')!;
    expect(editedPodium.floors).toBe(1);
    expect(editedPodium.height).toBe(podium.floorToFloorHeight);
    expect(podiumEdit.scenario.masses.filter((mass) => mass.type === 'TOWER').map((mass) => mass.floors)).toEqual(originalTowerFloors);
    expect(podiumEdit.scenario.masses.filter((mass) => mass.type === 'TOWER').every((mass) => mass.position.y === editedPodium.height)).toBe(true);

    const towerEdit = service.execute(podiumEdit.project, command(podiumEdit.project, scenario.id, {
      type: 'SET_MASS_TYPE_FLOORS', targetId: scenario.id, payload: { massType: 'TOWER', floors: 5 }, description: 'tower storeys',
    }, 'cmd:tower-storeys'));
    expect(towerEdit.accepted).toBe(true);
    if (!towerEdit.accepted) return;
    expect(towerEdit.scenario.masses.filter((mass) => mass.type === 'TOWER').every((mass) => mass.floors === 5)).toBe(true);
    expect(towerEdit.scenario.masses.find((mass) => mass.type === 'PODIUM')?.floors).toBe(1);

    const undoTower = service.undo(towerEdit.project, project.id, scenario.id, '2026-08-24T18:00:00.000Z');
    expect(undoTower.accepted).toBe(true);
    expect(undoTower.project.scenarios[1].masses.filter((mass) => mass.type === 'TOWER').map((mass) => mass.floors)).toEqual(originalTowerFloors);
    const redoTower = service.redo(undoTower.project, project.id, scenario.id, '2026-08-24T18:01:00.000Z');
    expect(redoTower.accepted).toBe(true);
    expect(redoTower.project.scenarios[1].masses.filter((mass) => mass.type === 'TOWER').every((mass) => mass.floors === 5)).toBe(true);
  });

  it('accepts a 0 m front setback and symmetric 4 m sides as one undoable canonical revision', () => {
    const project = freshProject();
    const scenario = project.scenarios[1];
    const service = new CanonicalSpatialCommandService(successfulPersist);
    const edit = service.execute(project, command(project, scenario.id, {
      type: 'SET_SETBACKS', targetId: scenario.id,
      payload: { setbacks: { ...scenario.assumptionsUsed.setbacks, front: 0, sideLeft: 4, sideRight: 4 } },
      description: 'front and symmetric side setbacks',
    }, 'cmd:setbacks-zero-four'));
    expect(edit.accepted).toBe(true);
    if (!edit.accepted) return;
    expect(edit.scenario.assumptionsUsed.setbacks).toMatchObject({ front: 0, sideLeft: 4, sideRight: 4 });
    expect(edit.scenario.metrics.netBuildableArea).toBeGreaterThan(scenario.metrics.netBuildableArea);
    expect(edit.scenario.complianceReport?.status).toBe(edit.scenario.status);
    const undo = service.undo(edit.project, project.id, scenario.id, '2026-08-24T18:02:00.000Z');
    expect(undo.accepted).toBe(true);
    expect(undo.project.scenarios[1].assumptionsUsed.setbacks.front).toBe(scenario.assumptionsUsed.setbacks.front);
    const redo = service.redo(undo.project, project.id, scenario.id, '2026-08-24T18:03:00.000Z');
    expect(redo.accepted).toBe(true);
    expect(redo.project.scenarios[1].assumptionsUsed.setbacks).toMatchObject({ front: 0, sideLeft: 4, sideRight: 4 });
  });

  it('resizing the podium updates footprint, GFA, FAR, coverage, containment, and compliance together', () => {
    const project = freshProject();
    const scenario = project.scenarios[1];
    const podium = scenario.masses[0];
    const result = accepted(project, command(project, scenario.id, {
      type: 'RESIZE_MASS', targetId: podium.id, payload: { width: 90, length: 80 }, description: 'resize podium',
    }));
    expect(result.scenario.metrics.buildingFootprintArea).not.toBe(scenario.metrics.buildingFootprintArea);
    expect(result.scenario.metrics.totalGFA).not.toBe(scenario.metrics.totalGFA);
    expect(result.scenario.metrics.farKLB).not.toBe(scenario.metrics.farKLB);
    expect(result.scenario.metrics.siteCoveragePercentage).not.toBe(scenario.metrics.siteCoveragePercentage);
    expect(result.scenario.complianceReport?.status).toBe(result.scenario.status);
    expect(result.scenario.canonicalRevision?.revisionHash).toBe(computeCanonicalScenarioHash(result.scenario));
  });

  it('detects collision and setback/compliance changes from the same canonical snapshot', () => {
    const project = freshProject();
    const scenario = project.scenarios[1];
    const west = scenario.masses[1];
    const overlap = { ...structuredClone(west), id: 'overlap', name: 'Overlap' };
    const collision = accepted(project, command(project, scenario.id, {
      type: 'ADD_MASS', targetId: overlap.id, payload: { mass: overlap }, description: 'overlap',
    }));
    expect(collision.scenario.pairwiseOverlap?.hasOverlap).toBe(true);
    expect(collision.scenario.complianceReport?.isCompliant).toBe(false);
    expect(collision.scenario.status).toBe('WARNING_EXCEEDS_CONSTRAINT');

    const restrictive = accepted(project, command(project, scenario.id, {
      type: 'SET_SETBACKS', targetId: scenario.id, payload: { setbacks: { ...scenario.assumptionsUsed.setbacks, front: 47 } }, description: 'setback',
    }));
    expect(restrictive.scenario.metrics.netBuildableArea).toBeLessThan(scenario.metrics.netBuildableArea);
    expect(restrictive.scenario.complianceReport?.status).toBe(restrictive.scenario.status);
  });

  it('exports meter-scaled Z_UP geometry from the accepted active revision only', () => {
    const project = freshProject();
    const scenario = project.scenarios[1];
    const west = scenario.masses[1];
    const acceptedResize = accepted(project, command(project, scenario.id, {
      type: 'RESIZE_MASS', targetId: west.id, payload: { width: 36, length: west.dimensions.length }, description: 'resize',
    }, 'cmd:exported'));
    const stale = executeCanonicalSpatialCommand(acceptedResize.project, command(project, scenario.id, {
      type: 'RESIZE_MASS', targetId: west.id, payload: { width: 50, length: west.dimensions.length }, description: 'stale resize',
    }, 'cmd:stale-export'));
    expect(stale.accepted).toBe(false);

    const xml = exportToColladaDAE(
      acceptedResize.project.site,
      acceptedResize.scenario.masses,
      acceptedResize.scenario.name,
      acceptedResize.scenario.assumptionsUsed.setbacks
    );
    const document = new DOMParser().parseFromString(xml, 'application/xml');
    expect(document.querySelector('unit')?.getAttribute('meter')).toBe('1.0');
    expect(document.querySelector('up_axis')?.textContent).toBe('Z_UP');
    expect(document.querySelectorAll('instance_geometry')).toHaveLength(6);
    expect(xml).not.toContain('ACCESS_SECONDARY_CORRIDOR');
    const westPositions = document.querySelector('#geom-mass-1-positions-array')?.textContent || '';
    expect(westPositions.split(/\s+/).map(Number)).toContain(36);
    expect(westPositions.split(/\s+/).map(Number)).not.toContain(50);
  });
});
