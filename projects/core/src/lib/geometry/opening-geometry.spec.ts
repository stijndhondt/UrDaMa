import { addOpening } from '../commands/add-opening';
import { parseProject, serializeProject } from '../file/project-file';
import { drawRoom } from '../commands/draw-room';
import { counterIds } from '../model/ids';
import { createProject } from '../model/new-project';
import { PLAN_CUT } from '../model/opening-parts';
import type { LevelId, OpeningId, Vec, Wall } from '../model/types';
import { ProjectStore } from '../store/project-store';
import { elevation, type ElevationShape } from './elevation';
import { buildingSolids, type Solid } from './solids';

/** A 4 × 3 m Room: a window in its bottom (front) Wall, a door in its top (back) Wall. */
function house() {
  const ids = counterIds();
  const store = new ProjectStore(createProject({ name: 'T', levelName: 'Ground floor' }, ids), ids);
  const level = Object.keys(store.model().levels)[0] as LevelId;
  store.run(drawRoom, {
    level,
    from: { x: 0, y: 0 },
    to: { x: 4000, y: 3000 },
    size: 'inside',
    name: 'Living',
  });
  const wallAt = (y: number) =>
    Object.values(store.model().walls).find((w: Wall) => w.start.y === y && w.end.y === y)!;
  store.run(addOpening, { wall: wallAt(3000).id, kind: 'window', offset: 800, sill: 900 });
  store.run(addOpening, { wall: wallAt(0).id, kind: 'door', offset: 600 });
  const byKind = (kind: string) =>
    Object.values(store.model().openings).find(
      (o) =>
        store.model().openingFamilies[store.model().openingTypes[o.type]!.family]!.kind === kind,
    )!;
  return { store, window: byKind('window'), door: byKind('door') };
}

const ROUND = (n: number) => Math.round(n * 1000) / 1000;
/** The extent of plan points along x and y, rounded. */
const extent = (ring: readonly Vec[]) => [
  ROUND(Math.min(...ring.map((p) => p.x))),
  ROUND(Math.max(...ring.map((p) => p.x))),
  ROUND(Math.min(...ring.map((p) => p.y))),
  ROUND(Math.max(...ring.map((p) => p.y))),
];
const partsOf = (solids: readonly Solid[], id: OpeningId, part: string) =>
  solids.filter((s) => s.kind === 'openingPart' && s.id === id && s.part === part);

describe("an Opening's parts in every view (ticket 19)", () => {
  it('draws the same window parts in the plan, the Elevation and 3D', () => {
    const { store, window } = house();
    const placed = store.values.opening(window.id).shape()!;
    const solids = buildingSolids(store.model(), store.values).solids;
    const glass3d = partsOf(solids, window.id, 'glass');
    expect(glass3d).toHaveLength(2);
    const floor = store.values.levelHeights().values().next().value!.elevation;

    // 3D: each pane is its part's box, placed in the Wall.
    const panes = placed.shape.parts.filter((p) => p.kind === 'glass');
    panes.forEach((p, i) => {
      const s = glass3d[i]!;
      expect(extent(s.body.rings[0]!)).toEqual(
        extent([placed.point(p.u0, p.v0), placed.point(p.u1, p.v1)]),
      );
      expect([s.body.bottom, s.body.top]).toEqual([floor + 900 + p.z0, floor + 900 + p.z1]);
    });

    // Elevation (front): the same panes, as wide and as high as in 3D.
    const front = elevation(store.model(), store.values, 'front');
    const shape = front.shapes.find(
      (x): x is Extract<ElevationShape, { kind: 'opening' }> =>
        x.kind === 'opening' && x.opening === window.id,
    )!;
    const glassElev = shape.parts.filter((p) => p.kind === 'glass').map((p) => p.rect);
    const glass3dWidths = glass3d.map((s) => {
      const [x0, x1] = extent(s.body.rings[0]!);
      return ROUND(x1! - x0!);
    });
    expect(glassElev.map((r) => ROUND(r.u1 - r.u0)).sort()).toEqual(glass3dWidths.sort());
    for (const r of glassElev) {
      expect([r.z0, r.z1]).toEqual([glass3d[0]!.body.bottom, glass3d[0]!.body.top]);
    }
    // The frame's jambs, head, sill rail and middle post: in the Elevation and in 3D.
    expect(shape.parts.filter((p) => p.kind === 'frame')).toHaveLength(5);
    expect(partsOf(solids, window.id, 'frame')).toHaveLength(5);

    // Plan: the parts the plan cuts are the 3D boxes seen from above.
    const cut = PLAN_CUT - 900;
    const planGlass = placed.shape.plan.rects.filter((r) => r.kind === 'glass');
    expect(planGlass).toHaveLength(2);
    for (const r of planGlass) {
      const ring = [placed.point(r.u0, r.v0), placed.point(r.u1, r.v1)];
      expect(glass3d.some((s) => extent(s.body.rings[0]!).join() === extent(ring).join())).toBe(
        true,
      );
    }
    expect(panes.every((p) => p.z0 <= cut && p.z1 >= cut)).toBe(true);
  });

  it("draws a door's leaf as wide in the plan as in the Elevation and 3D", () => {
    const { store, door } = house();
    const placed = store.values.opening(door.id).shape()!;
    const leaf3d = partsOf(buildingSolids(store.model(), store.values).solids, door.id, 'leaf');
    expect(leaf3d).toHaveLength(1);
    const [x0, x1] = extent(leaf3d[0]!.body.rings[0]!);
    const width3d = x1! - x0!;
    // The plan shows the leaf standing open: its length across the Wall is the leaf's width.
    const open = placed.shape.plan.rects.find((r) => r.kind === 'leaf')!;
    expect(ROUND(open.v1 - open.v0)).toBe(ROUND(width3d));
    expect(
      ROUND(
        Math.hypot(
          placed.shape.plan.arcs[0]!.from.u - placed.shape.plan.arcs[0]!.center.u,
          placed.shape.plan.arcs[0]!.from.v - placed.shape.plan.arcs[0]!.center.v,
        ),
      ),
    ).toBe(ROUND(width3d));
    // The back Elevation sees the door in the top Wall: the same leaf, as wide and as high.
    const back = elevation(store.model(), store.values, 'back');
    const shape = back.shapes.find(
      (x): x is Extract<ElevationShape, { kind: 'opening' }> =>
        x.kind === 'opening' && x.opening === door.id,
    )!;
    const leaf = shape.parts.find((p) => p.kind === 'leaf')!.rect;
    expect(ROUND(leaf.u1 - leaf.u0)).toBe(ROUND(width3d));
    expect(ROUND(leaf.z1 - leaf.z0)).toBe(ROUND(leaf3d[0]!.body.top - leaf3d[0]!.body.bottom));
  });

  it("counts a window's glass area", () => {
    const { store, window, door } = house();
    const p = store.model().project.presets;
    // Two panes beside a 60 mm middle post, inside a 60 mm frame.
    expect(store.values.opening(window.id).glassArea()).toBe(
      (p.windowWidth - 3 * 60) * (p.windowHeight - 2 * 60),
    );
    expect(store.values.opening(door.id).glassArea()).toBe(0);
  });

  it('draws a garage door and a wall opening alike in every view', () => {
    const { store } = house();
    const wall = Object.values(store.model().walls).find(
      (w: Wall) => w.start.x === w.end.x && w.start.x > 2000,
    )!;
    store.run(addOpening, { wall: wall.id, kind: 'wallOpening', offset: 300 });
    const back = Object.values(store.model().walls).find(
      (w: Wall) => w.start.y === 0 && w.end.y === 0,
    )!;
    store.run(addOpening, { wall: back.id, kind: 'garageDoor', offset: 1700, width: 2000 });
    const kindOf = (id: OpeningId) =>
      store.model().openingFamilies[
        store.model().openingTypes[store.model().openings[id]!.type]!.family
      ]!.kind;
    const ids = Object.keys(store.model().openings) as OpeningId[];
    const garage = ids.find((id) => kindOf(id) === 'garageDoor')!;
    const hole = ids.find((id) => kindOf(id) === 'wallOpening')!;
    const solids = buildingSolids(store.model(), store.values).solids;
    const shapes = [...(['front', 'back', 'left', 'right'] as const)].flatMap(
      (side) => elevation(store.model(), store.values, side).shapes,
    );
    const elevationParts = (id: OpeningId) =>
      shapes.find(
        (x): x is Extract<ElevationShape, { kind: 'opening' }> =>
          x.kind === 'opening' && x.opening === id,
      )!.parts;
    // The garage door: four panels and its frame, in the Elevation as in 3D.
    expect(partsOf(solids, garage, 'panel')).toHaveLength(4);
    expect(elevationParts(garage).filter((p) => p.kind === 'panel')).toHaveLength(4);
    expect(store.values.opening(garage).shape()!.shape.plan.dashed).toHaveLength(3);
    // The wall opening: a plain hole, nothing in it anywhere.
    expect(solids.filter((x) => x.kind === 'openingPart' && x.id === hole)).toEqual([]);
    expect(elevationParts(hole)).toEqual([]);
    expect(store.values.opening(hole).shape()!.shape.plan.dashed).toHaveLength(2);
  });

  it('cuts the parts of an Opening taller than its Wall off at the Wall top, as the Elevation does', () => {
    const { store } = house();
    const wall = Object.values(store.model().walls).find(
      (w: Wall) => w.start.x === w.end.x && w.start.x < 100,
    )!;
    store.run(addOpening, { wall: wall.id, kind: 'door', offset: 800, height: 4000 });
    const tall = Object.values(store.model().openings).find((o) => o.wall === wall.id)!;
    const solids = buildingSolids(store.model(), store.values).solids;
    const wallTop = solids.find((x) => x.kind === 'wall' && x.id === wall.id)!.body.top;
    const parts = solids.filter((x) => x.kind === 'openingPart' && x.id === tall.id);
    expect(parts.length).toBeGreaterThan(0);
    for (const p of parts) expect(p.body.top).toBeLessThanOrEqual(wallTop);
  });

  it("draws a family's own design, kept in the project file", () => {
    const { store, door } = house();
    const doc = JSON.parse(serializeProject(store.model())) as {
      openingFamilies: { id: string; kind: string; design?: unknown }[];
    };
    const family = doc.openingFamilies.find((f) => f.kind === 'door')!;
    family.design = {
      frame: { width: 50, depth: 90 },
      bottomRail: false,
      infill: { kind: 'leaves', count: 2, thickness: 40 },
    };
    const text = JSON.stringify(doc, null, 2);
    const opened = parseProject(text);
    expect(opened.ok).toBe(true);
    if (!opened.ok) return;
    const ids = counterIds();
    const reopened = new ProjectStore(opened.model, ids);
    const leaves = buildingSolids(reopened.model(), reopened.values).solids.filter(
      (x) => x.kind === 'openingPart' && x.id === door.id && x.part === 'leaf',
    );
    expect(leaves).toHaveLength(2);
    // Saved again, the design comes back unchanged.
    const again = parseProject(serializeProject(opened.model));
    expect(again.ok && serializeProject(again.model)).toBe(serializeProject(opened.model));
    expect(serializeProject(opened.model)).toContain('"design"');
  });
});
