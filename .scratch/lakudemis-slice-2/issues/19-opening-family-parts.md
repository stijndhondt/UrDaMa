# 19: Opening family parts

**What to build:** Each Opening family is one parametric description made of parts (frame, leaves, glass, panels, garage-door sections). From a family plus a type's sizes, one derivation gives the plan symbol, the Elevation drawing, the 3D solids (cut from the Wall as today, plus frame, leaf and glass) and quantities such as glass area.

**Blocked by:** 16 Opening model: families, types, migration, 14 Elevations, look and select

**Status:** done

- [x] For the default families, the plan symbol, the Elevation drawing and the 3D solids come from the same derivation and agree on every size (store tests).
- [x] A window's glass area is available as a quantity (store test).
- [x] 3D meshes stay watertight, and a window's glass sits inside its frame (render3d worker test).
- [x] The plan, Elevations and 3D show the parts.

## Comments

**2026-10-03, built:** `openingShape(design, placement, wallDepth)` (core/model/opening-parts.ts) turns a family's design (frame profile, bottom rail, infill: leaves, glazing, garage-door sections or none) plus a type's sizes and the Opening's hinge, swing and sill into parts: boxes in the Opening's own (u along the Wall, v across it, z up) coordinates. From the same parts come the plan symbol (the parts the plan cuts at 1 m, each door leaf standing open with its swing arc, dashed what is above: a wall opening's head, a garage door's track), the Elevation drawing (the parts seen face on, clipped to the Opening), the 3D solids (one `openingPart` prism per part, mapped through the host Wall by `openingToPlan`) and the glass area (shown in the properties panel). Defaults: a door has a 60 × 100 mm frame and one 40 mm leaf; a window a 60 × 70 mm frame with a sill rail and one pane, or two beside a middle post from 1 m wide; a garage door four panels; a wall opening no parts. In 3D the parts are coloured (white frame, wooden leaf, see-through glass, grey sections) and a click on one selects its Opening. Store tests: the window's panes and frame and the door's leaf agree in size between plan, Elevation and 3D; the glass area; the render3d worker meshes every part watertight with the glass inside its frame. Checked in the browser.

**2026-10-03, after review:** each Opening family can carry its own `design` (optional, kept in the project file; without it the family uses its kind's default), and `resolveOpening` hands it on, so every view and quantity follows the family; the family editor (ticket 20) will set it. An Opening's parts and glass area are a cached Derived value (`values.opening(id)`). Fixes: a window wholly above the plan cut (sill over 0.94 m) is cut through its middle instead of losing its glass in the plan; leaf, glass and panel thicknesses never exceed the frame's depth (thin Walls); 3D parts stop at the Wall's top like the Elevation; the Elevation keeps a Wall's Openings even without their parts. A garage door's sections are called panels (the glossary's word). Plan and Elevation fill each part kind alike. More tests: the garage door and wall opening in every view, a double door, a high window, a thin Wall, a tiny Opening, a tall Opening, and a family's own design through a save and open.
