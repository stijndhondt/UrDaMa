# 14: Elevations, look and select

**What to build:** Elevation panels show straight-on drawings of the whole building from the front, back, left side and right side (front = looking at the plan's bottom edge), all Levels stacked: outside Wall faces, Openings at their real sill height and height, Slab edges. Each Elevation panel has its own side picker. Clicking an element selects it everywhere; an element selected elsewhere is highlighted. Hidden Levels are hidden. The drawing is a Derived value in core.

**Blocked by:** 11 Preset panel layouts

**Status:** ready-for-agent

- [ ] The front Elevation of a two-Level house shows each Level's outside faces at the right heights; interior Walls do not appear (store test).
- [ ] An Opening appears at its sill height and height, and each shape refers to its element (store test).
- [ ] Clicking in an Elevation selects the element in the plan, 3D and properties panel, and vice versa.
- [ ] Elevations update after every edit and respect hidden Levels.
- [ ] All new UI text exists in English and Dutch.
