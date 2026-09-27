# 01: Type a Wall's length in the properties panel

**What to build:** A homeowner selects a Wall and types a new length in its properties panel. They choose a direction (shown as left / right / symmetric for a horizontal Wall, up / down / symmetric for a vertical one, start / end / symmetric for a diagonal one) and a mode: **Move Room** (default: the Wall at the moving end shifts along and keeps its angle, so the Room grows or shrinks and every other measured length stays exact) or **Move only this Wall** (the connected Wall's end goes along and that Wall tilts). The change is one command and one undo step, the changed Rooms are highlighted with old → new values, and an impossible change is refused with a reason.

**Blocked by:** None (can start immediately)

**Status:** done

- [x] The Keuken's top Wall 2.67 → 2.70 m, Move Room, to the right: the Keuken is 10.07 m² and every other Room keeps its area (store test).
- [x] Symmetric moves both ends by half the difference; Move only this Wall tilts the connected Wall and leaves the opposite Wall in place (store tests).
- [x] A change that is impossible is refused with a reason and leaves the model unchanged (store tests): too short, unchanged, Only this Wall at a T end, and Move Room when the Wall at that end would have to stretch at an angle (the reason points to Only this Wall).
- [x] The change is one undo step and highlights the changed Rooms with old → new values.
- [x] The panel shows the length field, the direction choice labelled by the Wall's orientation, and the mode choice; typed values follow the units rule.
- [x] All new UI text exists in English and Dutch.

## Comments

**2026-09-27, code review:** Move Room pushes the Wall at the moving end and everything beyond it, exactly as re-typing a Room's size does, so a Wall "held on its other side" is pushed along rather than refused; the only Move Room refusal is a Wall that would have to stretch at an angle (typically around a diagonal Wall), and its reason now says to use Only this Wall. Known limit: the plan label edits a face's length and changes the Baseline by the same amount, which is exact for Move Room; with Only this Wall the tilting partner can leave the face a few mm off.
