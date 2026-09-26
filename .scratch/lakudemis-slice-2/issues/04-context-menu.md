# 04: Right-click context menu on the plan

**What to build:** Right-clicking the plan opens one context menu built from the element under the cursor and the current selection. It offers the matching actions, each with its shortcut: Create Room here (empty area), Delete, Merge Rooms (two Rooms selected), Flip door (hinge side, swing), Reset to Preset. It is built in the current UI now and restyled by the workspace shell later.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] Right-clicking an empty enclosed area offers "Create Room here", which creates the Room.
- [ ] Right-clicking a Wall, Room, Room separator or Opening selects it and offers the actions that apply to it, with their shortcuts.
- [ ] With two Rooms selected, the menu offers Merge Rooms.
- [ ] Every action is the same command as its button or shortcut (one undo step each); refusals show their reason.
- [ ] All new UI text exists in English and Dutch.
