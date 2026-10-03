# 04: A Room's width falls back to moving the shared Wall

Type: grilling
Status: resolved
Blocked by: 03

## Question

Settled: when a Room's width (or depth) can't push the other Rooms aside, it moves the shared Wall instead. Decide when the fallback applies (which refusals of the push count; which Wall is "the shared Wall" when a side borders several Rooms or the outside), what the user sees (the change summary with both Rooms; any note that the neighbour got smaller), and how it reads in the properties panel. HITL.

## Answer

Facts: `resizeRoom` moves the Walls bounding the chosen side and pushes what is in front of them (`commands/push.ts`); the push's only refusal is "skewed" (a Wall crossing the face line would stretch at an angle), and on the grid it refuses because pushing row 6 would bend the Walls it shares with rows 5 and 7. That message names the Wall by its ID ("wal_0532"). The panel's width and depth rows choose only which side moves.

Decided with the user (2026-10-03):

1. **When:** whenever the push is refused (the skewed case, and any refusal the push's result gets, such as an overlap), the width or depth change instead moves the shared Wall. Width and depth alike.
2. **Which Walls:** every Wall that bounds the chosen side moves by the difference, together as one move, each with the re-hosting rule of "Moving a shared Wall: how its junctions follow"; refused if those Walls don't lie on one line.
3. **When both fail:** one message gives both reasons, Walls named by their Building panel numbers: "Can't keep the other Rooms' sizes (Wall 163 would have to stretch at an angle), and can't move the shared Wall either (Wall 142's end would leave Wall 122 with no Wall to carry it)." The push's "skewed" message names the Wall number too.
4. **What the user sees:** the step is named "Resize room (R3-6) by moving its shared Wall"; the change summary lists every Room whose area changed, old → new (R2-6 and R3-6). One undo step.
5. **Panel:** no new control; the fallback is automatic. Shrinking a neighbour on purpose where a push would work is done by dragging the Wall.
