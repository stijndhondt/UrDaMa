# 15: Slice 1 acceptance run

**What to build:** Prove Slice 1 is done, against the spec's acceptance criteria. Redraw the reference-house ground floor by hand in the app from the tape measurements, check speed and smoothness, audit the Dutch UI and CSV, and tick off every criterion. Anything that fails becomes a follow-up ticket rather than being fixed silently here.

**Blocked by:** 05 Save, reopen, new project, 06 Undo, redo and "what changed", 12 Surfaces and Quantities, 13 Levels, Slab, build-up and Ceiling, 14 3D view

**Status:** ready-for-agent

- [ ] Manual redraw of the reference house gives the tape areas for every rectangular Room.
- [ ] < 16 ms of 2D recalculation per edit (including Clipper2) on the reference house and a ~200-Wall plan; a steady 60 fps while dragging, in Chrome / Edge.
- [ ] Byte-identical save round trip; undo back to the empty project; working copy survives a reload.
- [ ] Dutch UI complete; Dutch numbers use a decimal comma, including the CSV.
- [ ] Every acceptance criterion in the spec is checked and recorded here, with follow-up tickets for any gaps.
