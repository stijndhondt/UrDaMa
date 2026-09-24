# The project file is flat, sorted collections with ID references

A `.lakudemis.json` file stores Source data only, as one flat list per element kind (`buildings`, `levels`, `walls`, `wallConnections`, `openings`, `rooms`, `roomSeparators`, `slabs`, `ceilings`, `furnishings`). The lists refer to each other by ID, and each list is sorted by ID. There is no Building → Level → Wall tree, even though `Docs/idea.md` sketches the model that way. We chose flat collections because the model is a set of related elements, not a hierarchy. For example, a Wall connection belongs to two Walls, and Fixtures will later be hosted by Walls, Ceilings or Rooms. Flat, sorted lists also give clean git diffs and simple migrations.

## Considered Options

- **Nested tree** (Building → Levels → Walls → Openings). It reads naturally, but every cross-link (connections, hosting, Room separators) needs a second referencing scheme anyway. Moving an element to another Level rewrites whole subtrees in a diff, and migrations must walk the tree.

## Consequences

- The file is deterministic: keys in a fixed order, lengths rounded to 0.001 mm, 2-space indentation, and a trailing newline. Saving the same model twice gives byte-identical files.
- An element that follows a Preset has no value for that property; no `null` is written.
- IDs carry a readable kind prefix (`wal_`, `rom_`, `lvl_`) plus a random, time-sortable part.
- `schemaVersion` is a whole number. Pure, fixture-tested migration functions upgrade older files on open. A file from a newer app version is refused.
- The browser working copy (IndexedDB) and the saved file hold exactly the same format.
