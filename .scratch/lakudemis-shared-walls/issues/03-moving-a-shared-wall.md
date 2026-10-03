# 03: Moving a shared Wall: how its junctions follow

Type: grilling
Status: resolved
Blocked by: 02

## Question

Given the facts and candidate rules of "How a moved Wall's junctions are handled today", which rule makes moving the shared Wall between R2-6 and R3-6 give the settled outcome (R2-6 1.50 m, R3-6 4.50 m, nothing else moves), keeps every other Wall where it is, and stays one undo step? Decide the rule, the cases it must refuse (and with which reason), and what the drag in the plan and the length editor's modes inherit from it. HITL.

## Answer

Decided with the user (2026-10-03):

1. **Rule: re-host a T at a moved junction.** After a Wall moves, every T end (the moved Wall's own T ends, and the T ends of Walls whose ends moved with it) whose host no longer reaches it is carried by the Wall that now covers that point, at the matching distance along it. Every Wall stays as drawn; nothing else moves. Wall 142 then works both ways: moving left, R2-7's right Wall is carried by R3-6's longer bottom Wall; moving right, Wall 142's top end is carried by R3-5's bottom Wall. Still one command, one undo step.
2. **Glossary (CONTEXT.md, Wall connection):** "never join" stays absolute. Re-hosting is not a new joint: a T stays where it is in the plan and, when its host no longer reaches it, is carried by the Wall that now does (the same connection, another host).
3. **Refusal:** when no Wall covers the new point, the move is refused, naming the Walls by their Building panel numbers ("Wall 142's end would leave Wall 122 with no Wall to carry it").
4. **Who gets it:** the move a drag makes (`moveWall`); the drag in the plan inherits it. The length editor's "Move Room" and "Only this Wall" modes stay in the fog until checked on the grid.
5. **Two candidates:** when the new point falls where two Walls meet, the Wall on the same line as the old host carries it (R2-5's bottom Wall → R3-5's bottom Wall).

Rejected: joining Walls that lie on one line (changes the model, the file, Wall numbers and the per-face Quantities); only refusing more clearly (doesn't give the settled outcome).
