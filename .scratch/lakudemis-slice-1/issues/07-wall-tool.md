# 07: Wall tool

**What to build:** The tool for odd Walls (W). Press-drag-release, or click the start point, type a length (now locked) and rotate with the mouse, optionally Tab + angle, Enter. S cycles the thickness side (right / left / centre). Angles snap to 15°; drag increments are 10 mm, Shift = 100 mm / 45°, Ctrl = 1 mm / 1°. Snapping to a Wall end or face creates a corner or T Wall connection (at most one corner per end; a taken corner gives a T). Corners are mitred, T-joins butt against the host face. Drawing onto a Wall snaps against its face; drawing through a Wall splits it into two Walls T-connected to both faces. Unconnected ends show red. Closing a loop places a Seed point in the new area unless one is there. See Box-drawing interaction and Wall joins on the foundation map, and ADR 0001.

**Blocked by:** 04 Rooms side by side

**Status:** ready-for-agent

- [ ] Click, type 3.73, rotate: the Wall stays exactly 3.73 m; Tab + 90 + Enter places it at 90°.
- [ ] Snapping creates stored Wall connections; the plan shows corner, T and red unconnected ends distinctly.
- [ ] Mitred corners and T-joins render correctly for different thicknesses; face lengths are shown on every Wall.
- [ ] No command can create overlapping Walls: overlaps snap against the face, crossings split into T-connected Walls.
- [ ] Closing a loop with the Wall tool creates a Room.
- [ ] All new UI text exists in English and Dutch.
- [ ] `core` has no DOM or Angular UI imports (only `signal` / `computed` in the wrapper), enforced by lint.
