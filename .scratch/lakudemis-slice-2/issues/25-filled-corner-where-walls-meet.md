# 25: Walls that meet only at a corner point get a solid corner

**What to build:** When a new Room's Wall ends exactly where an existing Wall ends (they touch at one corner point, with an empty square between them), the new Wall reaches on so the corner is solid, like any other corner. Today the square stays empty: the plan shows a notch, 3D has a hole, the outside face lengths are wrong, and the Room counts as "not enclosed" because its area leaks to the outside through that one point.

Found while drawing (2026-10-03): Room 1 drawn 5.00 × 4.00 m inside, then a Room started on Room 1's outer bottom-left corner and drawn to the right. The new left Wall's top end is tee'd to the end of Room 1's bottom Wall; the two touch only at that corner.

**Blocked by:** none

**Status:** done

- [x] The reproduction (Room 1 at 0,0–5000,4000; a Room from its outer corner −140,4140 to 5010,6430) gives an enclosed Room, and the merged footprint has no notch at that corner (store test).
- [x] The filled corner holds for the other three orientations (store test).
- [x] Existing drawing tests still pass (Rooms side by side, shared Walls, T connections).

## Comments

**2026-10-03, built:** a geometry rule in the Wall outlines: a T-connected Wall that lies wholly past its host's end (beside the host's corner) reaches on to the host's far face instead of stopping at its near face, so the corner square between them is solid. The host's own outline ends (as its partners shape them) decide "past"; a Wall that still overlaps the host's corner keeps butting the near face, as reaching through would run into the host's corner partner. The outline cache now also keys on the host's partners. Store tests: the reproduction and its mirrored, rotated and upside-down versions are enclosed with a solid corner; an ordinary shared Wall is unchanged. Checked in the browser on the user's own plan: its "not enclosed" Room 3 is now enclosed.

**2026-10-03, after review:** the "past the end" check reads the host's own end caps one level deep (its direct partners), and the outline cache key covers exactly that, with each connection's kind and end. A deeper chain (tried first) made every Wall within three T connections of a dragged Wall recalculate and broke the edit-speed budget (31–49 ms against 25 ms); one level keeps the budget and gives the same result for ordinary corners.
