# Stack, licence and repository layout

Type: grilling
Status: resolved
Blocked by: 02, 03, 04
Parent: [Lakudemis foundation & Slice 1](../map.md)

## Question

Lock the stack from the research results:

- frontend framework and 2D drawing approach
- 3D library
- geometry library, including whether a WASM-compiled C++ library is acceptable
- test runner and build tool
- package/monorepo layout (core vs UI packages)

Before locking the 2D approach, decide whether to run the small Canvas2D benchmark suggested in [Choose a frontend framework for a canvas-heavy editor](04-choose-frontend-framework.md).

Also benchmark the dependency engine target from [Dependency and recalculation engine](10-dependency-engine.md): < 16 ms of 2D recalculation per edit on ~200 Walls. Decide whether the engine is our own code or built on a small signals library.

Choose between GPL-3.0 and AGPL-3.0. Record the decisions as ADRs.

## Answer

Settled with the user between 2026-09-24 and 2026-09-25, after three prototypes. ADRs:
- [0005 Technology stack and workspace](../../../Docs/adr/0005-technology-stack-and-workspace.md)
- [0006 Licence: AGPL-3.0-or-later](../../../Docs/adr/0006-agpl-licence.md)
- [0003 amended](../../../Docs/adr/0003-lazy-self-tracking-derived-values.md): the dependency engine is Angular signals

1. **Workspace:** an Angular CLI monorepo, everything under `projects/` (`core`, `editor2d`, `render3d` as Angular libraries, `web` as the Angular 22 app), with **pnpm**. `core` has no DOM and no Angular UI; only `signal` / `computed`, in one wrapper, enforced by ESLint.
2. **Licence:** AGPL-3.0-or-later.
3. **2D plan editor: plain Canvas2D.** Prototype `prototype/canvas-speed`: a stable 60 fps vs ~45 for PixiJS, with 3–4× lower drawing time. PixiJS is the fallback.
4. **3D:** three.js draws; manifold-3d (WASM, accepted) builds the solids and cuts the openings, in a Web Worker behind `SolidKernel`.
5. **Geometry:** clipper2-ts + robust-predicates; Wall joins and room detection are our own code; JSTS is a test reference only.
6. **Dependency engine: Angular signals** inside `core` behind `source()` / `derived()`. Prototype `prototype/dependency-engine`; ADR 0003 amended.
7. **Translation: ngx-translate 18** + `ngx-translate-messageformat-compiler` (ICU plurals, number formats), with JSON files. Prototype `prototype/i18n`: equivalent to Transloco 8 and simpler, and the user knows it. Features use a top-level key prefix (`editor.*`, `panel.*`), because all files merge at the root.
8. **Tooling:**
   - TypeScript strict, ESLint + Prettier
   - Vitest via `ng test`
   - local pre-commit hooks (format, type check, tests)
   - Volta-pinned **Node ≥ 24.15** (required by the Angular 22 CLI; the user's current default, 24.11.1, is too old) + pnpm
9. **Benchmarks:**
   - The Canvas2D and engine benchmarks are done.
   - The real geometry (Clipper2 room detection) must be benchmarked against < 16 ms per edit in the build's first milestone.

## Comments

- 2026-09-24: **Partial decisions** (the ticket stays open until the three prototypes below are done, per the user):
  - **Settled:**
    - **manifold-3d accepted:** it builds the Wall solids and cuts the openings; three.js draws the meshes. Lazy, in a Web Worker, behind a `SolidKernel` interface; no calculation depends on it.
    - **Licence: AGPL-3.0-or-later.**
    - **Workspace:** an Angular CLI monorepo with everything under `projects/` (like the user's VAF repo): `core`, `editor2d`, `render3d` as Angular libraries (ng-packagr), `web` as the Angular 22 app. **pnpm** is the package manager.
    - **`core` rule:** no DOM and no Angular UI APIs (enforced by ESLint). Whether `core` may use `@angular/core` signals is decided by prototype 2.
    - **Tooling:** TypeScript strict, ESLint + Prettier, Volta-pinned Node 24 + pnpm, local pre-commit hooks (format, type check, tests), Vitest via `ng test`.
  - **Still to prototype, each one deciding its own point:**
    1. **Canvas2D speed:** can plain Canvas2D draw and hit-test a ~200-Wall plan at 60 fps while dragging? Fallback: PixiJS.
    2. **Dependency engine: our own vs Angular signals inside `core`.**
       - **Measure:** < 16 ms 2D recalculation per edit on ~200 Walls; laziness; readable names (`debugName`); fit with patch-driven invalidation.
       - **If Angular signals win:** ADR 0003 must be amended; it currently lists "Angular signals as the engine" as rejected. The user's argument: an Electron desktop app keeps Angular, and signals run without a DOM.
    3. **Translation: Transloco vs ngx-translate**, in a small trial with JSON files. The user knows ngx-translate, not Transloco.
- 2026-09-24: **Prototype 2 done: dependency engine → Angular signals.**
  - **Prototype:** branch `prototype/dependency-engine`. `dependency-engine.prototype.html`, plus `run-in-node.prototype.mjs` to run it in Node.
  - **Findings:**
    - Both engines are lazy, never touch the other Level, and give identical results.
    - Both run in plain Node; Angular 22.2.0 needs no DOM.
    - Worst case per edit on 224 Walls: ours 8.6 ms, Angular 2.8 ms (median 0.2 / 0.3 ms).
    - Angular cuts off unchanged values (104 vs 152 recalculations for one Wall move) and garbage-collects deleted nodes.
    - Graph walking can't explain an edit at per-Level granularity, so consequences come from comparing values before and after.
  - **Verdict (user):** Angular signals inside `core`, behind a thin `source()` / `derived()` wrapper. `core` may import only `signal` / `computed`, and only in that wrapper.
  - **ADR 0003 amended.**
  - **Still open:** prototype 1 (Canvas2D speed) and prototype 3 (Transloco vs ngx-translate).
- 2026-09-24: **Prototype 1 done: 2D plan drawing → plain Canvas2D.**
  - **Prototype:** branch `prototype/canvas-speed`, `canvas-speed.prototype.html`. It has variants A (Canvas2D) and B (PixiJS v8), the same plan and the same rbush hit-testing, plus stress controls.
  - **User's test** (everything enabled: labels, auto-drag, auto zoom + pan): **Canvas2D holds a stable 60 fps against ~45 fps for PixiJS, with 3–4× lower drawing time per frame.**
  - **My measurements** (hidden pane, 1400×900, 1.5× pixel density):
    - Canvas2D stays under 16 ms at the 95th percentile, even at 5,000 Walls, because it draws only what's on screen.
    - PixiJS with one text object per label scales badly (74 ms average at 5,000 Walls).
    - Hit-testing via rbush takes microseconds.
  - **Verdict (user): plain Canvas2D** for the plan editor, behind the renderer interface. PixiJS stays only as a named fallback.
  - **Lessons for `editor2d`:**
    - Draw only what's on screen (culling).
    - Batch Wall paths into one path.
    - Keep the frame loop resilient: schedule the next frame before drawing, and never let one failed frame stop it.
    - Reset all editor state (hover, selection, pending redraws) whenever the plan or renderer is swapped.
  - **Still open:** prototype 3 (Transloco vs ngx-translate).
- 2026-09-25: **Prototype 3 done: translation → ngx-translate.**
  - **Prototype:** branch `prototype/i18n`, an Angular 22 app. Run `pnpm install && pnpm start`.
  - **Findings:**
    - Both libraries handled the same EN/NL/FR JSON files, runtime language switching, ICU plurals, number formats, key + params messages from core, and missing keys.
    - Transloco pitfall: a scope applies to its whole component, including `translateSignal`.
  - **Verdict (user): ngx-translate.** Ticket resolved.
