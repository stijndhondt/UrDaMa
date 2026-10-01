import { addOpening } from '../commands/add-opening';
import { drawRoom } from '../commands/draw-room';
import { addLevel } from '../commands/levels';
import { counterIds } from '../model/ids';
import { createProject } from '../model/new-project';
import type { LevelId, Wall } from '../model/types';
import { ProjectStore } from '../store/project-store';
import {
  elevation,
  elevationHeights,
  type ElevationShape,
  type HeightDimension,
} from './elevation';

/** Two Levels of two Rooms side by side (an interior Wall between them), 6 × 3 m inside. */
function twoLevelHouse() {
  const ids = counterIds();
  const store = new ProjectStore(createProject({ name: 'T', levelName: 'Ground floor' }, ids), ids);
  const ground = Object.keys(store.model().levels)[0] as LevelId;
  store.run(addLevel, { relativeTo: ground, position: 'above', name: 'First floor' });
  const first = Object.values(store.model().levels).find((l) => l.name === 'First floor')!.id;
  for (const level of [ground, first]) {
    for (const [name, x0, x1] of [
      ['A', 0, 2930],
      ['B', 3070, 6000],
    ] as const) {
      const r = store.run(drawRoom, {
        level,
        from: { x: x0, y: 0 },
        to: { x: x1, y: 3000 },
        size: 'inside',
        name,
      });
      if (!r.ok) throw new Error(r.reason.key);
    }
  }
  const heights = store.values.levelHeights();
  return { store, ground, first, heights };
}

const faces = (shapes: readonly ElevationShape[]) =>
  shapes.filter((s): s is Extract<ElevationShape, { kind: 'wallFace' }> => s.kind === 'wallFace');

describe('Elevations (ticket 14)', () => {
  it("shows each Level's outside faces at their heights, and no interior Wall", () => {
    const { store, ground, first, heights } = twoLevelHouse();
    const front = elevation(store.model(), store.values, 'front');
    const walls = store.model().walls;
    const interior = Object.values(walls).filter(
      (w: Wall) => w.start.x === w.end.x && w.start.x > 0 && w.start.x < 6000,
    );
    expect(interior.length).toBe(2);
    const shown = faces(front.shapes);
    expect(shown.some((s) => interior.some((w) => w.id === s.wall))).toBe(false);

    for (const level of [ground, first]) {
      const h = heights.get(level)!;
      const mine = shown.filter((s) => s.level === level);
      expect(mine.length).toBeGreaterThan(0);
      for (const s of mine) {
        expect(s.rect.z0).toBe(h.slabTop);
        expect(s.rect.z1).toBe(h.slabTop + h.storeyHeight);
      }
      // The front faces of a Level span the whole outside width, 6 m and two Wall thicknesses.
      const u0 = Math.min(...mine.map((s) => s.rect.u0));
      const u1 = Math.max(...mine.map((s) => s.rect.u1));
      expect(Math.round(u1 - u0)).toBe(6000 + 280);
    }
    // The first floor sits right on top of the ground floor.
    expect(heights.get(first)!.slabTop).toBe(
      heights.get(ground)!.slabTop + heights.get(ground)!.storeyHeight,
    );
    // Each Level's Slab edge shows under its faces.
    const slabs = front.shapes.filter((s) => s.kind === 'slabEdge');
    expect(new Set(slabs.map((s) => s.level))).toEqual(new Set([ground, first]));
  });

  it('draws an Opening at its sill height and height, referring to its element', () => {
    const { store, ground, heights } = twoLevelHouse();
    const wall = Object.values(store.model().walls).find(
      (w: Wall) => w.level === ground && w.start.y === 3000 && w.end.y === 3000,
    )!;
    store.run(addOpening, { wall: wall.id, kind: 'window', offset: 600, width: 1200, sill: 900 });
    const opening = Object.values(store.model().openings)[0]!;
    const front = elevation(store.model(), store.values, 'front');
    const shown = front.shapes.filter((s) => s.kind === 'opening');
    expect(shown).toHaveLength(1);
    const o = shown[0]!;
    expect(o).toMatchObject({
      opening: opening.id,
      wall: wall.id,
      level: ground,
      openingKind: 'window',
    });
    const floor = heights.get(ground)!.elevation;
    expect(o.rect.z0).toBe(floor + 900);
    expect(o.rect.z1).toBe(floor + 900 + 1200);
    expect(Math.round(o.rect.u1 - o.rect.u0)).toBe(1200);
    // Drawn over its Wall face.
    const face = faces(front.shapes).find((s) => s.wall === wall.id)!;
    expect(front.shapes.indexOf(o)).toBeGreaterThan(front.shapes.indexOf(face));
    expect(o.rect.u0).toBeGreaterThanOrEqual(face.rect.u0);
    expect(o.rect.u1).toBeLessThanOrEqual(face.rect.u1);
    // Not seen from the back.
    const back = elevation(store.model(), store.values, 'back');
    expect(back.shapes.some((s) => s.kind === 'opening')).toBe(false);
  });

  it('mirrors left and right between the front and the back', () => {
    const { store } = twoLevelHouse();
    const left = elevation(store.model(), store.values, 'left');
    const rightSide = elevation(store.model(), store.values, 'right');
    expect(faces(left.shapes).length).toBeGreaterThan(0);
    expect(faces(rightSide.shapes).length).toBeGreaterThan(0);
    // Seen from the front, x grows to the right; seen from the back, to the left.
    const front = elevation(store.model(), store.values, 'front');
    const back = elevation(store.model(), store.values, 'back');
    expect(front.bounds.u0).toBe(-back.bounds.u1);
  });
});

describe('heights in Elevations (ticket 15)', () => {
  const levelDims = (dims: readonly HeightDimension[]) =>
    dims.flatMap((d) => (d.kind === 'level' ? [[d.level, d.z0, d.z1]] : []));
  const totalOf = (dims: readonly HeightDimension[]) => {
    const t = dims.find((d) => d.kind === 'total')!;
    return [t.z0, t.z1];
  };
  const openingDims = (dims: readonly HeightDimension[], id: string) =>
    dims.flatMap((d) =>
      (d.kind === 'sill' || d.kind === 'openingHeight') && d.opening === id
        ? [[d.kind, d.z1 - d.z0]]
        : [],
    );

  it('dimensions the reference house with a second Level, as the model has it', () => {
    const ids = counterIds();
    const store = new ProjectStore(
      createProject({ name: 'T', levelName: 'Ground floor' }, ids),
      ids,
    );
    const ground = Object.keys(store.model().levels)[0] as LevelId;
    store.run(addLevel, { relativeTo: ground, position: 'above', name: 'First floor' });
    const first = Object.values(store.model().levels).find((l) => l.name === 'First floor')!.id;
    const draw = (name: string, x0: number, y0: number, x1: number, y1: number, level = ground) =>
      store.run(drawRoom, {
        level,
        from: { x: x0, y: y0 },
        to: { x: x1, y: y1 },
        size: 'inside',
        name,
      });
    draw('Keuken', 0, 0, 2670, 3730);
    draw('Achterhal', 0, -140 - 3940, 2670, -140);
    draw('Badkamer', 0, -280 - 3940 - 1910, 2950, -280 - 3940);
    draw('Berging', 0, -420 - 3940 - 1910 - 1940, 3010, -420 - 3940 - 1910);
    draw('WC', 0, -140 - 3940, 1120, -140 - 3940 + 1000);
    draw('Eetkamer', 0, 3730 + 140, 2650, 3730 + 140 + 3570);
    draw('Living', 0, 3730 + 280 + 3570, 3340, 3730 + 280 + 3570 + 3320);
    // The second Level: one bedroom over the Living, a window in its front Wall.
    draw('Slaapkamer', 0, 3730 + 280 + 3570, 3340, 3730 + 280 + 3570 + 3320, first);
    const front = Object.values(store.model().walls).find(
      (w: Wall) => w.level === first && w.start.y === w.end.y && w.start.y === 10900,
    )!;
    store.run(addOpening, { wall: front.id, kind: 'window', offset: 1000, width: 1200, sill: 900 });
    const window = Object.values(store.model().openings)[0]!;

    const e = elevation(store.model(), store.values, 'front');
    const dims = elevationHeights(e, new Set());
    const g = store.values.levelHeights().get(ground)!;
    const f = store.values.levelHeights().get(first)!;
    // Each Level's storey height, from its finished floor, as typed in the panel.
    expect(levelDims(dims)).toEqual([
      [ground, g.elevation, g.elevation + g.storeyHeight],
      [first, f.elevation, f.elevation + f.storeyHeight],
    ]);
    // The total: from the ground line under the lowest Slab to the top of the highest Walls.
    expect(totalOf(dims)).toEqual([g.slabTop - g.slabThickness, f.slabTop + f.storeyHeight]);
    // The window: 900 above the first floor's finished floor, 1200 high, beside its right edge.
    expect(openingDims(dims, window.id)).toEqual([
      ['sill', 900],
      ['openingHeight', 1200],
    ]);
    const shape = e.shapes.find((x) => x.kind === 'opening' && x.opening === window.id)!;
    const d = dims.find((x) => x.kind === 'openingHeight' && x.opening === window.id)!;
    expect(d.kind === 'openingHeight' && d.u).toBe(shape.rect.u1);
  });

  it('gives a door its height and no sill', () => {
    const { store, ground } = twoLevelHouse();
    const wall = Object.values(store.model().walls).find(
      (w: Wall) => w.level === ground && w.start.y === 3000 && w.end.y === 3000,
    )!;
    store.run(addOpening, { wall: wall.id, kind: 'door', offset: 1000 });
    const door = Object.values(store.model().openings)[0]!;
    const dims = elevationHeights(elevation(store.model(), store.values, 'front'), new Set());
    expect(openingDims(dims, door.id)).toEqual([['openingHeight', 2115]]);
  });

  it('leaves a hidden Level out without changing the others', () => {
    const { store, ground, first } = twoLevelHouse();
    store.run(addLevel, { relativeTo: first, position: 'above', name: 'Attic' });
    const attic = Object.values(store.model().levels).find((l) => l.name === 'Attic')!.id;
    store.run(drawRoom, {
      level: attic,
      from: { x: 0, y: 0 },
      to: { x: 6000, y: 3000 },
      size: 'inside',
      name: 'Attic',
    });
    const heights = store.values.levelHeights();
    const dims = elevationHeights(
      elevation(store.model(), store.values, 'front'),
      new Set([first]),
    );
    const g = heights.get(ground)!;
    const a = heights.get(attic)!;
    // The ground floor keeps its own storey height, not the gap up to the next shown Level.
    expect(levelDims(dims)).toEqual([
      [ground, g.elevation, g.elevation + g.storeyHeight],
      [attic, a.elevation, a.elevation + a.storeyHeight],
    ]);
    expect(totalOf(dims)).toEqual([g.slabTop - g.slabThickness, a.slabTop + a.storeyHeight]);
  });

  it('gives no dimensions to an Opening hidden behind a nearer face', () => {
    const ids = counterIds();
    const store = new ProjectStore(
      createProject({ name: 'T', levelName: 'Ground floor' }, ids),
      ids,
    );
    const level = Object.keys(store.model().levels)[0] as LevelId;
    const draw = (name: string, x0: number, y0: number, x1: number, y1: number) =>
      store.run(drawRoom, {
        level,
        from: { x: x0, y: y0 },
        to: { x: x1, y: y1 },
        size: 'inside',
        name,
      });
    draw('House', 0, 0, 6000, 3000);
    draw('Shed', 1000, 5000, 5000, 8000);
    const wall = Object.values(store.model().walls).find(
      (w: Wall) => w.start.y === 3000 && w.end.y === 3000,
    )!;
    store.run(addOpening, { wall: wall.id, kind: 'window', offset: 2400, width: 1200, sill: 900 });
    const window = Object.values(store.model().openings)[0]!;
    const dims = elevationHeights(elevation(store.model(), store.values, 'front'), new Set());
    expect(openingDims(dims, window.id)).toEqual([]);
  });
});
