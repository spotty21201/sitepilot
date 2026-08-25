/**
 * Canonical Deterministic Spatial & Geometry Engine for SitePilot
 * Single Source of Truth for 2D, 3D Three.js, Compliance Validation, and COLLADA (.dae) Export.
 * Standard: PRD Sec 17, 24, & 34.
 */

import { 
  Setbacks, 
  BuildingMass, 
  DevelopmentMetrics, 
  SiteGeometry,
  ScenarioEditClassification
} from '@/types';
import { deriveStreetName } from '@/lib/opportunity/street-name';

export interface CanonicalParcelBounds {
  width: number;
  length: number;
  grossSiteArea: number;
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  buildableMinX: number;
  buildableMaxX: number;
  buildableMinY: number;
  buildableMaxY: number;
  buildableWidth: number;
  buildableLength: number;
  netBuildableArea: number;
}

/**
 * Calculates geodesic surface area of polygon coordinates in square meters (WGS84).
 */
export function calculatePolygonAreaM2(coordinates: number[][]): number {
  if (!coordinates || coordinates.length < 3) return 0;

  const RADIUS = 6378137; // Earth radius in meters
  let area = 0;
  const len = coordinates.length;

  for (let i = 0; i < len; i++) {
    const p1 = coordinates[i];
    const p2 = coordinates[(i + 1) % len];

    const lon1 = (p1[0] * Math.PI) / 180;
    const lat1 = (p1[1] * Math.PI) / 180;
    const lon2 = (p2[0] * Math.PI) / 180;
    const lat2 = (p2[1] * Math.PI) / 180;

    area += (lon2 - lon1) * (2 + Math.sin(lat1) + Math.sin(lat2));
  }

  area = (area * RADIUS * RADIUS) / 2.0;
  return Math.abs(Math.round(area * 100) / 100);
}

/**
 * Calculates canonical 2D/3D metric coordinates for a parcel from site area and frontage width.
 * Origin (0,0) is placed at the exact geometric center of the parcel.
 */
export function getCanonicalParcelBounds(
  grossSiteArea: number, 
  setbacks: Setbacks, 
  frontageWidth: number = 110
): CanonicalParcelBounds {
  const width = frontageWidth;
  const length = grossSiteArea > 0 ? grossSiteArea / width : 0;

  const halfW = width / 2;
  const halfL = length / 2;

  const minX = -halfW;
  const maxX = halfW;
  const minY = -halfL;
  const maxY = halfL;

  // Zero is a valid user-entered setback, so defaults must not use truthiness.
  const buildableMinX = minX + (setbacks.sideLeft ?? 5);
  const buildableMaxX = maxX - (setbacks.sideRight ?? 5);
  const buildableMinY = minY + (setbacks.rear ?? 6);
  const buildableMaxY = maxY - (setbacks.front ?? 10);

  const buildableWidth = Math.max(0, buildableMaxX - buildableMinX);
  const buildableLength = Math.max(0, buildableMaxY - buildableMinY);
  const netBuildableArea = Math.round(buildableWidth * buildableLength * 100) / 100;

  return {
    width: Math.round(width * 100) / 100,
    length: Math.round(length * 100) / 100,
    grossSiteArea: Math.round(grossSiteArea * 100) / 100,
    minX: Math.round(minX * 1000) / 1000,
    maxX: Math.round(maxX * 1000) / 1000,
    minY: Math.round(minY * 1000) / 1000,
    maxY: Math.round(maxY * 1000) / 1000,
    buildableMinX: Math.round(buildableMinX * 1000) / 1000,
    buildableMaxX: Math.round(buildableMaxX * 1000) / 1000,
    buildableMinY: Math.round(buildableMinY * 1000) / 1000,
    buildableMaxY: Math.round(buildableMaxY * 1000) / 1000,
    buildableWidth: Math.round(buildableWidth * 100) / 100,
    buildableLength: Math.round(buildableLength * 100) / 100,
    netBuildableArea
  };
}

/**
 * Calculates net buildable area after applying scenario-specific front, rear, and side setbacks.
 */
export function calculateBuildableArea(
  grossSiteArea: number, 
  setbacks: Setbacks,
  frontageWidth: number = 110
): number {
  const bounds = getCanonicalParcelBounds(grossSiteArea, setbacks, frontageWidth);
  return bounds.netBuildableArea;
}

/**
 * Calculates pairwise intersection volume between building mass blocks to detect overlapping masses.
 */
export function calculateMassPairwiseIntersections(masses: BuildingMass[]): {
  hasOverlap: boolean;
  overlapVolumeM3: number;
  overlaps: { massA: string; massB: string; overlapAreaM2: number; overlapVolumeM3: number }[];
} {
  const overlaps: { massA: string; massB: string; overlapAreaM2: number; overlapVolumeM3: number }[] = [];
  let totalOverlapVolume = 0;

  for (let i = 0; i < masses.length; i++) {
    for (let j = i + 1; j < masses.length; j++) {
      const mA = masses[i];
      const mB = masses[j];

      // Horizontal bounds (X and Z in 3D scene)
      const aMinX = mA.position.x - mA.dimensions.width / 2;
      const aMaxX = mA.position.x + mA.dimensions.width / 2;
      const aMinZ = mA.position.z - mA.dimensions.length / 2;
      const aMaxZ = mA.position.z + mA.dimensions.length / 2;

      const bMinX = mB.position.x - mB.dimensions.width / 2;
      const bMaxX = mB.position.x + mB.dimensions.width / 2;
      const bMinZ = mB.position.z - mB.dimensions.length / 2;
      const bMaxZ = mB.position.z + mB.dimensions.length / 2;

      // Vertical bounds (Y elevation in Three.js coordinates)
      const aMinY = mA.position.y || 0;
      const aMaxY = aMinY + mA.dimensions.height;
      const bMinY = mB.position.y || 0;
      const bMaxY = bMinY + mB.dimensions.height;

      // Calculate intersection spans
      const overlapX = Math.max(0, Math.min(aMaxX, bMaxX) - Math.max(aMinX, bMinX));
      const overlapZ = Math.max(0, Math.min(aMaxZ, bMaxZ) - Math.max(aMinZ, bMinZ));
      const overlapY = Math.max(0, Math.min(aMaxY, bMaxY) - Math.max(aMinY, bMinY));

      if (overlapX > 0.01 && overlapZ > 0.01 && overlapY > 0.01) {
        const area = Math.round(overlapX * overlapZ * 100) / 100;
        const volume = Math.round(area * overlapY * 100) / 100;
        totalOverlapVolume += volume;
        overlaps.push({
          massA: mA.name,
          massB: mB.name,
          overlapAreaM2: area,
          overlapVolumeM3: volume
        });
      }
    }
  }

  return {
    hasOverlap: overlaps.length > 0,
    overlapVolumeM3: Math.round(totalOverlapVolume * 100) / 100,
    overlaps
  };
}

/**
 * Calculates exact analytic 2D footprint projection union, parcel-contained area, and out-of-bounds area.
 * Uses 2D grid cell decomposition across all mass bounding boxes.
 */
export function calculateGroundFootprintUnion(
  masses: BuildingMass[],
  bounds: CanonicalParcelBounds
): {
  totalFootprintArea: number;
  parcelContainedArea: number;
  outOfBoundsArea: number;
} {
  if (!masses || masses.length === 0) {
    return { totalFootprintArea: 0, parcelContainedArea: 0, outOfBoundsArea: 0 };
  }

  const xCoordsSet = new Set<number>();
  const zCoordsSet = new Set<number>();

  xCoordsSet.add(bounds.minX);
  xCoordsSet.add(bounds.maxX);
  zCoordsSet.add(bounds.minY);
  zCoordsSet.add(bounds.maxY);

  const rects: { minX: number; maxX: number; minZ: number; maxZ: number }[] = [];

  for (const m of masses) {
    const halfW = m.dimensions.width / 2;
    const halfL = m.dimensions.length / 2;
    const minX = m.position.x - halfW;
    const maxX = m.position.x + halfW;
    const minZ = m.position.z - halfL;
    const maxZ = m.position.z + halfL;

    xCoordsSet.add(minX);
    xCoordsSet.add(maxX);
    zCoordsSet.add(minZ);
    zCoordsSet.add(maxZ);

    rects.push({ minX, maxX, minZ, maxZ });
  }

  const xs = Array.from(xCoordsSet).sort((a, b) => a - b);
  const zs = Array.from(zCoordsSet).sort((a, b) => a - b);

  let totalFootprintArea = 0;
  let parcelContainedArea = 0;
  let outOfBoundsArea = 0;

  for (let i = 0; i < xs.length - 1; i++) {
    const x1 = xs[i];
    const x2 = xs[i + 1];
    const midX = (x1 + x2) / 2;
    const dx = x2 - x1;
    if (dx <= 0.0001) continue;

    for (let j = 0; j < zs.length - 1; j++) {
      const z1 = zs[j];
      const z2 = zs[j + 1];
      const midZ = (z1 + z2) / 2;
      const dz = z2 - z1;
      if (dz <= 0.0001) continue;

      const isInsideMass = rects.some(r => midX >= r.minX && midX <= r.maxX && midZ >= r.minZ && midZ <= r.maxZ);

      if (isInsideMass) {
        const cellArea = dx * dz;
        totalFootprintArea += cellArea;

        const isInsideParcel = midX >= bounds.minX && midX <= bounds.maxX && midZ >= bounds.minY && midZ <= bounds.maxY;

        if (isInsideParcel) {
          parcelContainedArea += cellArea;
        } else {
          outOfBoundsArea += cellArea;
        }
      }
    }
  }

  return {
    totalFootprintArea: Math.round(totalFootprintArea * 100) / 100,
    parcelContainedArea: Math.round(parcelContainedArea * 100) / 100,
    outOfBoundsArea: Math.round(outOfBoundsArea * 100) / 100
  };
}

/**
 * Calculates comprehensive development metrics from massing geometry, gross site area, and scenario setbacks.
 * Maintains full floating-point precision throughout calculation.
 */
export function calculateDevelopmentMetrics(
  grossSiteArea: number,
  masses: BuildingMass[],
  setbacks: Setbacks,
  frontageWidth: number = 110,
  landscapedPermeableAreaM2?: number,
): DevelopmentMetrics {
  const bounds = getCanonicalParcelBounds(grossSiteArea, setbacks, frontageWidth);
  const netBuildable = bounds.netBuildableArea;

  const footprintUnion = calculateGroundFootprintUnion(masses, bounds);
  const totalFootprint = footprintUnion.totalFootprintArea;
  const parcelContained = footprintUnion.parcelContainedArea;
  const outOfBounds = footprintUnion.outOfBoundsArea;

  let totalGFA = 0;
  let maxFloors = 0;
  let maxHeight = 0;

  for (const mass of masses) {
    const footprint = mass.footprintArea > 0 ? mass.footprintArea : (mass.dimensions.width * mass.dimensions.length);
    const gfa = mass.gfa > 0 ? mass.gfa : (footprint * mass.floors);
    totalGFA += gfa;
    
    const massTopElevation = (mass.position.y || 0) + mass.height;
    if (massTopElevation > maxHeight) maxHeight = massTopElevation;

    // Calculate total effective vertical floors
    const basePodiumFloors = mass.position.y > 0 
      ? masses.filter(m => m.type === 'PODIUM' && (m.position.y || 0) === 0).reduce((max, m) => Math.max(max, m.floors), 0)
      : 0;
    const massEffectiveFloors = basePodiumFloors + mass.floors;
    if (massEffectiveFloors > maxFloors) maxFloors = massEffectiveFloors;
  }

  const coverageKDB = grossSiteArea > 0 ? (parcelContained / grossSiteArea) * 100 : 0;
  const farKLB = grossSiteArea > 0 ? totalGFA / grossSiteArea : 0;
  const unbuiltArea = Math.max(0, grossSiteArea - parcelContained);
  const openSpacePct = grossSiteArea > 0 ? (unbuiltArea / grossSiteArea) * 100 : 0;
  const estimatedParking = Math.round(totalGFA / 60);

  return {
    grossSiteArea: Math.round(grossSiteArea * 100) / 100,
    netBuildableArea: Math.round(netBuildable * 100) / 100,
    buildingFootprintArea: Math.round(totalFootprint * 100) / 100,
    parcelContainedFootprintM2: Math.round(parcelContained * 100) / 100,
    outOfBoundsAreaM2: Math.round(outOfBounds * 100) / 100,
    siteCoveragePercentage: Math.round(coverageKDB * 10) / 10,
    totalGFA: Math.round(totalGFA * 100) / 100,
    farKLB: Math.round(farKLB * 100) / 100,
    openSpaceArea: Math.round(unbuiltArea * 100) / 100,
    openSpacePercentage: Math.round(openSpacePct * 10) / 10,
    totalFloors: maxFloors,
    totalHeightMeters: Math.round(maxHeight * 10) / 10,
    estimatedParkingSpaces: estimatedParking
    ,landscapedPermeableAreaM2: landscapedPermeableAreaM2,
    kdhDemonstrated: landscapedPermeableAreaM2 !== undefined,
  };
}

/**
 * Finds a valid non-overlapping placement coordinate for a duplicated mass.
 */
export function findNonOverlappingDuplicatePosition(
  sourceMass: BuildingMass,
  existingMasses: BuildingMass[],
  bounds: CanonicalParcelBounds
): { x: number; y: number; z: number } {
  const w = sourceMass.dimensions.width;
  const l = sourceMass.dimensions.length;
  const h = sourceMass.dimensions.height;
  const baseElev = sourceMass.position.y || 0;

  const candidateOffsets: [number, number][] = [
    [-sourceMass.position.x, sourceMass.position.z],
    [sourceMass.position.x, -sourceMass.position.z],
    [sourceMass.position.x + w + 8, sourceMass.position.z],
    [sourceMass.position.x - (w + 8), sourceMass.position.z],
    [sourceMass.position.x, sourceMass.position.z + l + 8],
    [sourceMass.position.x, sourceMass.position.z - (l + 8)]
  ];

  for (const [candX, candZ] of candidateOffsets) {
    const candMinX = candX - w / 2;
    const candMaxX = candX + w / 2;
    const candMinZ = candZ - l / 2;
    const candMaxZ = candZ + l / 2;

    if (
      candMinX >= bounds.buildableMinX &&
      candMaxX <= bounds.buildableMaxX &&
      candMinZ >= bounds.buildableMinY &&
      candMaxZ <= bounds.buildableMaxY
    ) {
      const hasCollision = existingMasses.some(m => {
        const mElev = m.position.y || 0;
        const mTop = mElev + m.dimensions.height;
        const candTop = baseElev + h;
        const vertOverlap = Math.max(0, Math.min(candTop, mTop) - Math.max(baseElev, mElev));
        if (vertOverlap <= 0.01) return false;

        const mMinX = m.position.x - m.dimensions.width / 2;
        const mMaxX = m.position.x + m.dimensions.width / 2;
        const mMinZ = m.position.z - m.dimensions.length / 2;
        const mMaxZ = m.position.z + m.dimensions.length / 2;

        const overlapX = Math.max(0, Math.min(candMaxX, mMaxX) - Math.max(candMinX, mMinX));
        const overlapZ = Math.max(0, Math.min(candMaxZ, mMaxZ) - Math.max(candMinZ, mMinZ));

        return overlapX > 0.01 && overlapZ > 0.01;
      });

      if (!hasCollision) {
        return { x: Math.round(candX * 10) / 10, y: baseElev, z: Math.round(candZ * 10) / 10 };
      }
    }
  }

  return {
    x: Math.round((sourceMass.position.x + 12) * 10) / 10,
    y: baseElev,
    z: Math.round((sourceMass.position.z + 12) * 10) / 10
  };
}

/**
 * Accurately classifies scenario dirty state against baseline concept.
 */
export function detectScenarioEditClassification(
  currentScenario: {
    masses: BuildingMass[];
    isFittedOverride?: boolean;
    pairwiseOverlap?: { hasOverlap: boolean };
    metrics: DevelopmentMetrics;
  },
  originalScenario: {
    masses: BuildingMass[];
  }
): ScenarioEditClassification {
  if (currentScenario.pairwiseOverlap && currentScenario.pairwiseOverlap.hasOverlap) {
    return 'INVALID_CONFLICT';
  }

  if (currentScenario.metrics.outOfBoundsAreaM2 && currentScenario.metrics.outOfBoundsAreaM2 > 0) {
    return 'INVALID_CONFLICT';
  }

  if (currentScenario.isFittedOverride) {
    return 'FITTED_TO_SETBACK';
  }

  if (currentScenario.masses.length !== originalScenario.masses.length) {
    return 'USER_GEOMETRY_EDIT';
  }

  let hasGeometryDiff = false;
  let hasHeightDiff = false;
  let hasProgramDiff = false;

  for (let i = 0; i < currentScenario.masses.length; i++) {
    const cm = currentScenario.masses[i];
    const om = originalScenario.masses.find(m => m.id === cm.id);
    if (!om) {
      hasGeometryDiff = true;
      break;
    }

    if (
      Math.abs(cm.dimensions.width - om.dimensions.width) > 0.01 ||
      Math.abs(cm.dimensions.length - om.dimensions.length) > 0.01 ||
      Math.abs(cm.position.x - om.position.x) > 0.01 ||
      Math.abs(cm.position.z - om.position.z) > 0.01
    ) {
      hasGeometryDiff = true;
    }

    if (cm.floors !== om.floors || Math.abs(cm.dimensions.height - om.dimensions.height) > 0.01) {
      hasHeightDiff = true;
    }

    if (cm.program !== om.program) {
      hasProgramDiff = true;
    }
  }

  if (hasGeometryDiff) return 'USER_GEOMETRY_EDIT';
  if (hasHeightDiff) return 'HEIGHT_OVERRIDE';
  if (hasProgramDiff) return 'PROGRAM_OVERRIDE';

  return 'BASE_CONCEPT';
}

export interface SetbackEncroachmentResult {
  hasEncroachment: boolean;
  massName: string;
  edge: 'FRONT' | 'REAR' | 'LEFT' | 'RIGHT';
  distanceMeters: number;
  description: string;
}

/**
 * Checks if any building mass footprint extends beyond the canonical buildable envelope.
 */
export function checkSetbackEncroachments(
  grossSiteArea: number,
  setbacks: Setbacks,
  masses: BuildingMass[],
  frontageWidth?: number
): SetbackEncroachmentResult[] {
  const bounds = getCanonicalParcelBounds(grossSiteArea, setbacks, frontageWidth || 110);
  const results: SetbackEncroachmentResult[] = [];

  for (const mass of masses) {
    const halfW = mass.dimensions.width / 2;
    const halfL = mass.dimensions.length / 2;
    const massMinX = mass.position.x - halfW;
    const massMaxX = mass.position.x + halfW;
    const massMinY = mass.position.z - halfL; // in 3D world, z is ground Y
    const massMaxY = mass.position.z + halfL;

    // Check Front Setback Encroachment (at maxY)
    if (massMaxY > bounds.buildableMaxY + 0.05) {
      const dist = Math.round((massMaxY - bounds.buildableMaxY) * 10) / 10;
      results.push({
        hasEncroachment: true,
        massName: mass.name,
        edge: 'FRONT',
        distanceMeters: dist,
        description: `${mass.name} encroaches into Front Setback by ${dist}m (Front edge at Y=${massMaxY.toFixed(1)}m exceeds limit Y=${bounds.buildableMaxY.toFixed(1)}m).`
      });
    }

    // Check Rear Setback Encroachment (at minY)
    if (massMinY < bounds.buildableMinY - 0.05) {
      const dist = Math.round((bounds.buildableMinY - massMinY) * 10) / 10;
      results.push({
        hasEncroachment: true,
        massName: mass.name,
        edge: 'REAR',
        distanceMeters: dist,
        description: `${mass.name} encroaches into Rear Setback by ${dist}m.`
      });
    }

    // Check Left Setback Encroachment (at minX)
    if (massMinX < bounds.buildableMinX - 0.05) {
      const dist = Math.round((bounds.buildableMinX - massMinX) * 10) / 10;
      results.push({
        hasEncroachment: true,
        massName: mass.name,
        edge: 'LEFT',
        distanceMeters: dist,
        description: `${mass.name} encroaches into Left Side Setback by ${dist}m.`
      });
    }

    // Check Right Setback Encroachment (at maxX)
    if (massMaxX > bounds.buildableMaxX + 0.05) {
      const dist = Math.round((massMaxX - bounds.buildableMaxX) * 10) / 10;
      results.push({
        hasEncroachment: true,
        massName: mass.name,
        edge: 'RIGHT',
        distanceMeters: dist,
        description: `${mass.name} encroaches into Right Side Setback by ${dist}m.`
      });
    }
  }
  return results;
}

/**
 * Deterministically reshapes and shifts massing geometry to achieve 100% containment within the buildable envelope in one click.
 */
export function fitMassesToBuildableEnvelope(
  grossSiteArea: number,
  setbacks: Setbacks,
  masses: BuildingMass[],
  frontageLength?: number
): BuildingMass[] {
  const bounds = getCanonicalParcelBounds(grossSiteArea, setbacks, frontageLength || 110);
  
  if (masses.length === 0) return masses;

  const maxBuildableW = Math.max(10, bounds.buildableWidth);
  const maxBuildableL = Math.max(10, bounds.buildableLength);
  const centerX = (bounds.buildableMinX + bounds.buildableMaxX) / 2;
  const centerZ = (bounds.buildableMinY + bounds.buildableMaxY) / 2;

  // Determine current bounds across all masses
  let minX = Infinity, maxX = -Infinity;
  let minZ = Infinity, maxZ = -Infinity;

  for (const m of masses) {
    const halfW = m.dimensions.width / 2;
    const halfL = m.dimensions.length / 2;
    const massMinX = m.position.x - halfW;
    const massMaxX = m.position.x + halfW;
    const massMinZ = m.position.z - halfL;
    const massMaxZ = m.position.z + halfL;

    if (massMinX < minX) minX = massMinX;
    if (massMaxX > maxX) maxX = massMaxX;
    if (massMinZ < minZ) minZ = massMinZ;
    if (massMaxZ > maxZ) maxZ = massMaxZ;
  }

  const currentTotalW = Math.max(1, maxX - minX);
  const currentTotalL = Math.max(1, maxZ - minZ);

  // Scaling factor if massing group exceeds buildable envelope
  const scaleX = currentTotalW > maxBuildableW ? (maxBuildableW * 0.95) / currentTotalW : 1.0;
  const scaleZ = currentTotalL > maxBuildableL ? (maxBuildableL * 0.95) / currentTotalL : 1.0;
  const scale = Math.min(scaleX, scaleZ, 1.0);

  const currentGroupCenterX = (minX + maxX) / 2;
  const currentGroupCenterZ = (minZ + maxZ) / 2;

  return masses.map(mass => {
    // Scale width and length
    let newWidth = Math.round(mass.dimensions.width * scale * 10) / 10;
    let newLength = Math.round(mass.dimensions.length * scale * 10) / 10;

    // Hard safety clamp to buildable bounds
    newWidth = Math.min(newWidth, Math.round(maxBuildableW * 0.98 * 10) / 10);
    newLength = Math.min(newLength, Math.round(maxBuildableL * 0.98 * 10) / 10);

    // Shift relative to group center scaled and placed at buildable center
    const relX = (mass.position.x - currentGroupCenterX) * scale;
    const relZ = (mass.position.z - currentGroupCenterZ) * scale;

    let newX = Math.round((centerX + relX) * 10) / 10;
    let newZ = Math.round((centerZ + relZ) * 10) / 10;

    // Strict boundary enforcement: Ensure mass edges don't exceed buildable bounds
    const halfW = newWidth / 2;
    const halfL = newLength / 2;

    if (newX - halfW < bounds.buildableMinX) {
      newX = bounds.buildableMinX + halfW;
    }
    if (newX + halfW > bounds.buildableMaxX) {
      newX = bounds.buildableMaxX - halfW;
    }
    if (newZ - halfL < bounds.buildableMinY) {
      newZ = bounds.buildableMinY + halfL;
    }
    if (newZ + halfL > bounds.buildableMaxY) {
      newZ = bounds.buildableMaxY - halfL;
    }

    const newFootprint = Math.round(newWidth * newLength * 100) / 100;
    const newGfa = mass.preserveGfa ? mass.gfa : Math.round(newFootprint * mass.floors * 100) / 100;

    return {
      ...mass,
      footprintArea: newFootprint,
      gfa: newGfa,
      position: {
        ...mass.position,
        x: Math.round(newX * 100) / 100,
        z: Math.round(newZ * 100) / 100
      },
      dimensions: {
        ...mass.dimensions,
        width: Math.round(newWidth * 100) / 100,
        length: Math.round(newLength * 100) / 100
      }
    };
  });
}

/**
 * Checks for constraint violations (Height, FAR, KDB coverage, Setback encroachments).
 */
export function checkConstraintViolations(
  metrics: DevelopmentMetrics,
  constraints: {
    maxHeightFloors?: number;
    maxHeightMeters?: number;
    maxFAR?: number;
    maxCoveragePct?: number;
    encroachments?: SetbackEncroachmentResult[];
    outOfBoundsAreaM2?: number;
  }
): { hasViolations: boolean; warnings: string[]; primaryViolation?: string } {
  const warnings: string[] = [];

  const maxFloors = constraints.maxHeightFloors;
  const maxMeters = constraints.maxHeightMeters;
  const maxFAR = constraints.maxFAR;
  const maxCoverage = constraints.maxCoveragePct;

  if ((maxMeters !== undefined && metrics.totalHeightMeters > maxMeters + 0.05)
    || (maxFloors !== undefined && metrics.totalFloors > maxFloors)) {
    const overrunMeters = maxMeters === undefined
      ? 0
      : Math.max(0, Math.round((metrics.totalHeightMeters - maxMeters) * 10) / 10);
    warnings.push(
      `Massing height (${metrics.totalHeightMeters.toFixed(1)}m / ${metrics.totalFloors} floors) exceeds maximum allowable height (${maxMeters === undefined ? 'not supplied' : `${maxMeters.toFixed(1)}m`} / ${maxFloors === undefined ? 'not supplied' : `${maxFloors} floors`}) by +${overrunMeters.toFixed(1)}m.`
    );
  }

  if (maxFAR !== undefined && metrics.farKLB > maxFAR + 0.005) {
    const overrunFAR = Math.max(0, Math.round((metrics.farKLB - maxFAR) * 100) / 100);
    warnings.push(
      `Floor Area Ratio (${metrics.farKLB.toFixed(2)}x) exceeds statutory maximum (${maxFAR.toFixed(2)}x) by +${overrunFAR.toFixed(2)}x.`
    );
  }

  if (maxCoverage !== undefined && metrics.siteCoveragePercentage > maxCoverage + 0.05) {
    const overrunCoverage = Math.max(0, Math.round((metrics.siteCoveragePercentage - maxCoverage) * 10) / 10);
    warnings.push(
      `Site coverage (${metrics.siteCoveragePercentage}%) exceeds statutory limit (${maxCoverage}%) by +${overrunCoverage.toFixed(1)}%.`
    );
  }

  if (constraints.encroachments && constraints.encroachments.length > 0) {
    for (const enc of constraints.encroachments) {
      warnings.push(`Setback Encroachment: ${enc.description}`);
    }
  }

  if ((metrics.outOfBoundsAreaM2 || 0) > 0.5) {
    warnings.push(`Footprint extends ${(metrics.outOfBoundsAreaM2 || 0).toLocaleString()} m² outside parcel boundary.`);
  }

  return {
    hasViolations: warnings.length > 0,
    warnings,
    primaryViolation: warnings[0]
  };
}

export type ComplianceViolationCategory = 
  | 'NONE'
  | 'HEIGHT'
  | 'FAR'
  | 'COVERAGE'
  | 'SETBACK'
  | 'COLLISION'
  | 'OUT_OF_BOUNDS';

export interface CanonicalComplianceReport {
  isCompliant: boolean;
  status: 'VALID' | 'WARNING_EXCEEDS_CONSTRAINT';
  violationCategory: ComplianceViolationCategory;
  assessmentStatus: 'COMPLIANT' | 'NON_COMPLIANT_HEIGHT' | 'NON_COMPLIANT_FAR' | 'NON_COMPLIANT_COVERAGE' | 'NON_COMPLIANT_SETBACK' | 'NON_COMPLIANT_OUT_OF_BOUNDS' | 'COLLISION_DETECTED';
  statusPillLabel: string;
  isGreen: boolean;
  summaryText: string;
  decisionText: string;
  recommendedAction: string;
  identifiedRisks: string[];
  primaryWarning?: string;
  violations: string[];
  kdhDemonstrated: boolean;
  metrics: {
    heightOverrunMeters: number;
    farOverrun: number;
    coverageOverrunPercent: number;
    outOfBoundsAreaM2: number;
    collisionVolumeM3: number;
  };
}

export interface ScenarioComplianceOptions {
  scenarioName?: string;
  hasZoningEvidence?: boolean;
  zoningName?: string;
  maxHeightMeters?: number;
  maxFloors?: number;
  maxFAR?: number;
  maxCoveragePct?: number;
  minKDHPct?: number;
  frontageLength?: number;
  kdhAreaM2?: number;
}

/**
 * Single authoritative source of truth for compliance evaluation across the entire application.
 */
export function evaluateScenarioCompliance(
  grossSiteArea: number,
  setbacks: Setbacks,
  masses: BuildingMass[],
  metrics: DevelopmentMetrics,
  pairwiseOverlap?: { hasOverlap: boolean; overlapVolumeM3: number; overlaps: { massA: string; massB: string }[], maxIntersectionDepthM?: number },
  scenarioNameOrOptions?: string | ScenarioComplianceOptions
): CanonicalComplianceReport {
  const options: ScenarioComplianceOptions = typeof scenarioNameOrOptions === 'string'
    ? { scenarioName: scenarioNameOrOptions }
    : (scenarioNameOrOptions || {});

  const scenarioName = options.scenarioName;
  const hasZoningEvidence = options.hasZoningEvidence !== undefined
    ? options.hasZoningEvidence
    : false;
  const zoningName = options.zoningName;

  const warnings: string[] = [];
  const hasExplicitHeight = options.maxHeightMeters !== undefined || options.maxFloors !== undefined;
  const STATUTORY_HEIGHT_CAP_METERS = options.maxHeightMeters ?? Number.POSITIVE_INFINITY;
  const STATUTORY_MAX_FLOORS = options.maxFloors ?? Number.POSITIVE_INFINITY;

  const hasExplicitFAR = options.maxFAR !== undefined;
  const STATUTORY_MAX_FAR = options.maxFAR ?? Number.POSITIVE_INFINITY;

  const hasExplicitCoverage = options.maxCoveragePct !== undefined;
  const STATUTORY_MAX_KDB_PERCENT = options.maxCoveragePct ?? Number.POSITIVE_INFINITY;

  const heightOverrunM = Math.max(0, Math.round((metrics.totalHeightMeters - STATUTORY_HEIGHT_CAP_METERS) * 10) / 10);
  const farOverrun = Math.max(0, Math.round((metrics.farKLB - STATUTORY_MAX_FAR) * 100) / 100);
  const coverageOverrunPercent = Math.max(0, Math.round((metrics.siteCoveragePercentage - STATUTORY_MAX_KDB_PERCENT) * 10) / 10);
  const outOfBoundsAreaM2 = metrics.outOfBoundsAreaM2 || 0;
  const collisionVolumeM3 = pairwiseOverlap?.overlapVolumeM3 || 0;
  const kdhDemonstrated = options.kdhAreaM2 !== undefined;

  // 1. Height checks (only if explicit or zoning evidence exists)
  if (hasExplicitHeight && (metrics.totalHeightMeters > STATUTORY_HEIGHT_CAP_METERS + 0.05 || metrics.totalFloors > STATUTORY_MAX_FLOORS)) {
    warnings.push(`Height (${metrics.totalHeightMeters.toFixed(1)}m / ${metrics.totalFloors} Fl) exceeds ${zoningName ? `${zoningName} ` : ''}${STATUTORY_HEIGHT_CAP_METERS.toFixed(1)}m cap by +${heightOverrunM.toFixed(1)}m.`);
  }

  // 2. FAR check (only if explicit or zoning evidence exists)
  if (hasExplicitFAR && (metrics.farKLB > STATUTORY_MAX_FAR + 0.005)) {
    warnings.push(`FAR / KLB (${metrics.farKLB.toFixed(2)}x) exceeds allowable ${STATUTORY_MAX_FAR.toFixed(2)}x by +${farOverrun.toFixed(2)}x.`);
  }

  // 3. KDB Site Coverage check (only if explicit or zoning evidence exists)
  if (hasExplicitCoverage && (metrics.siteCoveragePercentage > STATUTORY_MAX_KDB_PERCENT + 0.05)) {
    warnings.push(`Site coverage (${metrics.siteCoveragePercentage}%) exceeds ${STATUTORY_MAX_KDB_PERCENT}% KDB limit by +${coverageOverrunPercent.toFixed(1)}%.`);
  }

  // 4. Setback Encroachments
  const encroachments = checkSetbackEncroachments(grossSiteArea, setbacks, masses, options.frontageLength);
  for (const enc of encroachments) {
    warnings.push(enc.description);
  }

  // 5. Mass Pairwise Collision
  if (pairwiseOverlap && pairwiseOverlap.hasOverlap) {
    const ov = pairwiseOverlap.overlaps[0];
    warnings.push(`Mass collision active: ${ov?.massA || 'Mass'} intersects ${ov?.massB || 'Mass'} (${collisionVolumeM3.toLocaleString()} m³ overlap volume).`);
  }

  // 6. Out-of-bounds Footprint
  if (outOfBoundsAreaM2 > 0.5) {
    warnings.push(`Footprint extends ${outOfBoundsAreaM2.toLocaleString()} m² beyond parcel perimeter.`);
  }

  const isCompliant = warnings.length === 0;

  // Determine primary violation category and labels
  let violationCategory: ComplianceViolationCategory = 'NONE';
  let assessmentStatus: 'COMPLIANT' | 'NON_COMPLIANT_HEIGHT' | 'NON_COMPLIANT_FAR' | 'NON_COMPLIANT_COVERAGE' | 'NON_COMPLIANT_SETBACK' | 'NON_COMPLIANT_OUT_OF_BOUNDS' | 'COLLISION_DETECTED' = 'COMPLIANT';
  
  let statusPillLabel = hasZoningEvidence
    ? 'Verified planning compliance · Within supplied controls'
    : 'Provisional Study · Within Envelope · statutory compliance not verified';

  const verifiedLimitSummary = [
    hasExplicitHeight ? `height (${metrics.totalHeightMeters.toFixed(1)}m ≤ ${STATUTORY_HEIGHT_CAP_METERS.toFixed(1)}m)` : null,
    hasExplicitFAR ? `FAR (${metrics.farKLB.toFixed(2)}x ≤ ${STATUTORY_MAX_FAR.toFixed(2)}x)` : null,
    hasExplicitCoverage ? `coverage (${metrics.siteCoveragePercentage.toFixed(1)}% ≤ ${STATUTORY_MAX_KDB_PERCENT.toFixed(1)}%)` : null,
    'setback envelopes',
  ].filter(Boolean).join(', ');
  let decisionText = hasZoningEvidence
    ? `Verified planning compliance against the supplied confirmed ${zoningName || 'planning'} controls: ${verifiedLimitSummary}.`
    : `Provisional Study: Within supplied study limits for the current geometric inputs (height ${metrics.totalHeightMeters.toFixed(1)}m, FAR ${metrics.farKLB.toFixed(2)}x). Statutory municipal zoning compliance is UNKNOWN and not verified because official planning evidence (RDTR / KRK) is absent.`;

  let recommendedAction = hasZoningEvidence
    ? (scenarioName 
        ? `Proceed with architectural schematic design and preliminary zoning verification for "${scenarioName}".`
        : 'Proceed with architectural schematic design and preliminary zoning verification.')
    : 'Obtain official municipal planning certificate (RDTR / KRK) to establish binding statutory FAR, height cap, and setback requirements.';

  let summaryText = hasZoningEvidence
    ? `Within supplied planning controls; statutory verification remains subject to the confirmed source set.`
    : 'Within supplied study limits. Statutory compliance is not verified (no RDTR/KRK on file).';
  if (options.minKDHPct !== undefined && !kdhDemonstrated) {
    summaryText += ' KDH not yet demonstrated from explicit landscaped/permeable area.';
    decisionText += ' KDH cannot be assessed from unbuilt area alone.';
  }

  if (!isCompliant) {
    summaryText = warnings[0];
    if (pairwiseOverlap && pairwiseOverlap.hasOverlap) {
      violationCategory = 'COLLISION';
      assessmentStatus = 'COLLISION_DETECTED';
      statusPillLabel = `Collision: ${collisionVolumeM3.toLocaleString()} m³ overlap`;
      decisionText = `Non-compliant: Active 3D mass collision (${collisionVolumeM3.toLocaleString()} m³ overlap volume).`;
      recommendedAction = 'Separate intersecting building masses to eliminate volumetric clash.';
    } else if (hasExplicitHeight && (metrics.totalHeightMeters > STATUTORY_HEIGHT_CAP_METERS + 0.05 || metrics.totalFloors > STATUTORY_MAX_FLOORS)) {
      violationCategory = 'HEIGHT';
      assessmentStatus = 'NON_COMPLIANT_HEIGHT';
      statusPillLabel = `Height Overrun: +${heightOverrunM.toFixed(1)}m (>${STATUTORY_HEIGHT_CAP_METERS}m cap)`;
      decisionText = `Non-compliant: Massing height (${metrics.totalHeightMeters.toFixed(1)}m / ${metrics.totalFloors} Fl) exceeds allowable cap (${STATUTORY_HEIGHT_CAP_METERS.toFixed(1)}m) by +${heightOverrunM.toFixed(1)}m.`;
      recommendedAction = `Reduce massing storeys to ${STATUTORY_MAX_FLOORS} floors (≤${STATUTORY_HEIGHT_CAP_METERS.toFixed(1)}m) or submit a formal municipal height variance application.`;
    } else if (outOfBoundsAreaM2 > 0.5) {
      violationCategory = 'OUT_OF_BOUNDS';
      assessmentStatus = 'NON_COMPLIANT_OUT_OF_BOUNDS';
      statusPillLabel = `Out of Bounds: ${outOfBoundsAreaM2.toLocaleString()} m²`;
      decisionText = `Non-compliant: Building footprint extends ${outOfBoundsAreaM2.toLocaleString()} m² beyond official property boundary.`;
      recommendedAction = 'Adjust mass footprint to reside entirely within cadastral parcel boundaries.';
    } else if (encroachments.length > 0) {
      violationCategory = 'SETBACK';
      assessmentStatus = 'NON_COMPLIANT_SETBACK';
      statusPillLabel = `Setback Encroachment (${encroachments[0].edge})`;
      decisionText = `Non-compliant: ${encroachments[0].description}`;
      recommendedAction = 'Adjust building mass position inward to clear setback boundaries.';
    } else if (metrics.farKLB > STATUTORY_MAX_FAR + 0.005) {
      violationCategory = 'FAR';
      assessmentStatus = 'NON_COMPLIANT_FAR';
      statusPillLabel = `FAR Limit Exceeded (${metrics.farKLB.toFixed(2)}x)`;
      decisionText = `Non-compliant: Floor Area Ratio (${metrics.farKLB.toFixed(2)}x) exceeds allowable maximum (${STATUTORY_MAX_FAR.toFixed(2)}x) by +${farOverrun.toFixed(2)}x.`;
      recommendedAction = `Reduce total gross floor area by ${(metrics.totalGFA - grossSiteArea * STATUTORY_MAX_FAR).toLocaleString()} m² to conform to ${STATUTORY_MAX_FAR.toFixed(2)}x FAR limit.`;
    } else if (metrics.siteCoveragePercentage > STATUTORY_MAX_KDB_PERCENT + 0.05) {
      violationCategory = 'COVERAGE';
      assessmentStatus = 'NON_COMPLIANT_COVERAGE';
      statusPillLabel = `Coverage Exceeded (${metrics.siteCoveragePercentage}%)`;
      decisionText = `Non-compliant: Building footprint coverage (${metrics.siteCoveragePercentage}%) exceeds allowable maximum (${STATUTORY_MAX_KDB_PERCENT}%) by +${coverageOverrunPercent.toFixed(1)}%.`;
      recommendedAction = `Reduce ground footprint area to stay within ${STATUTORY_MAX_KDB_PERCENT.toFixed(1)}% KDB limit.`;
    } else {
      statusPillLabel = 'Non-compliant: Exceeds Constraints';
      decisionText = `Non-compliant: ${warnings[0]}`;
    }
  }

  // Derive tailored identified risks strictly from violationCategory
  let identifiedRisks: string[] = [];
  if (violationCategory === 'NONE') {
    if (hasZoningEvidence) {
      identifiedRisks = [
        'Street access, servicing, and emergency-vehicle capacity require project-specific verification.',
        'Confirm rooftop plant and screening remain within the supplied height control.'
      ];
    } else {
      identifiedRisks = [
        'Municipal zoning parameters unverified against official planning certificate (RDTR/KRK).',
        'Permissible building height and FAR limits remain provisional planning assumptions.'
      ];
    }
  } else if (violationCategory === 'HEIGHT') {
    identifiedRisks = [
      `Height overrun of +${heightOverrunM.toFixed(1)}m requires municipal rezoning variance.`,
      'High probability of building permit rejection by municipal planning authorities.'
    ];
  } else if (violationCategory === 'FAR') {
    identifiedRisks = [
      `Floor Area Ratio of ${metrics.farKLB.toFixed(2)}x exceeds ${STATUTORY_MAX_FAR.toFixed(2)}x statutory limit (+${farOverrun.toFixed(2)}x overrun), triggering density penalty or municipal rejection.`,
      'Requires reduction of buildable area or acquisition of transferable development rights.'
    ];
  } else if (violationCategory === 'COVERAGE') {
    identifiedRisks = [
      `Building footprint coverage of ${metrics.siteCoveragePercentage}% exceeds ${STATUTORY_MAX_KDB_PERCENT.toFixed(1)}% KDB statutory limit (+${coverageOverrunPercent.toFixed(1)}% overrun).`,
      'Violates open space ratio and reduces permeable ground surface required for municipal stormwater drainage compliance.'
    ];
  } else if (violationCategory === 'SETBACK') {
    identifiedRisks = [
      `${encroachments[0]?.description || 'Building mass penetrates setback envelope.'}`,
      'Encroachment creates compliance violation, risking municipal stop-work order or mandatory demolition.'
    ];
  } else if (violationCategory === 'COLLISION') {
    identifiedRisks = [
      `Active physical 3D mass clash (${collisionVolumeM3.toLocaleString()} m³ overlap) represents invalid spatial geometry.`,
      'Volumetric intersection causes structural calculation errors and architectural infeasibility.'
    ];
  } else if (violationCategory === 'OUT_OF_BOUNDS') {
    identifiedRisks = [
      `Building footprint extends ${outOfBoundsAreaM2.toLocaleString()} m² outside registered parcel boundary.`,
      'Critical legal liability: Construction outside cadastral title constitutes unauthorized encroachment on adjacent land.'
    ];
  }

  return {
    isCompliant,
    status: isCompliant ? 'VALID' : 'WARNING_EXCEEDS_CONSTRAINT',
    violationCategory,
    assessmentStatus,
    statusPillLabel,
    isGreen: isCompliant,
    summaryText,
    decisionText,
    recommendedAction,
    identifiedRisks,
    primaryWarning: warnings[0],
    violations: warnings,
    kdhDemonstrated,
    metrics: {
      heightOverrunMeters: heightOverrunM,
      farOverrun,
      coverageOverrunPercent,
      outOfBoundsAreaM2,
      collisionVolumeM3
    }
  };
}

/**
 * Generates an exact, meter-scaled, SketchUp-compatible COLLADA (.dae) XML string.
 * Output uses exact canonical parcel boundary coordinates and distinct layer components:
 * - SITE_BOUNDARY (Canonical geometry)
 * - BUILDABLE_AREA (Net buildable boundary)
 * - ACCESS_PRIMARY_FRONTAGE (Main arterial road frontage)
 * - ACCESS_SECONDARY_CORRIDOR (Continuous secondary corridor)
 * - BUILDING_MASS_* (Distinct podium and tower solids with zero overlap)
 */
export function exportToColladaDAE(
  site: SiteGeometry,
  masses: BuildingMass[],
  scenarioName: string,
  scenarioSetbacks?: Setbacks
): string {
  const timestamp = new Date().toISOString();
  const effectiveSetbacks = scenarioSetbacks || site.setbacks;
  const bounds = getCanonicalParcelBounds(site.grossSiteArea, effectiveSetbacks, site.frontageLength || 110);

  let geometriesXml = '';
  let visualNodesXml = '';

  // 1. SITE_BOUNDARY Geometry
  const siteVertices = [
    bounds.minX, bounds.minY, 0,
    bounds.maxX, bounds.minY, 0,
    bounds.maxX, bounds.maxY, 0,
    bounds.minX, bounds.maxY, 0
  ].join(' ');

  geometriesXml += `
    <geometry id="geom-site-boundary" name="SITE_BOUNDARY">
      <mesh>
        <source id="geom-site-boundary-positions">
          <float_array id="geom-site-boundary-positions-array" count="12">${siteVertices}</float_array>
          <technique_common>
            <accessor source="#geom-site-boundary-positions-array" count="4" stride="3">
              <param name="X" type="float"/><param name="Y" type="float"/><param name="Z" type="float"/>
            </accessor>
          </technique_common>
        </source>
        <vertices id="geom-site-boundary-vertices">
          <input semantic="POSITION" source="#geom-site-boundary-positions"/>
        </vertices>
        <polylist count="1">
          <input semantic="VERTEX" source="#geom-site-boundary-vertices" offset="0"/>
          <vcount>4</vcount>
          <p>0 1 2 3</p>
        </polylist>
      </mesh>
    </geometry>`;

  visualNodesXml += `
      <node id="node-site-boundary" name="SITE_BOUNDARY">
        <instance_geometry url="#geom-site-boundary"/>
      </node>`;

  // 2. BUILDABLE_AREA Geometry
  const buildableVertices = [
    bounds.buildableMinX, bounds.buildableMinY, 0.05,
    bounds.buildableMaxX, bounds.buildableMinY, 0.05,
    bounds.buildableMaxX, bounds.buildableMaxY, 0.05,
    bounds.buildableMinX, bounds.buildableMaxY, 0.05
  ].join(' ');

  geometriesXml += `
    <geometry id="geom-buildable-area" name="BUILDABLE_AREA">
      <mesh>
        <source id="geom-buildable-area-positions">
          <float_array id="geom-buildable-area-positions-array" count="12">${buildableVertices}</float_array>
          <technique_common>
            <accessor source="#geom-buildable-area-positions-array" count="4" stride="3">
              <param name="X" type="float"/><param name="Y" type="float"/><param name="Z" type="float"/>
            </accessor>
          </technique_common>
        </source>
        <vertices id="geom-buildable-area-vertices">
          <input semantic="POSITION" source="#geom-buildable-area-positions"/>
        </vertices>
        <polylist count="1">
          <input semantic="VERTEX" source="#geom-buildable-area-vertices" offset="0"/>
          <vcount>4</vcount>
          <p>0 1 2 3</p>
        </polylist>
      </mesh>
    </geometry>`;

  visualNodesXml += `
      <node id="node-buildable-area" name="BUILDABLE_AREA">
        <instance_geometry url="#geom-buildable-area"/>
      </node>`;

  // 3. Primary Arterial Frontage Road at positive Y
  const roadVertices = [
    bounds.minX - 20, bounds.maxY, 0,
    bounds.maxX + 20, bounds.maxY, 0,
    bounds.maxX + 20, bounds.maxY + 20, 0,
    bounds.minX - 20, bounds.maxY + 20, 0
  ].join(' ');

  const frontageStreetName = site.streetName || deriveStreetName(site.address).value;
  const frontageNodeName = `ACCESS_${frontageStreetName
    .replace(/[^a-zA-Z0-9]/g, '_')
    .replace(/_+/g, '_')
    .toUpperCase()}`;

  geometriesXml += `
    <geometry id="geom-access-frontage" name="${frontageNodeName}">
      <mesh>
        <source id="geom-access-positions">
          <float_array id="geom-access-positions-array" count="12">${roadVertices}</float_array>
          <technique_common>
            <accessor source="#geom-access-positions-array" count="4" stride="3">
              <param name="X" type="float"/><param name="Y" type="float"/><param name="Z" type="float"/>
            </accessor>
          </technique_common>
        </source>
        <vertices id="geom-access-vertices">
          <input semantic="POSITION" source="#geom-access-positions"/>
        </vertices>
        <polylist count="1">
          <input semantic="VERTEX" source="#geom-access-vertices" offset="0"/>
          <vcount>4</vcount>
          <p>0 1 2 3</p>
        </polylist>
      </mesh>
    </geometry>`;

  visualNodesXml += `
      <node id="node-access-frontage" name="${frontageNodeName}">
        <instance_geometry url="#geom-access-frontage"/>
      </node>`;

  // 4. BUILDING_MASS_* Geometries (Exact non-overlapping solids)
  masses.forEach((mass, index) => {
    const geoId = `geom-mass-${index}`;
    const nodeId = `node-mass-${index}`;
    const w = mass.dimensions.width;
    const l = mass.dimensions.length;
    const h = mass.dimensions.height;
    
    const posX = mass.position.x - w/2;
    const posY = mass.position.z - l/2;
    const posZ = mass.position.y || 0;

    const vertices = [
      0, 0, 0,
      w, 0, 0,
      w, l, 0,
      0, l, 0,
      0, 0, h,
      w, 0, h,
      w, l, h,
      0, l, h
    ].join(' ');

    geometriesXml += `
    <geometry id="${geoId}" name="BUILDING_MASS_${mass.name.toUpperCase().replace(/[^A-Z0-9_]/g, '_')}">
      <mesh>
        <source id="${geoId}-positions">
          <float_array id="${geoId}-positions-array" count="24">${vertices}</float_array>
          <technique_common>
            <accessor source="#${geoId}-positions-array" count="8" stride="3">
              <param name="X" type="float"/><param name="Y" type="float"/><param name="Z" type="float"/>
            </accessor>
          </technique_common>
        </source>
        <vertices id="${geoId}-vertices">
          <input semantic="POSITION" source="#${geoId}-positions"/>
        </vertices>
        <polylist count="6">
          <input semantic="VERTEX" source="#${geoId}-vertices" offset="0"/>
          <vcount>4 4 4 4 4 4</vcount>
          <p>
            0 3 2 1
            4 5 6 7
            0 1 5 4
            1 2 6 5
            2 3 7 6
            3 0 4 7
          </p>
        </polylist>
      </mesh>
    </geometry>`;

    visualNodesXml += `
      <node id="${nodeId}" name="BUILDING_MASS_${mass.name.toUpperCase().replace(/[^A-Z0-9_]/g, '_')}">
        <translate>${posX} ${posY} ${posZ}</translate>
        <instance_geometry url="#${geoId}"/>
      </node>`;
  });

  return `<?xml version="1.0" encoding="utf-8"?>
<COLLADA xmlns="http://www.collada.org/2005/11/COLLADASchema" version="1.4.1">
  <asset>
    <contributor>
      <authoring_tool>SitePilot 3D Spatial Development Workspace v1.0</authoring_tool>
      <comments>Scenario: ${scenarioName} | Gross Site Area: ${bounds.grossSiteArea}m2 | Coordinate System: Local metric study coordinates (Origin 0,0,0 at parcel center) · WGS84 Reference | Unit: 1.0 Meter | Axis: Z_UP</comments>
    </contributor>
    <created>${timestamp}</created>
    <modified>${timestamp}</modified>
    <unit name="meter" meter="1.0"/>
    <up_axis>Z_UP</up_axis>
  </asset>
  <library_geometries>
    ${geometriesXml}
  </library_geometries>
  <library_visual_scenes>
    <visual_scene id="Scene" name="SitePilot_${scenarioName.replace(/[^a-zA-Z0-9_]/g, '_')}">
      <node id="SITE_ROOT" name="SITEPILOT_CANONICAL_MODEL">
        ${visualNodesXml}
      </node>
    </visual_scene>
  </library_visual_scenes>
  <scene>
    <instance_visual_scene url="#Scene"/>
  </scene>
</COLLADA>`;
}
