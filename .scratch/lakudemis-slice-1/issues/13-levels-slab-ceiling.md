# 13: Levels, Slab, build-up and Ceiling

**What to build:** More than one storey, and what's between them. Levels are **stacked**: only the lowest Level's elevation is stored, the others are derived from storey heights. Level tabs, "Add Level" above or below, and keys 1–9 switch Levels; the Level below shows faded as a tracing aid. Each Level has a Slab (outline from the outer faces, thickness from its Preset); each Room has a Floor build-up (thickness + Floor finish material, with Room height measured from its top) and a Ceiling at Room height; the Ceiling void is derived and shows as unknown without a Level above. A Ceiling running into the Slab above is a warning. Levels show Gross floor area and total Net floor area.

**Blocked by:** 09 Thickness, Presets and push

**Status:** ready-for-agent

- [ ] Changing the ground floor's storey height moves the Levels above.
- [ ] A synthetic second Level works end to end; editing one Level never recalculates the other (verified by the engine's recalculation log).
- [ ] The Ceiling-into-Slab warning appears when a Room height is too large, and never blocks editing.
- [ ] The Level below is visible, faded, while drawing.
- [ ] All new UI text exists in English and Dutch.
- [ ] `core` has no DOM or Angular UI imports (only `signal` / `computed` in the wrapper), enforced by lint.
