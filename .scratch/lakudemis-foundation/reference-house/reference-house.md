# Reference house: ground floor

The test case that Slice 1 decisions and acceptance are checked against. **Scope: ground floor only.** The first floor is deliberately left out for now; the stair is recorded but not modelled.

Sources:

- `room measurement.md`: tape measurements by the user. **All are inside (clear) dimensions.**
- `full plan.PNG`: the whole ground floor as drawn in Rayon.
- `living + eetkamer.PNG`: Living and Eetkamer split by a divider (a Room separator).
- The other `*.PNG` files: crops per room. The areas shown are Rayon's own calculation.

## Layout

A narrow row house (terraced), front at the bottom of `full plan.PNG`, rear at the top. From front to rear:

1. **Front block (full width):**
   - **Left:** Living (front) and Eetkamer (behind it). This is one open space, divided by a Room separator; Eetkamer is narrower because the stair enclosure juts into it.
   - **Right:** the entrance Hal (L-shaped) with the Trap (stair enclosure) between the Hal and the Eetkamer.
   - The front door is in the Hal; the front window is in the Living.
2. **Rear extension (narrower, right-aligned; the left side is outside):**
   - **Keuken:** a window in the wall towards the front block.
   - **Achterhal:** L-shaped, containing the WC (its own Room) and wall cabinets (Kasten). The cabinets are a Furnishing and do not change the Achterhal area.
   - **Badkamer.**
   - **Berging** (Rayon "Zone 13"): a door to the outside on the left.
   - Windows along the left (exterior) side.

Room heights (floor to ceiling) differ per Room on the same Level (2.49–2.73 m).

## Rooms

| Room | Tape L × W (inside) | Tape area | Room height | Rayon area | Notes |
|---|---|---|---|---|---|
| Hal (entrance) | 6.76 × 1.00 | (L-shaped) | 2.71 | 9.47 | L-shaped: 1.73 m wide at the rear, narrower at the front. Tape L × W doesn't describe it; Rayon's inner length is 7.00. |
| Trap (stair enclosure) | – | – | – | 2.03 | Recorded only. Stairs and vertical connections are fog on the map. |
| Living | 3.32 × 3.34 | 11.09 | 2.73 | 11.29 | Separated from the Eetkamer by a Room separator. Rayon: 3.32 × ~3.40. |
| Eetkamer (dining) | 3.57 × 2.65 | 9.46 | 2.71 | 9.59 | Rayon: 3.58 × ~2.68. |
| Keuken (kitchen) | 3.73 × 2.67 | 9.96 | 2.57 | 10.09 | |
| Achterhal + WC | 3.94 × 2.67 | 10.52 | 2.49 | Hal 7.77 + Kasten 1.57 + WC 0.80 = 10.14 | L-shaped hall; the WC is 1.12 m wide inside and is its own Room. The Kasten are wall cabinets (a Furnishing), so their area belongs to the Achterhal. |
| Badkamer (bathroom) | 1.91 × 2.95 | 5.63 | 2.50 | 5.26 | ⚠ Rayon draws the inner width as 2.67; that is a drawing error, and the tape (2.95) is correct. |
| Berging (storage) | 1.94 × 3.01 | 5.84 | 2.50 | 5.29 | ⚠ Rayon draws the inner width as 2.67; that is a drawing error, and the tape (3.01) is correct. |

Areas in m², lengths in m.

**Source of truth: the tape measurements.** Rayon areas are only a rough cross-check. The two ⚠ rows are mistakes in the Rayon drawing, not in the tape (confirmed by the user). Rayon is finicky about wall measurements and about placing adjacent walls, which is one of the reasons Lakudemis exists.

## Derived (approximate, from the Rayon drawing)

- **Wall thicknesses:** about 0.14 m for the annex side walls; about 0.19–0.23 m for the front-block exterior walls.
- **Front facade:** 0.58 m from the left inner face to the Living window.

These are for plausibility checks, not exact tests.

## What this house tests

- **Room separator:** Living / Eetkamer.
- **L-shaped Rooms:** both halls.
- **A small Room inside a larger one:** the WC in the Achterhal.
- **Furnishing that does not change area:** the Kasten wall cabinets.
- **Room height per Room** (floor to ceiling), independent of Wall height.
- **A stair enclosure** carved out of the floor area (recorded, not modelled).
- **Drawing precision:** the two ⚠ rows are where Rayon's wall placement went wrong. Lakudemis should reproduce the tape dimensions exactly.

## Not captured (later)

- **First floor, and the stair's connection to it.** The multi-Level part of Slice 1 is tested with a synthetic second Level until then.
- **Exact wall thicknesses, opening sizes (width, height, sill), slab thickness, Level heights.**
- **Exact coordinates.** Not from Rayon: its drawing has known errors (the ⚠ rows). Build them from the tape measurements instead, which makes drawing the reference house in Lakudemis a natural first acceptance test.
