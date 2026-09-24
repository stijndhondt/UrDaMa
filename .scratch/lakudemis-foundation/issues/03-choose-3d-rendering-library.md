# Choose a 3D rendering library

Type: research
Status: resolved
Blocked by:
Parent: [Lakudemis foundation & Slice 1](../map.md)

## Question

Which browser 3D rendering library suits an architectural 3D view generated from the model: three.js, Babylon.js, or another? It starts read-only and may become editable later.

Compare them on:

- fit with Angular
- orthographic views (top/side/front/bottom)
- picking and selection
- line and edge rendering in an architectural style
- performance for a house-sized model
- licence compatibility with GPL-3.0/AGPL-3.0
- maintenance activity

Research: branch `research/3d-rendering`, file `Docs/research/3d-rendering.md`.

## Answer

- **three.js (MIT)**, behind a thin Angular wrapper we write ourselves (not a third-party wrapper). Keep an adapter boundary between "model → render geometry" and the library, so a later switch touches one module.
- **Why:** the largest ecosystem, and That Open Company's open-source BIM tools are built on three.js. The core library or its official add-ons cover orthographic cameras, picking, crease edges, thick lines, clipping planes and SVG export.
- **Cost:** breaking changes in every monthly release, and the TypeScript types are community-maintained. Pin the version and plan small, regular upgrades.
- **Runner-up: Babylon.js (Apache-2.0).** It keeps stable APIs between minor versions and has more editor features built in (edge rendering, GPU picking, gizmos). Worth another look when the 3D view becomes editable.
- **Rejected:** xeokit is AGPL-only and built for viewing pre-converted models. That Open's components sit on top of three.js rather than replacing it. PlayCanvas brings no advantage for architecture.
- **Performance** does not decide it: any of these handles a house-sized model easily.
- **Open:** the note suggests an optional one-day side-by-side prototype of three.js and Babylon.js in Angular.

Findings: branch `research/3d-rendering` (commit 93db9b0), `Docs/research/3d-rendering.md`.
