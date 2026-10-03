# 33: Confirm edit speed on a quiet machine

**What to build:** The Slice 2 acceptance run could not confirm "< 16 ms of 2D recalculation per edit on a ~200-Wall plan": while measuring, another program kept the CPU busy (about 4 cores), and `store/edit.benchmark.spec.ts` measured median 18–31 ms, p95 26–44 ms on 220 Walls. The same benchmark passed (p95 under 25 ms) in every commit hook earlier that day, and Slice 2 added work per edit (Wall runs, the T reach-through rule, Opening parts). Re-measure on an idle machine, in the browser as in Slice 1 ticket 15 (edit + recalculation, and with painting); if it no longer fits 16 ms, profile and fix.

**Blocked by:** none

**Status:** done

- [x] On an idle machine, one edit on the 220-Wall plan: edit + recalculation p95 < 16 ms, measured in the browser and recorded here.
- [x] If not, the slow part is found and fixed, and the benchmark guards it.

## Comments

**2026-10-03:** from the Slice 2 acceptance run (ticket 22).

**2026-10-03, measured and fixed:** in the browser (dev build, separate server on port 4300), the 220-Wall grid, a Wall between two rows dragged with real pointer events, one move per task. Timings per move: *edit + recalculation* (the preview, its invariants, the Level's footprint, warnings and every Room's area), *with paint* (plus drawing the plan), and *between moves* (what the app does before the next move: panels, effects).

- **Edit + recalculation: pass.** Median 6.2 ms, p95 9.9 ms with every panel open (Slice 1: 3.4 / 7.5 ms; same machine, Slice 2's work per edit roughly doubles it). In Node (`store/edit.benchmark.spec.ts`): median about 8 ms, p95 14–18 ms; before ticket 25 (f585e2f), side by side: median 6.7 vs 8.4 ms.
- **Found while measuring: the panels rebuilt on every move of a drag**, which a synchronous benchmark never sees:
  - Building panel: about 850 ms between moves on 220 Walls (its tree rebuilt from the preview, and every row drawn again). Now built from the committed model, rows tracked by element: 5 ms.
  - Quantities panel: 190 ms between moves. Elevations: spikes of 240 ms. Now held still during a drag (`project/settled.ts`), following when it is committed or cancelled.
  - 3D view: rendered again on every move (11 ms), because the hidden-Levels set was a new object each time. Now from the committed model, and equal sets count as unchanged.
  - A drag back to its start, or onto a refused position, cancelled the preview, so the held panels rebuilt on the way: it now holds the preview with nothing changed (`store.holdPreview()`).
- **After, every panel open** (Building, Quantities, two Elevations, 3D; 2×2 layout): between moves median 4.8 ms, p95 7 ms; the whole step (edit + recalculation + paint + panels) median 15.7 ms, p95 21 ms. The plan alone: whole step median 15.6, p95 23 ms. The Quantities and Elevations now update when a drag is released, not during it.

Tests: `editor/building-panel.component.spec.ts` (not rebuilt by a preview; unchanged rows keep their element), `project/settled.spec.ts`, `editor/level-visibility.service.spec.ts`, `store/project-store.spec.ts` (holdPreview).
