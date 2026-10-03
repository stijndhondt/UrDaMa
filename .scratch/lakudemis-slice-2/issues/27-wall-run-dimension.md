# 27: Overall length of a Wall run on the plan

**What to build:** The plan shows the overall outside length of each Wall run (CONTEXT.md: two or more Walls whose faces continue one another in a straight line), as one extra dimension line further out than the per-Wall dimensions. Example: Room 1 (4.28 m outside) and Room 2 (2.60 m) one behind the other give a left-side run of 6.88 m.

- Outside faces only, runs of two or more Walls, one Level at a time.
- A run continues across Openings, but stops at a step in the outside line (the reference house's 20 mm steps) and at a Wall whose outside face is not in line (another thickness).
- It shows only; it can't be clicked to edit (editing an overall length would have to spread over several Walls, a separate feature).

**Blocked by:** none

**Status:** done

- [x] Two Rooms one behind the other give one run per straight side with its overall outside length (store test of the derived runs).
- [x] A step in the outside line splits a run; a single Wall gets no run dimension (store test).
- [x] The run dimension is drawn outside the per-Wall dimensions, readable at the usual zoom levels; checked in the browser (dark).

## Comments

**2026-10-03, built:** `wallRuns` (core/geometry/wall-runs.ts) chains a Level's outside Wall face segments that look the same way, lie in one line within 0.5 mm and touch end to end; a chain over two or more Walls is a Wall run, a Derived value per Level (`wallRuns`). The plan draws each run's overall length as a dimension line 28 px outside the faces, with extension lines and ticks, past the per-Wall lengths; it only shows. Store tests: two Rooms one behind the other give a left and a right run of 6.71 m; a 30 cm step ends the right run; an Opening doesn't break a run. Checked in the browser in dark mode (the user's plan: 6.74 m and 6.88 m); it draws in the theme's colours like the per-Wall lengths, light mode not separately checked.

**2026-10-03, after review:** runs are made of the Walls' long faces only; a free Wall end is never part of one.
