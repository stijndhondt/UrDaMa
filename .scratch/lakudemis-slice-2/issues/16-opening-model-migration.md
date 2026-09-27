# 16: Opening model: families, types, migration

**What to build:** The expand step for ADR 0007: the project file gains Opening families and Opening types as flat, sorted collections; built-in default door and window families with default types come with every project; every placed Opening refers to a type and keeps its own host Wall, position, hinge side, swing and sill height. Slice 1 files are migrated on open. Everything looks and works exactly as before.

**Blocked by:** None (can start immediately)

**Status:** done

- [x] A Slice 1 file opens with its doors and windows turned into Openings of the default families and types, with the same sizes (file migration test).
- [x] Save → open → save stays byte-identical with families and types (file test).
- [ ] Placing, editing, flipping and deleting doors and windows works as before; Wall face areas, reveals, Quantities and 3D are unchanged (existing tests stay green).
- [x] A file from a newer schema version is still refused.

## Comments

**2026-09-27, built:** `OpeningFamily` (kind, optional name) and `OpeningType` (family, optional name, width, height) are new flat collections (schema version 2); an Opening keeps its Wall, offset, sill, hinge and swing and refers to a type. Built-in families have fixed IDs (`ofm_door`, `ofm_window`); every new project gets them with a default type each, sized from the Presets. Unnamed families and types are shown by kind and sizes in the UI's language. `resolveOpening` gives an Opening with its type's kind and sizes, cached per object so derived values stay cached. Placing an Opening or changing one Opening's width or height uses the family's type with that size, or makes one, so only that Opening changes, as before (ticket 18 adds the "all of this type" choice). Migration 1 → 2 turns each size in use, plus each family's Preset size, into a type (IDs from kind and size); tested with a real Slice 1 fixture file. Placing, editing, flipping and deleting still to be checked in the browser with ticket 09.
