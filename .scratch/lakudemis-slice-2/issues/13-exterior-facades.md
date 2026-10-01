# 13: Exterior Façades

**What to build:** An exterior section in the Quantities tree lists the building's Façades (front, back, left side, right side, relative to the plan's bottom edge as front). Each Façade has its total, splits into its Façade parts when it is not flat, and has totals per Level and for the whole height. The Measurement rule applies to Façades as to inside Wall faces.

**Blocked by:** 12 Quantities per surface

**Status:** done

- [x] The reference house's outside Wall faces are grouped into four Façades (store test).
- [x] An L-shaped house's front Façade splits into two Façade parts whose totals add up to the Façade (store test).
- [x] The Measurement rule changes Façade net areas as it does for inside faces (store test).
- [x] Clicking a Façade or Façade part selects its Wall faces in the plan and 3D.
- [x] All new UI text exists in English and Dutch.

## Comments

**2026-10-01, built:** each Level gets its outside Wall faces (`LevelValues.outsideFaces`): the same per-face calculation as the Rooms, run over the outer ring of the merged footprint, from the top of the Slab up the storey height so the Levels stack without gaps. `facadeTree` (core/report/facades.ts) puts each face in the Façade it looks towards (front = towards the plan's bottom edge; a 45° face counts as front or back), groups faces in one plane (0.5 mm) into Façade parts, numbered left to right as seen from outside, and gives every Façade and part its totals per Level and for the whole height, under the Measurement rule. Wall ends now count as faces too ("end"), where a Wall sticks out past the one it butts against (the reference house's Berging shows 60 mm of one) or a stub ends inside a Room. In the Quantities tree an Exterior section follows the Levels: Façade → its per-Level totals → its parts (only when it isn't flat) → the faces; a click selects the Walls of that row in the plan, 3D and the Elevations. The CSV follows the tree ("Room or Façade" column). Store tests: the reference house (four Façades, all outside faces once, the front steps where a Room behind is wider), an L-shaped front in two parts that add up, the Measurement rule, totals per Level. Checked in the browser. Façades don't count reveals (the inside faces already take the Wall's full depth).
