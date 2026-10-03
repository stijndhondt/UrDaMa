# 27: Overall length of a Wall run on the plan

**What to build:** The plan shows the overall outside length of each Wall run (CONTEXT.md: two or more Walls whose faces continue one another in a straight line), as one extra dimension line further out than the per-Wall dimensions. Example: Room 1 (4.28 m outside) and Room 2 (2.60 m) one behind the other give a left-side run of 6.88 m.

- Outside faces only, runs of two or more Walls, one Level at a time.
- A run continues across Openings, but stops at a step in the outside line (the reference house's 20 mm steps) and at a Wall whose outside face is not in line (another thickness).
- It shows only; it can't be clicked to edit (editing an overall length would have to spread over several Walls, a separate feature).

**Blocked by:** none

**Status:** ready-for-agent

- [ ] Two Rooms one behind the other give one run per straight side with its overall outside length (store test of the derived runs).
- [ ] A step in the outside line splits a run; a single Wall gets no run dimension (store test).
- [ ] The run dimension is drawn outside the per-Wall dimensions, readable at the usual zoom levels; checked in the browser in light and dark.
