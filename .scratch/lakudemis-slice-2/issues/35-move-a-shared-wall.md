# 35: Moving a shared Wall carries its T-connections along

**What to build:** On a grid of separately drawn Rooms, moving the Wall shared by two Rooms is refused for anything over about 100 mm ("overlap"). Wall 142 between R2-6 and R3-6 moved 1.50 m to the left should give R2-6 1.50 m wide and R3-6 4.50 m, with nothing else moving. The fault: a move never re-hosts a T, so a T is left on a host Wall that no longer reaches it while another Wall now covers that point.

Decided (map "Shared Walls on a grid of Rooms", ticket "Moving a shared Wall: how its junctions follow"):

- After a Wall moves (`moveWall`, `moveWallBy`), every T end whose host no longer reaches it (the moved Wall's own T ends, and the T ends of Walls whose ends moved with it) is carried by the Wall that now covers that point, at the matching distance along it. It is the same connection with another host (CONTEXT.md, Wall connection); every Wall stays as drawn.
- When two Walls cover the point, the one on the old host's line carries it.
- When no Wall covers it, the move is refused, naming the Walls by their Building panel numbers: "Wall 142's end would leave Wall 122 with no Wall to carry it".
- The drag in the plan uses the same move and gets this as is. One command, one undo step.

**Blocked by:** none

**Status:** ready-for-agent

- [ ] Store test on the 220-Wall grid: Wall 142 moved 1.50 m to the left gives R2-6 1.50 × 3.00 m and R3-6 4.50 × 3.00 m inside, every other Room unchanged; R2-7's right Wall is then carried by R3-6's bottom Wall.
- [ ] Store test: moved 1.50 m to the right, R2-6 4.50 m and R3-6 1.50 m; Wall 142's top end is carried by R3-5's bottom Wall.
- [ ] Store test: a move that leaves a T with no Wall under it is refused with the Walls' numbers, and the model is unchanged.
- [ ] Undo restores the connections exactly (the file round trip is byte-identical).
- [ ] Checked by dragging Wall 142 on the grid in the browser.

## Comments

**2026-10-03:** whether the length editor's "Move Room" and "Only this Wall" modes hit the same fault on the grid is still open (map "Shared Walls on a grid of Rooms", Not yet specified); check it while building this.
