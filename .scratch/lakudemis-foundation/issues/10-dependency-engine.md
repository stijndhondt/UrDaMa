# Dependency and recalculation engine

Type: grilling
Status: resolved
Blocked by: 07
Parent: [Lakudemis foundation & Slice 1](../map.md)

## Question

How does Lakudemis track what depends on what (Wall → Room outline → Room area → Floor finish quantity), and recalculate only what a change affects?

Options include:

- a reactive signal graph
- an explicit dependency graph with invalidation
- recomputing everything after each change

Weigh them on running outside the UI, determinism and testability.

## Answer

Settled with the user on 2026-09-24. ADR: [0003 Derived values are lazy, cached and track their own dependencies](../../../Docs/adr/0003-lazy-self-tracking-derived-values.md). Terms **Source data** and **Derived value** are in `CONTEXT.md`.

1. **Mechanism:** lazy, cached Derived values that record what they read, automatically. A change marks everything downstream stale, and a stale value is recalculated only when something reads it. No events, no hand-declared dependencies, no recompute-everything.
2. **Names:** every Derived value has a readable name, e.g. "Keuken · Net floor area".
3. **Consequences in v1:**
   - After each edit, the affected Rooms are highlighted, with old → new values ("Keuken 9.96 → 10.09 m²").
   - A "what depends on this?" inspector is fog. The prototype showed consequences must come from comparing values before and after, not from walking the graph.
4. **Granularity:** per element for simple values (joined Wall outline, Opening area); per Level for topology (merged footprint, Room pieces). An edit never recomputes other Levels.
5. **2D vs 3D:**
   - 2D is synchronous and always exact after every command.
   - 3D meshes (manifold-3d in a Web Worker) are eventually consistent and may briefly show the previous shape. Nothing waits for them, and no calculation depends on them.
6. **Warnings** ("not enclosed", "sharing one area", unconnected ends, a Ceiling running into the Slab above) are Derived values, never stored.
7. **Dragging:**
   - A drag is a temporary, uncommitted change with live recalculation. Esc throws it away; release commits one command.
   - Target: < 16 ms of 2D recalculation per edit on ~200 Walls. Benchmark it in [Stack, licence and repository layout](12-stack-licence-repo-layout.md).
8. **Core vs UI:** ~~the engine lives in the plain TypeScript core; a thin Angular adapter turns "these named values changed" into signals.~~ **Superseded (2026-09-24):** the engine *is* Angular signals, used inside `core` behind a `source()` / `derived()` wrapper, with no DOM or UI (ADR 0003 amended; decided in [Stack, licence and repository layout](12-stack-licence-repo-layout.md)). Tests still run with no UI.
9. **Determinism:** sorted-ID iteration, no time, randomness or hidden state, and a fixed order of floating-point steps. Fixture tests (the reference house) compare exactly, within 0.01 mm.

Editor decision made during this session (drag increments) is recorded on [Box-drawing interaction](09-box-drawing-interaction.md).
