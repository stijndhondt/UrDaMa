# 06: Undo, redo and "what changed"

**What to build:** Mistakes are cheap and consequences are visible. Undo / redo (Ctrl+Z / Ctrl+Y) apply the commands' reverse / forward patches, keep the last 200 steps for the session, and show named steps ("Undo Draw room (Keuken)"). After every edit, the affected Rooms are highlighted with old → new values ("Keuken 9.96 → 10.09 m²"), computed by comparing Derived values before and after. A refused command leaves the model unchanged and shows its reason near the cursor and in a message bar until the next action.

**Blocked by:** 03 Draw one Room, see its area

**Status:** ready-for-agent

- [ ] Undoing every step of a drawing session returns to the empty project exactly; redo replays it exactly.
- [ ] The undo menu names each step; history is capped at 200 and cleared when another project opens.
- [ ] After an edit, changed Rooms are highlighted with old → new values; unchanged Rooms are not.
- [ ] A refused command changes nothing and shows its reason at the cursor and in the message bar.
- [ ] All new UI text exists in English and Dutch.
- [ ] `core` has no DOM or Angular UI imports (only `signal` / `computed` in the wrapper), enforced by lint.
