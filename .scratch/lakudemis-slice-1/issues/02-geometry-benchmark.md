# 02: Geometry benchmark

**What to build:** The go / no-go check for the geometry approach: room detection as holes in the merged footprint of room-bounding Walls (clipper2-ts union, Room separators cutting holes, Seed points picking pieces), measured against the target of < 16 ms of 2D recalculation per edit. It runs as a repeatable benchmark in `core`, on the reference house ground floor and on a synthetic ~200-Wall plan. See the Wall joins and room detection decision on the foundation map, and ADR 0003.

**Blocked by:** 01 Workspace skeleton

**Status:** done

- [x] A benchmark in `core` measures one edit + full re-detection of Rooms on the reference house and on a ~200-Wall plan, and reports median, 95th percentile and worst.
- [x] 95th percentile < 16 ms on both plans; if not, the ticket reports the numbers and the bottleneck instead of passing.
- [x] Detected hole areas for the reference house's rectangular Rooms match tape L × W within 0.01 m².
- [x] The benchmark runs in Node without a DOM.

## Result (2026-09-25)

Benchmark in `core` (`geometry.benchmark.spec.ts`), one edit + joined outlines + full Clipper2 room detection, 200 runs, Node 24.21:

| Plan | Walls | Rooms | median | 95th pct | worst |
|---|---|---|---|---|---|
| Reference house (tape sizes) | 28 | 7 | 0.28 ms | 1.07 ms | 1.70 ms |
| ~200-Wall grid | 220 | 100 | 1.09 ms | 2.39 ms | 3.14 ms |

Go: well under the 16 ms target. Reference-house Rooms come out at exactly their tape areas (Keuken 9.96, Badkamer 5.63, Berging 5.84, Living 11.09, Eetkamer 9.46 m²).
