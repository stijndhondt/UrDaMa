# 09: Thickness, Presets and push

**What to build:** Measured Room sizes survive every change. A Wall's thickness can be overridden or reset to its Preset; a Presets panel edits the project Presets, and elements without an override follow them live. Changing a thickness (per Wall or via a Preset) runs **push**: everything beyond the Wall shifts by the difference, so Room sizes are kept; if that's impossible (e.g. a Wall connected on both sides), the command is refused with a reason. A Room can be resized by typing a new inside width or depth in its panel and choosing which side moves (default: away from the building's origin corner).

**Blocked by:** 08 Select, move, delete

**Status:** ready-for-agent

- [ ] **Re-typing the Keuken's inside width from 2.67 to 2.70 m gives 3.73 × 2.70 = 10.07 m², and every other Room keeps its size.**
- [ ] Changing the wall-thickness Preset updates every Wall that follows it and keeps all measured Room sizes.
- [ ] The panel shows "preset" vs "custom" and offers "reset to preset".
- [ ] An impossible push is refused with a reason and changes nothing.
- [ ] All new UI text exists in English and Dutch.
- [ ] `core` has no DOM or Angular UI imports (only `signal` / `computed` in the wrapper), enforced by lint.
