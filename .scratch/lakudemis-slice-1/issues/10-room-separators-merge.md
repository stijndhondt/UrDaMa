# 10: Room separators and Merge Rooms

**What to build:** Open-plan and L-shaped spaces. The Room separator tool (E) draws a line between two Wall faces; both ends must snap to a face (stored as Wall connections), and the separator follows the Walls when they move. Merge Rooms (M, with two neighbouring Rooms selected) removes the shared Wall or Room separator and keeps the first Room's name and properties. The warnings "not enclosed" and "sharing one area" appear as Derived values when a Room's area is open or two Seed points share one area.

**Blocked by:** 08 Select, move, delete

**Status:** done

- [x] Living / Eetkamer: a separator splits the open space into two Rooms with the tape areas 11.09 and 9.46 m².
- [x] Merging two Rooms is one undo step and leaves one Room with the combined area.
- [x] Deleting a Wall between two Rooms flags "sharing one area"; opening a gap flags "not enclosed" and shows no area.
- [x] All new UI text exists in English and Dutch.
- [x] `core` has no DOM or Angular UI imports (only `signal` / `computed` in the wrapper), enforced by lint.
