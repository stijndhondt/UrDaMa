# 02: How a moved Wall's junctions are handled today

Type: task
Status: resolved
Blocked by: none

## Question

Map how `moveWall`, the push of `resizeRoom` and `setWallLength`, and the invariants treat the corner and T connections at a moved Wall's ends and along it, on the grid case: Wall 142 between R2-6 and R3-6 moved 1.50 m to the left. Which connections stay with Walls that no longer reach the junction, which outlines then overlap, and why the push reports "skewed". Record the facts and two or three candidate rules (for example: re-host a T-connection to the Wall that now covers the junction; split or join Walls that lie on one line), each with what it would change. AFK.

## Answer

**How `moveWall` treats connections** (`commands/move-wall.ts`, `moveWallBy`): the Wall moves along its normal; a **corner** partner's end moves with it (the partner stretches or shrinks); a Wall **T-connected onto** it keeps its end on it (that end moves); the Wall's **own T ends** keep their host and only update `at`, the distance along the host, even when that distance falls outside the host. Nothing is ever re-hosted.

**The grid case**, Wall 142 (x = 9280, between R2-6 and R3-6, y 18840–21840). Its top end is a T on R2-5's bottom Wall at `at` 0, that Wall's very end; its bottom end is a corner with R2-6's bottom Wall; R3-6's bottom Wall is a T onto it; R2-7's right Wall is a T onto R2-6's bottom Wall at its end (x 9280).

- **To the left 1.50 m** (x → 7780): R2-6's bottom Wall shrinks to 6280–7780 and R3-6's bottom Wall stretches to 7780 (both right). Wall 142's top T slides along R2-5's bottom Wall to `at` 1500 (right). But R2-7's right Wall stays a T on R2-6's bottom Wall at x 9280, which that Wall no longer reaches; its outline then reaches into R3-6's stretched bottom Wall: refused, overlap.
- **To the right 1.50 m** (x → 10780): R2-6's bottom Wall stretches to 10780, and R3-6's bottom Wall, a T on Wall 142, shrinks to 10780–12420 (right, no overlap). But Wall 142's top T slides to `at` −1500, past the end of R2-5's bottom Wall; its outline reaches into R3-5's bottom Wall: refused, overlap.
- So in both directions the only fault is a **T whose host no longer reaches its end**, while another Wall now covers that point.
- **Growing R3-6's width to the left** fails earlier, in the push of `resizeRoom` ("skewed"): pushing R3-6's left side pushes the Walls of the whole column in row 6 only, which would bend the Walls that row 6 shares with rows 5 and 7. That is the push rule's own limit, the one ticket 04 handles with the fallback.

**Candidate rules:**

1. **Re-host a T at a moved junction:** after the move, every T end (the moved Wall's own, and those on Walls whose ends moved) whose host no longer reaches it is attached to the Wall that now covers that point, at the right distance; if no Wall covers it, the move is refused with a reason. Small, local, keeps every Wall as drawn. It changes the glossary's "unconnected Walls never join": a move would create a connection by position.
2. **Join Walls on one line:** Walls of neighbouring Rooms that continue one another in a straight line (R2-6's and R3-6's bottom Walls) become one Wall, split only where something meets it. Removes the fault at its root but changes the model, the file and every command that counts Walls (Wall numbers, Quantities per Wall face).
3. **Refuse more clearly:** keep the model; say which Wall blocks and suggest the user split or join by hand. Doesn't give the settled outcome.
