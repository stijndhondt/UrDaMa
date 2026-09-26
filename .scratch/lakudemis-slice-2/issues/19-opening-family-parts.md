# 19: Opening family parts

**What to build:** Each Opening family is one parametric description made of parts (frame, leaves, glass, panels, garage-door sections). From a family plus a type's sizes, one derivation gives the plan symbol, the Elevation drawing, the 3D solids (cut from the Wall as today, plus frame, leaf and glass) and quantities such as glass area.

**Blocked by:** 16 Opening model: families, types, migration, 14 Elevations, look and select

**Status:** ready-for-agent

- [ ] For the default families, the plan symbol, the Elevation drawing and the 3D solids come from the same derivation and agree on every size (store tests).
- [ ] A window's glass area is available as a quantity (store test).
- [ ] 3D meshes stay watertight, and a window's glass sits inside its frame (render3d worker test).
- [ ] The plan, Elevations and 3D show the parts.
