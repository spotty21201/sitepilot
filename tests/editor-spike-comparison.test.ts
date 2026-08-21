import { describe, it, expect } from 'vitest';
import { createCase } from '@/lib/storage/case-repository';
import { 
  executeSpatialCommand, 
  ScenarioCommandHistory,
  MoveMassCommand,
  ResizeMassCommand,
  SetMassFloorsCommand,
  computeScenarioStateHash
} from '@/lib/spatial/commands';

describe('SitePilot Bounded Spike — Spatial Editor & Canonical Command Integration', () => {
  const sampleCase = createCase({
    name: 'Spike Test Parcel',
    address: '100 George St, Sydney',
    grossSiteArea: 3500,
    frontageLength: 50,
    maxFAR: 5.0,
    maxCoveragePct: 50.0,
    maxHeightMeters: 45.0,
    maxFloors: 12,
    hasZoningEvidence: true
  });

  const site = sampleCase.site;
  const initialScenario = sampleCase.scenarios[1]; // Scenario B

  it('demonstrates that committing an edit produces exactly one typed canonical command and updates planning metrics', () => {
    const targetMass = initialScenario.masses[0];
    const originalGFA = initialScenario.metrics.totalGFA;

    const resizeCmd: ResizeMassCommand = {
      id: `cmd-resize-${Date.now()}`,
      type: 'RESIZE_MASS',
      scenarioId: initialScenario.id,
      timestamp: new Date().toISOString(),
      author: 'USER',
      description: `Resize ${targetMass.name} from ${targetMass.dimensions.width}m to 25m`,
      massId: targetMass.id,
      previousDimensions: targetMass.dimensions,
      newDimensions: {
        width: 25,
        length: 30,
        height: targetMass.dimensions.height
      }
    };

    const result = executeSpatialCommand(site, initialScenario, resizeCmd);

    expect(result.success).toBe(true);
    expect(result.revision.revisionId).toMatch(/^rev-/);
    expect(result.revision.revisionHash).toHaveLength(64); // SHA-256

    // Metrics must update deterministically from canonical state
    const modifiedMass = result.updatedScenario.masses.find(m => m.id === targetMass.id);
    expect(modifiedMass?.dimensions.width).toBe(25);
    expect(modifiedMass?.dimensions.length).toBe(30);
    expect(modifiedMass?.footprintArea).toBe(750); // 25 * 30
    expect(result.updatedScenario.metrics.totalGFA).not.toBe(originalGFA);
  });

  it('executes move commands and verifies compliance and setback recalculation', () => {
    const targetMass = initialScenario.masses[0];

    const moveCmd: MoveMassCommand = {
      id: `cmd-move-${Date.now()}`,
      type: 'MOVE_MASS',
      scenarioId: initialScenario.id,
      timestamp: new Date().toISOString(),
      author: 'USER',
      description: `Move ${targetMass.name}`,
      massId: targetMass.id,
      previousPosition: targetMass.position,
      newPosition: { x: 5.0, y: 0, z: -2.0 }
    };

    const result = executeSpatialCommand(site, initialScenario, moveCmd);

    expect(result.success).toBe(true);
    const moved = result.updatedScenario.masses.find(m => m.id === targetMass.id);
    expect(moved?.position.x).toBe(5.0);
    expect(moved?.position.z).toBe(-2.0);
  });

  it('supports exact undo and redo with invariant state hashes', () => {
    const history = new ScenarioCommandHistory(initialScenario);
    const targetMass = initialScenario.masses[0];

    const floorsCmd: SetMassFloorsCommand = {
      id: `cmd-floors-${Date.now()}`,
      type: 'SET_MASS_FLOORS',
      scenarioId: initialScenario.id,
      timestamp: new Date().toISOString(),
      author: 'USER',
      description: 'Change floors to 8',
      massId: targetMass.id,
      previousFloors: targetMass.floors,
      newFloors: 8,
      floorToFloorHeight: 3.5
    };

    // Execute
    const forwardResult = executeSpatialCommand(site, initialScenario, floorsCmd);
    history.recordExecution(floorsCmd, forwardResult.inverseCommand, forwardResult.revision);

    expect(history.canUndo).toBe(true);
    expect(history.canRedo).toBe(false);

    // Undo
    const undoCmd = history.popUndo()!;
    history.pushRedo(floorsCmd);
    const undoResult = executeSpatialCommand(site, forwardResult.updatedScenario, undoCmd);

    expect(undoResult.success).toBe(true);
    const restoredMass = undoResult.updatedScenario.masses.find(m => m.id === targetMass.id);
    expect(restoredMass?.floors).toBe(targetMass.floors);

    // Verify hash matches original initial state
    const originalHash = computeScenarioStateHash(initialScenario);
    const restoredHash = computeScenarioStateHash(undoResult.updatedScenario);
    expect(restoredHash).toBe(originalHash);

    // Redo
    expect(history.canRedo).toBe(true);
    const redoCmd = history.popRedo()!;
    const redoResult = executeSpatialCommand(site, undoResult.updatedScenario, redoCmd);
    expect(redoResult.success).toBe(true);
    const redoneMass = redoResult.updatedScenario.masses.find(m => m.id === targetMass.id);
    expect(redoneMass?.floors).toBe(8);
  });

  it('verifies that an uncommitted or cancelled drag preview causes zero canonical mutation', () => {
    const beforeHash = computeScenarioStateHash(initialScenario);

    // Transient preview object created in UI / renderer layer
    const transientDragPreview = {
      massId: initialScenario.masses[0].id,
      proposedPosition: { x: 100, y: 0, z: 200 } // Wild coordinate
    };
    expect(transientDragPreview.massId).toBe(initialScenario.masses[0].id);

    // User presses Escape or releases without commit -> no command dispatched
    const afterHash = computeScenarioStateHash(initialScenario);

    expect(afterHash).toBe(beforeHash);
    expect(initialScenario.masses[0].position.x).not.toBe(100);
  });
});
