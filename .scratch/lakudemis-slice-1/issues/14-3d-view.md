# 14: 3D view

**What to build:** See the house. A read-only three.js view shows all Levels stacked: Walls extruded from their joined outlines with Openings cut out (manifold-3d in a Web Worker, behind a `SolidKernel` interface), Slabs and Floor build-up. Orbit camera plus six orthographic presets (top, front, back, left, right, bottom); show / hide per Level; clicking an element selects it in 2D and in the panel. The 3D view may briefly lag behind an edit; nothing waits for it and no calculation depends on it (ADR 0003).

**Blocked by:** 11 Doors and windows, 13 Levels, Slab, build-up and Ceiling

**Status:** done

- [x] All six presets and orbit work; per-Level visibility works.
- [x] Openings appear as clean holes; solids are watertight (manifold).
- [x] Selecting in 3D selects the same element in 2D and the panel, and vice versa.
- [x] Editing in 2D updates 3D without blocking the editor.
- [x] All new UI text exists in English and Dutch.
- [x] `core` has no DOM or Angular UI imports (only `signal` / `computed` in the wrapper), enforced by lint.
