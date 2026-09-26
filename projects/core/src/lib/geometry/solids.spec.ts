import { addLevel } from '../commands/levels';
import { addOpening } from '../commands/add-opening';
import { drawRoom } from '../commands/draw-room';
import { counterIds } from '../model/ids';
import { createProject, defaultStoreyHeight } from '../model/new-project';
import type { LevelId, Wall } from '../model/types';
import { ProjectStore } from '../store/project-store';
import { buildingSolids } from './solids';

function setup() {
  const ids = counterIds();
  const store = new ProjectStore(createProject({ name: 'T', levelName: 'Ground floor' }, ids), ids);
  const ground = Object.keys(store.model().levels)[0] as LevelId;
  store.run(drawRoom, {
    level: ground,
    from: { x: 0, y: 0 },
    to: { x: 3000, y: 3000 },
    size: 'inside',
    name: 'Living',
  });
  return { store, ground, p: store.model().project.presets };
}

describe('3D solids (ticket 14)', () => {
  it('stands each Wall on its Slab, up to the Wall height', () => {
    const { store, p } = setup();
    const solids = buildingSolids(store.model(), store.values);
    const walls = solids.solids.filter((s) => s.kind === 'wall');
    expect(walls).toHaveLength(4);
    for (const w of walls) {
      expect(w.body.bottom).toBe(-p.floorBuildUp);
      expect(w.body.top).toBe(-p.floorBuildUp + defaultStoreyHeight(p));
      expect(w.body.rings[0]).toHaveLength(4);
    }
  });

  it('gives each Level a Slab under its outer faces and each Room its Floor build-up', () => {
    const { store, p } = setup();
    const solids = buildingSolids(store.model(), store.values).solids;
    const slab = solids.find((s) => s.kind === 'slab')!;
    expect(slab.body.top).toBe(-p.floorBuildUp);
    expect(slab.body.bottom).toBe(-p.floorBuildUp - p.slabThickness);
    const floor = solids.find((s) => s.kind === 'floor')!;
    expect(floor.body.bottom).toBe(-p.floorBuildUp);
    expect(floor.body.top).toBe(0);
  });

  it('cuts Openings through the full Wall thickness, from the finished floor plus the sill', () => {
    const { store, p } = setup();
    const bottom = Object.values(store.model().walls).find(
      (w: Wall) => w.start.y === 3000 && w.end.y === 3000,
    )!;
    store.run(addOpening, { wall: bottom.id, kind: 'window', offset: 500 });
    store.run(addOpening, { wall: bottom.id, kind: 'door', offset: 2000, width: 800 });
    const wall = buildingSolids(store.model(), store.values).solids.find(
      (s) => s.kind === 'wall' && s.id === bottom.id,
    )!;
    expect(wall.kind === 'wall' && wall.cuts).toHaveLength(2);
    if (wall.kind !== 'wall') return;
    const [window, door] = [...wall.cuts].sort((a, b) => a.bottom - b.bottom).reverse();
    expect(window!.bottom).toBe(p.windowSill);
    expect(window!.top).toBe(p.windowSill + p.windowHeight);
    // A door runs down through to the Wall's foot, so no threshold is left.
    expect(door!.bottom).toBeLessThan(wall.body.bottom);
    expect(door!.top).toBe(p.doorHeight);
    const ys = window!.rings[0]!.map((v) => v.y);
    expect(Math.min(...ys)).toBeLessThan(3000);
    expect(Math.max(...ys)).toBeGreaterThan(3140);
  });

  it('stacks the Levels', () => {
    const { store, ground, p } = setup();
    store.run(addLevel, { relativeTo: ground, position: 'above', name: 'First floor' });
    const first = Object.values(store.model().levels).find((l) => l.name === 'First floor')!;
    store.run(drawRoom, {
      level: first.id,
      from: { x: 0, y: 0 },
      to: { x: 3000, y: 3000 },
      size: 'inside',
      name: 'Bedroom',
    });
    const result = buildingSolids(store.model(), store.values);
    expect(result.levels.map((l) => l.name)).toEqual(['Ground floor', 'First floor']);
    const firstSlab = result.solids.find(
      (s) => s.kind === 'slab' && s.level === result.levels[1]!.id,
    )!;
    expect(firstSlab.body.top).toBe(defaultStoreyHeight(p) - p.floorBuildUp);
  });
});
