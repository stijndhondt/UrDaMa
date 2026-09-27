# 06: Taiga UI prototype

**What to build:** The chosen layout built with Taiga UI against the real app, on a throwaway branch: the app shell, the Wall and Room properties (inputs with units, the direction and mode choices), the right-click menu, the Quantities tree, light/dark following the OS, the library's own texts in Dutch, and an Opening type dialog.

**Blocked by:** 05 Workspace layout mockups

**Status:** done

- [x] The prototype runs against the real app on its own branch, with every item above working.
- [x] Notes in this ticket: what was easy, what fought back, missing pieces (such as a resizable splitter), bundle size, and zoneless issues.

## Comments

**2026-09-27, prototype built:** branch `prototype/taiga-ui` (on `prototype/workbench-base`, which holds the library-independent part: layout/theme state, Building and Quantities tree data, the right-click menu's items, an in-memory Opening type list). Run it with `pnpm start` on that branch. Taiga UI 5.25.0 on Angular 22.2, zoneless.

Checked in the browser: the Workbench shell (menus File/Edit/View, undo/redo with hints, the four layout presets, maximise/restore per panel with Plan only as default, Building and Library panels from the icon bar, floating tool bar with tooltips and an Opening type flyout, properties right, Quantities/Warnings bottom, status bar), Wall length typed in a number field with units and the grows/mode choices as segmented controls (3.00 m typed: Room 1 6.44 → 7.89 m², Room 2 moved along), Room fields, the right-click menu at the cursor (heading, items, shortcuts, Esc), the Quantities tree with the Measurement rule switch, light/dark following the OS plus a manual switch, Taiga's own texts in Dutch (dialog close: "Sluiten"), and the Opening type dialog, a component opened by `TuiDialogService` like Optimus's dynamic dialog (kind select, name, sizes in mm with Dutch separators, leaves and operation; Save adds the type to the Library).

**Easy**

- Dutch: Taiga ships `TUI_DUTCH_LANGUAGE`; `TUI_LANGUAGE` is a signal token, so one provider makes Taiga follow the app's language live.
- Dark mode: `TUI_DARK_MODE` is a writable signal that follows the OS by default; the whole palette (dialogs, dropdowns, fields) switches.
- Tree (`tui-tree` with a children handler and a row template) did both the Building panel and the Quantities tree.
- Number fields with units (`tuiInputNumber` + `postfix`), segmented controls, accordion sections, tooltips (`tuiHint`) and dropdown menus (`tuiDropdown` + `tui-data-list`) all worked first time.
- 4,300 Lucide icons (`@tui.*`) via an assets glob.
- Zoneless: no problems found (hints, dropdowns, context dropdown, the service-opened component dialog, tabs, tree, select, all with OnPush and signals).

**Fought back**

- `ng add taiga-ui` hung under pnpm (waiting on an interactive step); the install was finished with `pnpm add`. The Taiga MCP server timed out; the docs came from `taiga-ui.dev/llms-full.txt`.
- The right-click menu: `tuiDropdownContext` opens on its own event only; our editor first decides what is under the cursor, so opening it from there needed its protected `onContextMenu` (a cast).
- Dropdown and dialog closing animations wait for `animationend`; in a hidden/throttled browser tab (the automated test pane) they hang and block clicks. Real use is fine; browser tests need animations switched off.
- Number fields don't take the decimal comma from the language by themselves: the number format has to be given per language (done per field here).
- Lint: `<label tuiLabel>` inside `<tui-textfield>` is linked at run time, which `label-has-associated-control` can't see; the rule is off for the Taiga folder.
- Tests (jsdom): Taiga needs `provideTaiga()` in the test bed and reads `matchMedia`, which jsdom lacks (stubbed in the shell test).
- Density: size-s fields with the label inside are cramped in a 280 px properties panel, and three long labels in a segmented control get cut off ("to the ri…"); a compact desktop density would need our own CSS.

**Missing**

- No splitter component: the side panel resizes with the CDK `tuiResizable`/`tuiResizer` (works, basic); there are **no draggable dividers between the centre panels** in this prototype; they would be our own code.
- Not in either prototype (same on both, so the comparison stays fair): showing/hiding Levels in the Building panel, and the Building panel replacing the Level tabs (ticket 10).
- No menubar: menus are buttons with dropdowns (fine, but hover-to-switch between open menus isn't there).
- No tree table: the Quantities tree uses fixed-width columns in the tree row.

**Bundle size** (production build, initial): 530 kB → 1.09 MB raw, 140 → 241 kB transferred (+101 kB); global styles 86 kB raw / 5 kB transferred. The 1 MB error budget had to be raised on the branch.
