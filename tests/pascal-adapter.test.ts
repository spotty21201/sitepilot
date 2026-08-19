import { describe, it, expect } from 'vitest';
import { adaptSitePilotToPascalScene } from '@/features/development-3d/adapter';
import { GOLDEN_PROJECT } from '@/lib/mock-data/golden-project';
import { calculateDevelopmentMetrics } from '@/lib/geometry/engine';

describe('SitePilot ↔ Pascal Scene Adapter (PRD Sec 14, 16, & 3D Pivot)', () => {
  it('adapts canonical SitePilot model into deterministic Pascal scene nodes', () => {
    const site = GOLDEN_PROJECT.site;
    const scenarioB = GOLDEN_PROJECT.scenarios[1];

    const pascalScene = adaptSitePilotToPascalScene(site, scenarioB, 32.0);

    expect(pascalScene.siteAreaM2).toBe(16850);
    expect(pascalScene.buildableAreaM2).toBeGreaterThan(13000);
    expect(pascalScene.zoningHeightCapMeters).toBe(32.0);
    expect(pascalScene.nodes.length).toBeGreaterThanOrEqual(6);

    // Verify boundary node
    const siteNode = pascalScene.nodes.find(n => n.kind === 'sitepilot:site-boundary');
    expect(siteNode).toBeDefined();
    expect(siteNode?.dimensions[0]).toBe(110); // 110m frontage

    // Verify buildable envelope node
    const buildableNode = pascalScene.nodes.find(n => n.kind === 'sitepilot:buildable-envelope');
    expect(buildableNode).toBeDefined();
    expect(buildableNode?.dimensions[0]).toBe(100); // 110 - 5 - 5 = 100m

    // Verify access nodes
    const arterialNode = pascalScene.nodes.find(n => n.kind === 'sitepilot:access-arterial');
    expect(arterialNode).toBeDefined();

    const corridorNode = pascalScene.nodes.find(n => n.kind === 'sitepilot:access-corridor');
    expect(corridorNode).toBeDefined();
    expect(corridorNode?.dimensions[0]).toBe(6.5); // 6.5m corridor width

    // Verify zoning envelope node
    const zoningNode = pascalScene.nodes.find(n => n.kind === 'sitepilot:zoning-envelope');
    expect(zoningNode).toBeDefined();
    expect(zoningNode?.dimensions[1]).toBe(32.0); // 32.0m height cap
  });

  it('generates development mass nodes matching Scenario B geometry with zero overlap', () => {
    const site = GOLDEN_PROJECT.site;
    const scenarioB = GOLDEN_PROJECT.scenarios[1];

    const pascalScene = adaptSitePilotToPascalScene(site, scenarioB, 32.0);
    const massNodes = pascalScene.nodes.filter(n => n.kind === 'sitepilot:development-mass');

    expect(massNodes).toHaveLength(3); // Podium, West Wing, East Wing
    
    const podiumNode = massNodes.find(n => n.name === 'Retail & Wellness Podium');
    expect(podiumNode).toBeDefined();
    expect(podiumNode?.dimensions[0]).toBe(80);
    expect(podiumNode?.dimensions[2]).toBe(72.5);
    expect(podiumNode?.dimensions[1]).toBe(9.0);

    const westNode = massNodes.find(n => n.name === 'West Residential Wing');
    expect(westNode).toBeDefined();
    expect(westNode?.position[0]).toBe(-21); // West at negative X

    const eastNode = massNodes.find(n => n.name === 'East Residential Wing');
    expect(eastNode).toBeDefined();
    expect(eastNode?.position[0]).toBe(21); // East at positive X
  });

  it('creates an overrun crown node when Scenario C exceeds the 32m height cap', () => {
    const site = GOLDEN_PROJECT.site;
    const scenarioC = GOLDEN_PROJECT.scenarios[2]; // 12 floors, 43.2m

    const pascalScene = adaptSitePilotToPascalScene(site, scenarioC, 32.0);
    const overrunNode = pascalScene.nodes.find(n => n.kind === 'sitepilot:overrun-crown');

    expect(overrunNode).toBeDefined();
    expect(overrunNode?.dimensions[1]).toBeCloseTo(11.2, 1); // 43.2 - 32.0 = 11.2m
    expect(overrunNode?.position[1]).toBeCloseTo(32.0 + 11.2 / 2, 1);
  });
});
