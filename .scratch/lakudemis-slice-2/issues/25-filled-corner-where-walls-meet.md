# 25: Walls that meet only at a corner point get a solid corner

**What to build:** When a new Room's Wall ends exactly where an existing Wall ends (they touch at one corner point, with an empty square between them), the new Wall reaches on so the corner is solid, like any other corner. Today the square stays empty: the plan shows a notch, 3D has a hole, the outside face lengths are wrong, and the Room counts as "not enclosed" because its area leaks to the outside through that one point.

Found while drawing (2026-10-03): Room 1 drawn 5.00 × 4.00 m inside, then a Room started on Room 1's outer bottom-left corner and drawn to the right. The new left Wall's top end is tee'd to the end of Room 1's bottom Wall; the two touch only at that corner.

**Blocked by:** none

**Status:** ready-for-agent

- [ ] The reproduction (Room 1 at 0,0–5000,4000; a Room from its outer corner −140,4140 to 5010,6430) gives an enclosed Room, and the merged footprint has no notch at that corner (store test).
- [ ] The filled corner holds for the other three orientations (store test).
- [ ] Existing drawing tests still pass (Rooms side by side, shared Walls, T connections).
