# Slice 1 spec

Type: grilling
Status: resolved
Blocked by: 01, 07, 08, 09, 10, 11, 12
Parent: [Lakudemis foundation & Slice 1](../map.md)

## Question

Write the Slice 1 spec from the decisions on this map. It covers:

- scope and user stories
- acceptance criteria, checked against the reference house
- what is explicitly deferred

Carry in the open points from [Box-drawing interaction](09-box-drawing-interaction.md): L-shaped Rooms, partly shared Walls, and the Room tool placing the Seed point.

This is the destination. Once the spec exists, hand off to `/grill-me` and then the build.

## Answer

Settled with the user on 2026-09-25. The spec: [Slice 1: draw a house, get its surfaces](../../lakudemis-slice-1/spec.md). The term **Opening** was added to `CONTEXT.md`.

Decisions made in this session (all else is gathered from the map):

1. **L-shaped Rooms:** a **Merge Rooms** command (removes the shared Wall or Room separator and keeps one Room), plus drawing any shape with the Wall tool.
2. **Door / Window tool:**
   - Click a Wall to place; while sliding, see the distances to both inside corners; typed distance, width and height.
   - F / Shift+F flip the swing.
   - Preset defaults: door 930 × 2115 mm; window 1200 × 1200 mm with a 900 mm sill.
   - No overlapping Openings.
3. **Levels:** Level tabs, "Add Level" above or below, the Level below shown faded. No copying of Walls between Levels.
4. **3D view:** read-only, all Levels stacked, orbit plus top / front / back / left / right / bottom presets, show or hide per Level, selection synced with 2D.
5. **Calculations:**
   - Room: Net floor area, volume, Floor finish area, Net wall area around the Room.
   - Wall: face lengths, Gross and Net area per face.
   - Level: Gross and total Net floor area.
   - A Quantities table with CSV export.
6. **Measurement rules:** "Exact" (default) and "Belgian masonry" (< 0.25 m² ignored).
7. **Furnishings deferred**, including the Kasten.
8. **Languages:** English + Dutch at launch; French later.
9. **Acceptance:**
   - Reference-house rectangular Rooms equal tape L × W exactly.
   - A byte-identical save round trip, and full undo back to the empty project.
   - < 16 ms per edit including Clipper2, and 60 fps while dragging.
   - Level isolation, invariants, and recovery from the working copy.
   - `core` runs without a DOM; the Dutch UI is complete.
10. **Milestones:** M0 workspace + geometry benchmark → M1 thin end-to-end thread → M2 editing → M3 Openings + quantities → M4 Levels + Slab / Ceiling → M5 3D.

**Destination reached.** Hand off to `/grill-me` on the spec, then build tickets.

