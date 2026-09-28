# Slice 2: a modern workspace, surfaces per element, Elevations and Opening families

Status: ready-for-agent
Grilled: 2026-09-26 (`/grill-with-docs`, five rounds; all points agreed)
Vocabulary: `CONTEXT.md` (Opening, Opening family, Opening type, Wall face, Façade, Elevation, Section plane were added or redefined in this session). ADRs: `Docs/adr/0001`–`0007`; ADR 0007 records the Opening family → Opening type → Opening model.

## Problem Statement

Slice 1 draws a house at its tape sizes, but using it still feels like a prototype, and some everyday edits are missing:

- **A Wall's length can't be typed after drawing.** A measured length can only be set while drawing a Wall, or as a Room's inside size. Correcting one Wall means dragging it and hoping.
- **A deleted Room is hard to get back.** The area shows hatched as "no Room", and the only way to make it a Room again is hidden: switch to the Room tool and click inside it.
- **Doors and windows are a fixed pair.** There is no plain wall opening (a passage between kitchen and living room), no garage door, and no way to make "our front door" once and reuse it. Every door repeats its own sizes.
- **Surfaces are counted per Room only.** A homeowner buying paint, plaster or tiles thinks in floors, ceilings and walls, and in the outside of the house: "how much façade do I render?". The Quantities table gives a Room total without that breakdown, and outside Wall faces belong to nobody.
- **Heights are invisible.** The plan can't show sill heights, Opening heights or how the Levels stack. There is no straight-on view of the house from the front or the sides, only a free 3D orbit.
- **The look and feel is plain.** Hand-made buttons and a fixed three-column page. There are no icons, menus, context menus, dockable panels, or light/dark theme like the desktop tools the user knows (VS Code, Postman, Rayon, Fusion 360).

## Solution

**Quick wins first, then a new workspace, then the new model features.**

- **Typing a Wall's length.** The user selects a Wall and types a new length in the properties panel, or directly on the plan by clicking the length label next to the Wall. They choose a direction:
  - left / right / symmetric for a horizontal Wall
  - up / down / symmetric for a vertical Wall
  - start / end / symmetric for a diagonal Wall
  
  They also choose a mode:
  - **Move Room** (the first time; afterwards the last choice is remembered, ticket 23): the Wall at the moving end shifts along and keeps its angle, so the Room grows or shrinks and every other measured length stays exact.
  - **Move only this Wall**: the connected Wall's end goes along and that Wall tilts.
  
  An impossible change is refused with a reason, as all commands are.
- **Creating a Room in an empty area.** Every enclosed area without a Room shows a **"+ Room" button** inside it, with any tool. A **right-click context menu** on the plan offers "Create Room here", plus the actions for whatever is under the cursor: delete, merge, flip a door, and so on.
- **A modern workspace.**
  - **Design first:** the layout is chosen from 2–3 clickable mockups ("Workbench", VS Code-like; "Canvas-first", Rayon-like; "Collections", Postman-like).
  - **Library choice:** the chosen layout is then built twice against the real app, once with **Taiga UI** and once with **Optimus** (the MIT fork of PrimeNG). The user picks the library.
  - **Target workspace:**
    - **Left:** an icon bar opening a **Building** panel (Levels with show/hide, each with its Rooms, Walls and Openings; it replaces the Level tabs) and a **Library** panel (Opening families and types).
    - **Centre:** view panels in **preset layouts** (Plan; Plan + Elevation; Plan + 3D; Plan + Elevation + 3D; 2×2), with draggable dividers.
    - **Plan panel:** a **floating toolbar** at the bottom with grouped tools and shortcuts. The Opening tool has a flyout of Opening types.
    - **Right:** a properties panel in collapsible sections.
    - **Bottom:** a collapsible panel with Quantities and Warnings tabs, and a status bar.
    - **Top:** a bar with menus, undo/redo, the layout picker and the theme switch.
    - **Theme:** light and dark, following the operating system by default.
- **Quantities per surface.** The Quantities panel is a tree:
  - **Per Level:** Level → Room (with its totals) → its floor, its ceiling, and each of its **Wall faces**.
  - **Exterior section:** the building's **Façades** (front, back, left side, right side, relative to the building's front) with a total each. A Façade that isn't flat splits into its **Façade parts** (the separate flat parts of a T- or L-shaped front), with totals per Level and for the whole height.
  - **Selection:** clicking a row selects that surface in every view.
- **Elevations.** Straight-on drawings of the whole building from the front, back, left side and right side, all Levels stacked. "Front" means looking at the plan's bottom edge. They show Wall faces, Openings, Slab edges and heights. They are for looking and selecting: clicking an element selects it in the plan, the other views and the properties panel.
- **Opening families** (ADR 0007).
  - **The three levels:**
    - An **Opening family** is one parametric object (frame, leaves, glass, panels, garage-door sections) whose kind is door, window, wall opening or garage door.
    - It has **Opening types**: named sizes such as "90 × 211".
    - An **Opening** is a type placed in a Wall. It keeps its own host Wall, position, hinge side, swing and sill height.
  - **How changes flow:**
    - A family is edited in an edit mode that shows the one object in six straight-on views (top, bottom, front, back, left, right) and 3D, all derived from the same parts, so they can't disagree.
    - Changes flow from family to types to Openings.
    - Changing one Opening "only for this one" detaches it into a new Opening type.
  - **Where families live:** in a personal library in the browser. The project file keeps its own copy of every family and type it uses.

## User Stories

### Typing a Wall's length

1. As a homeowner, I want to type a Wall's length in its properties panel, so that I can correct a measurement without dragging.
2. As a homeowner, I want to click the length label next to a Wall on the plan and type the new length there, so that I can correct it where I'm looking.
3. As a homeowner, I want to choose which way a horizontal Wall grows (left, right or symmetric), so that the change lands where the house actually differs from my drawing.
4. As a homeowner, I want to choose which way a vertical Wall grows (up, down or symmetric), so that I can correct depth measurements the same way.
5. As a homeowner, I want to choose start, end or symmetric for a diagonal Wall, so that odd Walls can be corrected too.
6. As a homeowner, I want "Move Room" to be the default, so that lengthening a Room's Wall widens the Room and keeps its corners square.
7. As a homeowner, I want a "Move only this Wall" mode, so that I can fix one Wall's end without moving a whole Room side.
8. As a homeowner, I want every other measured length to stay exact after "Move Room", so that one correction doesn't spoil the rest of my tape measurements.
9. As a homeowner, I want a length change that is impossible to be refused with a reason near the cursor, so that I know why and the model stays unchanged.
10. As a homeowner, I want the Rooms whose area changed to be highlighted with old → new values after a length change, so that I can check the effect.
11. As a homeowner, I want a length change to be one undo step, so that I can take it back at once.
12. As a homeowner, I want typed lengths to follow the usual units rule (a bare number above 50 is mm, otherwise m; a typed unit wins), so that typing a length works the same everywhere.

### Creating Rooms in empty areas

13. As a homeowner, I want a "+ Room" button inside every enclosed area that has no Room, so that I can see at once how to make it a Room again.
14. As a homeowner, I want that button to work with any tool active, so that I don't have to know which tool creates Rooms.
15. As a homeowner, I want the new Room to get the next default name and appear selected, so that I can rename it straight away.
16. As a homeowner, I want to right-click an empty area and choose "Create Room here", so that the same action is in the menu I use for everything else.
17. As a homeowner, I want the right-click menu to offer the actions that fit the element under the cursor (delete, merge two selected Rooms, flip a door, create a Room), so that I don't have to remember shortcuts.
18. As a homeowner, I want the right-click menu to show each action's shortcut, so that I learn the keys as I go.

### The workspace

19. As the product owner, I want 2–3 clickable mockups of different workspace layouts before anything is built, so that I can choose the layout cheaply.
20. As the product owner, I want the chosen layout built once with Taiga UI and once with Optimus against the real app, so that I can choose the UI library on real experience.
21. As the product owner, I want both prototypes to cover the same slice (shell, Wall and Room properties, right-click menu, Quantities tree, light/dark, an Opening type dialog), so that the comparison is fair.
22. As a homeowner, I want a left icon bar that opens a Building panel, so that I can see my Levels and everything on them in one tree.
23. As a homeowner, I want to show or hide each Level in the Building panel, so that I can focus on one Level.
24. As a homeowner, I want to click a Room, Wall or Opening in the Building panel to select it, so that I can find small elements that are hard to click on the plan.
25. As a homeowner, I want the Building panel to replace the Level tabs, so that there is one place to manage Levels (add above/below, rename, delete, choose the Level I draw on).
26. As a homeowner, I want a Library panel with my Opening families and types, so that I can place my standard doors and windows quickly.
27. As a homeowner, I want to choose a panel layout (Plan; Plan + Elevation; Plan + 3D; Plan + Elevation + 3D; 2×2), so that I can see my plan, a side and 3D at once.
28. As a homeowner, I want to drag the dividers between panels, so that I can give the view I'm working in more room.
29. As a homeowner, I want each Elevation panel to have its own front / back / left side / right side picker, so that a 2×2 layout can show two different sides.
30. As a homeowner, I want the drawing tools in a floating toolbar at the bottom of the Plan panel, grouped with icons and shortcuts, so that the tools sit next to where I draw.
31. As a homeowner, I want the Opening tool to show a flyout of Opening types, so that I pick what I place in one move.
32. As a homeowner, I want a properties panel on the right in collapsible sections, so that long property lists stay readable.
33. As a homeowner, I want the properties panel to show the project's Presets, Measurement rule and the current Level when nothing is selected, so that those settings have an obvious home.
34. As a homeowner, I want a collapsible bottom panel with Quantities and Warnings tabs, so that the tables and problems are one click away without covering my plan.
35. As a homeowner, I want a status bar with the current hint, units and zoom, so that I always know what the tool expects.
36. As a homeowner, I want a top bar with menus (File, Edit, View), undo/redo and the layout picker, so that every command can be found without knowing its shortcut.
37. As a homeowner, I want the app to follow my operating system's light or dark theme, and to switch it myself, so that it's comfortable to use at any time of day.
38. As a Dutch-speaking homeowner, I want every new menu, button, tooltip and panel in Dutch, including the UI library's own texts, so that the whole app speaks my language.
39. As a homeowner, I want icons with tooltips on every tool and panel button, so that the interface is compact but still explains itself.

### Quantities per surface

40. As a homeowner, I want the Quantities table grouped per Level and per Room, so that I can find a Room's numbers the way I think about my house.
41. As a homeowner, I want each Room's row to show its totals and expand into its floor, its ceiling and its Wall faces, so that I can buy material per surface.
42. As a homeowner, I want each Wall face row to show its length, height, gross area, Openings subtracted and net area, so that I can check the calculation.
43. As a homeowner, I want reveals shown per Wall face but not added to its area, so that plaster around Openings can be ordered separately.
44. As a homeowner, I want an exterior section listing the building's Façades (front, back, left side, right side), so that I know how much outside wall I render or paint.
45. As a homeowner, I want each Façade to split into its Façade parts when it isn't flat (a T- or L-shaped house), so that I get both the total and the numbers per part.
46. As a homeowner, I want Façade totals per Level and for the whole height, so that I can quote per Level or for the whole house.
47. As a homeowner, I want to click any row to select that surface in the plan, Elevations and 3D, so that I can see which surface the number belongs to.
48. As a homeowner, I want the Measurement rule chooser to apply to Wall faces and Façades alike, so that "Belgian masonry" works for inside and outside.
49. As a homeowner, I want the CSV export to follow the same tree (Level, Room or Façade, surface), so that my spreadsheet matches the screen.

### Elevations

50. As a homeowner, I want a front Elevation of the whole building, so that I can see my façade with all Levels stacked.
51. As a homeowner, I want back, left side and right side Elevations, so that I can see every side.
52. As a homeowner, I want "front" to mean looking at the plan's bottom edge, so that the Elevations match how I drew the house.
53. As a homeowner, I want Openings drawn in the Elevations at their real sill height and height, so that I can check window heights I can't see in the plan.
54. As a homeowner, I want Level heights, Slab edges and the total height shown in an Elevation, so that I can read the building's vertical sizes.
55. As a homeowner, I want to click an Opening or Wall face in an Elevation to select it everywhere, so that I can edit it in the properties panel.
56. As a homeowner, I want an element selected elsewhere to be highlighted in the Elevations, so that I see where it sits in height.
57. As a homeowner, I want the Elevations to update after every edit, so that they never show an old state.
58. As a homeowner, I want hidden Levels hidden in the Elevations too, so that the Building panel's visibility applies to every view.

### Opening families, types and Openings

59. As a homeowner, I want to place a door, a window, a wall opening or a garage door, so that every hole in my Walls can be modelled.
60. As a homeowner, I want a plain wall opening with no frame or leaf, so that a passage between two Rooms is counted correctly.
61. As a homeowner, I want to design an Opening family once from parts (frame, leaves, glass, panels, garage-door sections), so that my standard door exists once.
62. As a homeowner, I want to edit a family in a mode that shows the one object from the top, bottom, front, back, left and right and in 3D, so that I design it like in Fusion 360.
63. As a homeowner, I want every view of a family derived from the same parts, so that the plan symbol and the side view always line up.
64. As a homeowner, I want to drag handles in the family's views to change its parameters, so that designing feels direct.
65. As a homeowner, I want to set a door family's leaf count (single or double) and operation (hinged or sliding), so that the common door kinds are covered.
66. As a homeowner, I want to set a garage door family's style, so that its drawing matches my garage.
67. As a homeowner, I want to add named Opening types to a family ("80 × 211", "90 × 211"), so that one design comes in several sizes.
68. As a homeowner, I want a change to a family to update all its types and every placed Opening, so that "all interior doors get a glass panel" is one edit.
69. As a homeowner, I want a change to a type to update every Opening of that type, so that resizing all my 90 doors is one edit.
70. As a homeowner, I want to change one placed Opening "only for this one", which detaches it into a new type, so that one exception doesn't change the rest.
71. As a homeowner, I want a detached type to get a readable name ("Front door (2)"), so that I can find it in the library.
72. As a homeowner, I want each placed Opening to keep its own position, hinge side, swing and sill height, so that the same window type can sit at different heights in different Rooms.
73. As a homeowner, I want my Opening families to live in a personal library in the browser, so that I can reuse them in every project.
74. As a homeowner, I want the project file to keep its own copy of every family and type it uses, so that the project opens complete on another computer.
75. As a homeowner, I want my Slice 1 projects to open with their doors and windows turned into Openings of built-in default families, so that nothing is lost.
76. As a homeowner, I want the Wall's net area, reveals and the Quantities to keep working for every Opening kind, so that a garage door or a wall opening counts like any other hole.
77. As a homeowner, I want the Opening tool to place the selected type, sliding along the Wall with the distances to both inside corners, so that placing works as it does today.
78. As a homeowner, I want to drag an Opening type from the Library panel onto a Wall, so that placing from the library feels natural.

## Implementation Decisions

- **Order of delivery:** quick wins (typing a Wall's length; "+ Room" button and context menu) → workspace (mockups, the two library prototypes, then the chosen shell) → Quantities per surface → Elevations → Opening families. The later pieces are built in the chosen shell.
- **Typing a Wall's length** is a new core command taking the Wall, the new length, a direction (start, end or symmetric, which the editor shows as left/right/up/down depending on the Wall's orientation) and a mode (move Room or move only this Wall).
  - **Move Room** reuses the existing way connected Walls are moved (as dragging a Wall and resizing a Room already do). Seed points are re-seated, and Rooms are highlighted with old → new values.
  - **Move only this Wall** moves the Wall's end, and the connected Wall's end with it.
  - **Refusals:** when a Wall that must shift is held in place on its other side, the command refuses with a reason. The invariants (no overlapping Walls, at most one corner per Wall end, Openings inside the Wall) are checked as for every command.
- **Creating a Room in an empty area** reuses the existing command behind the Room tool's click. The "+ Room" button and the context menu are editor/UI features; there is no new model behaviour.
- **The context menu** is one menu model built from the element under the cursor and the current selection. It lists the existing commands (create Room, delete, merge, flip a door, reset to Preset) with their shortcuts. Keyboard shortcuts stay as they are.
- **Workspace mockups** are static, clickable pages outside the app, published for review. The **two library prototypes** are throwaway branches against the real app. The chosen library then gets its own ADR (lock-in, and a real trade-off between Taiga UI and Optimus).
- **Both libraries must be checked for:**
  - Angular 22 and zoneless use (Optimus: tooltip and dynamic dialog specifically)
  - Dutch texts for their own components, switched with the app's language
  - light/dark following the OS
  - a resizable splitter (Optimus has one; Taiga needs one built on its low-level resizable primitives)
- **The drawing canvases** (plan, Elevations, 3D) stay the project's own. They take their colours from the theme's variables.
- **Preset layouts:** the centre area is a small set of preset layouts, not free docking. Each Elevation panel has its own side picker, and the dividers are draggable. The chosen layout and divider positions are remembered per viewer (browser storage), not in the project file.
- **The Building panel** replaces the Level tabs. Level visibility becomes a per-viewer view setting that applies to the plan (faded Level below stays), the Elevations and 3D.
- **Quantities per surface** is a new Derived value next to today's Quantity rows. It is a tree:
  - **Levels:** Level → Room (totals) → floor, ceiling and the Room's Wall faces.
  - **Exterior:** the Façades → Façade parts → outside Wall faces, with totals per Level and for the whole height.
  
  **Deriving the parts:**
  - **Wall faces** come from the same per-Room surface calculation that already gives the wall perimeter, Openings and reveals, now kept per face instead of summed.
  - **Outside Wall faces** are the Wall faces that face no Room.
  - **Façades:** each outside face is assigned to front, back, left side or right side by the direction it faces, relative to the building's front (the plan's bottom edge for now).
  - **Façade parts:** outside faces that lie in one plane are grouped into one part.
  
  **Other rules:**
  - The Measurement rule applies to both inside and outside faces.
  - The CSV export follows the tree.
- **Elevations** are a new Derived value in core, per side, like the 3D solids description today. It describes, in the Elevation's own 2D coordinates:
  - the outline of each visible Wall face and each Opening
  - Slab edges and Level heights
  - which element each shape belongs to, so a click can select it
  
  Hidden Levels are left out by the view. The editor renders it on a canvas with the same style as the plan. It is read-only in this slice.
- **Opening families** follow ADR 0007.
  - **The project file** gains Opening families and Opening types as flat, sorted collections (ADR 0004). An Opening refers to its type, and keeps its host Wall, position, hinge side, swing and sill height.
  - **Migration:** the schema version goes up, and a migration turns every Slice 1 door and window into an Opening of a built-in default door or window family and type with the same sizes.
- **Commands for families:** create a family; edit a family's parts and parameters; add, rename or delete a type (refused while Openings use it); place an Opening of a type; change an Opening's type sizes for "all of this type" or "only this one" (which creates a new type and reassigns the Opening); import a family and its types from the personal library into the project.
- **Family geometry** is one parametric description per family. A single derivation turns a family plus a type's sizes into everything that is drawn and counted: the plan symbol, its Elevation drawing, its 3D solids (cut from the Wall as today, plus frame, leaf and glass parts) and its quantities (such as glass area). The family editor's six views and 3D show that same derivation.
- **The personal library** is stored in the browser, separate from the working copy. Importing into a project copies the family and the types used, with new IDs where needed, so the project stays self-contained.

## Testing Decisions

- **What a good test is:** it drives the public seam (commands in, Derived values or file text out) and checks what a homeowner would check: areas, lengths, heights, which elements exist, and that refusals leave the model unchanged. It never inspects internal data structures or rendering details. Fixtures are the reference house and small synthetic houses built through commands, as in Slice 1.
- **The core ProjectStore** (commands in, Derived values out) is the main seam:
  - **Typing a Wall's length:**
    - the Keuken's top Wall 2.67 → 2.70 m, Move Room, to the right: the Keuken grows to 10.07 m² and every other Room keeps its area
    - symmetric changes
    - Move only this Wall
    - refusals when a Wall held on both sides must move
    - one undo step
  - **Creating a Room in an empty area:** covered by the existing command's tests; add one test that deleting a Room and creating it again in the same area gives the same Net floor area.
  - **Quantities per surface:**
    - Living's Wall faces stop at the Room separator
    - a Room's faces add up to its net wall area
    - the outside faces of the reference house are grouped into four Façades
    - an L-shaped house's front Façade splits into two Façade parts whose totals add up to the Façade
    - the Measurement rule applies to Façades
  - **Elevations:** the front Elevation of a two-Level house shows each Level's outside faces at the right heights; an Opening appears at its sill height and height; interior Walls do not appear; each shape refers to its element.
  - **Opening families:**
    - placing an Opening of a type
    - a family change reaches every Opening
    - a type change reaches only that type's Openings
    - "only this one" detaches into a new type
    - deleting a type in use is refused
    - importing from the library keeps references consistent
    - net Wall face areas and reveals are right for each Opening kind
- **The project file** (existing seam): the Slice 1 → Slice 2 migration turns doors and windows into Openings of the default families with the same sizes; the save → open → save round trip stays byte-identical with families and types.
- **The render3d worker meshing** (existing seam), only if Opening parts become separate solids: meshes stay watertight, and a window's glass sits inside its frame.
- **Browser verification** (no test seam), as in Slice 1:
  - the mockups, the two library prototypes and the chosen shell
  - the "+ Room" button and the context menu
  - typing a length on the plan label
  - panel layouts and dividers
  - the Elevation panels and selection sync
  - the family editor's six views
  - light/dark and the Dutch texts
- **Prior art:** `commands/*.spec.ts` and `store/*.spec.ts` for command behaviour, `values/surfaces.spec.ts` for surface quantities, `geometry/solids.spec.ts` for derived view data, `file/project-file.spec.ts` for migrations and round trips, and the render3d worker's meshing spec for meshes. The translation check keeps English and Dutch complete.

## Out of Scope

- The **Section plane**: cutting away the side you look from, in any orientation.
- **Editing in Elevations** (dragging an Opening's sill height, height or position). Elevations are look + select in this slice.
- **Interior wall views** (one Room's walls seen from inside).
- **Sheets / export pages** (Rayon's "pages").
- **Free docking** of panels. Only preset layouts.
- **Free-form modelling** of Opening families (sketch and extrude). Not planned (ADR 0007).
- **Compass orientation** of the building. The front is the plan's bottom edge for now; choosing the front by picking a Wall face comes later.
- **Accounts, sharing and sync.** The app stays local-first.
- **Furnishings and Fixtures** in the library. The library holds Opening families only in this slice.

## Further Notes

- **Research behind the library choice (2026-09-26):**
  - **Taiga UI** 5.25 supports Angular 22; icons are Lucide; built-in light/dark; Dutch texts for its own components; no ready-made resizable split pane.
  - **Optimus** 2.0.2 (`@openng/optimus-ui`) is an MIT fork of PrimeNG v21 and supports Angular 22. It is about three months old with two maintainers, and zoneless use of its tooltip and dynamic dialog is unconfirmed. It has a splitter and a tree table; its icons are PrimeIcons-style.
- **Rayon, for reference:**
  - a Zone tool (click an enclosed area to make a room)
  - typed Wall lengths via clickable dimension labels
  - a bottom floating toolbar
  - parametric blocks whose views are drawn separately (the reason ADR 0007 derives every view from one object)
  - no automatic Elevations or 3D, which makes automatic Elevations a clear advantage for Lakudemis
- **Façade parts:** "lie in one plane" needs a tolerance, like the other geometric comparisons in core (0.5 mm).
- **Terms:** the terms added in this session are in `CONTEXT.md`. Code and translation keys use the English terms; the Dutch interface uses the proper Dutch words (Gevel, Gevelaanzicht, Opening, Wandvlak…).
