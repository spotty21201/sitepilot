import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = path.resolve(__dirname, '..');
const read = (relativePath: string) => fs.readFileSync(path.join(root, relativePath), 'utf8');

describe('Spatial Console production authority boundary', () => {
  it('contains no prototype, mock, persistence, export, AI, or command-store imports', () => {
    const productionFiles = [
      'src/features/development-3d/spatial-editor-adapter.ts',
      'src/features/development-3d/spatial-console/SpatialConsoleCamera.ts',
      'src/features/development-3d/spatial-console/SpatialConsoleScene.ts',
      'src/features/development-3d/spatial-console/SpatialConsoleViewport.tsx',
    ];
    const source = productionFiles.map(read).join('\n');

    expect(source).not.toMatch(/prototypes\/sitepilot-spatial-console/);
    expect(source).not.toMatch(/mockData|domain\/calculations|command\/store|store-bridge/);
    expect(source).not.toMatch(/localStorage|sessionStorage|exportToColladaDAE/);
    expect(source).not.toMatch(/onProposeCommand|CanonicalSpatialCommand|@google\/genai|gemini/i);
  });

  it('keeps feature selection default-safe and mounts renderers conditionally', () => {
    const source = read('src/features/development-3d/DevelopmentWorkspace.tsx');
    expect(source).toContain('process.env.NEXT_PUBLIC_SPATIAL_EDITOR_ENGINE');
    expect(source).toContain("activeSpatialEngine === 'spatial-console'");
    expect(source).not.toMatch(/display:\s*none[^]*ViewportCanvas|visibility:\s*hidden[^]*ViewportCanvas/);
  });

  it('fully tears down the read-only WebGL scene', () => {
    const source = read('src/features/development-3d/spatial-console/SpatialConsoleScene.ts');
    for (const requiredCleanup of [
      'cancelAnimationFrame',
      'resizeObserver?.disconnect',
      "removeEventListener('pointerdown'",
      "removeEventListener('wheel'",
      "removeEventListener('contextmenu'",
      'renderer.renderLists.dispose',
      'renderer.dispose',
      'renderer.forceContextLoss',
      'canvas.remove()',
    ]) {
      expect(source).toContain(requiredCleanup);
    }
  });

  it('routes construction and snapshot synchronization failures to the legacy fallback', () => {
    const viewport = read('src/features/development-3d/spatial-console/SpatialConsoleViewport.tsx');
    const scene = read('src/features/development-3d/spatial-console/SpatialConsoleScene.ts');
    expect(viewport).toMatch(/try\s*{[^]*scene = new SpatialConsoleScene/);
    expect(viewport).toMatch(/try\s*{[^]*scene\.sync\(snapshot/);
    expect(viewport.match(/onInitializationError\(/g)).toHaveLength(2);
    expect(scene).toMatch(/catch \(error\) {\s*this\.dispose\(\);\s*throw error;/);
  });
});
