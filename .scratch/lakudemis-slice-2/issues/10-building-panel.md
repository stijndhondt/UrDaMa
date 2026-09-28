# 10: Building panel

**What to build:** A Building panel opened from the left icon bar replaces the Level tabs: each Level (add above/below, rename, delete, choose the Level to draw on) with show/hide, and under it its Rooms, Walls and Openings. Clicking an element selects it everywhere. Hidden Levels are hidden in the plan and 3D.

**Blocked by:** 09 Workspace shell

**Status:** done

- [x] All Level actions of the old tabs work from the Building panel, including keys 1–9.
- [x] Clicking a Room, Wall or Opening in the tree selects it in the plan, 3D and the properties panel, and selecting it elsewhere reveals it in the tree.
- [x] Show/hide per Level applies to the plan and 3D, and is remembered per browser.
- [x] All new UI text exists in English and Dutch.

## Comments

**2026-09-28, built:** `lk-building-panel` in the left side panel replaces the Level tabs: Levels highest first, the one drawn on highlighted with its key 1–9; a click draws on a Level, a double click renames it, its ⋯ menu adds a Level above or below, renames or deletes it (confirmed); "+ Level above/below" at the top. Under each Level: Rooms, Walls (numbered, with their length) and Openings (kind and size), in groups that expand; a click selects the element (switching Level if needed), Shift+click adds to the selection, and a selection made elsewhere opens its Level and group and scrolls its row into view. The eye hides a Level in the plan (the faded Level below) and in 3D (the 3D view's own Level checkboxes are gone); the choice is per browser and per project (`LevelVisibilityService`, never in the file). The Level being drawn on is always shown, but its hidden choice is kept for when another Level is drawn on. The Level tabs component became `lk-add-level-dialog`. Checked in the browser: tree selection both ways, add a Level above, hide the Ground floor from Level 2, reload, rename by double click, key 1.
