# Lakudemis foundation & Slice 1

Label: wayfinder:map

## Destination

The foundational decisions for Lakudemis are locked (stack, geometry library, domain model, dependency engine, file format), and a **Slice 1 spec** is ready to hand to `/grill-me` and then build.

Slice 1 covers:

- multiple Levels
- Walls drawn as boxes, Rayon-style
- Rooms detected automatically from Walls and Room separators, and adjustable by hand
- doors and windows as rectangular openings
- Slab + Floor finish
- Net and Gross floor and wall areas
- 2D editing plus a read-only 3D view
- automatic browser saving plus a JSON project file

Everything is checked against the reference house (the user's own home).

## Notes

- **Domain:** a connected, semantic building model: "Every part. One model." The vision is in `Docs/idea.md`; the vocabulary is in `CONTEXT.md`. Use the glossary terms. ADRs are in `Docs/adr/`.
- **Skills:** grilling tickets call `grilling` + `domain-modeling`; record hard-to-reverse choices as ADRs in `docs/adr/`.
- **Planning only.** This map produces decisions, not code. The build is handed off after the Slice 1 spec.
- **Standing preferences:**
  - Browser-first, with a desktop wrapper later (Tauri/Electron). The core (model, geometry, calculations) is plain TypeScript, UI-free.
  - TypeScript + Angular is the working assumption. No React; no hand-written C/C++ (any WASM-compiled C++ library must be flagged as a trade-off).
  - Licence: GPL-family (GPL-3.0 or AGPL-3.0); every dependency must be licence-compatible.
  - Metric first, with unit conversion possible later. UI strings in JSON translation files from day one.
  - The user is used to Angular and C#. Target users: homeowners/DIY first; the model must be able to grow to professionals.
  - Wall and Slab thickness come from project Presets and can be overridden per element.
  - Drawing, Rayon-inspired: click the first point, then drag. Snap to earlier boxes; type length and rotation (degrees) by hand.
  - **Why Lakudemis exists, in part:** Rayon is finicky about wall measurements and placing adjacent Walls. Its drawing of the reference house came out wrong in two rooms. Precise, typed dimensions and reliable adjacency beat drawing speed.

## Decisions so far

<!-- one line per closed ticket: [title](issues/NN-slug.md): gist -->

- [Choose a geometry library](issues/02-choose-geometry-library.md): clipper2-ts for 2D booleans/offsets/areas; our own TS for wall joins and room detection (half-edge faces, robust-predicates, JSTS as test oracle); manifold-3d (WASM) for 3D openings, pending acceptance in the stack decision.
- [Choose a 3D rendering library](issues/03-choose-3d-rendering-library.md): three.js (MIT) behind our own thin Angular adapter; pin versions; Babylon.js is the runner-up for when the 3D view becomes editable.
- [Choose a frontend framework for a canvas-heavy editor](issues/04-choose-frontend-framework.md): Angular 22 (zoneless, signals) + plain Canvas2D in a framework-free TS editor module with a spatial index; Konva/PixiJS as fallbacks.
- [Define Net and Gross area rules](issues/05-define-area-rules.md): EPB = outer dimensions, ventilation = inner; several named Gross/Net area types; store exact openings, apply subtraction thresholds as named Measurement rules; Slice 1 needs 8 of 17 area types.
- [Study how Rayon draws walls and detects rooms](issues/06-study-rayon-drawing.md): side toggle (left/centre/right) while drawing; Floorplanner-style box drag + typed dimensions; live room re-detection from a seed point with gap tolerance; Room separator = zero-thickness bounding line; show the level below as a tracing aid.
- [Capture the reference house](issues/01-capture-reference-house.md): ground floor only, a narrow row house (front block + narrower rear extension); tape inside dimensions are the source of truth (Rayon drawing has errors); tests a Room separator, L-shaped halls, a Room inside a Room (WC), a Furnishing that leaves areas unchanged (Kasten), and per-Room Room height.
- [Domain model v1](issues/07-domain-model-v1.md): Walls = Baseline + side + thickness, joined by stored Wall connections (ADR 0001); Rooms = Seed point + derived outline (ADR 0002); Presets followed live unless overridden, thickness changes push the plan to keep Room sizes; Level elevation = finished floor level; Slab, Floor build-up, Ceiling and derived Ceiling void; mm floats, typed IDs.
- [Box-drawing interaction](issues/09-box-drawing-interaction.md): two tools: a Room tool (drag the tape inside size, Walls grow outward, shared Walls reused) as the main one, and a Wall tool (drag, or click then type a locked length and rotate; S = side, typed angle) for odd walls; snaps create Wall connections. Prototype on branch `prototype/box-drawing`.
- [Wall joins and room detection strategy](issues/08-wall-joins-and-room-detection.md): Rooms = holes in the merged footprint of room-bounding Walls (Net outline directly), cut by Room separators, picked by Seed point; enclosure is geometric, joins need connections; mitred corners, T = butt on the host face, X = run-through + two Ts; overlaps prevented while drawing; broken Rooms flagged ("not enclosed", "sharing one area"), never stale.

## Not yet specified

- **Units & display settings:** how display units and precision are configured and stored.
- **Translation files:** the JSON translation structure and key naming.
- **Assemblies:** layered Walls, Slabs and Floor build-ups (brick / insulation / screed / plaster), and how they replace the single thickness number. Includes butt joints with "which Wall wins" priority instead of v1 mitres.
- **Multiple Buildings:** more than one Building per Project (the user's detached garage).
- **Locked dimensions:** storing measured inside dimensions as constraints kept true by a solver, beyond the v1 push command.
- **Ceiling void contents:** beams (structural elements) and cable/duct runs placed in the Ceiling void.
- **Floor detail:** several Floor finishes within one Room; finish under door thresholds.
- **Vertical connections:** stairs, floor openings (voids in Slabs), Walls that span several Levels, the roof slab over the top Level.
- **Reference house, upper Levels:** capture the first floor, plus exact wall and opening sizes (by tape; Rayon exports are unreliable), once multi-Level work needs a real test case.
- **Roofs & attics:** sloped roofs, knee walls, area rules under low ceilings.
- **Desktop wrapper:** Tauri vs Electron, local file access.
- **Projected views:** the top/side/front/bottom view system (sections, elevations).
- **Furnishings:** the parameter model for Furnishings and a catalogue.
- **Quantities & materials:** paint, plaster and flooring quantities beyond areas.

## Out of scope

- Detailed specs for building systems (electricity, water, gas, heating, ventilation, solar) and for cost calculation. The architecture only has to leave room for them (Fixtures, connections).
