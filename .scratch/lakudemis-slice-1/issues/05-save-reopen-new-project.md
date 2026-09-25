# 05: Save, reopen, new project

**What to build:** The user owns their work. A new-project dialog asks for a name, the wall-thickness Preset (140 mm) and the Room-height Preset (2600 mm), and opens one Level, "Ground floor", at elevation 0. Every command autosaves the working copy to IndexedDB, restored on reload. Save writes a `.lakudemis.json` file (back to the same file via the File System Access API), and Open imports one. The file follows ADR 0004: flat collections sorted by ID, prefixed IDs, fixed key order, lengths rounded to 0.001 mm, no values for properties that follow a Preset, `schemaVersion` 1 with the migration harness in place. The title bar shows unsaved changes.

**Blocked by:** 03 Draw one Room, see its area

**Status:** done

- [x] Save → open → save produces a **byte-identical** file.
- [x] Reloading the page restores the working copy exactly.
- [x] The file holds Source data only; no Derived values.
- [x] A file with a higher `schemaVersion` is refused with a clear message; the migration chain has a tested (no-op) v1 step.
- [x] The unsaved-changes marker appears after an edit and clears after saving.
- [x] All new UI text exists in English and Dutch.
- [x] `core` has no DOM or Angular UI imports (only `signal` / `computed` in the wrapper), enforced by lint.
