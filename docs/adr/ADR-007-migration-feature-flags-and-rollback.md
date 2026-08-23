# ADR-007: Migration, Feature Flags, and Rollback Strategy

**Status:** APPROVED  
**Date:** 2026-08-21  
**Deciders:** AntiGravity (Implementation Orchestrator)

## Context
Replacing or upgrading 3D viewports, geographic adapters, and repository layers in an active product risks regressions, data loss, and breaking investor demonstrations.

## Decision
1. **Non-Destructive Transition:** Retain the legacy localStorage schema and legacy Three.js viewport behind the `NEXT_PUBLIC_SPATIAL_EDITOR_ENGINE` feature flag.
2. **Deterministic Fallbacks:** If WebGPU or experimental 3D renderers fail to initialize, automatically fall back to WebGL Three.js viewport and 2D SVG site plan without losing canonical scenario state.
3. **Safe Rollback:** Any new spatial editor adapter must be reversible via a single environment flag (`NEXT_PUBLIC_SPATIAL_EDITOR_ENGINE`) without altering stored canonical case data.
4. **Release-Candidate Default:** An unset flag selects `spatial-console`; explicit `spatial-console` selects Spatial Console; explicit `legacy` selects the legacy renderer. Any other explicit value fails closed to `legacy`. Spatial Console construction or canonical-snapshot synchronization failure also activates `legacy`. Render branches remain mutually exclusive.

## Consequences
- **Positive:** Zero downtime risk; safe progressive rollout.
- **Negative:** Temporary maintenance of legacy adapter code.
- **Operational:** Because `NEXT_PUBLIC_` values are embedded by Next.js at build time, changing the kill-switch value requires a fresh production build. No hosted value is changed by this decision.
