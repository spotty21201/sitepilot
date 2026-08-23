import fs from 'node:fs';
import path from 'node:path';
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';

import { SpatialConsoleCamera } from '@/features/development-3d/spatial-console/SpatialConsoleCamera';

const root = path.resolve(__dirname, '..');
const read = (relativePath: string) => fs.readFileSync(path.join(root, relativePath), 'utf8');

function settle(camera: SpatialConsoleCamera): void {
  for (let index = 0; index < 100; index += 1) camera.update();
}

describe('Spatial Console Phase 1 corrections', () => {
  it('self-hosts the accepted sans and mono fonts through Next.js', () => {
    const layout = read('src/app/layout.tsx');
    const globals = read('src/app/globals.css');
    expect(layout).toContain('Inter, JetBrains_Mono');
    expect(layout).toContain('--font-sitepilot-sans');
    expect(layout).toContain('--font-sitepilot-mono');
    expect(globals).toContain('--font-sans: var(--font-sitepilot-sans)');
    expect(globals).toContain('--font-mono: var(--font-sitepilot-mono)');
    expect(globals).toContain('font-variant-numeric: tabular-nums lining-nums');
  });

  it('projects true north from world coordinates and responds to camera orbit', () => {
    const camera = new SpatialConsoleCamera();
    camera.setAspect(16 / 9, 900);
    camera.frame(new THREE.Vector3(), 80);
    camera.setPreset('TOP');
    settle(camera);
    const topAngle = camera.screenAngleForWorldDirection(new THREE.Vector3(0, 0, 1));
    expect(topAngle).not.toBeNull();

    camera.orbit(0.45, 0);
    settle(camera);
    const orbitAngle = camera.screenAngleForWorldDirection(new THREE.Vector3(0, 0, 1));
    expect(orbitAngle).not.toBeNull();
    expect(orbitAngle).not.toBeCloseTo(topAngle!);

    camera.setProjection('ORTHOGRAPHIC');
    settle(camera);
    expect(camera.screenAngleForWorldDirection(new THREE.Vector3(0, 0, 1))).not.toBeNull();
  });

  it('defines one in-canvas camera dock and stable interaction presentation regions', () => {
    const workspace = read('src/features/development-3d/DevelopmentWorkspace.tsx');
    const toolbar = read('src/features/development-3d/Toolbar.tsx');
    const viewport = read('src/features/development-3d/spatial-console/SpatialConsoleViewport.tsx');
    expect(workspace).toContain("viewType === '3D' && activeSpatialEngine === 'legacy'");
    expect(toolbar).toContain('!hideCameraControls');
    expect(viewport.match(/aria-label="Spatial Console camera controls"/g)).toHaveLength(1);
    for (const region of ['gizmos', 'preview-dimensions', 'snap-indicators', 'validation']) {
      expect(viewport).toContain(`data-interaction-region="${region}"`);
    }
    expect(viewport).toContain('Context not yet verified');
  });

  it('records production provenance without claiming unresolved ownership', () => {
    const provenance = read('docs/SPATIAL_CONSOLE_PROVENANCE.md');
    for (const item of ['Inter', 'JetBrains Mono', 'Three.js', 'React', 'Lucide', 'unresolved']) {
      expect(provenance).toContain(item);
    }
    expect(provenance).toContain('no stock 3D models, textures, photographs, imagery');
    expect(provenance).toContain('mock planning calculations');
  });
});
