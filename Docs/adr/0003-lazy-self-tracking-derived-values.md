---
status: accepted (amended 2026-09-24: engine = Angular signals)
---

# Derived values are lazy, cached and track their own dependencies

Every Derived value (a joined Wall outline, a Level's merged footprint, a Room outline, an area, a warning) is a named, cached computation in `core`. It records automatically which Source data and other Derived values it reads. A change marks everything downstream as stale, and a stale value is recalculated only when something reads it, much like a spreadsheet. We chose this because it recalculates only what a change affects, and it makes consequences showable ("Keuken Net floor area 9.96 → 10.09 m²"), a first step towards "every consequence understood".

**The engine is Angular signals** (`signal()` and `computed()` from `@angular/core`), used inside `core` behind a thin wrapper, `source(name, value)` and `derived(name, fn)`. The rest of `core` never imports Angular directly.

## Amendment (2026-09-24)

This ADR first rejected Angular signals because they would tie the core to the UI framework, and planned our own engine instead. The dependency-engine prototype (branch `prototype/dependency-engine`) reversed that:

- **They run without a browser.** `signal()` and `computed()` work in plain Node (tested with `@angular/core` 22.2.0, `typeof document === 'undefined'`), so `core` stays free of DOM and UI.
- **Angular stays anyway.** The desktop app will be Electron, which keeps Angular, so tying `core` to Angular costs little (the user's argument).
- **Same results, better behaviour.** Angular gave identical results to our own engine and is lazy. It also stops passing a change along when a recalculated value comes out equal (104 vs 152 recalculations for one Wall move). Deleted elements are garbage-collected, whereas our engine needed manual unlinking. Both run far under the 16 ms target: engine overhead is well below 1 ms per edit on 224 Walls.
- **Graph walking isn't needed.** With per-Level granularity, every Room on a Level depends on every Wall, so walking the dependency graph can't explain a single edit. Consequences are therefore shown by **comparing Derived values before and after a command**, which needs no access to Angular's internal graph.

## Considered Options

- **Recompute everything after every change.** Simplest, and fast enough for a house, but it can never say what a change affected.
- **Events and callbacks** (elements notify listeners). This is the "giant collection of UI callbacks" `Docs/idea.md` warns against: ordering bugs, missed updates.
- **Our own small engine.** Prototyped and working, but it would have to re-implement "stop when the value is unchanged" and clean-up of deleted nodes. Its one advantage, an inspectable graph, turned out not to answer the real question.

## Consequences

- `core` may import only `signal` and `computed` from `@angular/core`, and only inside the wrapper module. No `effect`, no dependency injection, no DOM, no other Angular packages; ESLint enforces this.
- `@angular/core/primitives/signals` (semi-internal) may be used for developer tooling only, never for behaviour.
- Dependencies are recorded as values are read, never declared by hand, so they can't drift out of date.
- The granularity is per element for simple values and per Level for topology (merged footprint, Rooms).
- 2D values are synchronous and always exact after each command. 3D meshes (manifold-3d in a worker) sit outside this guarantee and may briefly lag.
- Derivations must be deterministic: sorted-ID iteration, and no time, randomness or hidden state.
- Angular major upgrades now touch `core` as well. The wrapper keeps that to one file.
