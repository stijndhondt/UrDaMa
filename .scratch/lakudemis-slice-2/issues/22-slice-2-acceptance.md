# 22: Slice 2 acceptance run

**What to build:** Prove Slice 2 is done: check every user story of the spec in the browser, on the reference house and a synthetic two-Level L-shaped house, in English and Dutch, light and dark. Anything that fails becomes a follow-up ticket rather than being fixed silently here.

**Blocked by:** 01–21 (all other Slice 2 tickets)

**Status:** done (run 2026-10-03; gaps → 28–33)

- [x] Every user story of the spec is checked and recorded here.
- [x] The reference house figures (tape areas, Keuken 10.07 m² after 2.70 m) still hold.
- [ ] Speed: < 16 ms of 2D recalculation per edit on a ~200-Wall plan still holds. (Not confirmable during the run: the machine was busy → 33.)
- [x] Follow-up tickets exist for every gap.

## How it was run

In the app (dev build, a separate dev server on port 4300, so no real working copy or library was touched), on two houses made with the app's own commands and loaded into the store: the **reference house** ground floor at its tape sizes (7 Rooms, 23 Walls, a door and two windows), and a **synthetic two-Level L-shaped house** (Living + Garage below, two bedrooms above; a door, windows, a wall opening and a garage door). Driven by real clicks, double-clicks, right-clicks and typing where the story is about the UI; values read back from the store and the panels. English and Dutch, dark and light; 1600 × 900 for the multi-panel layouts.

## Results

**Reference house: pass.** Tape areas on load: Keuken 9.96, Badkamer 5.63, Berging 5.84, Eetkamer 9.46, Living 11.09, WC 1.12 m² (Achterhal 9.08). Double-click on the Keuken's top Wall label, 2.70, Enter (Move Room, to the right): Keuken 10.07 m², every other Room unchanged, "Keuken 9.96 m² → 10.07 m²" shown.

**Speed: not confirmed → 33.** A game kept about 4 CPU cores busy during the run; the benchmark measured median 18–31 ms, p95 26–44 ms on 220 Walls (it passed under 25 ms in the commit hooks earlier the same day).

**User stories** (pass unless noted; "store test" / "ticket NN" where the story was also proven there):

- **Typing a Wall's length (1–12): pass, one gap.** 1, 2 panel and double-click label editor (ticket 23); 3–5 direction choices left / both / right, up / both / down, start / both / end (editor2d `wall-length.spec.ts`); 6 Move Room is the default; 7 "Move only this Wall" applied; 8 other Rooms keep their size; 9 a 10 mm length is refused with "a Wall must be at least 50 mm long" near the editor, but "0" or text is silently ignored → **28**; 10 old → new shown; 11 one undo step (undo 9.96, redo 10.07); 12 "2.70" read as metres.
- **Rooms in empty areas (13–18): pass.** Deleting the Living left a hatched "no Room" area with "+ Room"; clicking it with the Separator tool active made "Room 7", selected; right-click → "Create Room here"; a window's menu offers hinge F, swing Shift+F, Delete Del; the Edit menu has Merge (M).
- **Workspace (19–39): pass, gaps.** 19–21 tickets 05–08; 22–25 Building panel tree, eye hides the Level in plan, Elevations and 3D, click selects, Level below added, renamed, deleted (gaps: header wraps with a scrollbar → **30**; the eye's tooltip omits the Elevations → **31**; delete asks with the browser's `window.confirm` → **32**); 26 Library panel (ticket 21); 27 all five layouts, 2×2 shows Plan, two Elevations and 3D (the plan isn't refitted → **30**); 28 dragging a divider 60/40 → 70/30; 29 each Elevation its own side; 30, 31 floating toolbar, flyout lists the four types; 32 sections not collapsible, long Measurement rule overlaps its label → **29**; 33 Presets, Measurement rule and Level when nothing is selected; 34 bottom panel with Quantities and Warnings; 35 status bar hint, "m · mm", zoom; 36 File / Edit / View with shortcuts, undo/redo, layout picker; 37 system / light / dark; 38 the Dutch UI has no English text left (all texts, tooltips and labels scanned), numbers with a decimal comma, also when switching language live; 39 every icon-only button has a name (the Opening types dialog's × has none → **31**).
- **Quantities per surface (40–49): pass.** Per Level → Room → floor, finish, ceiling, Wall faces with length, height, gross, openings, net, reveals; Exterior Front / Back / Left / Right Façades; the L-house's Front Façade splits into 2 parts and per Level (18.43 m² each); a Wall face row selects its Wall; the Measurement rule chooser covers the Façades (`report/facades.spec.ts`); the CSV has the same tree (Level, Room or Façade, surface; checked on the exported text).
- **Elevations (50–58): pass.** Front shows the garage door, windows and wall opening at their heights, Level lines with +2.94 m, total height; a second panel the left side; clicking an Opening selects it everywhere and highlights it; a storey height 3.50 m moved the First floor to +3.50 at once; a hidden Level is hidden in the Elevations.
- **Opening families, types and Openings (59–78): pass, one gap.** 59, 60 all four kinds placed, a wall opening without parts; 61–66, 68 the family editor (ticket 20, checked in the browser); 67 type named "Front door" in the Types dialog; 69 "All 2" offered (store test, ticket 18); 70, 71 a second door of the type at 1000 mm, "Only this one" → new type "Front door (2)"; 72 each door keeps its offset, hinge and swing; 73, 78 Library (ticket 21); 74 the file keeps every family and type (`file/project-file.spec.ts`); 75 Slice 1 files migrate (ticket 16); 76 the garage door (5.10 m²) and wall opening subtracted, with reveals; 77 the Door tool slides along the Wall with both distances. The Opening title gives cm where the rest gives m → **31**.

## Follow-up tickets

- 28 Length editor says why a typed length is not taken
- 29 Properties panel: collapsible sections and long values
- 30 Workspace layout polish
- 31 Consistent Opening sizes and labels
- 32 Deleting a Level asks in an app dialog
- 33 Confirm edit speed on a quiet machine
