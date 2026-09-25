# 03: Draw one Room, see its area

**What to build:** The thinnest end-to-end thread. With the Room tool (R) the user drags a rectangle, or types width, Tab, depth, Enter, as the Room's **inside size**; S switches to outside size. The `DrawRoom` command creates four Walls (Preset thickness, growing outward) with corner Wall connections and a Seed point at the rectangle's centre. The Room is detected from the merged footprint, and its name and Net floor area appear on the Canvas2D plan, which supports pan and zoom. This ticket introduces the `source()` / `derived()` wrapper over Angular signals, Source data vs Derived values, commands as pure functions producing patches, and the first invariants.

**Blocked by:** 02 Geometry benchmark

**Status:** done

- [x] Dragging or typing 3.73 × 2.67 m gives a Room labelled 9.96 m²; the Walls grow outward with the Preset thickness.
- [x] S toggles inside / outside size while drawing; typed values are exact.
- [x] Pan (middle-drag or Space+drag) and zoom (wheel) work; the plan draws only what is on screen.
- [x] Derived values are lazy and named (e.g. "Room 1 · Net floor area"); nothing is recalculated until read.
- [x] `DrawRoom` is one command that returns a forward and a reverse patch; invariants (references exist, lengths > 0) are checked at its end.
- [x] All new UI text exists in English and Dutch.
- [x] `core` has no DOM or Angular UI imports (only `signal` / `computed` in the wrapper), enforced by lint.
