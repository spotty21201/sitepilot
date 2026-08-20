import { DevelopmentScenario, SiteGeometry } from '@/types';
import { getCanonicalParcelBounds } from '@/lib/geometry/engine';
import { PascalSceneModel, PascalSceneNode } from './types';

/**
 * SitePilot ↔ Pascal Scene Adapter
 * Translates canonical SitePilot state into a deterministic Pascal-compatible scene graph.
 * SitePilot remains the single source of truth for planning data and geometry.
 */
export function adaptSitePilotToPascalScene(
  site: SiteGeometry,
  scenario: DevelopmentScenario,
  zoningHeightCapMeters: number = 32.0
): PascalSceneModel {
  const setbacks = scenario.assumptionsUsed.setbacks;
  const bounds = getCanonicalParcelBounds(site.grossSiteArea, setbacks, site.frontageLength || 110);
  const nodes: PascalSceneNode[] = [];

  // 1. Site Boundary Node
  nodes.push({
    id: 'node-site-boundary',
    kind: 'sitepilot:site-boundary',
    name: `Site Parcel (${bounds.width}m × ${bounds.length.toFixed(1)}m)`,
    position: [0, 0, 0],
    dimensions: [bounds.width, 0.1, bounds.length],
    properties: {
      grossSiteArea: bounds.grossSiteArea,
      frontageMeters: bounds.width,
      depthMeters: bounds.length
    }
  });

  // 2. Buildable Area Node
  const bCenterX = (bounds.buildableMinX + bounds.buildableMaxX) / 2;
  const bCenterZ = (bounds.buildableMinY + bounds.buildableMaxY) / 2;
  nodes.push({
    id: 'node-buildable-envelope',
    kind: 'sitepilot:buildable-envelope',
    name: `Net Buildable Envelope (${bounds.netBuildableArea.toLocaleString()} m²)`,
    position: [bCenterX, 0.05, bCenterZ],
    dimensions: [bounds.buildableWidth, 0.05, bounds.buildableLength],
    properties: {
      netBuildableArea: bounds.netBuildableArea,
      width: bounds.buildableWidth,
      length: bounds.buildableLength
    }
  });

  // 3. Arterial Access: Street Frontage (South at positive Y)
  nodes.push({
    id: 'node-access-arterial',
    kind: 'sitepilot:access-arterial',
    name: `Street Frontage (${bounds.width}m)`,
    position: [0, 0.02, bounds.maxY + 10],
    dimensions: [bounds.width + 40, 0.05, 20],
    properties: {
      roadWidth: 20,
      frontageLength: bounds.width
    }
  });

  // 4. Secondary Access: Continuous Access Corridor (North at negative Y)
  const corridorW = site.accessRoadWidth || 6.5;
  nodes.push({
    id: 'node-access-corridor',
    kind: 'sitepilot:access-corridor',
    name: `Secondary Access Corridor (${corridorW}m)`,
    position: [bounds.minX + corridorW / 2, 0.03, bounds.minY + 5],
    dimensions: [corridorW, 0.05, 40],
    properties: {
      corridorWidth: corridorW,
      length: 40.0
    }
  });

  // 5. 32m Regulatory Zoning Height Envelope Volume
  nodes.push({
    id: 'node-zoning-envelope',
    kind: 'sitepilot:zoning-envelope',
    name: `Subzone R.9 Height Envelope (32.0m / 8 Fl)`,
    position: [bCenterX, zoningHeightCapMeters / 2, bCenterZ],
    dimensions: [bounds.buildableWidth, zoningHeightCapMeters, bounds.buildableLength],
    properties: {
      maxHeightMeters: zoningHeightCapMeters,
      maxFloors: 8
    }
  });

  // 6. Development Masses
  scenario.masses.forEach((mass) => {
    const w = mass.dimensions.width;
    const l = mass.dimensions.length;
    const h = mass.dimensions.height;
    const posX = mass.position.x;
    const baseElevation = mass.position.y || 0;
    const posY = baseElevation + h / 2;
    const posZ = mass.position.z;

    nodes.push({
      id: mass.id,
      kind: 'sitepilot:development-mass',
      name: mass.name,
      position: [posX, posY, posZ],
      dimensions: [w, h, l],
      massData: mass,
      properties: {
        floors: mass.floors,
        floorToFloorHeight: mass.floorToFloorHeight,
        gfa: mass.gfa,
        program: mass.program,
        type: mass.type
      }
    });

    // If mass exceeds 32m zoning cap, add Overrun Crown Node
    if (baseElevation + h > zoningHeightCapMeters) {
      const overrunHeight = (baseElevation + h) - zoningHeightCapMeters;
      nodes.push({
        id: `${mass.id}-overrun-crown`,
        kind: 'sitepilot:overrun-crown',
        name: `${mass.name} Height Overrun (+${overrunHeight.toFixed(1)}m)`,
        position: [posX, zoningHeightCapMeters + overrunHeight / 2, posZ],
        dimensions: [w, overrunHeight, l],
        properties: {
          overrunHeightMeters: Math.round(overrunHeight * 10) / 10,
          parentMassId: mass.id
        }
      });
    }
  });

  return {
    siteAreaM2: bounds.grossSiteArea,
    buildableAreaM2: bounds.netBuildableArea,
    setbacks,
    zoningHeightCapMeters,
    nodes
  };
}
