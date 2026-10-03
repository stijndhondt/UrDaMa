# 26: Lining up Rooms and Walls: outer-corner rule, alignment guides, snap toggle

**What to build:** Three aids so Rooms drawn side by side line up without zooming in.

- **Outer-corner rule (Room tool, inside size).** A Room started on the outer corner of an existing Wall takes its meaning from the drag direction:
  - drawn along a Wall it shares (from Room 1's bottom-left outer corner: right and down shares Room 1's bottom Wall; up and left shares its left Wall), it shares that Wall and its inside starts one Wall thickness in, so its outer faces run flush with the existing ones;
  - drawn diagonally away (down and left), the point is taken literally and the corner is solid (ticket 25).
  
  At outside size (S) the outer corner is the new Room's own outer corner, taken literally. There is no modifier key for this.
- **Alignment guides.** While drawing with the Room, Wall and Room separator tools, the moving point snaps to the extension lines of nearby Wall faces and corners (12 px on screen, like the other snaps), shown with a dashed guide line.
- **Snap toggle.** One switch for all snapping (corners, faces, alignment guides, 100 mm steps), on by default: a magnet button at the end of the plan toolbar (Optimus), shortcut **G** (M merges Rooms), remembered per browser. Holding **Alt** inverts it for a one-off free point.

**Blocked by:** 25

**Status:** done

- [x] From Room 1's bottom-left outer corner, a Room drawn right and down shares Room 1's bottom Wall with its left outer face flush with Room 1's (store or editor test); drawn up and left it shares Room 1's left Wall with its bottom outer face flush; drawn down and left it starts at the corner itself.
- [x] The far corner of a dragged Room snaps to the extension of another Wall's outer face within 12 px, with a dashed guide (editor test).
- [x] The Wall and Room separator tools snap to alignment guides as well.
- [x] The magnet toggle and G switch all snapping off and on, remembered per browser; Alt inverts it while held.
- [x] All new UI text exists in English and Dutch; checked in the browser.

## Comments

**2026-10-03, built:** `outerCornerStart` (Room tool) applies the outer-corner rule to a start point snapped to a Wall outline corner at inside size: probes 1 mm around the corner tell which Wall the drag runs along and that the corner is an outer one, and the start moves in by the wall-thickness Preset on that axis; diagonally away, or from an inside corner, it stays. `alignToCorners` / `alignOrRound` (snap.ts) line a free point up with the vertical and horizontal lines through Wall outline corners within the 12 px radius, each axis on its own, else round to the drag increment; the Room and Room separator tools use them after the corner and face snaps, and the Wall tool lines up a level or plumb Wall's end along its own direction (so a guide never bends it). Guides are drawn dashed. The snap toggle (`SnapService`, remembered per browser) is a magnet toggle at the end of the plan toolbar; with it off, or Alt held, the point is where the pointer is. **The shortcut is G, not M:** M already merges Rooms. Editor tests for the rule (all four directions and an inside corner) and the guides; checked in the browser (flush Room above Room 1, guide during a drag, G).
