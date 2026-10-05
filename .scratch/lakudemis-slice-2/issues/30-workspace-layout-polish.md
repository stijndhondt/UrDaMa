# 30: Workspace layout polish

**What to build:** Two layout faults seen in the acceptance run:

- When the Building panel's tree gets a scrollbar (many Walls), its header narrows: "Level above" and "Level below" wrap onto two lines and the Level names are cut short ("Ground f…").
- In the 2×2 layout the Plan panel shows only part of the plan; switching layouts doesn't fit the plan to its new panel size.

**Blocked by:** none

**Status:** done

- [x] The Building panel header stays on one line with a scrollbar, in English and Dutch.
- [x] Changing the layout fits the plan into its panel (unless the user has zoomed or panned since the last fit).

## Comments

**2026-10-03:** found in the Slice 2 acceptance run (ticket 22, stories 22 and 27).

**2026-10-05:** done. Only the Building tree scrolls now, so its scrollbar never narrows the buttons above it. "Bouwlaag erboven / eronder" needed 319 px in a 250 px panel, so the Dutch buttons read "Erboven / Eronder", with the full action ("Bouwlaag erboven toevoegen") as a tooltip in both languages. The plan keeps fitting its panel on every size change (layout, divider, window) from load or the last fit until the user zooms or pans; it is now also fitted on load.
