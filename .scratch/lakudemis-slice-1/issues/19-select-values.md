# 19: Selects show the wrong option after a reload

**Found by:** 15 Slice 1 acceptance run (Dutch UI audit)

**What to build:** After a reload with Dutch chosen, the UI is Dutch but the language picker shows "English". The `<select>` gets its value through `[value]` before its `@for` options exist, so the browser falls back to the first option. The same pattern is used by the Measurement-rule select in the Quantities table and the "moves" selects in the Room panel. Mark the chosen option itself instead.

**Blocked by:** none

**Status:** done

- [x] After a reload in Dutch, the language picker shows "Nederlands".
- [x] The Measurement-rule select shows the rule in use when the Quantities table opens.
- [x] The Room panel's "moves" selects show their current choice.
