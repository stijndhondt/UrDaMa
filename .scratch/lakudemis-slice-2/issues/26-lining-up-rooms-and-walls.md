# 26: Lining up Rooms and Walls: outer-corner rule, alignment guides, snap toggle

**What to build:** Three aids so Rooms drawn side by side line up without zooming in.

- **Outer-corner rule (Room tool, inside size).** A Room started on the outer corner of an existing Wall takes its meaning from the drag direction:
  - drawn along a Wall it shares (from Room 1's bottom-left outer corner: right and down shares Room 1's bottom Wall; up and left shares its left Wall), it shares that Wall and its inside starts one Wall thickness in, so its outer faces run flush with the existing ones;
  - drawn diagonally away (down and left), the point is taken literally and the corner is solid (ticket 25).
  
  At outside size (S) the outer corner is the new Room's own outer corner, taken literally. There is no modifier key for this.
- **Alignment guides.** While drawing with the Room, Wall and Room separator tools, the moving point snaps to the extension lines of nearby Wall faces and corners (12 px on screen, like the other snaps), shown with a dashed guide line.
- **Snap toggle.** One switch for all snapping (corners, faces, alignment guides, 100 mm steps), on by default: a magnet button at the end of the plan toolbar (Optimus), shortcut **M**, remembered per browser. Holding **Alt** inverts it for a one-off free point.

**Blocked by:** 25

**Status:** ready-for-agent

- [ ] From Room 1's bottom-left outer corner, a Room drawn right and down shares Room 1's bottom Wall with its left outer face flush with Room 1's (store or editor test); drawn up and left it shares Room 1's left Wall with its bottom outer face flush; drawn down and left it starts at the corner itself.
- [ ] The far corner of a dragged Room snaps to the extension of another Wall's outer face within 12 px, with a dashed guide (editor test).
- [ ] The Wall and Room separator tools snap to alignment guides as well.
- [ ] The magnet toggle and M switch all snapping off and on, remembered per browser; Alt inverts it while held.
- [ ] All new UI text exists in English and Dutch; checked in the browser.
