# 16: Speed on a 200-Wall plan

**Found by:** 15 Slice 1 acceptance run

**What to build:** Dragging a Wall on a 220-Wall plan (a 10 × 10 grid of Rooms) took a median 17 ms per pointer move in the browser (p95 43 ms) before painting, over the 16 ms budget. Each preview ran two full Room detections to re-seat Seed points (before and after), a Clipper2 union of every Wall outline for the overlap invariant, and recomputed every Wall outline. Make edits local without changing any result.

**Blocked by:** none

**Status:** done

- [x] Seed points are re-detected only when a command could have displaced one: same Walls, connections, separators and Rooms, only Wall / separator ends moved, and no Seed point near the swept Walls. Otherwise the full re-detection runs as before.
- [x] The overlap invariant checks only the changed Walls (and both Walls of every changed connection) against their bounding-box neighbours, with a separating-axis pre-test before Clipper2; without a previous model (or after a thickness Preset change) it checks everything as before.
- [x] Wall outlines are memoised per Wall object on their exact inputs (partner Walls, joint kind, Preset).
- [x] Tests: `store/edit.benchmark.spec.ts` (220 Walls, p95 < 16 ms, exactly the two neighbouring Rooms change) and `store/fast-paths.spec.ts` (a Wall dragged across a Seed point re-seats it; a Wall dragged into another is refused).
- [x] Browser, 220 Walls: edit + recalculation median 3.4 ms, p95 7.5 ms; edit + recalculation + paint, paced per task, median 5.5 ms, p95 13.2 ms, max 15.7 ms.
