# ADR-007: Migration, Feature Flags, and Rollback Strategy

**Status:** APPROVED  
**Date:** 2026-08-21  
**Deciders:** AntiGravity (Implementation Orchestrator)

## Context
Replacing or upgrading 3D viewports, geographic adapters, and repository layers in an active product risks regressions, data loss, and breaking investor demonstrations.

## Decision
1. **Non-Destructive Transition:** Retain legacy localStorage schema and current Three.js viewport behind feature flags during Phase 1–4.
2. **Deterministic Fallbacks:** If WebGPU or experimental 3D renderers fail to initialize, automatically fall back to WebGL Three.js viewport and 2D SVG site plan without losing canonical scenario state.
3. **Safe Rollback:** Any new spatial editor adapter must be reversible via a single environment flag (`NEXT_PUBLIC_SPATIAL_EDITOR_ENGINE`) without altering stored canonical case data.

## Consequences
- **Positive:** Zero downtime risk; safe progressive rollout.
- **Negative:** Temporary maintenance of legacy adapter code.
