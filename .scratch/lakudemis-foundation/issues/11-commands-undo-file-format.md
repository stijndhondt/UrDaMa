# Commands, undo/redo and project file format

Type: grilling
Status: resolved
Blocked by: 07
Parent: [Lakudemis foundation & Slice 1](../map.md)

## Question

- What does the command and transaction model look like (AddWall, MoveWall, …, grouped operations)?
- How does undo/redo work on top of it?
- What is the JSON project file format? It needs a schema version, stable IDs, deterministic ordering and migrations, and stores no derived data.
- How does the automatic browser save relate to the project file?

## Answer

Settled with the user on 2026-09-24. ADR: [0004 The project file is flat, sorted collections with ID references](../../../Docs/adr/0004-flat-project-file.md).

### Commands and undo

1. **Commands are pure functions** from the current Source data to a changed version. The core records a **forward and a reverse patch**. Undo and redo apply the patches, with no hand-written undo code. The same patch tells the dependency engine which elements changed (ADR 0003).
2. **One user action = one command = one undo step**, however many elements it touches:
   - `DrawRoom` covers up to 4 Walls + Wall connections + the Seed point.
   - A drag is one step, committed on release.
   - A committed property field is one step.
   - A thickness change with its push is one step.
   - Commands have domain names (`DrawRoom`, `DrawWall`, `MoveWall`, `SetWallThickness`, `DeleteWall`, `AddOpening`, `SetPreset` …), and the undo menu shows e.g. "Undo Draw room (Keuken)".
3. **All or nothing.** A command either fully succeeds or changes nothing and returns a reason. **Invariants** are checked at the end of every command, and a command that would break one is refused:
   - every reference exists
   - at most one corner connection per Wall end
   - no overlapping Walls
   - lengths > 0
4. **Deleting a Wall:**
   - deletes its Openings, the Wall connections involving it, and Room separators attached to it
   - neighbouring ends become open (red)
   - Rooms and their Seed points stay, possibly flagged "not enclosed" / "sharing one area"; they are never deleted silently
5. **Undo history** lives in memory for the session, **capped at the last 200 steps** (adjustable later), and is cleared when another project is opened. It is never written to the file or the working copy. Named versions are fog.

### Project file

6. **Layout:** flat, sorted collections per element kind with ID references (ADR 0004). A header carries `format`, `schemaVersion` and `units`, and `project` holds the name and Presets.
7. **Deterministic:**
   - keys in a fixed order
   - lengths rounded to 0.001 mm
   - no value written for properties that follow a Preset
   - 2-space indentation, trailing newline
   - IDs with a kind prefix (`wal_`, `rom_`, `lvl_`) + a random, time-sortable part
   - → byte-identical output for the same model
8. **Migrations:**
   - `schemaVersion` is a whole number.
   - The chain is pure v(n)→v(n+1) functions, tested with a fixture file from every past version.
   - Older files are migrated in memory on open, and saving writes the latest version.
   - Files from a newer app version are refused with a clear message.
9. **Saving:**
   - The **working copy** is in IndexedDB, saved automatically after every command and restored on reopen.
   - The **project file** (`.lakudemis.json`) is written when the user saves: back to the same file via the File System Access API where available, otherwise a download. Opening a file imports it into a working copy.
   - The title bar shows unsaved changes.
   - Both hold the same format.
