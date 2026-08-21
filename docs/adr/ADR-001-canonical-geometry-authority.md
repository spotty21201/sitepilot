# ADR-001: Canonical Geometry and Planning Authority

**Status:** APPROVED  
**Date:** 2026-08-21  
**Deciders:** AntiGravity (Implementation Orchestrator), Architecture Team  

## Context
SitePilot connects fragmented property evidence, spatial context, building massing, and statutory planning compliance into an early investment decision room. Multiple rendering and viewing layers exist (Three.js WebGL canvas, 2D SVG site plans, potential WebGPU/MapLibre viewers, and export formats). Without a strict authority boundary, transient renderer state, floating-point GPU inaccuracies, or client-side manipulators could drift or independently fabricate planning truth (such as GFA, FAR, coverage, setbacks, and height limits).

## Decision
1. **Single Source of Truth:** The deterministic canonical SitePilot domain model (`src/lib/geometry/engine.ts` and `src/lib/spatial/`) is the **sole and exclusive authority** for:
   - Parcel boundaries and polygon coordinates
   - Local metric project coordinates (ENU tangent frame)
   - Building masses, floor-to-floor heights, and storey counts
   - Setback calculations, buildable envelopes, and easement reserves
   - GFA, FAR/KLB, KDB site coverage, and KDH open space metrics
   - Statutory and provisional planning compliance evaluations
   - Scenario comparisons, executive summaries, and exported artifacts
2. **Subordination of Viewers:** 3D renderers (Three.js, Pascal, That Open), 2D maps (MapLibre), and UI inputs are strictly view and manipulation adapters. They must NEVER directly calculate planning metrics or mutate state without dispatching a typed canonical command.

## Consequences
- **Positive:** Guaranteed consistency across 3D viewport, 2D plan, scenario matrix, AI assessment payloads, and downloaded COLLADA DAE / GLB exports.
- **Negative:** Viewport manipulation requires an adapter layer to dispatch commands and await canonical state updates rather than direct three-scene graph mutation.
