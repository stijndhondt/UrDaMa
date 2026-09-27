# 07: Optimus prototype

**What to build:** The same slice as the Taiga UI prototype, built with Optimus (the MIT fork of PrimeNG) against the real app on a throwaway branch. It explicitly tests tooltips and dynamic dialogs without Zone.js.

**Blocked by:** 05 Workspace layout mockups

**Status:** done

- [x] The prototype runs against the real app on its own branch, with every item of the Taiga UI prototype working.
- [x] Tooltips and dialogs are checked without Zone.js; the result is noted here.
- [x] Notes in this ticket: what was easy, what fought back, bundle size, maturity concerns.

## Comments

**2026-09-27, prototype built:** branch `prototype/optimus-ui` (on `prototype/workbench-base`, the same library-independent base as the Taiga UI prototype). Run it with `pnpm start` on that branch. Optimus UI 2.0.2 (`@openng/optimus-ui`, Aura preset) with `@openng/icons` and `primelocale` on Angular 22.2, zoneless.

Checked in the browser: the same Workbench as the Taiga prototype. Menubar (File/Edit/View with submenus and shortcuts), undo/redo, the four layout presets, maximise/restore per panel with Plan only as default, **draggable dividers between the centre panels** (`p-splitter`; the plan and 3D resize with them), Building tree and Library panel, floating tool bar with tooltips and an Opening type menu, properties right, Quantities/Warnings tabs at the bottom, status bar. Wall length typed in Dutch as "3,20" in a number field with units and locale (Room 1 7,89 → 8,42 m²), grows/mode as select buttons. The right-click menu at the cursor (heading, items, shortcuts, Esc). The Quantities tree as a **tree table with real columns** and the Measurement rule switch. Light/dark following the OS plus a manual switch. Optimus's own texts in Dutch (dialog close: "Sluit"). The Opening type dialog as a dynamic dialog (family select fills in the family's sizes, name, sizes in mm, leaves and operation; Save adds the type to the Library).

**Without Zone.js** (the ticket's explicit check): tooltips (`pTooltip`) show and hide on hover, including on the icon bar and tool bar; the dynamic dialog (`DialogService.open` with a component, `DynamicDialogRef.close`) opens, updates (the family select changing the size fields) and closes, with Esc and Cancel; the context menu, select overlays, menubar submenus and tree table expansion all work. No problems found.

**Easy**

- Everything a desktop-style shell needs is in the box: menubar, splitter, tree table, context menu, select buttons, tabs, accordion, toggle switch, tooltips, dynamic dialogs. It is API-compatible with PrimeNG v21, so its docs, examples and experience carry over.
- Number fields take a locale (`nl-BE`): decimal comma and thousands dot with no extra code; suffixes for units.
- The right-click menu: `ContextMenu.show(event)` accepts our own event, so the editor decides the target and the menu opens at the cursor, no workaround.
- Dark mode: a `darkModeSelector` class (`.app-dark`) that we toggle from the Workbench's theme choice.
- Lint passes as is (labels with `for`/`inputId`); the shell test needs no Optimus provider.

**Fought back**

- No Dutch texts in the package: they come from the community `primelocale` package and are set with `Optimus.setTranslation` on each language change (a few lines; the English/Dutch objects are complete).
- Menus, select buttons and tree nodes take their labels as data (`MenuItem[]`, options arrays), so every label has to be translated in code and rebuilt when the new language's texts have loaded (`onLangChange`, not the language choice, which comes before the file loads); the translate pipe in templates doesn't have this problem.
- Styling Optimus's inner parts needs `::ng-deep` or its pass-through (`pt`) API; the Aura density is roomy for a desktop tool (select buttons wrap long Dutch labels over 3 lines; the Elevation side picker doesn't fit a narrow panel header and would be a dropdown).
- `p-inputnumber`'s `onBlur` fires before the model value is written, so the typed text is parsed on blur by a small helper that has to know the locale's group and decimal separators ("2.650 mm" in Dutch, "2,650 mm" in English).
- Icons: `@openng/icons` is the old PrimeIcons set (~300 icons), with no good fit for walls, doors, windows or a redo arrow; a real build would add Lucide or our own SVGs.

**Missing in this prototype**

- The side panel (Building/Library) has a fixed width; only the centre panels have draggable dividers (Taiga UI is the other way round).
- Not in either prototype (same on both): showing/hiding Levels in the Building panel, and the Building panel replacing the Level tabs (ticket 10).

**Maturity concerns**

- The fork is new: Optimus 2.0.2 dates from 2026-08-28, forked after PrimeTek moved PrimeNG v22+ to a commercial licence and archived the MIT repository (June 2026). Two maintainers are listed on npm. The component code is mature (PrimeNG's), but its future pace and the Angular 23+ upgrades depend on a small community team. The icons package says its first release is still being worked on.
- Taiga UI, by contrast, is maintained by a company team (T-Bank) and releases often, but has fewer desktop-style components.

**Bundle size** (production build, initial): 530 kB → 1.53 MB raw, 140 → 316 kB transferred (+176 kB, against +101 kB for Taiga UI); global styles 14 kB (the theme is injected at run time). The error budget had to be raised to 2 MB on the branch.
