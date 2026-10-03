# 01: Where a Wall face's visible stretches come from

Type: task
Status: resolved
Blocked by: none

## Question

Find in the code what already knows which parts of a Wall face border a Room or the outside: the Room surfaces (`values/surfaces.ts`, a Room's Wall faces with their segments), the outside faces (`geometry/outside.ts`), the Wall runs (`geometry/wall-runs.ts`). Can a face's visible stretches be read from them for every face on a Level, including faces between two Rooms, outside faces, faces beside an area without a Room, and the end of a Wall? Record the recipe (which values, how to combine them, what is missing) and the cost on the 220-Wall grid, so the label ticket can be written. AFK.

## Answer

**What already knows the visible stretches.** Two Level values split every Wall face into the parts that border something, each part with its plan `segments` (joined stretches along the face):

- `roomSurfaces()` (`values/surfaces.ts`, `levelRoomSurfaces`): per enclosed Room, a `RoomWallFace` per Wall face it borders. A face shared by two Rooms, or broken by a Room separator, has a part per Room; collinear Walls each take their own stretch; the parts of a face touched by another Wall's end (a T, the solid corner) are not in it.
- `outsideFaces()`: the same, for the outside of the merged footprint and for enclosed areas without a Room (the hatched "no Room" area).

Together they cover every long face. On the 220-Wall grid, all 440 long faces have a visible stretch; a free-standing Wall (or an unfinished Room's Walls) is covered by the outside faces, both faces full length. `wallRuns` is built from the outside faces and adds nothing for labels. Wall ends (`face: 'end'`) appear too; labels keep to the long faces, as now.

**Recipe:** a label per segment of every `RoomWallFace` (long faces only), its length the segment's length. That gives R3-6 four labels of 3.00 m, one label per Room along a long shared Wall, and splits at a Room separator, as settled.

**Cost: too slow for the plan as is.** On the 220-Wall grid, reading `roomSurfaces()` + `outsideFaces()` after a drag step takes median 48 ms, p95 54 ms (footprint and warnings, which the plan reads now: median 2.9 ms). The plan redraws its labels on every frame of a drag, so it can't read them per move (the Quantities only avoid this cost by holding still during a drag, ticket 33).

**Recommendation for the build ticket:** work the plan's visible stretches out locally, per Wall: its outline face minus the parts that touch another Wall's outline (found through the bounding-box neighbours the overlap check already uses), split where a Room separator ends on it. Only the moved Walls and their neighbours change during a drag, so it stays within the frame budget. A test checks on the grid and the reference house that these stretches equal the Room and outside face segments, so the plan and the Quantities never disagree. The alternative, labels from `roomSurfaces` held still during a drag like the Quantities, would freeze the lengths of the Wall being dragged, which is the one place they are wanted live.
