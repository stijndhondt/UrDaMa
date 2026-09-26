# 09: Workspace shell

**What to build:** The chosen library installed app-wide, in the chosen layout: a top bar with File / Edit / View menus, undo/redo and the theme switch; a left icon bar for the side panels; the right properties panel in collapsible sections (with the project's Presets, Measurement rule and Level when nothing is selected); a collapsible bottom panel with Quantities and Warnings tabs; a status bar with hint, units and zoom; and the drawing tools as a floating toolbar in the Plan panel, grouped with icons, tooltips and shortcuts. Light and dark follow the OS and can be switched; the library's own texts follow the app's language. Every existing feature keeps working in the new shell.

**Blocked by:** 08 Choose the UI library (ADR)

**Status:** ready-for-agent

- [ ] Every Slice 1 feature and tickets 01–04 work in the new shell (browser check against the reference house).
- [ ] Light and dark follow the OS by default and can be switched from the View menu.
- [ ] Switching the language switches the library's own texts too.
- [ ] The production build and the library builds still pass, and the initial bundle stays within its budget.
- [ ] All new UI text exists in English and Dutch.
