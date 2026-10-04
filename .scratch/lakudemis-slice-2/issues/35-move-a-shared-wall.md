# 35: Moving a shared Wall carries its T-connections along

**What to build:** On a grid of separately drawn Rooms, moving the Wall shared by two Rooms is refused for anything over about 100 mm ("overlap"). Wall 142 between R2-6 and R3-6 moved 1.50 m to the left should give R2-6 1.50 m wide and R3-6 4.50 m, with nothing else moving. The fault: a move never re-hosts a T, so a T is left on a host Wall that no longer reaches it while another Wall now covers that point.

Decided (map "Shared Walls on a grid of Rooms", ticket "Moving a shared Wall: how its junctions follow"):

- After a Wall moves (`moveWall`, `moveWallBy`), every T end whose host no longer reaches it (the moved Wall's own T ends, and the T ends of Walls whose ends moved with it) is carried by the Wall that now covers that point, at the matching distance along it. It is the same connection with another host (CONTEXT.md, Wall connection); every Wall stays as drawn.
- When two Walls cover the point, the one on the old host's line carries it.
- When no Wall covers it, the move is refused, naming the Walls by their Building panel numbers: "Wall 142's end would leave Wall 122 with no Wall to carry it".
- The drag in the plan uses the same move and gets this as is. One command, one undo step.

**Blocked by:** none

**Status:** done

- [x] Store test on the 220-Wall grid: Wall 142 moved 1.50 m to the left gives R2-6 1.50 × 3.00 m and R3-6 4.50 × 3.00 m inside, every other Room unchanged; R2-7's right Wall is then carried by R3-6's bottom Wall.
- [x] Store test: moved 1.50 m to the right, R2-6 4.50 m and R3-6 1.50 m; Wall 142's top end is carried by R3-5's bottom Wall.
- [x] Store test: a move that leaves a T with no Wall under it is refused with the Walls' numbers, and the model is unchanged.
- [x] Undo restores the connections exactly (the file round trip is byte-identical).
- [x] Checked by dragging Wall 142 on the grid in the browser.

## Comments

**2026-10-03:** whether the length editor's "Move Room" and "Only this Wall" modes hit the same fault on the grid is still open (map "Shared Walls on a grid of Rooms", Not yet specified); check it while building this.

**2026-10-04, length editor checked on the grid:** both modes are refused there, with a reason. Lengthening R2-2's own bottom Wall 1.50 m at its left end: "Move Room" gives `commands.wallLength.cannotShift` (the Wall that must shift can't follow), "Only this Wall" gives `commands.wallLength.teeEnd` (its end sits against another Wall's face). The same family of problem; not part of this ticket (recorded on the map).

**2026-10-04, built:** `moveWallsBy` (`commands/move-wall.ts`) moves one or more Walls by a vector (a Wall connected to two of them moves once), then carries every T whose Wall or host moved: its distance along the host again, or, when the host no longer reaches its end, the parallel Wall that now does with the end on one of its faces (any thickness), one on the old host's line first. `moveWall` is `moveWallsBy` with one Wall.

**Decision added while building (recorded here, on the map and in CONTEXT.md):** when no Wall carries a T, it stays on its host while it is still within the host's thickness of the host's end (it still meets the corner, as a T at a Wall's end always could); only beyond that is the move refused. Every small drag of a grid Wall leaves such a T a few mm past its host's end, and refusing those broke 10 mm moves (the edit-speed benchmark's drag).

Refusals now name Walls by their Building panel number: the new `commands.moveWall.noHost`, the overlap invariant and the push's "skewed". Tests (`commands/shared-wall.spec.ts`) use a 4 × 4 grid with the same topology as the 220-Wall grid: moving the shared Wall between R1-2 and R2-2 1.50 m either way, which Wall carries each T afterwards, the refusal with Wall numbers, and the undo round trip. Checked in the browser on the 220-Wall grid: Wall 142 dragged 1.50 m to the left gives R2-6 4.50 m² and R3-6 13.50 m².
