# Choose a frontend framework for a canvas-heavy editor

Type: research
Status: resolved
Blocked by:
Parent: [Lakudemis foundation & Slice 1](../map.md)

## Question

The app is a canvas/WebGL-heavy 2D plan editor plus a 3D view with property panels. Angular is the default because the user knows it. Is it a good fit, or does Svelte, Solid, Lit or no framework clearly win? React is excluded.

Also: which 2D drawing approach fits the plan editor? Candidates are Canvas2D, SVG, WebGL, or a library such as Konva, PixiJS or Paper.js. Judge them on:

- hit-testing
- snapping
- zoom and pan
- crisp lines
- dimension labels

Include licence compatibility with GPL-3.0/AGPL-3.0.

Research: branch `research/frontend-framework`, file `Docs/research/frontend-framework.md`.

## Answer

- **Framework:** Angular 22 (standalone, zoneless, signals). No alternative clearly wins; zoneless removes the old Angular problem where every pointer move re-ran change detection. Svelte, Solid and Lit are only faster at updating panels, which is not the hot path.
- **2D editor:** plain Canvas2D, driven by a framework-free TypeScript editor module. Snapping and hit-testing run on the model geometry through a spatial index (`rbush`/`flatbush`), with the renderer behind an interface. Typed length/angle input is an HTML overlay.
- **Fallbacks:** Konva (`ng2-konva`) if a quick first demo matters more; PixiJS v8 if plans become very large. Paper.js is a maintenance risk; SVG is kept for overlays and export.
- **Licences:** all candidates are MIT, BSD or ISC, so GPL/AGPL-compatible.
- **Side finding:** `angular-three` does not declare support for Angular 22 yet, so rendering libraries should be called directly from TypeScript rather than through Angular wrappers.
- **Unverified:** no benchmarks were run. A small test to confirm Canvas2D is fast enough is worth doing before the stack is locked.

Findings: branch `research/frontend-framework` (commit ae3509a), `Docs/research/frontend-framework.md`.
