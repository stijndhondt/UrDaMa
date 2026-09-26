# 16: Opening model: families, types, migration

**What to build:** The expand step for ADR 0007: the project file gains Opening families and Opening types as flat, sorted collections; built-in default door and window families with default types come with every project; every placed Opening refers to a type and keeps its own host Wall, position, hinge side, swing and sill height. Slice 1 files are migrated on open. Everything looks and works exactly as before.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] A Slice 1 file opens with its doors and windows turned into Openings of the default families and types, with the same sizes (file migration test).
- [ ] Save → open → save stays byte-identical with families and types (file test).
- [ ] Placing, editing, flipping and deleting doors and windows works as before; Wall face areas, reveals, Quantities and 3D are unchanged (existing tests stay green).
- [ ] A file from a newer schema version is still refused.
