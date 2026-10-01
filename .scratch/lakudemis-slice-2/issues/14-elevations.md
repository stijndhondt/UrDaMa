# 14: Elevations, look and select

**What to build:** Elevation panels show straight-on drawings of the whole building from the front, back, left side and right side (front = looking at the plan's bottom edge), all Levels stacked: outside Wall faces, Openings at their real sill height and height, Slab edges. Each Elevation panel has its own side picker. Clicking an element selects it everywhere; an element selected elsewhere is highlighted. Hidden Levels are hidden. The drawing is a Derived value in core.

**Blocked by:** 11 Preset panel layouts

**Status:** done

- [x] The front Elevation of a two-Level house shows each Level's outside faces at the right heights; interior Walls do not appear (store test).
- [x] An Opening appears at its sill height and height, and each shape refers to its element (store test).
- [x] Clicking in an Elevation selects the element in the plan, 3D and properties panel, and vice versa.
- [x] Elevations update after every edit and respect hidden Levels.
- [x] All new UI text exists in English and Dutch.

## Comments

**2026-10-01, built:** `elevation(model, values, side)` in core (geometry/elevation.ts) describes one side in its own coordinates (u to the viewer's right, z up): each visible outside Wall face, the Slab edge under it, and each Opening at its sill height and height, back to front, each referring to its Wall, Opening or Slab and Level. A face is visible when it looks towards the viewer at all, so a slanted Wall shows foreshortened. `ElevationView` (editor2d) draws it fitted to the panel in the plan's colours (now shared through `PlanColorsService`), with a window's middle post, a garage door's sections and a dashed wall opening; a click selects the front-most Wall or Opening (and its Level) everywhere, and what is selected elsewhere is highlighted. The Elevation panels show it for their chosen side, recalculated after every committed edit, leaving out hidden Levels; an empty side says so. Store tests: a two-Level house's front at the right heights without the interior Walls, an Opening at its sill height and height over its face, front and back mirrored. Checked in the browser (selection both ways, the Façade highlight). Heights and dimensions are ticket 15.
