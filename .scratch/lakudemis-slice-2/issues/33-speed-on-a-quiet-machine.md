# 33: Confirm edit speed on a quiet machine

**What to build:** The Slice 2 acceptance run could not confirm "< 16 ms of 2D recalculation per edit on a ~200-Wall plan": while measuring, another program kept the CPU busy (about 4 cores), and `store/edit.benchmark.spec.ts` measured median 18–31 ms, p95 26–44 ms on 220 Walls. The same benchmark passed (p95 under 25 ms) in every commit hook earlier that day, and Slice 2 added work per edit (Wall runs, the T reach-through rule, Opening parts). Re-measure on an idle machine, in the browser as in Slice 1 ticket 15 (edit + recalculation, and with painting); if it no longer fits 16 ms, profile and fix.

**Blocked by:** none

**Status:** needs-triage

- [ ] On an idle machine, one edit on the 220-Wall plan: edit + recalculation p95 < 16 ms, measured in the browser and recorded here.
- [ ] If not, the slow part is found and fixed, and the benchmark guards it.

## Comments

**2026-10-03:** from the Slice 2 acceptance run (ticket 22).
