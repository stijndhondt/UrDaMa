# 11: Doors and windows

**What to build:** Openings in Walls. The Door (D) and Window (N) tools place an Opening by clicking a Wall; sliding along it shows the distance to both inside corners, and distance, width and height (and sill height for windows) can be typed. F / Shift+F flip a door's swing side / opening direction. Defaults come from Presets: door 930 × 2115 mm, window 1200 × 1200 mm with a 900 mm sill. Openings can't overlap each other or cross a Wall end; they move with their Wall and are deleted with it. Wall panels show each face's length and Gross / Net area (Wall height).

**Blocked by:** 08 Select, move, delete

**Status:** done

- [x] Placing a window 0.58 m from the inside corner is exact, whether typed or snapped.
- [x] Overlapping Openings or Openings crossing a Wall end are refused with a reason.
- [x] Wall face Net area = Gross area minus the Openings in that face.
- [x] Doors render with their swing on the plan.
- [x] All new UI text exists in English and Dutch.
- [x] `core` has no DOM or Angular UI imports (only `signal` / `computed` in the wrapper), enforced by lint.
