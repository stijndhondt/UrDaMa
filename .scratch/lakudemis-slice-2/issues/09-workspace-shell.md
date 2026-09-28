# 09: Workspace shell

**What to build:** Optimus UI (ADR 0008) installed app-wide, with Iconify icons (one main set, bundled), taking `prototype/optimus-ui` as the reference but not copying its prototype code, in the chosen layout: a top bar with File / Edit / View menus, undo/redo and the theme switch; a left icon bar for the side panels; the right properties panel (design from ticket 24) (with the project's Presets, Measurement rule and Level when nothing is selected); a collapsible bottom panel with Quantities and Warnings tabs; a status bar with hint, units and zoom; and the drawing tools as a floating toolbar in the Plan panel, grouped with icons, tooltips and shortcuts. Light and dark follow the OS and can be switched; the library's own texts follow the app's language. Every existing feature keeps working in the new shell.

**Blocked by:** 08 Choose the UI library (ADR), 24 Properties panel design

**Status:** done

- [x] Every Slice 1 feature and tickets 01–04 work in the new shell (browser check against the reference house).
- [x] Light and dark follow the OS by default and can be switched from the View menu.
- [x] Switching the language switches the library's own texts too.
- [x] The production build and the library builds still pass, and the initial bundle stays within its budget.
- [x] All new UI text exists in English and Dutch.
- [x] The properties panel follows the design chosen in ticket 24: values read as text with a summary of key figures on top, a click edits a value in place (Enter saves, Esc cancels), a value that differs from its preset has a reset button, preset values show in grey.

## Comments

**2026-09-27, built:** Optimus UI 2.0.2 app-wide (Aura with the app's blue as primary, dark via the `app-dark` class, `primelocale` texts following the language), Lucide icons bundled by `pnpm icons` (`scripts/build-icons.mjs` → `shell/icons.generated.ts`). Menubar (File / Edit / View with shortcuts, theme and language submenus), undo/redo with the action in the tooltip, theme button (system → light → dark, remembered per browser); left icon bar with the Building panel (holding the Level tabs until ticket 10) and toggles for 3D, Quantities and Warnings; Plan with the floating tool bar and the 3D view beside it in a splitter (layouts come with ticket 11); properties panel in design C (`lk-prop` rows: text, click to edit, Enter/Esc, reset button for own values, grey for Preset values; summary tiles); the Wall's length opens `lk-length-editor` (length, direction and mode as icon toggles, mode remembered per browser, ticket 23 reuses it on the plan); right-click menu on Optimus; bottom panel with the Quantities table (Measurement rule, CSV export) and Warnings; status bar with hint or message, warnings count, Level, units and the drawing scale (1:38 at 96 dpi). Initial bundle 530 kB → 1.20 MB raw, 140 → 264 kB transferred; budget raised to 1.3 MB warning / 1.6 MB error (ADR 0008).

Checked in the browser (Dutch, light and dark): a Wall's length 3,00 → 3,30 m through the panel (Room 1 8,15 → 8,94 m²), a Room height reset to its Preset, the right-click menu, 3D beside the plan, the Quantities panel, a door placed and its width changed to 830 (only that door, now type "83 × 211,5"), the Level dialog in dark. A Slice 1 working copy opened through the ticket 16 migration.

Not in this ticket: the plan canvas keeps its light paper colours in dark mode; the side panel is not yet resizable.

**2026-09-28, after review:** Openings in the panel now have summary tiles, grey Preset sizes and reset buttons naming the Preset; Wall faces show the gross area in a tooltip; the plan stays mounted when 3D opens (it was rebuilt, losing the tool and view), with its own draggable divider instead of the Optimus splitter; shared helpers for per-browser settings, texts built in code (`LanguageService.text`) and the Measurement rule choices. Known differences, kept on purpose: the status bar shows the drawing scale (1:67) rather than a zoom percentage, and the change summary takes the status bar's place while there is no message.
