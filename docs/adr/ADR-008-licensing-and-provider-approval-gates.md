# ADR-008: Licensing and Provider Approval Gates

**Status:** APPROVED  
**Date:** 2026-08-21  
**Deciders:** AntiGravity (Implementation Orchestrator)

## Context
Geospatial APIs, 3D tiles, and third-party UI packages carry diverse licensing constraints (e.g. Google Maps Platform Terms, Mapbox telemetry/billing terms, AGPL/MIT library licenses).

## Decision
1. **Strict Approval Gate:** No paid API provider may be enabled, billing activated, IAM role changed, or commercial boundary ingested without prior explicit user authorization.
2. **MIT / Permissive License Requirement:** Core repository dependencies must adhere to permissive open-source licenses (MIT, Apache 2.0, BSD). AGPL/copyleft dependencies are prohibited in the core client distribution.
3. **Attribution Display:** All geographic context layers must render mandatory provider attribution.

## Consequences
- **Positive:** Prevents accidental commercial licensing breaches or cloud cost overruns.
- **Negative:** Mock / open data fixtures must be used for automated CI testing when commercial API keys are unset.
