# 11: Preset panel layouts

**What to build:** A layout picker in the top bar arranges the centre into preset layouts: Plan; Plan + 3D; Plan + Elevation + 3D; 2×2 (Plan, two Elevations, 3D). Elevation slots show a placeholder until ticket 14. The dividers can be dragged, and the layout and divider positions are remembered per browser (not in the project file).

**Blocked by:** 09 Workspace shell

**Status:** ready-for-agent

- [ ] Each preset layout arranges the panels as described; the Plan and 3D panels work in every layout.
- [ ] Dragging a divider resizes its panels and the canvases redraw at the new size.
- [ ] The chosen layout and divider positions survive a reload and are not written to the project file.
- [ ] All new UI text exists in English and Dutch.
