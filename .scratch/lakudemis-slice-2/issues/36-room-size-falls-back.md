# 36: A Room's width or depth falls back to moving the shared Wall

**What to build:** Typing a Room's width or depth pushes the other Rooms aside so they keep their size. On a grid of Rooms that push can't work: growing R3-6 to the left would bend the Walls row 6 shares with rows 5 and 7, and it is refused ("push: skewed Wall", naming the Wall by its ID).

Decided (map "Shared Walls on a grid of Rooms", ticket "A Room's width falls back to moving the shared Wall"):

- Whenever the push is refused (the skewed case, or any refusal of its result such as an overlap), the width or depth change instead moves every Wall bounding the chosen side by the difference, together as one move, each with the re-hosting rule of ticket 35. Refused if those Walls don't lie on one line.
- When both fail, one message gives both reasons, Walls named by their Building panel numbers: "Can't keep the other Rooms' sizes (Wall 163 would have to stretch at an angle), and can't move the shared Wall either (Wall 142's end would leave Wall 122 with no Wall to carry it)." The push's "skewed" message names the Wall's number instead of its ID.
- The step is named "Resize room (R3-6) by moving its shared Wall"; the change summary lists every Room whose area changed, old → new. One undo step. No new control in the properties panel.

**Blocked by:** 35 Moving a shared Wall carries its T-connections along

**Status:** done

- [x] Store test on the 220-Wall grid: R3-6's width 4.50 m to the left gives R3-6 4.50 m and R2-6 1.50 m, every other Room unchanged, named "…by moving its shared Wall", one undo step.
- [x] Where the push works (the reference house), nothing changes: the Keuken 2.67 → 2.70 m still keeps every other Room's size.
- [x] A change refused both ways gives the one combined message with Wall numbers; the "skewed" message names the Wall's number.
- [x] All new text exists in English and Dutch.

## Comments

**2026-10-04, built:** `resizeRoom` checks the push's result against the invariants itself; when the push or its result is refused it moves every Wall bounding the chosen side as one move (`moveWallsBy`, with ticket 35's carrying), named `commands.resizeRoom.sharedWall`. When both fail, `commands.resizeRoom.neither` gives both reasons in one ICU message (skewed, overlap, no host by Wall number; any other refusal as "the plan would no longer hold together"). Tests in `commands/shared-wall.spec.ts` (4 × 4 grid: width to the left, depth, the combined refusal) and `commands/push.spec.ts` (the Keuken still pushes). Checked in the browser on the 220-Wall grid through the properties panel: R3-6 4.50 m to the left, summary "Resize room (R3-6) by moving its shared wall: R2-6 9.00 → 4.50 m², R3-6 9.00 → 13.50 m²"; 7.00 m gives the combined message with Wall numbers.
