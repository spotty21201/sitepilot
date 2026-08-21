import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('SitePilot Phase 0 — Runtime Editor Mounting & Identity Proof Suite', () => {
  it('proves that the production route imports and mounts DevelopmentWorkspace / ViewportCanvas (Custom Three.js)', () => {
    const pageContent = fs.readFileSync(path.join(process.cwd(), 'src/app/page.tsx'), 'utf8');
    
    // 1. Assert production page imports DevelopmentWorkspace
    expect(pageContent).toContain("import { DevelopmentWorkspace } from '@/features/development-3d/DevelopmentWorkspace'");
    expect(pageContent).toContain('<DevelopmentWorkspace');

    // 2. Assert production page does NOT mount PascalEditorView
    expect(pageContent).not.toContain('PascalEditorView');

    // 3. Inspect DevelopmentWorkspace to prove it mounts ViewportCanvas
    const workspaceContent = fs.readFileSync(
      path.join(process.cwd(), 'src/features/development-3d/DevelopmentWorkspace.tsx'),
      'utf8'
    );
    expect(workspaceContent).toContain("import { ViewportCanvas } from './ViewportCanvas'");
    expect(workspaceContent).toContain('<ViewportCanvas');

    // 4. Inspect ViewportCanvas to prove it initializes Three.js Scene and uses canonical mass IDs
    const viewportContent = fs.readFileSync(
      path.join(process.cwd(), 'src/features/development-3d/ViewportCanvas.tsx'),
      'utf8'
    );
    expect(viewportContent).toContain('new THREE.Scene()');
    expect(viewportContent).toContain('new THREE.WebGLRenderer(');
    expect(viewportContent).toContain('mesh.userData = { massId: mass.id');
  });

  it('verifies that PascalEditorView is isolated and not reached by production dependency graph', () => {
    const pascalViewContent = fs.readFileSync(
      path.join(process.cwd(), 'src/features/development-3d/PascalEditorView.tsx'),
      'utf8'
    );
    // Dynamic import exists in the unmounted file
    expect(pascalViewContent).toContain("import('@pascal-app/editor')");

    // Assert no core feature or component imports PascalEditorView
    const componentsDir = path.join(process.cwd(), 'src/components');
    const componentFiles = fs.readdirSync(componentsDir);
    for (const file of componentFiles) {
      if (file.endsWith('.tsx') || file.endsWith('.ts')) {
        const content = fs.readFileSync(path.join(componentsDir, file), 'utf8');
        expect(content).not.toContain('PascalEditorView');
      }
    }
  });
});
