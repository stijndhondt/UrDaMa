# 32: Deleting a Level asks in an app dialog

**What to build:** "Delete Level" asks for confirmation with the browser's own `window.confirm`: not an Optimus control (ADR 0008), its buttons in the browser's language rather than the app's, and unlike every other dialog in the app. Ask with an Optimus confirmation dialog, in the app's language, naming the Level and what goes with it (its Rooms, Walls and Openings).

**Blocked by:** none

**Status:** needs-triage

- [ ] Deleting a Level asks in an Optimus dialog, in English or Dutch as the app is.
- [ ] Cancel leaves the model unchanged; confirming is one undo step.

## Comments

**2026-10-03:** found in the Slice 2 acceptance run (ticket 22, story 25).
