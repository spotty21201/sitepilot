/**
 * SitePilot Spatial Engine — Geographic Coordinate System & Local Metric Project Frame
 * Implements authoritative geodesic transformation between geographic coordinates (WGS84/CRS)
 * and local tangent engineering coordinates (East-North-Up / ENU in meters).
 */

export type BoundaryAuthority = 
  | 'AUTHORITATIVE_CADASTRAL'
  | 'SURVEYED_LEGAL'
  | 'IMPORTED_SOURCE'
  | 'USER_CORRECTED'
  | 'INDICATIVE_TRACE'
  | 'ILLUSTRATIVE_STUDY';

export interface SpatialSourceMetadata {
  providerName: string;
  sourceId?: string;
  retrievalDate: string;
  sourceCRS: string; // e.g. 'EPSG:4326', 'EPSG:3857', 'EPSG:7856'
  units: 'meters' | 'feet' | 'degrees';
  accuracyMeters: number;
  authority: BoundaryAuthority;
  attribution: string;
  license?: string;
}

export interface GeographicCoordinate {
  longitude: number;
  latitude: number;
  elevationMeters?: number;
}

export interface LocalMetricCoordinate {
  x: number; // East in meters relative to project origin
  y: number; // North in meters relative to project origin
  z: number; // Elevation in meters relative to project datum
}

export interface LocalProjectFrame {
  id: string;
  origin: GeographicCoordinate;
  rotationDegrees: number; // 0 = True North aligned
  verticalDatum: string; // e.g. 'MSL' (Mean Sea Level) or 'EGM96'
  units: 'meters';
  sourceCRS: string;
  authority: BoundaryAuthority;
  accuracyMeters: number;
  centroid: GeographicCoordinate;
}

export interface GeographicBoundaryPolygon {
  id: string;
  name: string;
  coordinates: GeographicCoordinate[]; // Ring of exterior boundary coordinates (must close)
  metadata: SpatialSourceMetadata;
  areaM2: number;
  perimeterMeters: number;
}

export interface LocalBoundaryPolygon {
  id: string;
  name: string;
  coordinates: LocalMetricCoordinate[];
  areaM2: number;
  perimeterMeters: number;
  projectFrameId: string;
  authority: BoundaryAuthority;
}

const WGS84_A = 6378137.0; // WGS84 major semi-axis in meters
const WGS84_E2 = 0.00669437999014; // WGS84 first eccentricity squared

/**
 * Calculates geodesic distance in meters between two lat/lon points using Haversine.
 */
export function calculateGeodesicDistanceMeters(
  coordA: GeographicCoordinate,
  coordB: GeographicCoordinate
): number {
  const lat1 = (coordA.latitude * Math.PI) / 180;
  const lat2 = (coordB.latitude * Math.PI) / 180;
  const dLat = ((coordB.latitude - coordA.latitude) * Math.PI) / 180;
  const dLon = ((coordB.longitude - coordA.longitude) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return WGS84_A * c;
}

/**
 * Computes polygon centroid in geographic space.
 */
export function computeGeographicCentroid(coordinates: GeographicCoordinate[]): GeographicCoordinate {
  if (!coordinates.length) return { longitude: 0, latitude: 0 };
  const pts = coordinates.slice(0, coordinates.length - 1);
  const sumLon = pts.reduce((acc, p) => acc + p.longitude, 0);
  const sumLat = pts.reduce((acc, p) => acc + p.latitude, 0);
  return {
    longitude: sumLon / pts.length,
    latitude: sumLat / pts.length,
    elevationMeters: 0
  };
}

/**
 * Creates an authoritative local metric project frame centered at a parcel centroid.
 */
export function createLocalProjectFrame(
  boundary: GeographicBoundaryPolygon,
  frameId: string = `frame-${Date.now()}`
): LocalProjectFrame {
  const centroid = computeGeographicCentroid(boundary.coordinates);
  return {
    id: frameId,
    origin: centroid,
    rotationDegrees: 0,
    verticalDatum: 'EGM96',
    units: 'meters',
    sourceCRS: boundary.metadata.sourceCRS,
    authority: boundary.metadata.authority,
    accuracyMeters: boundary.metadata.accuracyMeters,
    centroid
  };
}

/**
 * Forward transformation: Geographic (lon, lat) -> Local Metric Frame (x East, y North in meters).
 * Uses high-precision local tangent plane projection centered at project origin.
 */
export function geographicToLocalFrame(
  coord: GeographicCoordinate,
  frame: LocalProjectFrame
): LocalMetricCoordinate {
  const originLatRad = (frame.origin.latitude * Math.PI) / 180;
  const latRad = (coord.latitude * Math.PI) / 180;
  const dLonRad = ((coord.longitude - frame.origin.longitude) * Math.PI) / 180;
  const dLatRad = ((coord.latitude - frame.origin.latitude) * Math.PI) / 180;

  // Radii of curvature at origin
  const sinLat = Math.sin(originLatRad);
  const N = WGS84_A / Math.sqrt(1 - WGS84_E2 * sinLat * sinLat); // Prime vertical radius
  const M = (WGS84_A * (1 - WGS84_E2)) / Math.pow(1 - WGS84_E2 * sinLat * sinLat, 1.5); // Meridional radius

  // Tangent plane coordinates (x = East, y = North)
  const xEast = N * Math.cos(latRad) * dLonRad;
  const yNorth = M * dLatRad;

  return {
    x: Math.round(xEast * 1000) / 1000,
    y: Math.round(yNorth * 1000) / 1000,
    z: coord.elevationMeters ?? 0
  };
}

/**
 * Inverse transformation: Local Metric Frame (x East, y North in meters) -> Geographic (lon, lat).
 */
export function localFrameToGeographic(
  localCoord: LocalMetricCoordinate,
  frame: LocalProjectFrame
): GeographicCoordinate {
  const originLatRad = (frame.origin.latitude * Math.PI) / 180;
  const sinLat = Math.sin(originLatRad);
  const N = WGS84_A / Math.sqrt(1 - WGS84_E2 * sinLat * sinLat);
  const M = (WGS84_A * (1 - WGS84_E2)) / Math.pow(1 - WGS84_E2 * sinLat * sinLat, 1.5);

  const dLatRad = localCoord.y / M;
  const latRad = originLatRad + dLatRad;
  const dLonRad = localCoord.x / (N * Math.cos(latRad));

  const latitude = frame.origin.latitude + (dLatRad * 180) / Math.PI;
  const longitude = frame.origin.longitude + (dLonRad * 180) / Math.PI;

  return {
    longitude: Math.round(longitude * 1e8) / 1e8,
    latitude: Math.round(latitude * 1e8) / 1e8,
    elevationMeters: localCoord.z
  };
}

/**
 * Transforms an entire geographic boundary polygon into a local metric polygon.
 */
export function transformBoundaryToLocal(
  geoBoundary: GeographicBoundaryPolygon,
  frame: LocalProjectFrame
): LocalBoundaryPolygon {
  const localCoords = geoBoundary.coordinates.map((c) => geographicToLocalFrame(c, frame));

  // Compute 2D polygon area using Shoelace formula on local metric coords
  let area = 0;
  let perimeter = 0;
  const n = localCoords.length;

  for (let i = 0; i < n - 1; i++) {
    const p1 = localCoords[i];
    const p2 = localCoords[i + 1];
    area += p1.x * p2.y - p2.x * p1.y;
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    perimeter += Math.sqrt(dx * dx + dy * dy);
  }
  area = Math.abs(area) / 2;

  return {
    id: `local-${geoBoundary.id}`,
    name: geoBoundary.name,
    coordinates: localCoords,
    areaM2: Math.round(area * 10) / 10,
    perimeterMeters: Math.round(perimeter * 10) / 10,
    projectFrameId: frame.id,
    authority: geoBoundary.metadata.authority
  };
}
