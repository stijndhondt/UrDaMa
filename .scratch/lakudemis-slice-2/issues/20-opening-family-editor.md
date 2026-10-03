# 20: Opening family editor

**What to build:** A Fusion-style edit mode for one Opening family, using the panel layouts: the family shown from the top, bottom, front, back, left and right and in 3D, all from the same parts. Parameters (leaf count, hinged or sliding, garage-door style, part sizes and divisions) are set in the properties panel or by dragging handles in the views. Changes flow to all types and placed Openings.

**Blocked by:** 18 Opening types and "only this one", 19 Opening family parts, 11 Preset panel layouts

**Status:** done

- [x] Entering and leaving the edit mode keeps the project's views as they were.
- [x] The six views and 3D always show the same object; a parameter change updates them all.
- [x] A family change reaches all its types and every placed Opening, as one undo step (store test).
- [x] Handles change parameters and snap to sensible increments.
- [x] All new UI text exists in English and Dutch.

## Comments

**2026-10-03, built:** "Edit family" (properties panel, Opening Type section) opens the family editor over the centre panels; the layout underneath stays mounted, so Done finds the project's views as they were. It shows the family at one of its types' sizes ("Shown at") from the top, front, left, bottom, back and right, at one shared scale, and in 3D (manifold, built from the same parts), all from core's `openingShape`. The properties panel shows the family's name, frame (width, depth, sill rail) and infill: leaf count, hinged or sliding, glass in the leaf; window panes (1–6 or auto, a post between each two; panes narrower than 100 mm are not made); garage-door style (sectional with its section count, up-and-over, roller) and thickness. Handles: frame width on the front and back views and frame depth on the others (5 mm steps), infill thickness on the left and right views (2 mm steps, no thicker than the frame). Each change is one `updateOpeningFamily`: every type and placed Opening follows, one undo step (a drag previews and commits on release); a design equal to the kind's default is stored as none. Plan symbols: a sliding leaf hangs on the Wall face with its open position dashed beside it; up-and-over has a shorter track, a roller a dashed roller box. Store tests for the one-step change, refusals and the new parts. Checked in the browser.

Known limits: the frame-depth handle stops at the preview Wall (300 mm, or the frame's depth); deeper frames are typed. Leaf widths, glass panel size and post width follow the frame and are not set separately. A project file's family designs are not validated on opening.
