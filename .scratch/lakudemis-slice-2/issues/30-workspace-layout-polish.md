# 30: Workspace layout polish

**What to build:** Two layout faults seen in the acceptance run:

- When the Building panel's tree gets a scrollbar (many Walls), its header narrows: "Level above" and "Level below" wrap onto two lines and the Level names are cut short ("Ground f…").
- In the 2×2 layout the Plan panel shows only part of the plan; switching layouts doesn't fit the plan to its new panel size.

**Blocked by:** none

**Status:** needs-triage

- [ ] The Building panel header stays on one line with a scrollbar, in English and Dutch.
- [ ] Changing the layout fits the plan into its panel (unless the user has zoomed or panned since the last fit).

## Comments

**2026-10-03:** found in the Slice 2 acceptance run (ticket 22, stories 22 and 27).
