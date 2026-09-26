# 20: Opening family editor

**What to build:** A Fusion-style edit mode for one Opening family, using the panel layouts: the family shown from the top, bottom, front, back, left and right and in 3D, all from the same parts. Parameters (leaf count, hinged or sliding, garage-door style, part sizes and divisions) are set in the properties panel or by dragging handles in the views. Changes flow to all types and placed Openings.

**Blocked by:** 18 Opening types and "only this one", 19 Opening family parts, 11 Preset panel layouts

**Status:** ready-for-agent

- [ ] Entering and leaving the edit mode keeps the project's views as they were.
- [ ] The six views and 3D always show the same object; a parameter change updates them all.
- [ ] A family change reaches all its types and every placed Opening, as one undo step (store test).
- [ ] Handles change parameters and snap to sensible increments.
- [ ] All new UI text exists in English and Dutch.
