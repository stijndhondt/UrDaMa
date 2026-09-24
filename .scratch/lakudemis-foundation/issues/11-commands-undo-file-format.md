# Commands, undo/redo and project file format

Type: grilling
Status: open
Blocked by: 07
Parent: [Lakudemis foundation & Slice 1](../map.md)

## Question

- What does the command and transaction model look like (AddWall, MoveWall, …, grouped operations)?
- How does undo/redo work on top of it?
- What is the JSON project file format? It needs a schema version, stable IDs, deterministic ordering and migrations, and stores no derived data.
- How does the automatic browser save relate to the project file?
