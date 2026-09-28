import { addOpening } from '../commands/add-opening';
import { drawRoom } from '../commands/draw-room';
import { counterIds } from '../model/ids';
import { createProject } from '../model/new-project';
import type { LevelId, Wall } from '../model/types';
import { ProjectStore } from '../store/project-store';
import { netWallArea } from '../values/surfaces';
import { quantityTree } from './quantity-tree';

function keukenAndEetkamer() {
  const ids = counterIds();
  const store = new ProjectStore(createProject({ name: 'T', levelName: 'Ground floor' }, ids), ids);
  const level = Object.keys(store.model().levels)[0] as LevelId;
  store.run(drawRoom, {
    level,
    from: { x: 0, y: 0 },
    to: { x: 2670, y: 3730 },
    size: 'inside',
    name: 'Keuken',
  });
  store.run(drawRoom, {
    level,
    from: { x: 2810, y: 0 },
    to: { x: 5460, y: 3730 },
    size: 'inside',
    name: 'Eetkamer',
  });
  const shared = Object.values(store.model().walls).find(
    (w: Wall) => w.start.x === w.end.x && w.start.x > 2600 && w.start.x < 2900,
  )!;
  store.run(addOpening, { wall: shared.id, kind: 'door', offset: 500 });
  return { store, level, shared };
}

describe('the Quantities tree (ticket 12)', () => {
  it('lists each Level, its Rooms by name, and per Room its floor, ceiling and Wall faces', () => {
    const { store, level } = keukenAndEetkamer();
    const [ground] = quantityTree(store.model(), store.values, 'exact');
    expect(ground!.level).toBe(level);
    expect(ground!.rooms.map((r) => r.name)).toEqual(['Eetkamer', 'Keuken']);
    const keuken = ground!.rooms[1]!;
    expect(keuken.faces).toHaveLength(4);
    expect(keuken.floorArea).toBe(store.values.room(keuken.room).floorFinishArea());
    expect(keuken.ceilingArea).toBe(store.values.room(keuken.room).ceilingArea());
    const faceNet = keuken.faces.reduce((sum, f) => sum + f.net, 0);
    expect(Math.round(faceNet)).toBe(
      Math.round(netWallArea(store.values.room(keuken.room).surfaces()!, 'exact')),
    );
  });

  it('numbers the Walls as the Building panel does, and shows the door in the shared Wall on both sides', () => {
    const { store, shared } = keukenAndEetkamer();
    const [ground] = quantityTree(store.model(), store.values, 'exact');
    const walls = Object.values(store.model().walls).sort((a, b) => (a.id < b.id ? -1 : 1));
    const number = walls.findIndex((w) => w.id === shared.id) + 1;
    for (const room of ground!.rooms) {
      const face = room.faces.find((f) => f.wall === shared.id)!;
      expect(face.wallNumber).toBe(number);
      expect(face.openings).toBeGreaterThan(0);
      expect(face.net).toBeCloseTo(face.gross - face.openings);
    }
  });
});
