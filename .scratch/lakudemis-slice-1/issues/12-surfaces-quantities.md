# 12: Surfaces and Quantities

**What to build:** The numbers a homeowner buys materials with. Each Room shows Net floor area, volume (Net floor area × Room height), Floor finish area, Ceiling area, and **Net wall area around the Room**: wall perimeter × Room height minus the Openings in it (only the part below the Ceiling), with no wall area along Room separators; reveals are a separate figure. Measurement rules "Exact" (default) and "Belgian masonry" (ignore openings < 0.25 m²) are chosen per report. A Quantities table lists every Room and Level, and exports CSV following the UI language (Dutch: `;` and decimal comma; English: `,` and decimal point; UTF-8 with BOM).

**Blocked by:** 10 Room separators and Merge Rooms, 11 Doors and windows

**Status:** ready-for-agent

- [ ] Living's Net wall area stops at the Room separator to the Eetkamer.
- [ ] Switching the Measurement rule changes wall areas as expected for an opening below 0.25 m².
- [ ] The CSV opens correctly in Dutch Excel (columns split, "9,96", "m²" shown).
- [ ] All values in the table match the properties panels.
- [ ] All new UI text exists in English and Dutch.
- [ ] `core` has no DOM or Angular UI imports (only `signal` / `computed` in the wrapper), enforced by lint.
