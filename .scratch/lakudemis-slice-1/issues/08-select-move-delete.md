# 08: Select, move, delete

**What to build:** The user can change what they drew. Clicking a Wall's body selects the Wall; clicking inside a Room selects the Room (V / Esc = select tool). Dragging a Wall moves it: connected Walls follow and Seed points are carried along. Delete removes the selection with the decided cascade: a Wall's Openings, its Wall connections and attached Room separators go; neighbouring ends turn red; Rooms stay and may be flagged. Basic properties panels show and edit a Wall (thickness shown, room-bounding yes/no) and a Room (name, Room height).

**Blocked by:** 07 Wall tool

**Status:** ready-for-agent

- [ ] Click priority works as described; the selection is visible on the plan and in the panel.
- [ ] Dragging a Wall keeps its connected Walls attached, and the Rooms update live while dragging (a temporary change: Esc cancels, release commits one undo step).
- [ ] Deleting a Wall never deletes a Room silently.
- [ ] Renaming a Room and changing its Room height are single undo steps.
- [ ] All new UI text exists in English and Dutch.
- [ ] `core` has no DOM or Angular UI imports (only `signal` / `computed` in the wrapper), enforced by lint.
