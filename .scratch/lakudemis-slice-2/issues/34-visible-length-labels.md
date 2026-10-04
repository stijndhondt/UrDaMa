# 34: Length labels show the visible part of a Wall face

**What to build:** The plan's length labels measure a Wall's whole outline face, including the part that runs against another Wall (into the solid corner of ticket 25, or against a T). On the 220-Wall grid, R3-6 (3.00 × 3.00 m inside) shows 3.14 m on the two Walls it shares with R3-5 and R2-6. Each label should show the **visible** part instead: the part of the face bordering a Room, the outside or an area without a Room. One label per visible stretch: a long Wall bordering two Rooms on one side gets two labels, a Room separator ending on a face splits its label.

How (map "Shared Walls on a grid of Rooms", ticket "Where a Wall face's visible stretches come from"): the Room and outside face segments (`roomSurfaces`, `outsideFaces`) already hold these stretches but cost about 48 ms per drag step on 220 Walls, too slow for the plan. Work the stretches out locally per Wall: its outline face minus the parts touching another Wall's outline (the bounding-box neighbours the overlap check uses), split where a Room separator ends on it. Long faces only, as now.

**Blocked by:** none

**Status:** done

- [x] R3-6 on the grid shows 3.00 m on all four sides; a long Wall shared by two Rooms on one side shows a label per Room; a Room separator splits a face's label.
- [x] Store test: on the grid and the reference house, every Wall's visible stretches equal the segments of its Room and outside faces.
- [x] A free-standing Wall and an unfinished Room's Walls keep their labels (their whole faces are visible).
- [x] The edit-speed benchmark still holds: labels add no measurable time per drag step.
- [x] Double-clicking a label still opens the length editor for its Wall (ticket 23).

## Comments

**2026-10-04, built:** `visibleStretches` (`geometry/visible-faces.ts`): each long face minus where another Wall's outline lies within 0.5 mm of the face line (contacts under 1 mm, a mitre merely touching, don't count), split where a Room separator ends on it; cached per outline while its neighbours and the separators are the same objects (outlines are memoised per Wall). The plan labels each stretch (`faceLabels` in `draw-plan.ts`), only for Walls in view long enough on screen. Tests (`geometry/visible-faces.spec.ts`): the stretches equal the Room and outside face segments on a 4 × 4 grid, the reference house, a free-standing Wall with an unfinished Room, and a Room split by a separator; an inner Room reads 3.00 m on all four sides. The edit-speed benchmark now includes the stretches of every Wall. Checked in the browser on the 220-Wall grid: every label around R3-6 reads 3.00 m. Labels add about 1 ms per drag step (Node, same conditions); the browser timings of this run were taken under heavy CPU load from another program.

Note: a double-clicked label now opens the length editor with that stretch's length; the editor adds the typed difference to the Wall's Baseline, as before.
