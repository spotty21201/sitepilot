# Spatial Console Production Provenance

## Design and implementation provenance

- The owner conceived and directed SitePilot, set the product constraints, selected the Spatial Console direction, and visually accepted the final design and interaction architecture.
- Kimi was an AI design and coding assistant used under the owner's direction. It is not described as a human contributor, legal co-owner, or independent design authority.
- The Spatial Console concept and prototype were generated and iterated specifically for SitePilot. The repository contains no evidence that the visual design or prototype was copied from an earlier product.
- The production adapter, canonical-command integration, direct editing lifecycle, fallback behavior, accessibility corrections, and verification were independently implemented and tested in the SitePilot worktree.
- Antigravity and other AI coding agents were also used for development, review, integration, and testing. AI assistance must remain disclosed in the submission.

The official hackathon FAQ permits AI coding assistants, and the rules expressly allow AI coding assistants as standard development tools. That permission does not itself establish ownership. The unresolved provenance item is owner confirmation that Kimi and every other AI service was used under applicable provider/account terms and that the entrant has sufficient rights to submit and grant the required license for the assisted output. This is a factual owner/provider-terms acceptance item, not a claim that an AI system owns the design and not legal advice.

## Production implementation

- Production Spatial Console modules, scoped design tokens, interaction overlays, and SitePilot-specific inline UI marks are in `src/features/development-3d/spatial-console/`.
- Production geometry is derived from the SitePilot canonical snapshot. Mutations route through the canonical command service; the renderer does not own planning truth.
- The owner-approved visual and interaction architecture is frozen for this release except for genuine release blockers.
- General-purpose interface icons are rendered from Lucide. No icon files were copied from the standalone prototype.

## Fonts, packages, and licenses

- Inter and JetBrains Mono are loaded through `next/font/google`, which self-hosts generated font assets at build time. Both font families are published under the SIL Open Font License 1.1.
- `@google/genai` package metadata declares Apache-2.0.
- Next.js, React, React Three Fiber, Drei, Three.js, Turf, Zustand, Zod, clsx, tailwind-merge, and the installed Pascal packages declare MIT licenses.
- Lucide declares ISC; MapLibre GL JS declares BSD-3-Clause.
- All third-party packages and fonts remain governed by their own licenses and notices. The root repository currently has no `LICENSE` file even though an earlier README stated “MIT License”; the owner must choose and add an accurate project license before submission.

## Assets and excluded prototype material

- The production Spatial Console contains no stock 3D models, textures, photographs, imagery, background image, or copied mock geography. Scene geometry and materials are created in source.
- Parcel, envelope, massing, metrics, compliance, revision, and selection inputs come from the production SitePilot canonical snapshot.
- Prototype sample cases, mock planning calculations, mock persistence, command store, standalone history, compiled output, roads, buildings, lot-line context, screenshots, and source maps are excluded from the production release commits.
- The prototype's illustrative Menteng geography and mock calculations are not production authority. Surrounding map/cadastral context remains visibly qualified until an authoritative source is integrated.
- Default Next.js starter SVGs/favicon and all open-source dependencies are third-party or starter material, not claimed as original SitePilot assets.

## Release controls

- Spatial Console is the source default when `NEXT_PUBLIC_SPATIAL_EDITOR_ENGINE` is unset.
- Explicit `spatial-console` selects Spatial Console; explicit `legacy` and any unrecognized explicit value select the legacy renderer.
- Spatial Console initialization or canonical-snapshot synchronization failure activates the legacy renderer, and the render branches are mutually exclusive.
- The legacy renderer and its tests remain present as the release kill-switch and fallback path.
- Measurement has no production implementation and is omitted from the Spatial Console primary editing rail. No unavailable control is presented as functional.

## Submission disclosure wording

> SitePilot and the Spatial Console were conceived and directed by the entrant. Kimi was used as an AI design/coding assistant to generate and iterate a SitePilot-specific console under the entrant's direction; Antigravity and other AI coding agents assisted implementation, review, and testing. The entrant selected and accepted the design, and the production integration was independently implemented and verified against SitePilot's canonical geometry and command architecture. No stock models, imagery, or textures were incorporated into the production console. Third-party packages and fonts remain subject to their respective open-source licenses.
