# 04: Rooms side by side

**What to build:** Rooms fit together the way the user's house does. Starting a Room on an existing Wall's far face reuses that Wall instead of doubling it; a partly shared edge creates Walls only for the uncovered parts, T-connected to the existing Wall. Drawing a Room inside another Room (the WC in the Achterhal) moves the old Room's Seed point to the largest remaining piece if it was covered. An enclosed area without a Room shows hatched as "no Room" with its area, and clicking it creates a Room there.

**Blocked by:** 03 Draw one Room, see its area

**Status:** done

- [x] Drawing Keuken and then Achterhal behind it shares one Wall, with face (T) connections at its ends; no Walls overlap.
- [x] A narrower Room behind a wider one creates Walls only for the uncovered part.
- [x] Drawing the WC inside the Achterhal keeps the Achterhal's name and properties on the remaining area.
- [x] "No Room" areas are hatched, show their area, and become a Room on click.
- [x] **Reference-house fixture test** in `core`: every rectangular Room of the ground floor equals tape L × W exactly (Keuken 9.96, Badkamer 5.63, Berging 5.84, Living 11.09, Eetkamer 9.46 m², WC 1.12 m wide).
- [x] All new UI text exists in English and Dutch.
- [x] `core` has no DOM or Angular UI imports (only `signal` / `computed` in the wrapper), enforced by lint.
