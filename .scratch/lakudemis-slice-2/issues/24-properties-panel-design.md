# 24: Properties panel design (mockups)

**What to build:** Two or three variants of the properties panel, added to the design canvas of ticket 05, for a Room, a Wall and an Opening (and nothing selected), in light and dark, in Dutch (the longest labels): how fields, units, sections and read-only figures sit in a 280 px panel, and how the Wall's length is shown (as text that opens the in-place editor of ticket 23). Built with Optimus-like controls at a compact density. The user picks one.

**Blocked by:** 08 Choose the UI library (ADR)

**Status:** done

- [x] The variants are on the design canvas and clickable (Room / Wall / Opening / nothing selected, light/dark).
- [x] The user has picked one (or a mix), recorded in this ticket's Comments.

## Comments

**2026-09-27:** from the user's review of the prototypes: "the main concern is this is a bad designed panel". Both prototypes stacked full-width default fields with long labels ("Ruimte verschuiven (de muur aan dat uiteinde schuift mee)") that didn't fit.

**2026-09-27, variants published** on the design canvas (https://claude.ai/artifact/AMPRTHfFEY5VhRfJ4SfGUJ), row "Properties panel — pick one", each switchable between Room, Wall, Door and nothing selected, with a dark tweak:

- **A · Compact raster**: label column and small right-aligned fields with units inside, collapsible sections, a reset icon only on values that differ from the preset, figures as a dense list at the bottom.
- **B · Paren en tabbladen**: Figma-like pairs of fields with one-letter prefixes (full name as tooltip), and the figures on a separate "Hoeveelheden" tab.
- **C · Eerst lezen, ter plaatse wijzigen**: values shown as text with a summary of the key figures on top; clicking a value edits it in place, like the length editor.
- **Lengte wijzigen (dubbelklik)**: the in-place editor of ticket 23 on a piece of the plan, with direction and mode as icon toggles.

**2026-09-27, decision:** variant **C** (read first, edit in place: values as text, a summary of key figures on top, click a value to edit it there, the Wall's length opens the ticket 23 editor) **with A's reset icons**: a value that differs from its preset shows a reset button (tooltip names the preset value) that puts the preset back; preset values show in grey. The canvas's C artboard is updated to show this.
