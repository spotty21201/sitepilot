# ADR-006: Server-Authoritative Export Pipeline, Lineage, and Z_UP Axis Convention

**Status:** APPROVED  
**Date:** 2026-08-21  
**Deciders:** AntiGravity (Implementation Orchestrator)

## Context
1. DAE export generation was previously split between client-side blob generation and an API route that permitted unverified client payloads or Golden Project fallbacks.
2. The export acceptance contract had an inconsistency: the exporter emitted `<up_axis>Z_UP</up_axis>` while an acceptance check searched for `Y_UP`.

## Decision
1. **Z_UP Architectural Axis Standard:** Standardize on **Z_UP** as the canonical coordinate orientation for all exported COLLADA 1.4.1 DAE, IFC, and CAD artifacts:
   - `X`: East / Parcel Width
   - `Y`: North / Parcel Length
   - `Z`: Elevation / Height above ground
   - All tests, acceptance scripts, documentation, and exporter templates must strictly align on `<up_axis>Z_UP</up_axis>`.
2. **Server-Authoritative Export:** Export endpoints must load the authorized canonical scenario revision snapshot server-side. Client-supplied raw XML and fallback to unrelated demo cases in production exports are strictly disallowed.
3. **Artifact Provenance Manifest:** Every exported artifact must embed project identity, revision hash, boundary authority, and local project frame origin.

## Consequences
- **Positive:** 100% downstream interoperability with architectural tools (SketchUp, Blender, Rhino, AutoCAD, Revit) which expect Z as the vertical elevation axis.
- **Negative:** Three.js internal scene (which is Y_UP) requires a single 90-degree X-axis rotation upon import/export conversion.
