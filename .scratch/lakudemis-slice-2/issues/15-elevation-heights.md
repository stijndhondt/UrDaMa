# 15: Heights in Elevations

**What to build:** Elevations show heights: Level heights, the total height, and sill and Opening heights as dimensions. A Façade or Façade part selected in the Quantities panel is highlighted in the Elevation.

**Blocked by:** 14 Elevations, look and select

**Status:** done

- [x] Level heights, total height and Opening sill/height dimensions are drawn and read correctly on the reference house with a synthetic second Level.
- [x] Selecting a Façade or Façade part in Quantities highlights it in the matching Elevation.
- [x] All new UI text exists in English and Dutch.

## Comments

**2026-10-01, built:** `elevationHeights(elevation, hidden)` in core gives the heights to dimension, leaving out hidden Levels: a chain of storeys from each shown Level's finished floor to the next one's (the top Level to the top of its Walls, which stop where a next Slab would start, so it reads its storey height minus the Floor build-up), the total height from the lowest finished floor to the top, and per Opening its sill above its finished floor (when it has one) and its height, at its right edge. `ElevationView` draws them: each Level's name and height (±0,00, +2,94) at a dashed mark and the storey chain on the left, "Total height" on the right, each Opening's sill and height beside it; a dimension too short to label shows its line only. A Façade, Façade part or Façade Level row picked in the Quantities selects its Walls and remembers its faces; the Elevation of that side highlights those faces for as long as that selection stands. Store tests for the chain, the total, the Opening dimensions and hidden Levels. Checked in the browser on a two-Level house (not the reference house: drawing it by hand in the browser is slow; the store tests cover its geometry).

**2026-10-01, after review:** each Level reads its own storey height (finished floor to the next, as typed in the panel), hidden Levels leave the others unchanged, and the total height runs from the ground line under the lowest Slab to the top of the highest Walls. An Opening split over faces gets one set of dimensions over its whole width; one hidden behind a nearer face gets none. A picked Façade shows as its own faces in the Elevation of its side only, not as its whole Walls everywhere. A store test now dimensions the reference house with a second Level.
