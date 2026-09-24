# Wall joins and room detection strategy

Type: grilling
Status: resolved
Blocked by: 02, 06, 07
Parent: [Lakudemis foundation & Slice 1](../map.md)

## Question

Per [Domain model v1](07-domain-model-v1.md) and ADR 0001, Walls are joined only through stored Wall connections (corner or T at a distance), and Rooms are found from Seed points (ADR 0002). Tolerance-based adjacency is not used for joining.

- How are Wall joins computed: L, T and X joins, and joins between walls of different thickness?
- How are Rooms derived from room-bounding Walls plus Room separators, including manual overrides?
- What tolerances still apply (e.g. the 0.01 mm model tolerance, snapping radius in the editor)?
- What happens with loops that are not closed because a connection is missing, with overlapping Walls, and with free-standing Walls? How does the editor show a missing connection?

## Answer

Settled with the user on 2026-09-24.

1. **Room detection = holes in the merged wall footprint.**
   - Merge (Clipper2 union) the joined outlines of all room-bounding Walls. Every hole is an enclosed area already measured to the **inner faces**: the Net outline.
   - Room separators cut those holes, and each Room is the piece containing its Seed point.
   - The Level's Gross outline is the outer boundary of the same merged shape.
   - This replaces the research note's "graph of Baselines + shrink" approach, because Baselines may lie on either face.
2. **Enclosure is geometric; joins need connections.**
   - A Room is enclosed when the footprints leave no gap, even without Wall connections.
   - The mitred join shape and moving together require a stored Wall connection (ADR 0001).
   - An unconnected end is always shown (red), so a missing snap is visible and fixable.
3. **Corner joins are mitred in v1.** Both faces show true lengths. Butt joints with "which Wall wins" priority come later with Assemblies.
4. **Tee joins:** the ending Wall stops against the host Wall's face on its own side.
5. **Crossings (X):** there is no X connection. A crossing is one Wall running through plus two Walls T-connected to its two faces.
6. **No overlapping Walls: overlaps are prevented while drawing, not warned about.**
   - A Wall drawn onto an existing Wall **snaps against its face** (side by side).
   - A Wall drawn **through** an existing Wall is split there into two Walls, **T-connected to both faces**.
   - The Room tool creates Walls only for the **uncovered parts** of a partly shared edge, T-connected to the existing Wall.
7. **One corner connection per Wall end.** A third Wall snapping onto a taken corner gets a T connection to one of the two Walls' faces instead. Join maths stays pairwise.
8. **Broken Rooms are flagged, never guessed.**
   - **"Not enclosed":** a gap, or the Seed point sits inside a Wall. The Room shows no area.
   - **"Sharing one area":** two Seed points in one hole. There is no automatic merge; the user deletes one or adds a Room separator.
   - Outlines are never kept stale. Push and move commands carry Seed points along.
9. **Walls that aren't room-bounding** (bar wall, island, low divider) are left out of detection and don't reduce Net floor area in v1. Whether to subtract them is a later Measurement rule question.
10. **Tolerances:**
    - model comparisons: 0.01 mm
    - Clipper2 integer unit: 0.001 mm
    - editor snapping: 12 screen px
    - holes under 0.01 m² are ignored as rounding leftovers
11. **Code:** our own TypeScript join module with `robust-predicates`; Clipper2 for union, holes and cutting; JSTS `Polygonizer` only as a test reference.

No new ADR: the load-bearing choices are already ADR 0001 and ADR 0002, and the rest is cheap to change.
