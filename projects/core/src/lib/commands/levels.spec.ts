import { counterIds } from '../model/ids';
import { createProject, defaultStoreyHeight } from '../model/new-project';
import type { LevelId, Model } from '../model/types';
import { recordRecalculations } from '../reactive';
import { ProjectStore } from '../store/project-store';
import { drawRoom } from './draw-room';
import { drawWall } from './draw-wall';
import { addLevel, deleteLevel, updateLevel, updateSlab } from './levels';
import { updateRoom } from './update-room';

function setup() {
  const ids = counterIds();
  const store = new ProjectStore(createProject({ name: 'T', levelName: 'Ground floor' }, ids), ids);
  const ground = Object.keys(store.model().levels)[0] as LevelId;
  const levels = (m: Model = store.model()) =>
    Object.values(m.levels).sort((a, b) => a.order - b.order);
  const storey = defaultStoreyHeight(store.model().project.presets);
  return { store, ground, levels, storey };
}

describe('Levels, Slab, Floor build-up and Ceiling (ticket 13)', () => {
  it('stacks Levels: elevations follow the storey heights below', () => {
    const { store, ground, levels, storey } = setup();
    expect(
      store.run(addLevel, { relativeTo: ground, position: 'above', name: 'First floor' }).ok,
    ).toBe(true);
    const first = levels()[1]!;
    expect(first.name).toBe('First floor');
    expect(first.storeyHeight).toBe(storey);
    expect(Object.values(store.model().slabs).some((s) => s.level === first.id)).toBe(true);
    expect(store.values.levelHeights().get(first.id)!.elevation).toBe(storey);

    store.run(updateLevel, { level: ground, storeyHeight: 3000 });
    expect(store.values.levelHeights().get(first.id)!.elevation).toBe(3000);
  });

  it('adds a Level below the lowest without moving the Levels above', () => {
    const { store, ground, levels, storey } = setup();
    store.run(addLevel, {
      relativeTo: ground,
      position: 'below',
      name: 'Basement',
      storeyHeight: 2500,
    });
    const [basement, g] = levels();
    expect(basement!.name).toBe('Basement');
    expect(g!.id).toBe(ground);
    const heights = store.values.levelHeights();
    expect(heights.get(ground)!.elevation).toBe(0);
    expect(heights.get(basement!.id)!.elevation).toBe(-2500);
    void storey;
  });

  it('sets the lowest elevation, but other elevations are derived', () => {
    const { store, ground, levels } = setup();
    store.run(addLevel, { relativeTo: ground, position: 'above', name: 'First floor' });
    expect(store.run(updateLevel, { level: ground, elevation: 450 }).ok).toBe(true);
    expect(store.values.levelHeights().get(ground)!.elevation).toBe(450);
    const refused = store.run(updateLevel, { level: levels()[1]!.id, elevation: 5000 });
    expect(!refused.ok && refused.reason.key).toBe('commands.level.elevationDerived');
  });

  it("measures a Room's height from the top of its Floor build-up, up to its Ceiling", () => {
    const { store, ground, storey } = setup();
    store.run(addLevel, { relativeTo: ground, position: 'above', name: 'First floor' });
    store.run(drawRoom, {
      level: ground,
      from: { x: 0, y: 0 },
      to: { x: 3000, y: 3000 },
      size: 'inside',
      name: 'Living',
    });
    const room = Object.values(store.model().rooms)[0]!;
    const v = store.values.room(room.id);
    const p = store.model().project.presets;
    expect(v.floorTop()).toBe(0);
    expect(v.ceilingUnderside()).toBe(p.roomHeight);
    // Default storey = build-up + Room height + Ceiling + Slab: the void is exactly 0.
    expect(v.ceilingVoid()).toBe(0);

    store.run(updateLevel, { level: ground, storeyHeight: storey + 300 });
    expect(v.ceilingVoid()).toBe(300);
    store.run(updateRoom, { room: room.id, floorBuildUp: 170, floorFinish: 'Parquet' });
    expect(v.floorTop()).toBe(50);
    expect(v.ceilingVoid()).toBe(250);
    expect(store.model().rooms[room.id]!.floorFinish).toBe('Parquet');
  });

  it('shows the Ceiling void as unknown without a Level above', () => {
    const { store, ground } = setup();
    store.run(drawRoom, {
      level: ground,
      from: { x: 0, y: 0 },
      to: { x: 3000, y: 3000 },
      size: 'inside',
      name: 'Living',
    });
    const room = Object.values(store.model().rooms)[0]!;
    expect(store.values.room(room.id).ceilingVoid()).toBeNull();
  });

  it('warns, without blocking, when a Ceiling runs into the Slab above', () => {
    const { store, ground } = setup();
    store.run(addLevel, { relativeTo: ground, position: 'above', name: 'First floor' });
    store.run(drawRoom, {
      level: ground,
      from: { x: 0, y: 0 },
      to: { x: 3000, y: 3000 },
      size: 'inside',
      name: 'Living',
    });
    const room = Object.values(store.model().rooms)[0]!;
    const result = store.run(updateRoom, { room: room.id, height: 2800 });
    expect(result.ok).toBe(true);
    const warnings = store.values.level(ground).warnings();
    expect(
      warnings.some((w) => w.key === 'warnings.ceilingIntoSlab' && w.params?.['room'] === 'Living'),
    ).toBe(true);
  });

  it('gives each Level a Slab from the outer faces, with a thickness from the Preset or its own', () => {
    const { store, ground } = setup();
    store.run(drawRoom, {
      level: ground,
      from: { x: 0, y: 0 },
      to: { x: 3000, y: 3000 },
      size: 'inside',
      name: 'Living',
    });
    const slab = store.values.slab(ground);
    expect(slab.thickness()).toBe(store.model().project.presets.slabThickness);
    expect(Math.round(slab.area() / 1e4) / 100).toBe(Math.round((3280 * 3280) / 1e4) / 100);
    store.run(updateSlab, { level: ground, thickness: 250 });
    expect(slab.thickness()).toBe(250);
  });

  it('never recalculates one Level when another is edited (recalculation log)', () => {
    const { store, ground, levels } = setup();
    store.run(addLevel, { relativeTo: ground, position: 'above', name: 'First floor' });
    const first = levels()[1]!.id;
    store.run(drawRoom, {
      level: ground,
      from: { x: 0, y: 0 },
      to: { x: 3000, y: 3000 },
      size: 'inside',
      name: 'Living',
    });
    store.run(drawRoom, {
      level: first,
      from: { x: 0, y: 0 },
      to: { x: 4000, y: 3000 },
      size: 'inside',
      name: 'Bedroom',
    });
    const bedroom = Object.values(store.model().rooms).find((r) => r.name === 'Bedroom')!;
    const readFirst = () => {
      const l = store.values.level(first);
      l.footprint();
      l.warnings();
      l.roomSurfaces();
      store.values.room(bedroom.id).netFloorArea();
    };
    readFirst();
    const recalculated = recordRecalculations(() => {
      store.run(drawWall, {
        level: ground,
        start: { x: 1500, y: 0 },
        end: { x: 1500, y: 3000 },
        side: 'centre',
        roomName: () => 'Hall',
      });
      readFirst();
    });
    // The Ground floor is recalculated...
    expect(recalculated).toContain('Ground floor · merged footprint');
    // ...but on the First floor at most its Source-data slice is looked at again: it compares
    // equal, so nothing downstream of it runs.
    const onFirst = recalculated.filter(
      (label) => label.startsWith('First floor') || label.startsWith('Bedroom'),
    );
    expect(onFirst.filter((label) => !label.endsWith(' · Source data'))).toEqual([]);
  });

  it('deletes a Level with everything on it, but never the last one', () => {
    const { store, ground, levels } = setup();
    store.run(addLevel, { relativeTo: ground, position: 'above', name: 'First floor' });
    const first = levels()[1]!.id;
    store.run(drawRoom, {
      level: first,
      from: { x: 0, y: 0 },
      to: { x: 4000, y: 3000 },
      size: 'inside',
      name: 'Bedroom',
    });
    expect(store.run(deleteLevel, { level: first }).ok).toBe(true);
    expect(levels()).toHaveLength(1);
    expect(Object.keys(store.model().rooms)).toHaveLength(0);
    expect(Object.keys(store.model().walls)).toHaveLength(0);
    const last = store.run(deleteLevel, { level: ground });
    expect(!last.ok && last.reason.key).toBe('commands.level.lastLevel');
  });
});
