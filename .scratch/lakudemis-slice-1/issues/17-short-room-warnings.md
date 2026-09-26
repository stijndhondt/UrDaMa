# 17: Short Room warnings on the plan show a raw key

**Found by:** 15 Slice 1 acceptance run (Dutch UI audit)

**What to build:** The Room label on the plan shows why a Room has no area ("not enclosed", "sharing one area"). It asks for `warnings.notEnclosed.short` and `warnings.sharingArea.short`, which don't exist (those keys are full sentences, not groups), so the canvas shows the raw key in both languages. Add the short texts under their own keys and use them.

**Blocked by:** none

**Status:** ready-for-agent

- [x] A Room that is not enclosed shows "not enclosed" / "niet afgesloten" on the plan.
- [x] Rooms sharing an area show "shares an area" / "deelt een ruimte".
- [x] Every translation key used in code exists in English and Dutch (`scripts/check-i18n.mjs`, run first by `pnpm test`).
