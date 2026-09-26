import { counterIds } from '../model/ids';
import { createProject } from '../model/new-project';
import type { LevelId, Model, Room, Wall } from '../model/types';
import { ProjectStore } from '../store/project-store';
import { deleteElements } from './delete-elements';
import { drawRoom } from './draw-room';
import { moveWall } from './move-wall';
import { updateRoom } from './update-room';

const m2 = (mm2: number | null | undefined) => (mm2 == null ? null : Math.round(mm2 / 1e4) / 100);

/** Keuken (2670 × 3730) with the Achterhal (2670 × 3940) behind it, sharing one Wall. */
function twoRooms() {
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
    from: { x: 0, y: -4080 },
    to: { x: 2670, y: -140 },
    size: 'inside',
    name: 'Achterhal',
  });
  const room = (name: string) => Object.values(store.model().rooms).find((r) => r.name === name)!;
  const area = (name: string) => m2(store.values.room(room(name).id).netFloorArea());
  /** The Wall between the two Rooms: the Keuken's top Wall, from (0,0) to (2670,0). */
  const shared = () =>
    Object.values(store.model().walls).find((w) => w.start.y === 0 && w.end.y === 0)!;
  return { store, level, room, area, shared };
}

describe('moving, deleting and editing elements (ticket 08)', () => {
  it('moves a Wall along its normal: connected Walls stretch and both Rooms follow', () => {
    const { store, area, shared } = twoRooms();
    const result = store.run(moveWall, { wall: shared().id, offset: -300 }); // 300 mm into the Achterhal
    expect(result.ok).toBe(true);
    expect(area('Keuken')).toBe(m2(2670 * (3730 + 300)));
    expect(area('Achterhal')).toBe(m2(2670 * (3940 - 300)));
    expect(
      Object.values(
        store.values
          .level(Object.keys(store.model().levels)[0] as LevelId)
          .footprint()
          .rooms.values(),
      ).every((d) => d.status === 'enclosed'),
    ).toBe(true);
  });

  it('carries a Seed point along when a moved Wall passes over it', () => {
    const { store, area, shared, room } = twoRooms();
    // The Achterhal's Seed point is at y = -2110; move the shared Wall 2500 mm past it.
    store.run(moveWall, { wall: shared().id, offset: -2500 });
    expect(store.values.room(room('Achterhal').id).detection()?.status).toBe('enclosed');
    expect(area('Achterhal')).toBe(m2(2670 * (3940 - 2500)));
  });

  it('refuses a move that would give a Wall no length', () => {
    const { store, shared } = twoRooms();
    const result = store.run(moveWall, { wall: shared().id, offset: 3730 });
    expect(result.ok).toBe(false);
  });

  it('deletes a Wall with its Wall connections, keeping the Rooms (flagged: the corners are now open)', () => {
    const { store, shared, room } = twoRooms();
    const wall: Wall = shared();
    const before: Model = store.model();
    const result = store.run(deleteElements, { walls: [wall.id], rooms: [] });
    expect(result.ok).toBe(true);
    const after = store.model();
    expect(after.walls[wall.id]).toBeUndefined();
    expect(
      Object.values(after.wallConnections).some((c) => c.wall === wall.id || c.to === wall.id),
    ).toBe(false);
    expect(Object.keys(after.rooms)).toEqual(Object.keys(before.rooms));
    expect(store.values.room(room('Keuken').id).detection()?.status).toBe('notEnclosed');
    expect(store.values.room(room('Achterhal').id).detection()?.status).toBe('notEnclosed');
  });

  it('deletes a Room with its Ceiling, leaving an enclosed area without a Room', () => {
    const { store, level, room } = twoRooms();
    const keuken: Room = room('Keuken');
    store.run(deleteElements, { walls: [], rooms: [keuken.id] });
    expect(store.model().rooms[keuken.id]).toBeUndefined();
    expect(Object.values(store.model().ceilings).some((c) => c.room === keuken.id)).toBe(false);
    expect(
      store.values
        .level(level)
        .footprint()
        .areas.filter((a) => !a.rooms.length),
    ).toHaveLength(1);
  });

  it('renames a Room and changes its Room height as single steps', () => {
    const { store, room } = twoRooms();
    const id = room('Keuken').id;
    store.run(updateRoom, { room: id, name: 'Kitchen' });
    store.run(updateRoom, { room: id, height: 2570 });
    expect(store.model().rooms[id]).toMatchObject({ name: 'Kitchen', height: 2570 });
    store.undo();
    expect(store.model().rooms[id]!.height).toBeUndefined();
    expect(store.model().rooms[id]!.name).toBe('Kitchen');
  });
});
