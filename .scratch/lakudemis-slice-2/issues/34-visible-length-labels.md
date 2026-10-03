# 34: Length labels show the visible part of a Wall face

**What to build:** The plan's length labels measure a Wall's whole outline face, including the part that runs against another Wall (into the solid corner of ticket 25, or against a T). On the 220-Wall grid, R3-6 (3.00 × 3.00 m inside) shows 3.14 m on the two Walls it shares with R3-5 and R2-6. Each label should show the **visible** part instead: the part of the face bordering a Room, the outside or an area without a Room. One label per visible stretch: a long Wall bordering two Rooms on one side gets two labels, a Room separator ending on a face splits its label.

How (map "Shared Walls on a grid of Rooms", ticket "Where a Wall face's visible stretches come from"): the Room and outside face segments (`roomSurfaces`, `outsideFaces`) already hold these stretches but cost about 48 ms per drag step on 220 Walls, too slow for the plan. Work the stretches out locally per Wall: its outline face minus the parts touching another Wall's outline (the bounding-box neighbours the overlap check uses), split where a Room separator ends on it. Long faces only, as now.

**Blocked by:** none

**Status:** ready-for-agent

- [ ] R3-6 on the grid shows 3.00 m on all four sides; a long Wall shared by two Rooms on one side shows a label per Room; a Room separator splits a face's label.
- [ ] Store test: on the grid and the reference house, every Wall's visible stretches equal the segments of its Room and outside faces.
- [ ] A free-standing Wall and an unfinished Room's Walls keep their labels (their whole faces are visible).
- [ ] The edit-speed benchmark still holds: labels add no measurable time per drag step.
- [ ] Double-clicking a label still opens the length editor for its Wall (ticket 23).
