import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = path.resolve(__dirname, '..');
const read = (relativePath: string) => fs.readFileSync(path.join(root, relativePath), 'utf8');

describe('Spatial Console interaction efficiency', () => {
  it('keeps the production shell to one compact toolbar when Spatial Console is active', () => {
    const workspace = read('src/features/development-3d/DevelopmentWorkspace.tsx');
    expect(workspace).toContain("viewType === '3D' && activeSpatialEngine === 'legacy'");
    expect(workspace).toContain("activeSpatialEngine === 'legacy' || viewType === '2D'");
    expect(workspace).not.toContain('Navigation,');
  });

  it('keeps one north indicator and groups cardinal views behind a compact disclosure', () => {
    const viewport = read('src/features/development-3d/spatial-console/SpatialConsoleViewport.tsx');
    expect(viewport.match(/aria-label=\{northAngle === null/g)).toHaveLength(1);
    expect(viewport).toContain("(['TOP', 'ISO'] as const)");
    expect(viewport).toContain('Open cardinal view controls');
    expect(viewport).toContain('aria-label="Cardinal spatial views"');
    expect(viewport).toContain('displayDockWithViewMenu');
  });

  it('keeps display modes, legend, canonical authority, and context in canvas-owned UI', () => {
    const viewport = read('src/features/development-3d/spatial-console/SpatialConsoleViewport.tsx');
    expect(viewport).toContain('aria-label="Spatial display modes"');
    expect(viewport).toContain('aria-label="Toggle spatial legend"');
    expect(viewport).toContain('Study version {snapshot.revision.sequence} · Provisional study · Context not yet confirmed');
    expect(viewport).toContain('Context not yet verified');
  });

  it('keeps empty selection compact and defers destructive mass actions until selection', () => {
    const panel = read('src/features/development-3d/spatial-console/SpatialConsoleEditingPanel.tsx');
    expect(panel).toContain('data-selection-state={selectedMass ? \'selected\' : \'none\'}');
    expect(panel).toContain('Select a mass to edit exact geometry');
    expect(panel).toContain('aria-label="Duplicate selected mass"');
    expect(panel).toContain('aria-label="Delete selected mass"');
    expect(panel).not.toMatch(/Measure|Measurement|Ruler/);
    expect(panel).not.toContain('Select a mass to edit canonical geometry');
  });

  it('keeps the Floors tool directly acquirable from the selected mass while preserving its canonical proposal type', () => {
    const scene = read('src/features/development-3d/spatial-console/SpatialConsoleScene.ts');
    expect(scene).toContain("(pickedHandle === 'HEIGHT' || pickedMassId === selected.id)");
    expect(scene).toContain("type: 'SET_MASS_FLOORS'");
  });

  it('uses brighter neutral lighting and a transparent, non-selectable study envelope', () => {
    const scene = read('src/features/development-3d/spatial-console/SpatialConsoleScene.ts');
    const viewport = read('src/features/development-3d/spatial-console/SpatialConsoleViewport.tsx');
    expect(scene).toContain('new THREE.HemisphereLight(0xd5e3ed, 0x202630, 1.5)');
    expect(scene).toContain('new THREE.DirectionalLight(0x91acc4, 0.6)');
    expect(scene).toContain('color: 0xd6e0e7');
    expect(scene).toContain('opacity: 0.14');
    expect(scene).toContain('depthWrite: false');
    expect(scene).toContain('new THREE.EdgesGeometry(envelopeGeometry, 28)');
    expect(scene).toContain("footprint.name = 'study-envelope-footprint-height-not-provided'");
    expect(viewport).toContain("data-envelope-kind={snapshot.site.zoningHeightLimitMeters === null ? 'footprint-only' : 'volume'}");
    expect(viewport).toContain('Height limit not provided');
    expect(viewport).toContain('not surveyed or legally confirmed');
    expect(scene).not.toContain('color: 0xe2c17f, wireframe: true');
  });

  it('treats Planning checks as an on/off envelope control', () => {
    const workspace = read('src/features/development-3d/DevelopmentWorkspace.tsx');
    const viewport = read('src/features/development-3d/spatial-console/SpatialConsoleViewport.tsx');
    expect(workspace).toContain("displayMode === 'CONSTRAINTS'");
    expect(workspace).toContain("setDisplayMode(isTurningPlanningChecksOff ? 'DEVELOPMENT' : mode)");
    expect(workspace).toContain("setShowZoningCap(mode === 'CONSTRAINTS' && !isTurningPlanningChecksOff)");
    expect(viewport).toContain('Hide planning checks and study envelope');
    expect(viewport).toContain('Show planning checks and study envelope');
  });
});
