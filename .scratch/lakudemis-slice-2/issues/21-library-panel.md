# 21: Library panel

**What to build:** A Library panel opened from the left icon bar shows the personal library (stored in the browser) and this project's Opening families and types. A family and its types can be imported into the project (copied, so the project stays self-contained) or saved from the project to the library. A type can be dragged from the panel onto a Wall to place it.

**Blocked by:** 18 Opening types and "only this one"

**Status:** done

- [x] Importing a family and its types into a project keeps all references consistent (store test).
- [x] The personal library survives a reload and is available in every project on that browser.
- [x] Dragging a type onto a Wall places an Opening of that type.
- [x] All new UI text exists in English and Dutch.

## Comments

**2026-10-03, built:** a Library button in the left icon bar opens the Library panel in place of the Building panel. "In this project" lists the project's Opening families with their types; "Save to library" keeps a copy in this browser (`lakudemis.library`, shared by every project there and by other tabs; an unnamed built-in family is kept under its kind's name, and saving again replaces the entry). "My library" lists the saved families; "Import" copies one into the project with new IDs as one undo step (`importOpeningFamily`), taking a free name ("Window (2)") when the project already shows that name; a damaged entry is refused. A project type is dragged onto a Wall: the Opening tool of its kind follows the pointer along the Wall and the drop places it; afterwards (or when the drag leaves the plan) the earlier tool is back. Store tests: import keeps every reference consistent with one undo step, free names, refusals, the save/import round trip. "Library" is in CONTEXT.md. Checked in the browser: save, reload, import, drag-placing.

Known limits: library types are imported before they can be dragged (only the project's types drag). A built-in family saved from a Dutch session keeps its Dutch kind name in the library.
