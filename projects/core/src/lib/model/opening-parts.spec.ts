import { DEFAULT_DESIGNS, openingShape, type OpeningPart } from './opening-parts';

const span = (parts: readonly OpeningPart[], kind: OpeningPart['kind']) =>
  parts.filter((p) => p.kind === kind);
const inside = (p: OpeningPart, q: OpeningPart) =>
  p.u0 >= q.u0 && p.u1 <= q.u1 && p.v0 >= q.v0 && p.v1 <= q.v1 && p.z0 >= q.z0 && p.z1 <= q.z1;

describe('Opening family parts (ticket 19)', () => {
  it('gives a wide window two panes beside a middle post, and counts the glass', () => {
    const s = openingShape(
      DEFAULT_DESIGNS.window,
      { width: 1200, height: 1200, sill: 900, hinge: 'start', swing: 'right' },
      140,
    );
    const panes = span(s.parts, 'glass');
    expect(panes.map((p) => [p.u0, p.u1, p.z0, p.z1])).toEqual([
      [60, 570, 60, 1140],
      [630, 1140, 60, 1140],
    ]);
    // Frame: two jambs, a head, a sill rail and the middle post, 60 mm wide, 70 deep in the
    // middle of the 140 mm Wall.
    const frame = span(s.parts, 'frame');
    expect(frame).toHaveLength(5);
    for (const f of frame) expect([f.v0, f.v1]).toEqual([35, 105]);
    // The glass sits inside its frame's depth and opening.
    for (const p of panes) {
      expect(p.v0).toBeGreaterThanOrEqual(35);
      expect(p.v1).toBeLessThanOrEqual(105);
      expect(
        inside(p, { kind: 'frame', u0: 60, u1: 1140, v0: 35, v1: 105, z0: 60, z1: 1140 }),
      ).toBe(true);
    }
    expect(s.glassArea).toBe(2 * 510 * 1080);
  });

  it('gives a narrow window one pane', () => {
    const s = openingShape(
      DEFAULT_DESIGNS.window,
      { width: 800, height: 1000, sill: 900, hinge: 'start', swing: 'right' },
      140,
    );
    expect(span(s.parts, 'glass')).toHaveLength(1);
    expect(s.glassArea).toBe((800 - 120) * (1000 - 120));
  });

  it("draws a door's leaf standing open on its swing side, hinged at its jamb, with its arc", () => {
    const s = openingShape(
      DEFAULT_DESIGNS.door,
      { width: 930, height: 2115, sill: 0, hinge: 'start', swing: 'right' },
      140,
    );
    const [leaf] = span(s.parts, 'leaf');
    expect(leaf).toMatchObject({ u0: 60, u1: 870, v0: 80, v1: 120, z0: 0, z1: 2055 });
    expect(s.glassArea).toBe(0);
    // In the plan: both jambs cut, the leaf open at 90° from the hinge on the 'right' face.
    expect(s.plan.rects.filter((r) => r.kind === 'frame')).toHaveLength(2);
    expect(s.plan.rects.find((r) => r.kind === 'leaf')).toEqual({
      kind: 'leaf',
      u0: 60,
      u1: 100,
      v0: 120,
      v1: 120 + 810,
    });
    expect(s.plan.arcs).toEqual([
      { center: { u: 60, v: 120 }, from: { u: 60, v: 930 }, to: { u: 870, v: 120 } },
    ]);
    // Hinged at the other jamb and swinging the other way, it mirrors.
    const other = openingShape(
      DEFAULT_DESIGNS.door,
      { width: 930, height: 2115, sill: 0, hinge: 'end', swing: 'left' },
      140,
    );
    expect(other.plan.arcs).toEqual([
      { center: { u: 870, v: 20 }, from: { u: 870, v: 20 - 810 }, to: { u: 60, v: 20 } },
    ]);
  });

  it('leaves a wall opening a plain hole, its head dashed along both faces', () => {
    const s = openingShape(
      DEFAULT_DESIGNS.wallOpening,
      { width: 900, height: 2110, sill: 0, hinge: 'start', swing: 'right' },
      140,
    );
    expect(s.parts).toEqual([]);
    expect(s.plan.dashed).toEqual([
      [
        { u: 0, v: 0 },
        { u: 900, v: 0 },
      ],
      [
        { u: 0, v: 140 },
        { u: 900, v: 140 },
      ],
    ]);
  });

  it('builds a garage door from panels that fill its frame', () => {
    const s = openingShape(
      DEFAULT_DESIGNS.garageDoor,
      { width: 2400, height: 2125, sill: 0, hinge: 'start', swing: 'right' },
      140,
    );
    const panels = span(s.parts, 'panel');
    expect(panels).toHaveLength(4);
    expect(panels[0]!.z0).toBe(0);
    expect(panels[3]!.z1).toBe(2125 - 60);
    expect(s.plan.dashed).toHaveLength(3);
  });

  it('still shows a window wholly above the plan cut, cut through its middle', () => {
    const s = openingShape(
      DEFAULT_DESIGNS.window,
      { width: 1200, height: 600, sill: 1600, hinge: 'start', swing: 'right' },
      140,
    );
    expect(s.plan.rects.filter((r) => r.kind === 'glass')).toHaveLength(2);
    expect(s.plan.rects.filter((r) => r.kind === 'frame').length).toBeGreaterThan(0);
  });

  it('keeps every part inside a Wall thinner than its leaf', () => {
    const s = openingShape(
      DEFAULT_DESIGNS.door,
      { width: 930, height: 2115, sill: 0, hinge: 'start', swing: 'right' },
      30,
    );
    for (const p of s.parts) {
      expect(p.v0).toBeGreaterThanOrEqual(0);
      expect(p.v1).toBeLessThanOrEqual(30);
    }
  });

  it('hangs a double door at both jambs, each leaf with its own swing', () => {
    const design = {
      ...DEFAULT_DESIGNS.door,
      infill: { kind: 'leaves', count: 2, thickness: 40 },
    } as const;
    const s = openingShape(
      design,
      { width: 1600, height: 2115, sill: 0, hinge: 'start', swing: 'right' },
      140,
    );
    expect(span(s.parts, 'leaf').map((p) => [p.u0, p.u1])).toEqual([
      [60, 800],
      [800, 1540],
    ]);
    expect(s.plan.arcs.map((a) => a.center.u)).toEqual([60, 1540]);
  });

  it('never gives a tiny Opening a part of negative size', () => {
    for (const kind of ['door', 'window', 'garageDoor'] as const) {
      const s = openingShape(
        DEFAULT_DESIGNS[kind],
        { width: 100, height: 100, sill: 0, hinge: 'start', swing: 'left' },
        140,
      );
      for (const p of s.parts) {
        expect(p.u1).toBeGreaterThanOrEqual(p.u0);
        expect(p.v1).toBeGreaterThanOrEqual(p.v0);
        expect(p.z1).toBeGreaterThanOrEqual(p.z0);
      }
    }
  });
});
