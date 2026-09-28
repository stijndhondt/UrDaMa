# 12: Quantities per surface

**What to build:** The Quantities panel becomes a tree: Level → Room (with its totals) → its floor, its ceiling and each of its Wall faces (length, height, gross area, Openings subtracted, net area, reveals). Clicking a row selects its surface in the plan and 3D. The CSV export follows the tree.

**Blocked by:** 09 Workspace shell

**Status:** done

- [x] Living's Wall faces stop at the Room separator to the Eetkamer (store test).
- [x] A Room's Wall faces add up to its net wall area, under both Measurement rules (store test).
- [x] Rows expand and collapse; clicking a row selects its surface in the plan and 3D.
- [x] The CSV (English and Dutch formats) follows the tree.
- [x] All new UI text exists in English and Dutch.

## Comments

**2026-09-28, built:** `RoomSurfaces.faces` (core): each edge of a Room's outline that lies on a Wall face goes to that face, clipped to the face's extent (collinear Walls each take their own stretch); separators have no face. Per face: length, Room height, gross area, the Openings cut from it and its share of their reveals; `faceNetArea` applies the Measurement rule. The Room totals are summed the same way as before (the existing surface tests pass unchanged). `quantityTree` (core, tested) gives Level → Room → floor, ceiling, Wall faces, with the Wall numbers of the Building panel. The bottom panel shows it as an Optimus tree table (length, height, gross, Openings, net, reveals, volume); a click selects the Room (Room, floor, ceiling rows) or the Wall (face rows); the CSV writes one line per row with Level, Room and surface named, in the English or Dutch format. Checked in the browser: a Room expanded into floor, ceiling and four Wall faces with a window subtracted; a face row selecting its Wall; the CSV text.
