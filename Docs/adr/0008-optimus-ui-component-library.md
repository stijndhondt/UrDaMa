# Optimus UI is the component library, with Iconify icons

The workspace (the Workbench layout of slice 2) is built with **Optimus UI**, the MIT-licensed community fork of PrimeNG v21 (`@openng/optimus-ui`, Aura theme). We chose it after building the same slice twice against the real app, once with Taiga UI and once with Optimus UI (tickets 06 and 07, branches `prototype/optimus-ui` and the deleted `prototype/taiga-ui`). Optimus's flow felt better, and it has the desktop-style pieces this app needs out of the box: menubar, splitter with draggable dividers, tree table, context menu that opens from our own event, locale-aware number fields and dynamic dialogs. Tooltips and dynamic dialogs work without Zone.js. Taiga UI felt cramped in a narrow properties panel and lacks a splitter, a menubar and a tree table.

Icons come from **Iconify**: one main set, with icons from other sets only where their visual style matches (stroke width, corner style), bundled at build time so the app works offline and never calls the Iconify API. Optimus's own icon set (`@openng/icons`, about 300 old PrimeIcons) is used only where Optimus needs it internally.

## Considered Options

- **Taiga UI 5** (tickets 06): company-maintained and releasing often, a smaller bundle (+101 kB against +176 kB compressed), and Dutch built in. But dense layouts fought back, there is no splitter, menubar or tree table, and opening its context menu from our editor needed a workaround.
- **PrimeNG v22+**: the original, but no longer open source (commercial licence from v22, June 2026); it does not fit AGPL (ADR 0006).
- **Hand-made components** (Slice 1): no dependency, but every menu, tree, splitter and dialog would be ours to build and keep accessible.

## Consequences

- The fork is young (2.0.2, August 2026) with a small team. If it stalls, the escape route is its PrimeNG v21 API: code written against it stays close to PrimeNG and other forks.
- Labels given to Optimus as data (menus, options, tree nodes) are translated in code and rebuilt when a language's texts have loaded; Optimus's own texts come from the `primelocale` package through `Optimus.setTranslation`.
- Optimus's default density is roomy; the properties panel gets its own design (ticket 24) rather than stacked default fields.
- The initial bundle budget goes up to 1.3 MB (warning) and 1.6 MB (error): the workspace (ticket 09) takes the production build from 530 kB to 1.20 MB raw, 140 to 264 kB transferred.
