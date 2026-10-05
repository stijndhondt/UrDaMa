# 29: Properties panel: collapsible sections and long values

**What to build:** User story 32 asks for "a properties panel on the right in collapsible sections"; the chosen design (ticket 24, variant C) shows its sections open, with no way to fold them. Make each section (Sizes, Faces, Type, Level, Project presets, Measurement rule) collapsible, remembered per browser. Also, a long value overlaps its label: the Measurement rule "Belgian masonry (openings < 0.25 m² not subtracted)" runs over "Measurement rule" in the nothing-selected panel; long values wrap under their label or are shortened with the full text as a tooltip.

**Blocked by:** none

**Status:** done

- [x] Every section of the properties panel folds and unfolds, with an Optimus control, and stays as it was after a reload.
- [x] No value overlaps its label in English or Dutch, at the panel's normal width.

## Comments

**2026-10-03:** found in the Slice 2 acceptance run (ticket 22, story 32 and the Quantities stories).

**2026-10-05:** done. Every section heading is an Optimus text button inside the heading (`lk-panel-section`); folded sections are kept per browser under `urdama.panel.collapsed`, by the heading's translation key, so "Sizes" folds for a Wall and a Floor opening alike. A value too long for its row wraps under its label, right-aligned.
