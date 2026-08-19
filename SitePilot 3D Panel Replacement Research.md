# SitePilot 3D Panel Replacement Research

Date: 2026-08-18

## Decision

Run a technical spike with **Pascal Editor** as the first-choice replacement for SitePilot's current 3D panel. If Pascal proves unstable as an embedded package, use **That Open Components** as the lower-risk viewer foundation and build SitePilot's limited massing controls on top.

Changing only Three.js materials, lighting, or shadows will not make the panel feel like SketchUp. The missing quality is mainly interaction design: accurate navigation, selection, snapping, dimensions, axes, view modes, and readable architectural edges.

## First choice: Pascal Editor

Pascal separates its WebGPU viewer, editor tools, scene model, and architectural nodes into reusable packages:

- @pascal-app/viewer
- @pascal-app/editor
- @pascal-app/core
- @pascal-app/nodes

Strengths:

- React 19 and Next.js 16 alignment
- Perspective and orthographic cameras
- Outline and post-processing effects
- Direct selection and manipulation
- Level display modes and cutaways
- Undo and redo
- Plugin architecture for custom SitePilot objects
- MIT license

Risks:

- Fast-moving pre-1.0 packages
- WebGPU compatibility needs testing on target browsers
- Recent npm-only integration and measurement issues make a spike mandatory

Links:

- [Pascal Editor GitHub](https://github.com/pascalorg/editor)
- [Viewer documentation](https://github.com/pascalorg/editor/blob/main/packages/viewer/README.md)
- [Viewer on npm](https://www.npmjs.com/package/@pascal-app/viewer)
- [Open issues](https://github.com/pascalorg/editor/issues)

## Best fallback: That Open Components

That Open is a mature Three.js-based AEC/BIM toolkit with dimensions, orthographic and perspective cameras, floor-plan navigation, clipping planes, highlighting, post-processing, and DXF-related capabilities. It is a stronger viewer toolkit than a drawing editor.

Use it if SitePilot's 3D panel is primarily for inspecting planner-generated massing rather than authoring arbitrary buildings in the viewport. SitePilot would still need to provide selection, resizing, movement, numeric input, and massing-specific tools.

Links:

- [That Open Components GitHub](https://github.com/ThatOpen/engine_components)
- [Releases](https://github.com/ThatOpen/engine_components/releases)
- [Clipping and camera example](https://github.com/ThatOpen/engine_components/blob/main/packages/core/src/core/Clipper/example.ts)
- [Reddit BIM viewer discussion](https://www.reddit.com/r/bim/comments/1nb7vmp/best_bim_web_viewer/)

## Other options reviewed

| Option | SketchUp-like editing | SitePilot fit | Conclusion |
| --- | --- | --- | --- |
| Pascal Editor | High | High | Best replacement spike |
| That Open Components | Medium | High for viewing | Best fallback |
| Speckle Viewer | Low | Medium | Better for viewing and collaboration around external models |
| xeokit | Low | Medium | Strong BIM viewer, but AGPL/commercial licensing requires care |
| Aedifex | High | Low currently | Immature and derived from Pascal |
| openPlan3D | Medium | Low | Svelte and residential floor-plan orientation |
| Replicad/OpenCascade | None by itself | Low currently | Geometry kernel, not a finished editor UI |

Additional links:

- [Speckle](https://github.com/specklesystems/speckle-server)
- [xeokit](https://github.com/xeokit/xeokit-sdk)
- [Aedifex](https://github.com/TangSY/aedifex)
- [openPlan3D](https://github.com/laanlabs/openPlan3D)

## What makes the viewport feel like SketchUp

Reddit testing and feedback consistently identify these behaviors as essential:

- Exact numeric input, not sliders alone
- Strong grid, axis, endpoint, midpoint, face, and alignment snapping
- Predictable orbit, pan, zoom, and zoom-to-selection
- Persistent red, green, and blue axes
- Tape-measure guides and visible dimensions
- Object, face, and edge selection
- Clear push/pull or extrusion preview
- Modifier-key conventions and keyboard shortcuts
- Orthographic top, front, side, and isometric views
- Section-plane preview
- Monochrome or hidden-line visual style with strong edges

Community references:

- [Browser CAD precision discussion](https://www.reddit.com/r/FreeCAD/comments/1ufdh3v/i_built_a_browserbased_cad_editor_for_people_who/)
- [SketchUp interaction feedback](https://www.reddit.com/r/Sketchup/comments/1tc09sf/open_source_sketchup_update/)
- [Three.js and Manifold browser CAD](https://www.reddit.com/r/threejs/comments/1u97548/built_a_browser_cad_editor_with_threejs_no_r3f/)

## Recommended SitePilot architecture

Keep SitePilot's deterministic planning geometry and metrics as the canonical source of truth. The 3D module must be a view and editing adapter, not the source of FAR, GFA, setbacks, compliance, or export geometry.

Create custom Pascal nodes for:

- Site boundary
- Buildable envelope
- Road reserve
- Setback lines
- Podium masses
- Tower-wing masses
- Zoning-height envelope

All scenario changes should update the canonical SitePilot model first, then re-render the 3D scene. Exports should also be produced from canonical geometry rather than the viewer's transient scene graph.

## Proposed technical spike

1. Create an isolated route for the Pascal viewer.
2. Load one real SitePilot scenario using custom parcel, envelope, podium, and tower nodes.
3. Demonstrate perspective, orthographic, isometric, top, front, and side views.
4. Add architectural edge rendering, selection outlines, axes, grid, and a view cube.
5. Test orbit, pan, zoom, zoom-to-fit, and zoom-to-selection.
6. Provide exact numeric position and size fields.
7. Verify setbacks and zoning envelope remain legible without geometry overlap.
8. Test Chrome, Safari, and the target planner hardware.
9. Confirm npm-only integration and record bundle size and frame rate.
10. Compare the result side-by-side with the current panel before deciding whether to migrate.

## Acceptance criteria

- A planner can understand the parcel, setbacks, access, massing, and height cap within five seconds.
- Masses are separately selectable and never overlap incorrectly.
- Every visible dimension can be entered numerically.
- Camera controls behave consistently and include one-click standard views.
- Visual modes are genuinely different and correctly named.
- Geometry, calculations, and exported models remain consistent.