# ADR-003: Geographic Coordinates, CRS, and Local Metric Project Frame (ENU)

**Status:** APPROVED  
**Date:** 2026-08-21  
**Deciders:** AntiGravity (Implementation Orchestrator)

## Context
Initial prototypes used fixed synthetic Jakarta coordinates `[-6.189, 106.833]` and derived bounding boxes without georeferencing, preventing SitePilot from operating on genuine global parcels. Web Mercator (EPSG:3857) suffers from latitude-dependent scale distortion and is unsuitable for millimetric architectural and engineering calculations.

## Decision
1. **Dual Coordinate Model:**
   - **Geographic Layer:** Stores original coordinates in WGS84 (EPSG:4326) or source CRS (e.g. UTM / local national grid) with complete spatial metadata (provider, authority, retrieval date, accuracy).
   - **Local Metric Project Frame (ENU):** Authoritative local tangent plane in meters centered at the parcel centroid `(lat0, lon0)`.
     * `X`: East in meters
     * `Y`: North in meters
     * `Z`: Elevation in meters (vertical datum EGM96/MSL)
2. **Sub-Millimeter Reversibility:** Forward `geographicToLocalFrame()` and inverse `localFrameToGeographic()` transformations must achieve < 1mm round-trip tolerance across the parcel extent.
3. **Boundary Provenance:** Boundaries must explicitly record authority classifications: `AUTHORITATIVE_CADASTRAL`, `SURVEYED_LEGAL`, `IMPORTED_SOURCE`, `USER_CORRECTED`, `INDICATIVE_TRACE`, or `ILLUSTRATIVE_STUDY`.

## Consequences
- **Positive:** True geographic mobility for any parcel worldwide while maintaining strict millimetric precision for architectural massing and setback compliance.
- **Negative:** Requires explicit coordinate conversions at the boundary between map components and 3D viewports.
