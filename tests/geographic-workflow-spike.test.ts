import { describe, it, expect } from 'vitest';
import {
  GeographicBoundaryPolygon,
  createLocalProjectFrame,
  geographicToLocalFrame,
  localFrameToGeographic,
  transformBoundaryToLocal,
  calculateGeodesicDistanceMeters
} from '@/lib/spatial/project-frame';

describe('SitePilot Bounded Spike — Geographic Workflow & Local Metric Project Frame', () => {
  // Non-Jakarta Cadastral Parcel: 100 George St, The Rocks, Sydney, Australia (-33.8591, 151.2093)
  const sydneyCadastralBoundary: GeographicBoundaryPolygon = {
    id: 'bnd-sydney-george-st-01',
    name: '100 George St Cadastral Parcel (Lot 1 DP 87452)',
    metadata: {
      providerName: 'NSW Spatial Services (Cadastral Web Service)',
      sourceId: 'LOT-1-DP87452',
      retrievalDate: '2026-08-21T05:00:00Z',
      sourceCRS: 'EPSG:4326',
      units: 'meters',
      accuracyMeters: 0.05,
      authority: 'AUTHORITATIVE_CADASTRAL',
      attribution: 'State of New South Wales (Spatial Services)',
      license: 'CC-BY-4.0'
    },
    // Pentagonal 5-vertex parcel polygon (50m x 70m roughly ~3,500 m²)
    coordinates: [
      { longitude: 151.209000, latitude: -33.859000, elevationMeters: 12.5 },
      { longitude: 151.209540, latitude: -33.859000, elevationMeters: 12.8 },
      { longitude: 151.209540, latitude: -33.859630, elevationMeters: 13.0 },
      { longitude: 151.209270, latitude: -33.859700, elevationMeters: 12.9 },
      { longitude: 151.209000, latitude: -33.859630, elevationMeters: 12.6 },
      { longitude: 151.209000, latitude: -33.859000, elevationMeters: 12.5 } // Closes ring
    ],
    areaM2: 3498.5,
    perimeterMeters: 236.4
  };

  it('establishes a local metric project frame centered at parcel centroid', () => {
    const frame = createLocalProjectFrame(sydneyCadastralBoundary);
    
    expect(frame.id).toMatch(/^frame-/);
    expect(frame.units).toBe('meters');
    expect(frame.sourceCRS).toBe('EPSG:4326');
    expect(frame.authority).toBe('AUTHORITATIVE_CADASTRAL');
    expect(frame.accuracyMeters).toBe(0.05);

    // Centroid must lie within bounding box of polygon
    expect(frame.centroid.longitude).toBeGreaterThan(151.209000);
    expect(frame.centroid.longitude).toBeLessThan(151.209540);
    expect(frame.centroid.latitude).toBeLessThan(-33.859000);
    expect(frame.centroid.latitude).toBeGreaterThan(-33.859700);
  });

  it('transforms geographic coordinates to local metric frame (ENU) and achieves sub-millimeter round-trip precision', () => {
    const frame = createLocalProjectFrame(sydneyCadastralBoundary);

    for (const geoCoord of sydneyCadastralBoundary.coordinates) {
      // Forward transform: Geographic -> Local Metric (X East, Y North in meters)
      const localCoord = geographicToLocalFrame(geoCoord, frame);
      
      // Inverse transform: Local Metric -> Geographic
      const roundtripGeo = localFrameToGeographic(localCoord, frame);

      // Verify geodesic error between original and round-tripped coordinate is < 0.001 meters (1mm)
      const errorMeters = calculateGeodesicDistanceMeters(geoCoord, roundtripGeo);
      expect(errorMeters).toBeLessThan(0.001); // < 1 mm error
    }
  });

  it('computes accurate 2D planar metric area and perimeter in the local project frame', () => {
    const frame = createLocalProjectFrame(sydneyCadastralBoundary);
    const localBoundary = transformBoundaryToLocal(sydneyCadastralBoundary, frame);

    expect(localBoundary.authority).toBe('AUTHORITATIVE_CADASTRAL');
    expect(localBoundary.coordinates.length).toBe(sydneyCadastralBoundary.coordinates.length);

    // Assert local metric area is within precision bounds
    expect(localBoundary.areaM2).toBeGreaterThanOrEqual(3650);
    expect(localBoundary.areaM2).toBeLessThanOrEqual(3720);
    expect(localBoundary.perimeterMeters).toBeGreaterThanOrEqual(230);
    expect(localBoundary.perimeterMeters).toBeLessThanOrEqual(250);
  });

  it('clearly distinguishes indicative trace from authoritative cadastral boundaries', () => {
    const indicativeTraceBoundary: GeographicBoundaryPolygon = {
      id: 'bnd-user-trace-01',
      name: 'Indicative Rough Site Sketch',
      metadata: {
        providerName: 'User On-Screen Draw Tool',
        retrievalDate: '2026-08-21T05:10:00Z',
        sourceCRS: 'EPSG:4326',
        units: 'meters',
        accuracyMeters: 5.0,
        authority: 'INDICATIVE_TRACE',
        attribution: 'User Sketch (Subject to Cadastral Survey)'
      },
      coordinates: sydneyCadastralBoundary.coordinates,
      areaM2: 3500,
      perimeterMeters: 236
    };

    const frame = createLocalProjectFrame(indicativeTraceBoundary);
    const local = transformBoundaryToLocal(indicativeTraceBoundary, frame);

    expect(local.authority).toBe('INDICATIVE_TRACE');
    expect(frame.authority).toBe('INDICATIVE_TRACE');
    expect(frame.accuracyMeters).toBe(5.0);
  });
});
