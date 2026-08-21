# ADR-004: SpatialEditorAdapter Boundary and Renderer Lifecycle

**Status:** APPROVED  
**Date:** 2026-08-21  
**Deciders:** AntiGravity (Implementation Orchestrator)

## Context
The 3D viewport was previously coupled directly to Three.js canvas lifecycles, mixing camera animations, hover raycasting, custom drag handle mathematics, and planning calculations.

## Decision
1. **Adapter Interface (`SpatialEditorAdapter`):** Define a clean interface contract (`src/features/development-3d/spatial-editor-adapter.ts`) separating rendering engines from SitePilot's planning core:
   - **Inputs:** Read-only immutable `DevelopmentScenario` and `SiteGeometry`.
   - **Outputs:** Typed `SpatialCommand` proposals upon committed edits.
   - **Internal Transient State:** Camera presets, orbit/pan/zoom, hover preselection, snap targets, and drag preview HUDs.
2. **Pluggable Renderers:** Enables running purpose-built Three.js/R3F as the primary editor while isolating experimental engines (Pascal Editor, That Open Components) behind the same interface.

## Consequences
- **Positive:** Isolates 3D engine upgrades, WebGPU transitions, or package replacements from core planning logic.
- **Negative:** Requires bridging React component events through the adapter.
