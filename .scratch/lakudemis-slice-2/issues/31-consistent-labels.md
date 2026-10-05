# 31: Consistent Opening sizes and labels

**What to build:** Small text and label gaps from the acceptance run:

- An Opening's title in the properties panel gives its size in cm ("Window 120 × 120", "Wall opening 90 × 211"), while the Type list, the Building panel and the toolbar flyout give metres ("1.20 × 1.20 m"). Use one way everywhere.
- The Level visibility button's tooltip says "Show this Level in the plan and 3D"; hiding a Level also hides it in the Elevations.
- The Opening types dialog's close (×) button has no accessible name.

**Blocked by:** none

**Status:** done

- [x] Opening sizes read the same in the title, the Type list, the Building panel and the flyout.
- [x] The visibility tooltip names the Elevations, in English and Dutch.
- [x] Every dialog's close button has a translated accessible name.

## Comments

**2026-10-03:** found in the Slice 2 acceptance run (ticket 22, stories 23, 38, 39, 67).

**2026-10-05:** done. An unnamed type's title uses the same size text as the Type list, the Building panel and the flyout (metres). The visibility tooltips name the Elevations. All four dialogs (add Level, delete Level, new project, Opening types) give their close button the translated "Close".
