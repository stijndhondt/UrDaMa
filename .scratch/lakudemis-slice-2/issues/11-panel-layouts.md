# 11: Preset panel layouts

**What to build:** A layout picker in the top bar arranges the centre into preset layouts: Plan; Plan + Elevation; Plan + 3D; Plan + Elevation + 3D; 2×2 (Plan, two Elevations, 3D). Elevation slots show a placeholder until ticket 14. The dividers can be dragged, and the layout and divider positions are remembered per browser (not in the project file). Every panel can be maximised to fill the centre on its own and restored to the preset (ticket 05 decision); **Plan only** is the default layout.

**Blocked by:** 09 Workspace shell

**Status:** done

- [x] Each preset layout arranges the panels as described; the Plan and 3D panels work in every layout.
- [x] Dragging a divider resizes its panels and the canvases redraw at the new size.
- [x] The chosen layout and divider positions survive a reload and are not written to the project file.
- [x] Each panel's Maximise button shows that panel alone (Plan, any Elevation side, or 3D); Restore brings back the preset layout.
- [x] A new project, or a browser without a remembered layout, starts in Plan only.
- [x] All new UI text exists in English and Dutch.

## Comments

**2026-09-28, built:** the layout picker in the top bar (and View › Layout): Plan only (default), Plan + 3D, Plan + Elevation + 3D, 2 × 2 (Plan, two Elevations, 3D). `layoutGrid` (tested) turns a layout, a maximised panel and the divider positions into CSS grid areas and tracks; the centre is one grid, so the Plan stays mounted in every layout and keeps its tool and view. Dividers are dragged (15–85 %), the canvases follow through their resize observers. Each panel header has Maximise / Restore (only when the layout has more than one panel); an Elevation panel has its own side picker and shows a placeholder until ticket 14. Layout, divider positions and Elevation sides are remembered per browser (`LayoutService`), never in the project file; the icon bar's 3D button switches between Plan only and Plan + 3D. Checked in the browser: every preset, maximise and restore, dragging a divider (plan canvas 167 → 110 px wide), a reload keeping the layout and split.

**2026-09-28, after review:** the spec listed Plan + Elevation, the ticket Plan + 3D; both are presets now (Plan + 3D stays for the icon bar's 3D button). A layout whose panels would get less than 360 × 240 px is disabled and falls back to the largest one that fits; the chosen one comes back when the window grows. File › New starts in Plan only.
