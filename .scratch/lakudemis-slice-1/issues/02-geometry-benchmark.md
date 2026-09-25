# 02: Geometry benchmark

**What to build:** The go / no-go check for the geometry approach: room detection as holes in the merged footprint of room-bounding Walls (clipper2-ts union, Room separators cutting holes, Seed points picking pieces), measured against the target of < 16 ms of 2D recalculation per edit. It runs as a repeatable benchmark in `core`, on the reference house ground floor and on a synthetic ~200-Wall plan. See the Wall joins and room detection decision on the foundation map, and ADR 0003.

**Blocked by:** 01 Workspace skeleton

**Status:** ready-for-agent

- [ ] A benchmark in `core` measures one edit + full re-detection of Rooms on the reference house and on a ~200-Wall plan, and reports median, 95th percentile and worst.
- [ ] 95th percentile < 16 ms on both plans; if not, the ticket reports the numbers and the bottleneck instead of passing.
- [ ] Detected hole areas for the reference house's rectangular Rooms match tape L × W within 0.01 m².
- [ ] The benchmark runs in Node without a DOM.
