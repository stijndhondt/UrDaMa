# Wall connections are stored, not inferred from geometry

Whether two Walls are joined is recorded as an explicit **Wall connection**: one Wall's end attached to another Wall's end (a corner) or to its face at a stored distance (a T). It is never inferred from coordinates that happen to lie within a tolerance of each other. We chose this because unreliable adjacency is the main pain point in existing tools: in Rayon, walls that look joined leave gaps or overlap, and the drawing of the reference house came out wrong. Stored connections also give the editor a graph to use, so moving or thickening a Wall can move ("push") what is attached to it and keep measured Room sizes intact.

## Considered Options

- **Free endpoints, adjacency inferred within a tolerance** (Sweet Home 3D, Floorplanner). Simpler to store, but near-misses and hairline gaps are exactly the failures users report, and nothing tells the editor what should move together.
- **Shared node entities that walls reference.** Handles corners well, but a T-junction then forces the host Wall to be split in two.

## Consequences

- Snapping in the editor must create a Wall connection, not just align coordinates.
- Room separators attach to Walls with the same mechanism.
- Two Walls drawn touching but not connected do not join. The editor should make that state visible.
