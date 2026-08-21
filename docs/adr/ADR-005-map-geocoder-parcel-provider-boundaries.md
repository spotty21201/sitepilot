# ADR-005: Map, Geocoder, and Parcel-Provider Adapter Boundaries

**Status:** APPROVED  
**Date:** 2026-08-21  
**Deciders:** AntiGravity (Implementation Orchestrator)

## Context
SitePilot requires mapping context, address geocoding, cadastral parcel boundary acquisition, and satellite/3D imagery. Combining all geospatial responsibilities into a single proprietary SDK introduces vendor lock-in, licensing friction, and unverified authority assumptions.

## Decision
1. **Separation of Provider Roles:**
   - **Geocoder Adapter:** Address and place search (Google Geocoding / Mapbox / OpenStreetMap Nominatim).
   - **Basemap / Vector Map Adapter:** MapLibre GL JS compatible vector tiles.
   - **Parcel / Cadastral Boundary Adapter:** Authoritative national / municipal cadastral web services (e.g. NSW Spatial Services, BPN Indonesia, UK Land Registry, or user-uploaded SHP/GeoJSON).
   - **Context Imagery / 3D Tiles:** Separate layer for 3D Photorealistic Tiles / satellite orthoimagery.
2. **Authority Rule on Visual Imagery:** Basemaps and satellite imagery provide visual reference only. They must NEVER be presented as authoritative cadastral boundary truth.

## Consequences
- **Positive:** Modular architecture allowing different geographic providers per jurisdiction without core refactoring.
- **Negative:** Multiple provider interfaces to maintain.
