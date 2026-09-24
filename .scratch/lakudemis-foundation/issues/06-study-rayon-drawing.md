# Study how Rayon draws walls and detects rooms

Type: research
Status: resolved
Blocked by:
Parent: [Lakudemis foundation & Slice 1](../map.md)

## Question

How do Rayon (rayon.design) and comparable tools handle wall drawing and rooms? Comparable tools: Sweet Home 3D and Floorplanner, plus Revit and ArchiCAD for room detection. Cover:

- box-style wall drawing: first click, drag, which side the thickness goes, typed length and angle
- snapping to existing Walls
- wall joins
- automatic room detection
- room separation lines
- multiple Levels

Note what works well and the pain points users report. This feeds the box-drawing prototype and the room detection strategy.

Research: branch `research/rayon-drawing`, file `Docs/research/rayon-drawing.md`.

## Answer

- **Which side the thickness goes:** every serious tool lets the user flip the wall's position against the drawn line (left, centre or right) while drawing. Rayon uses `S`, Revit Spacebar, ArchiCAD `C`. Sweet Home 3D always centres the wall, and users complain that thick walls then shrink their rooms. → Lakudemis needs a side toggle while drawing.
- **Box drawing:**
  - Floorplanner is the closest to ours: press, drag and release a box, then click an inner dimension, type a size and choose which side moves.
  - ArchiCAD's type → Tab → Enter input is the smoothest way to enter values.
  - Sweet Home 3D measures a chained wall's angle from the previous wall and proposes 90°.
- **Room detection:**
  - Most tools create a Room by clicking inside walls; Floorplanner detects rooms automatically, and Revit has an opt-in automatic command.
  - The cheap method, from Sweet Home 3D's source: merge all wall outlines, and each hole in the result is a candidate room.
  - Live updates when walls move (Rayon, Revit, Floorplanner) are liked. Manual refresh (ArchiCAD, Sweet Home 3D) draws complaints.
- **Room separators:** every tool has one (Rayon Zone divider, Revit Room Separation Line, ArchiCAD Zone Boundary, Floorplanner invisible wall). Rayon also lets each door decide where a room stops across it.
- **Recurring pain points:**
  - walls that look closed but have gaps or corners that don't meet
  - overlapping walls
  - junk rooms from automatic detection
  - rooms going stale after walls move
- **Levels:** Rayon has none. Sweet Home 3D shows the level below faded as a tracing aid.
- **Suggestion from the note:**
  - store a seed point per Room and re-detect live from it
  - allow a small gap tolerance, and highlight outlines that are not closed
  - treat a Room separator as a room-bounding line with no thickness
- **Open:** Rayon's docs don't describe how walls join or how T-junctions work.

Findings: branch `research/rayon-drawing` (commit bed3522), `Docs/research/rayon-drawing.md`.
