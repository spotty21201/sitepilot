# ADR-002: Typed Canonical Commands, Reducers, and Revision Lineage

**Status:** APPROVED  
**Date:** 2026-08-21  
**Deciders:** AntiGravity (Implementation Orchestrator)

## Context
In early SitePilot iterations, direct React state setters in `page.tsx` directly mutated mass arrays and recalculated metrics in ad-hoc callbacks. This lacked replayability, transactional integrity, deterministic undo/redo, and revision hashing.

## Decision
1. **Command Pattern:** Every user, system, or AI-proposed edit must be expressed as a typed canonical command (`SpatialCommand` in `src/lib/spatial/commands.ts`):
   - `MOVE_MASS`, `RESIZE_MASS`, `SET_MASS_FLOORS`, `SET_MASS_PROGRAM`, `DUPLICATE_MASS`, `DELETE_MASS`, `SET_SETBACKS`, `FIT_TO_ENVELOPE`, `RESET_SCENARIO`.
2. **Pure Deterministic Reducer:** `executeSpatialCommand(site, scenario, command)` processes commands immutably, computing:
   - Updated scenario state
   - Deterministic SHA-256 revision hash
   - Inverse command for exact undo/redo
   - Re-evaluated metrics and compliance
3. **Transient vs Committed Previews:** Pointer dragging in the 3D viewport produces transient preview feedback only. Cancelling (e.g. Escape key) discards the transient preview without dispatching a command. Releasing pointer commits exactly one command.

## Consequences
- **Positive:** Full audit trail, deterministic replayability, scenario-scoped undo/redo, and verifiable revision hashes for exported models and AI payloads.
- **Negative:** Slightly higher ceremony when introducing new massing operations.
