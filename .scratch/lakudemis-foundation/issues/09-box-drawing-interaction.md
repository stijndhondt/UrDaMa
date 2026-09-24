# Box-drawing interaction

Type: prototype
Status: resolved
Blocked by: 06
Parent: [Lakudemis foundation & Slice 1](../map.md)

## Question

How should drawing a Wall feel? Click the first point, then drag: the drag sets the length and direction, and the thickness comes from the Preset. Open points:

- Which side of the drawn line does the thickness go on?
- How does snapping to earlier boxes work?
- How does typing the length and rotation (in degrees) work?

- How does the user get *exact* dimensions and clean adjacency? Rayon is finicky about wall measurements and placing adjacent Walls. Its drawing of the [reference house](../reference-house/reference-house.md) came out wrong in two rooms. A good test: can the user redraw the reference house ground floor from the tape measurements, with every Room coming out at its measured inside size?

Build a throwaway prototype to react to.

## Answer

Verdict from the user (2026-09-24): **two drawing tools. "Drag a room" (variant C) is the main way to draw Rooms; "drag a wall" (variant A) is for odd walls.** Variant B (click a chain) is dropped.

- **Room tool (C):**
  - The dragged rectangle is the Room's **inside size**, as measured by tape.
  - Walls are created around it with the Preset thickness, growing **outward** (S switches to outside size).
  - Starting a Room on the far face of an existing Wall **reuses that Wall** instead of doubling it; the new Walls get face (T) Wall connections to it.
  - Typed input: width, Tab, depth, Enter.
- **Wall tool (A):**
  - Press, drag, release: the drag sets length and direction, and the thickness comes from the Preset.
  - **S** cycles the thickness side (right / left / centre of the drag line).
  - Typing while dragging gives an exact length (m), Tab = angle (°), Enter = place.
  - Angle snaps to 15° (Shift = 45°).
  - **Click-then-type** (added by the user after the verdict): click the start point without dragging, type a length, and the length is **locked** while the mouse only rotates the Wall. Optionally Tab + angle, then Enter (or click) places it. Prototyped and confirmed working.
- **Both tools:**
  - Snapping to a Wall end or face creates a stored Wall connection (ADR 0001). The editor shows corner, face and **unconnected** ends distinctly.
  - Each face shows its length.
- **Confirmed by the smoke test:** Keuken 2.67 × 3.73 and Achterhal 2.67 × 3.94 came out at exactly the tape sizes (9.96 / 10.52 m²), sharing one Wall.

Open for [Slice 1 spec](13-slice-1-spec.md):

- The Room tool should place the Room's Seed point (ADR 0002).
- How are **L-shaped Rooms** (both halls) drawn? Two rectangles joined by removing the Wall between them, or the Room tool plus Wall-tool edits?
- **Partly shared Walls** (a new Room narrower or wider than the Wall it borders) were only handled crudely: reuse needs ≥ 90 % overlap.
- Not prototyped: push on thickness change, moving or selecting existing Walls, T/X joins beyond simple cases.

## Comments

- 2026-09-24: Prototype ready: `prototypes/box-drawing/box-drawing.prototype.html` on branch `prototype/box-drawing` (commit f1b3218). It is a single file; open it in a browser. Three variants, switchable with `?variant=A|B|C`, the bottom bar, or ← / →:
  - **A: Drag a wall.** Press, drag, release.
  - **B: Click a chain.** Click at each corner; it prefers 90° turns relative to the previous wall.
  - **C: Drag a room.** The rectangle is the tape inside size, and walls grow outward; a shared wall is reused.
  - **All variants:** S toggles the thickness side; typed length/angle (or width/depth); snapping creates stored Wall connections (corner / face).
  - **Smoke-tested:** in C, Keuken 2.67 × 3.73 and Achterhal 2.67 × 3.94 come out at exactly those inside sizes, sharing one wall. Waiting for the user's verdict.
- 2026-09-24: Added click-then-type to the Wall tool on the user's request (branch `prototype/box-drawing`, second commit).
