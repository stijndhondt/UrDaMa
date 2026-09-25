# Domain model v1

Type: grilling
Status: resolved
Blocked by: 05
Parent: [Lakudemis foundation & Slice 1](../map.md)

## Question

What are the entities, stable IDs and explicit relationships of domain model v1 for Slice 1? The entities are Project, Building, Level, Wall, Opening (door/window), Room, Room separator, Slab, Floor finish and Preset. Sub-questions:

- Which data is source data, and which is derived (Room outlines, areas)?
- When a Preset changes, do Walls that don't override it follow the new value?
- How does a manual Room adjustment coexist with automatic detection?
- [Define Net and Gross area rules](05-define-area-rules.md) calls opening-subtraction thresholds "measurement presets". That clashes with the glossary's **Preset** (a project default value such as wall thickness). What is this concept called, and where does it live?
- Rooms will need a clear height later, for attics. Does anything in v1 have to allow for it? The [reference house](../reference-house/reference-house.md) already has clear heights from 2.49 to 2.73 m on one Level. Is height a property of the Level, the Wall, the Room, or derived from the Slabs above and below?
  - **Input from the user (2026-09-24):** both Walls and Rooms have a height. **Room height** is measured floor to ceiling. **Wall height** is usually greater, because the Wall runs past the ceiling finish. Walls that don't reach the ceiling (a divider, a bar wall) have their own lower Wall height. Still to decide: how the two relate and what is source vs derived (e.g. is Wall height defaulted from the Level and Slab, and Room height from the Slab and ceiling?).
- The reference house has the WC and a cupboard zone inside the Achterhal. Are they separate Rooms bounded by their own Walls, or sub-areas of one Room?
- How is the model shaped so that Assemblies, Fixtures and building systems can be added later without painful migrations?

## Answer

Settled with the user on 2026-09-24. Terms are in `CONTEXT.md`; ADRs: [0001 stored Wall connections](../../../Docs/adr/0001-stored-wall-connections.md), [0002 Room outlines derived from Seed points](../../../Docs/adr/0002-room-outlines-derived-from-seed-points.md).

### Entities

`→` means "refers to by ID".

| Entity | Source data (stored) | Derived (never stored) |
|---|---|---|
| **Project** | Presets, units, language → one Building (v1) | – |
| **Building** | → Levels | – |
| **Level** | name, elevation (= finished floor level), storey height. **Amended 2026-09-25 (Slice 1 grilling):** Levels are stacked; only the lowest Level's elevation is stored, and the others are derived from the storey heights below. | elevation of every Level above the lowest |
| **Wall** | → Level; Baseline (start, end); side (left / centre / right); thickness override or none; Wall height override or none (default = storey height); room-bounding yes/no | box outline, joins, gross/net face areas |
| **Wall connection** | Wall end → other Wall's end (corner) or face at a distance (T) | – |
| **Opening** | → host Wall; door/window; offset along the Baseline; width, height, sill height; door hinge side + swing direction | reveals, opening area |
| **Room** | → Level; Seed point; name; Room height (default from a Preset); Floor build-up thickness override + Floor finish material; optional drawn outline (escape hatch) | outline, Net floor area, volume |
| **Room separator** | → Level; line whose two ends are Wall connections to Wall faces | – |
| **Slab** | → Level (its own floor); thickness override or none | outline (outer faces of exterior Walls); top = elevation − the Level's Floor build-up Preset |
| **Ceiling** | → Room; thickness override or none | outline = Room outline; underside at Room height |
| **Ceiling void** | – | height = underside of the Slab above − top of the Ceiling; unknown when there is no Level above |
| **Furnishing** | → Level; parametric box (position, rotation, dimensions) | – (never changes areas) |

### Rules

1. **Presets:** an element with no override follows the Preset live; the panel shows "preset" vs "custom".
2. **Push:** a thickness change (including a Preset change) is an editing command. It pushes everything beyond the Wall by the difference, so measured Room sizes are kept, and the side nearest the building's origin corner stays put by default. If it can't push cleanly (e.g. a Wall connected on both sides), it stops and reports instead of shrinking a Room.
3. **Seed points:** the editor places a Seed point when a loop closes. Deleting a Room deletes its seed, so the Room stays deleted.
4. **Room outlines:** they follow Walls and Room separators live. Openings never change Room boundaries.
5. **Room height:** source data, measured from that Room's own finished floor. A Room with a thicker or thinner Floor build-up has a slightly higher or lower finished floor.
6. **Ceiling vs Slab:** if a Ceiling would run into the Slab above, that is a warning, not an error.
7. **Measurement rules:** chosen per report. The model stores only exact Opening geometry.
8. **Units and IDs:** lengths in millimetres (float64) with a 0.01 mm tolerance; angles in degrees in the UI, radians internally. IDs are random, time-sortable and typed per entity kind.
9. **Hooks for later:**
   - thickness source: Preset / override / Assembly later
   - the "hosted by" relationship: Openings now, Fixtures later
   - separate collections for systems and Furnishings

### Reference house consequences

- The Kasten are a Furnishing (wall cabinets), so their area counts in the Achterhal.
- The WC is its own Room.
- The Room separator shape may change after [Box-drawing interaction](09-box-drawing-interaction.md) (user note).
