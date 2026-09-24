# Room outlines are derived from Seed points, not stored as polygons

A Room stores a **Seed point** (a point inside it) and its own data: name, Room height, Floor build-up. Its outline is always derived from the room-bounding Walls and Room separators around that point, so Rooms follow the Walls live and can never drift out of sync with them. We chose this over stored polygons because the core principle is one connected model: a Room's size is a consequence of its Walls, and a stored outline would be a second, conflicting copy.

## Considered Options

- **Stored polygons drawn by the user.** Easy to implement, but every Wall edit leaves Rooms stale, which is a common complaint about ArchiCAD and Sweet Home 3D.
- **Fully automatic detection with no seeds.** Every enclosed area becomes a Room, which creates junk Rooms, and a deleted Room reappears on the next recalculation.

## Consequences

- The editor places a Seed point when the user closes a loop. That is an editing action, so deleting a Room deletes its seed and it stays deleted.
- Manual adjustment goes through Room separators. A drawn outline exists only as an explicit escape hatch for odd cases, and a Room using one no longer follows its Walls.
- Openings never change Room boundaries in v1.
