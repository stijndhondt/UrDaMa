# Capture the reference house

Type: task
Status: resolved
Blocked by:
Parent: [Lakudemis foundation & Slice 1](../map.md)

## Question

Record the measurements of the user's own house as the test case every later decision is checked against. HITL checklist for the user:

- [ ] For each Level: its name, height above ground (e.g. ground floor = 0) and storey height.
- [ ] Slab thickness per Level (or one value if they are all the same).
- [ ] Per Level: a sketch or photo of the floor plan with the outer dimensions.
- [ ] Every Wall: start and end point (or length and direction), thickness, height. Mark exterior vs interior walls and any free-standing Walls.
- [ ] Every door and window: host Wall, position along the Wall, width, height, sill height.
- [ ] Open areas that should count as separate Rooms (e.g. kitchen/living): where the Room separator goes.
- [ ] Any known areas (e.g. from an EPB report or building plans), so the calculations can be checked.

Put the result in `.scratch/lakudemis-foundation/reference-house/`. Raw notes and photos are fine; the agent turns them into a fixture later.

## Answer

The ground floor is captured in [reference-house.md](../reference-house/reference-house.md). It covers the layout, the tape inside dimensions for every room, clear heights, Rayon areas as expected values, and the Living/Eetkamer Room separator.

- **Scope:** ground floor only (the user's choice). The first floor and stair connection come later; the multi-Level part of Slice 1 uses a synthetic second Level until then.
- **Test cases it brings:**
  - a Room separator
  - two L-shaped halls
  - rooms inside a room (WC and Kasten in the Achterhal)
  - ceiling height per Room
  - a stair enclosure
- **Open data questions** (non-blocking):
  - ~~Badkamer and Berging tape widths (2.95 / 3.01) disagree with Rayon's inner width (2.67).~~ Settled: the Rayon drawing is wrong, and **the tape measurements are the source of truth**.
  - Exact wall thicknesses and opening sizes are not measured.
  - Exact coordinates must come from the tape measurements, not a Rayon export, because the Rayon drawing has known errors.

## Comments

- 2026-09-24: Partial capture received: the ground floor rooms (tape measurements + Rayon screenshots). Consolidated in [reference-house.md](../reference-house/reference-house.md). Still open: the overall layout, upper Levels, wall thicknesses, opening sizes, slab and Level heights, and whether tape or Rayon figures win where they disagree.
- 2026-09-24: Full plan and the Living/Eetkamer divider added; the user confirmed all tape measurements are inside dimensions and chose to focus on the ground floor. Resolved.
