# Slice 1: draw a house, get its surfaces

Status: ready-for-human
Grilled: 2026-09-25 (`/grill-me`, two rounds; all points agreed)
Source: the wayfinder map [Lakudemis foundation & Slice 1](../lakudemis-foundation/map.md). Every decision below links to the ticket or ADR that holds its detail; this spec gathers them and does not restate their reasoning.
Vocabulary: `CONTEXT.md`. ADRs: `Docs/adr/0001`–`0006`.

## Goal

A homeowner draws their house, Level by Level, **at exactly the sizes they measured with a tape**. They see every Room's floor, wall and volume figures update live as they draw, look at the result in 3D, and save it as a project file they own.

It's the first vertical slice of "Every part. One model.": one connected model feeding a 2D editor, a 3D view and calculations.

## Users

- **Primary:** a homeowner / DIY renovator with a tape measure, drawing their own house, starting with the user's own row house.
- **Not yet:** professionals. The model must allow for them later (EPB, Assemblies), but Slice 1 doesn't serve them.

## Scope

### Model

Per [Domain model v1](../lakudemis-foundation/issues/07-domain-model-v1.md).

- **Project** → one **Building** → several **Levels**, **stacked**: only the lowest Level's elevation (its finished floor level) and each Level's storey height are stored; the other elevations are derived, so Levels never overlap or leave gaps.
- **Walls:**
  - Baseline + side (left / centre / right) + thickness (Preset or override) + Wall height (follows the storey height or is overridden) + room-bounding yes/no
  - joined only through stored **Wall connections**, corner or T (ADR 0001)
- **Openings** (doors, windows) hosted by Walls.
- **Rooms:** Seed point + derived outline (ADR 0002), name, Room height, Floor build-up (thickness + Floor finish material).
- **Room separators**, whose ends are Wall connections to Wall faces.
- **Slab** per Level; **Ceiling** per Room; the **Ceiling void** is derived.
- **Presets** at Project level: wall thickness, slab thickness, Floor build-up, Room height, door and window sizes. Elements without an override follow them live.
- **Not in Slice 1:** Furnishings, Fixtures, Assemblies, building systems. The model keeps its hooks for them (thickness source, the "hosted by" relationship, separate collections).

### Editor (2D, Canvas2D)

Per [Box-drawing interaction](../lakudemis-foundation/issues/09-box-drawing-interaction.md) and [Wall joins and room detection](../lakudemis-foundation/issues/08-wall-joins-and-room-detection.md).

- **Room tool (the main tool):**
  - Drag the Room's **inside size**; the Walls grow outward with the Preset thickness. **S** switches to outside size. Typed input: width, Tab, depth, Enter.
  - Starting on an existing Wall's far face reuses that Wall. A partly shared edge creates Walls only for the uncovered parts, T-connected.
  - Places the Room's Seed point at the rectangle's centre.
- **Wall tool (for odd Walls):**
  - Press, drag and release, **or** click, type a length (now locked), rotate with the mouse, Enter.
  - **S** cycles the thickness side. Tab + an angle gives an exact angle.
  - Drawing onto a Wall snaps against its face. Drawing through a Wall splits it into two Walls T-connected to both faces.
  - Closing a loop places a Seed point inside the new enclosed area, unless one is already there.
- **Room separator tool:** drawn like a Wall between two Wall faces; both ends must snap to a face.
- **Door / Window tool:**
  - Click a Wall to place. Sliding along the Wall shows the distance to both inside corners.
  - Typed distance, width and height (Tab between fields).
  - **F** flips the swing side, **Shift+F** the opening direction.
  - Defaults come from Presets: door 930 × 2115 mm; window 1200 × 1200 mm with a 900 mm sill.
  - Openings may not overlap each other or cross a Wall end.
- **L-shaped and odd Rooms:**
  - **Merge Rooms:** select two neighbouring Rooms and merge. It removes the shared Wall or Room separator and keeps the first Room's name and properties.
  - The Wall tool can also draw any shape wall by wall.
- **Resizing a Room:** select it and type a new inside width or depth in the panel, then choose which side moves (default: the side away from the building's origin corner). That Wall moves and push carries everything beyond it. Dragging a Wall also resizes. Rooms themselves are never dragged.
- **A Room drawn inside another Room** (the WC in the Achterhal): if the old Room's Seed point ends up inside the new Room, it moves to the largest remaining piece of the old Room, which keeps its name and properties. This is part of the same `DrawRoom` step.
- **An enclosed area without a Room** (e.g. after deleting a Room) shows hatched as "no Room", with its area. Clicking it creates a Room there.
- **Select / move / delete:**
  - Clicking a Wall's body selects the Wall; clicking inside a Room selects the Room.
  - Drag a Wall to move it (connected Walls follow, Seed points are carried along).
  - Delete cascades as decided: Openings, Wall connections and attached Room separators go; Rooms stay and may be flagged.
- **Drag increments:**
  - no modifier: 10 mm
  - **Shift:** 100 mm / 45°
  - **Ctrl:** 1 mm / 1°
  - Snapping to Walls always wins; typed values are always exact.
- **Push:** changing a thickness (per Wall or through a Preset) pushes everything beyond it so measured Room sizes are kept. It refuses with a reason when that's impossible.
- **Refused commands:** the model stays unchanged, and a short reason appears near the cursor (e.g. "W7 is connected on both sides; can't push") and stays in a message bar until the next action. No dialogs.
- **Keys** (the same in every language):

  | Key | Action |
  |---|---|
  | R / W / E / D / N | Room / Wall / Room separator / Door / Window tool |
  | V or Esc | Select |
  | M | Merge the two selected Rooms |
  | Delete | Delete |
  | S | while drawing: side (Wall tool) or inside / outside size (Room tool) |
  | F / Shift+F | while placing a door: swing side / opening direction |
  | F | with no tool active: fit the plan |
  | Ctrl+Z / Ctrl+Y | Undo / redo |
  | 1–9 | Switch Level |
- **Always visible:**
  - face lengths on every Wall
  - Wall connection markers (corner / T), with **unconnected ends in red**
- **Warnings** (Derived values):
  - "not enclosed"
  - "sharing one area"
  - unconnected ends
  - a Ceiling running into the Slab above
- **Levels:**
  - Level tabs, and "Add Level" above or below (name, elevation, storey height)
  - the Level below shown faded as a tracing aid
- **After every edit:** the affected Rooms are highlighted, with **old → new** values ("Keuken 9.96 → 10.09 m²"), computed by comparing values before and after.
- **Undo / redo:** one user action = one step ("Undo Draw room (Keuken)"), last 200 steps, per session.
- **New project dialog:** name, wall-thickness Preset (default 140 mm) and Room-height Preset (default 2600 mm). The project opens with one Level, "Ground floor", at elevation 0. Everything can be changed later.
- **Units on screen and when typing:**
  - Plan: lengths in m with 2 decimals.
  - Panels: thicknesses and Opening sizes in mm.
  - Areas and volumes: m² / m³ with 2 decimals.
  - Typing: a bare number > 50 means mm, otherwise m; a typed unit (`m`, `cm`, `mm`) always wins.
  - The model stores exact mm floats; only the display rounds.

### 3D view (three.js, read-only)

- **What's drawn:** all Levels stacked: Walls with Openings cut out (manifold-3d in a Web Worker), Slabs, Floor build-up.
- **Camera:** orbit, plus camera presets **top, front, back, left, right, bottom** (orthographic).
- **Controls:** show or hide per Level.
- **Selection:** clicking an element in 3D selects it in 2D and in the panel.
- **Timing:** 3D may briefly lag behind an edit; nothing waits for it.

### Calculations

Per [Define Net and Gross area rules](../lakudemis-foundation/issues/05-define-area-rules.md).

| Element | Values |
|---|---|
| **Room** | Net floor area, volume (Net floor area × Room height), Floor finish area, Ceiling area (= Net floor area in Slice 1), **Net wall area around the Room** (see below), reveal area (shown separately) |
| **Wall** | length of each face; Gross and Net area of each face, using the **Wall height** (the structural view) |
| **Level** | Gross floor area (outer outline of the merged footprint), total Net floor area |

- **Net wall area around a Room** = the Room's wall perimeter × **Room height**, minus the Openings in it (only the part of an Opening below the Ceiling), per the Measurement rule. Room separators have no surface: they bound the floor but add no wall area. Reveals (the sides of Openings inside the wall thickness) are a separate figure, not added.
- **Measurement rules:** "Exact" (subtract every opening; the default) and "Belgian masonry" (ignore openings < 0.25 m²), chosen per report.
- **Quantities table:** every Room and Level, with **CSV export** following the UI language: Dutch → `;` separators and decimal comma; English → `,` and decimal point. UTF-8 with a BOM, so Excel shows "m²" correctly.

### Files and saving

Per [Commands, undo/redo and project file format](../lakudemis-foundation/issues/11-commands-undo-file-format.md), ADR 0004.

- **Working copy:** in IndexedDB, saved automatically after every command and restored on reopen.
- **Saving:** explicit save to `.lakudemis.json` (File System Access API where available, otherwise a download); open = import. The title bar shows unsaved changes.
- **File:** flat, sorted, deterministic, prefixed IDs; `schemaVersion` 1 with the migration harness in place.

### Language

- **English + Dutch** at launch via ngx-translate JSON files (ICU plurals, number formats per language). French later.
- `core` never produces sentences, only keys + parameters.

### Platform

- **Browsers:** Chromium only (Chrome / Edge), desktop with mouse and keyboard. No touch, tablets, Firefox or Safari in Slice 1.
- **Running it:** locally (`pnpm start`) plus a static production build. No public hosting in Slice 1; GitHub Pages is a later option (the source is public there, which satisfies AGPL, ADR 0006).

## User stories

1. As a homeowner, I drag a Room at its tape size so that its Net floor area is exactly what I measured.
2. As a homeowner, I draw the next Room against an existing Wall so that the Wall is shared, not doubled.
3. As a homeowner, I type a Wall's length and turn it into place with the mouse so that odd Walls are exact.
4. As a homeowner, I split an open area with a Room separator so that Living and Eetkamer are separate Rooms.
5. As a homeowner, I merge two Rooms so that an L-shaped hall becomes one Room.
6. As a homeowner, I place doors and windows at a measured distance from the corner so that my wall areas are right.
7. As a homeowner, I change the wall-thickness Preset so that the whole plan grows around my Rooms without shrinking them.
8. As a homeowner, I see what each edit changed (old → new) so that I understand the consequences.
9. As a homeowner, I read each Room's floor area, volume and paintable wall area, and export them to a spreadsheet.
10. As a homeowner, I add a Level above so that I can draw the first floor over a faded ground floor.
11. As a homeowner, I look at my house in 3D from any side so that I can check that it looks right.
12. As a homeowner, I save my project as a file I own and reopen it exactly as it was.
13. As a homeowner, I undo any action step by step so that mistakes are cheap.
14. As a Dutch-speaking homeowner, I use the app in Dutch.
15. As a homeowner, I re-type a Room's measured size so that the plan follows my corrected measurement.
16. As a homeowner, I read each Room's paintable wall and ceiling area so that I can buy the right amount of paint.

## Acceptance criteria

1. **Reference house** (`../lakudemis-foundation/reference-house/reference-house.md`):
   - Drawing the ground floor from the tape measurements gives Net floor areas **exactly equal to tape L × W** for every rectangular Room: Keuken 9.96, Badkamer 5.63, Berging 5.84, Living 11.09, Eetkamer 9.46 m², WC (1.12 m wide).
   - The two L-shaped halls get plausibility checks.
   - This runs as an automated fixture test in `core`, and a manual redraw in the editor gives the same figures.
2. **Files and undo:**
   - Save → reopen → save gives a **byte-identical file**.
   - Undoing every command of the reference-house drawing brings back the empty project exactly.
3. **Speed:**
   - < 16 ms of 2D recalculation per edit, **including Clipper2 room detection**, on the reference house and on a ~200-Wall synthetic plan.
   - A steady 60 fps while dragging.
4. **Levels:** a second, synthetic Level works in 2D and 3D, and editing one Level never recalculates the other.
5. **Invariants:** no command can produce overlapping Walls, a dangling reference, or two corner connections on one Wall end. A refused command leaves the model unchanged and says why.
6. **Recovery:** the working copy survives a page reload.
7. **Architecture:**
   - `core` builds and tests in Node with no DOM.
   - ESLint blocks any Angular import in `core` other than `signal` / `computed` in the wrapper module.
8. **Language:** everything visible is translated in Dutch, and Dutch numbers use a decimal comma, including in the CSV.
9. **Resizing:** re-typing the Keuken's inside width from 2.67 to 2.70 m makes its Net floor area 3.73 × 2.70 = 10.07 m², and every other Room keeps its size (push).

## Milestones

Each milestone is usable on its own; the reference-house test grows with them.

- **M0:** Angular CLI workspace (`projects/core`, `editor2d`, `render3d`, `web`), pnpm, Volta (Node ≥ 24.15), strict TS, ESLint + Prettier, Vitest, pre-commit hooks; **geometry benchmark** (Clipper2 room detection vs < 16 ms).
- **M1:** thin end-to-end thread on one Level: Room tool → Room with Net floor area → save and reopen.
- **M2:** Wall tool, joins, Room separators, Merge Rooms, push, select/move/delete, warnings, undo/redo.
- **M3:** Openings + Measurement rules + properties panels + Quantities table (CSV).
- **M4:** Levels + Slab / Floor build-up / Ceiling / Ceiling void.
- **M5:** 3D view.

## Explicitly deferred

These are the map's **Not yet specified** items, plus:

- Furnishings (including the reference house's Kasten) and Fixtures
- Assemblies and butt joints
- stairs and voids in Slabs
- Walls that span several Levels
- roofs and attics
- several Buildings (the garage)
- locked dimensions with a constraint solver
- copying Walls between Levels
- a consequence inspector ("what depends on this?")
- named versions
- the Electron desktop app
- public hosting (GitHub Pages later)
- Firefox, Safari, touch and tablets
- dragging whole Rooms
- French
- units other than metric
- building systems and cost

## Hand-off

Grilled on 2026-09-25 and split into 15 build tickets in [issues/](issues/), from [01 Workspace skeleton](issues/01-workspace-skeleton.md) to [15 Slice 1 acceptance run](issues/15-slice-1-acceptance.md). All are `ready-for-agent`. Work the frontier: any ticket whose blockers are all done.
