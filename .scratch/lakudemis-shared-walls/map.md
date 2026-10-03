# Map: shared Walls on a grid of Rooms

Label: wayfinder:map

## Destination

Ready-to-build tickets (in `.scratch/lakudemis-slice-2/issues/`) for three fixes: Wall length labels that show the visible part of a face; moving a shared Wall between two Rooms on a grid of separately drawn Rooms; and a Room's width that falls back to moving the shared Wall when pushing can't work. Built later with `/implement`.

## Notes

- Domain: Lakudemis (CONTEXT.md glossary: Wall, Wall face, Room, Façade, Wall run). Skills: grilling and domain-modeling for HITL tickets; tracker conventions in `docs/agents/issue-tracker.md`.
- Found on the 220-Wall grid (10 × 10 Rooms of 3.00 × 3.00 m inside, 140 mm Walls, each Room drawn on its own). Reproduce it with the grid in `store/edit.benchmark.spec.ts`.
- **Settled while charting (2026-10-03, with the user):**
  - The destination is tickets, not the fixes themselves.
  - A Wall face's length label shows its **visible** part, the part bordering a Room or the outside, not the whole outline face. One label per visible stretch: a long Wall bordering two Rooms on one side gets two labels.
  - Moving the shared Wall between R2-6 and R3-6 1.50 m to the left: R2-6 becomes 1.50 m wide, R3-6 4.50 m; R3-6's top and bottom Walls get 1.50 m longer, R2-6's shorter; nothing else in the grid moves (the Rooms above and below keep their Walls, which now meet R3-6's longer Walls).
  - A Room's width that can't push (a grid row would shift out of line) falls back to moving the shared Wall: the neighbour gets smaller, both Rooms' area changes are shown, one undo step.
- **Facts found while charting:**
  - Wall 142 (the Wall between R2-6 and R3-6) is refused for any move over about 100 mm: "overlap" (R3-6's stretched bottom Wall against R2-7's right Wall; the other way, Wall 142's own end against R3-5's bottom Wall). The T-connections at the old junction stay with Walls that no longer reach it.
  - Growing R3-6's width to the left is refused with "push: skewed Wall".
  - R3-6 shows 3.14 m on the two Walls it shares with R3-5 and R2-6: the plan labels measure the whole outline face, which since ticket 25 reaches 140 mm into the solid corner. The Room surfaces (Quantities) say 3.00 m on all four sides.

## Decisions so far

- [Where a Wall face's visible stretches come from](issues/01-visible-face-stretches.md): the Room and outside face segments cover every face, but cost 48 ms per drag step on 220 Walls; recommended: the plan works stretches out locally (outline face minus other Walls' outlines, split at separators), tested equal to the Room/outside segments.
- [How a moved Wall's junctions are handled today](issues/02-junctions-of-a-moved-wall.md): a move never re-hosts a T; Wall 142 fails because a T is left on a host that no longer reaches it while another Wall covers the point; three candidate rules (re-host, join Walls on one line, refuse more clearly).
- [Moving a shared Wall: how its junctions follow](issues/03-moving-a-shared-wall.md): a T left without its host is carried by the Wall that now covers its point (the one on the old host's line first), else the move is refused naming both Walls; drag inherits it; glossary updated.
- [A Room's width falls back to moving the shared Wall](issues/04-room-width-fallback.md): when the push is refused, every Wall on the chosen side moves as one (re-hosting), named "…by moving its shared Wall"; if both fail, one message with both reasons and Wall numbers; no new panel control.

## Destination reached

Build tickets written (2026-10-03) in `.scratch/lakudemis-slice-2/issues/`: 34 Length labels show the visible part of a Wall face, 35 Moving a shared Wall carries its T-connections along, 36 A Room's width or depth falls back to moving the shared Wall (blocked by 35).

## Not yet specified

- Whether the length editor's "Move Room" mode (tickets 01, 23) and dragging a Wall in the plan hit the same junction problem on a grid, and whether one fix covers them all.

## Out of scope
