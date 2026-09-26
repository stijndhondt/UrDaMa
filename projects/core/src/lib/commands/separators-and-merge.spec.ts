import { counterIds } from '../model/ids';
import { createProject } from '../model/new-project';
import type { LevelId, Vec } from '../model/types';
import { ProjectStore } from '../store/project-store';
import { deleteElements } from './delete-elements';
import { drawRoom } from './draw-room';
import { drawRoomSeparator } from './draw-room-separator';
import { drawWall } from './draw-wall';
import { mergeRooms } from './merge-rooms';

const m2 = (mm2: number | null | undefined) => (mm2 == null ? null : Math.round(mm2 / 1e4) / 100);

function setup() {
  const ids = counterIds();
  const store = new ProjectStore(createProject({ name: 'T', levelName: 'Ground floor' }, ids), ids);
  const level = Object.keys(store.model().levels)[0] as LevelId;
  let n = 0;
  const roomName = () => `Room ${++n}`;
  const room = (name: string) => Object.values(store.model().rooms).find((r) => r.name === name)!;
  const area = (name: string) => m2(store.values.room(room(name).id).netFloorArea());
  const box = (name: string, x0: number, y0: number, x1: number, y1: number) => {
    const r = store.run(drawRoom, {
      level,
      from: { x: x0, y: y0 },
      to: { x: x1, y: y1 },
      size: 'inside',
      name,
    });
    if (!r.ok) throw new Error(r.reason.key);
  };
  /** A closed loop of Walls, clockwise, thickness outward. */
  const loop = (points: Vec[]) => {
    points.forEach((p, i) => {
      const r = store.run(drawWall, {
        level,
        start: p,
        end: points[(i + 1) % points.length]!,
        side: 'left',
        roomName,
      });
      if (!r.ok) throw new Error(r.reason.key);
    });
  };
  return { store, level, room, area, box, loop, roomName };
}

describe('Room separators and Merge Rooms (ticket 10)', () => {
  it('splits the Living / Eetkamer open space into the tape areas 11.09 and 9.46 m²', () => {
    const { store, level, area, loop, roomName } = setup();
    // The open space: Eetkamer 2.65 × 3.57 behind Living 3.34 × 3.32 (the stair takes the rest).
    loop([
      { x: 0, y: -3570 },
      { x: 2650, y: -3570 },
      { x: 2650, y: 0 },
      { x: 3340, y: 0 },
      { x: 3340, y: 3320 },
      { x: 0, y: 3320 },
    ]);
    expect(Object.keys(store.model().rooms)).toHaveLength(1);
    const result = store.run(drawRoomSeparator, {
      level,
      start: { x: 0, y: 0 },
      end: { x: 2650, y: 0 },
      roomName,
    });
    expect(result.ok).toBe(true);
    const names = Object.values(store.model().rooms).map((r) => r.name);
    expect(names).toHaveLength(2);
    const areas = names.map((n) => area(n)).sort();
    expect(areas).toEqual([11.09, 9.46].sort());
  });

  it('refuses a Room separator whose ends are not on Wall faces', () => {
    const { store, level, box, roomName } = setup();
    box('Living', 0, 0, 3340, 3320);
    const result = store.run(drawRoomSeparator, {
      level,
      start: { x: 500, y: 1000 },
      end: { x: 3340, y: 1000 },
      roomName,
    });
    expect(!result.ok && result.reason.key).toBe('commands.separator.notOnWalls');
  });

  it('merges two Rooms sharing a whole Wall into one, closing the corners', () => {
    const { store, box, area } = setup();
    box('Keuken', 0, 0, 2670, 3730);
    box('Achterhal', 0, -4080, 2670, -140);
    const result = store.run(mergeRooms, {
      keep: Object.values(store.model().rooms)[0]!.id,
      other: Object.values(store.model().rooms)[1]!.id,
    });
    expect(result.ok).toBe(true);
    expect(Object.values(store.model().rooms).map((r) => r.name)).toEqual(['Keuken']);
    expect(area('Keuken')).toBe(m2(2670 * 3730 + 2670 * 3940 + 2670 * 140));
  });

  it('merges two Rooms sharing part of a Wall into an L-shaped Room (the halls)', () => {
    const { store, box, area, room } = setup();
    box('Hal', 0, 0, 1730, 3000);
    box('Gang', 0, -3140, 1000, -140); // narrower, behind
    const result = store.run(mergeRooms, { keep: room('Hal').id, other: room('Gang').id });
    expect(result.ok).toBe(true);
    expect(area('Hal')).toBe(m2(1730 * 3000 + 1000 * 3000 + 1000 * 140));
    expect(store.values.room(room('Hal').id).detection()?.status).toBe('enclosed');
    // The corner where the Wall was cut is a proper corner: no Wall end is left unconnected.
    expect(store.values.level(Object.keys(store.model().levels)[0] as LevelId).warnings()).toEqual(
      [],
    );
  });

  it('merges two Rooms split by a Room separator by removing the separator', () => {
    const { store, level, room, box, roomName } = setup();
    box('Open', 0, 0, 3340, 6890);
    store.run(drawRoomSeparator, {
      level,
      start: { x: 0, y: 3570 },
      end: { x: 3340, y: 3570 },
      roomName,
    });
    const [a, b] = Object.values(store.model().rooms);
    const result = store.run(mergeRooms, { keep: a!.id, other: b!.id });
    expect(result.ok).toBe(true);
    expect(Object.keys(store.model().roomSeparators)).toHaveLength(0);
    expect(m2(store.values.room(room('Open').id).netFloorArea())).toBe(m2(3340 * 6890));
  });

  it('refuses to merge Rooms that are not neighbours', () => {
    const { store, box, room } = setup();
    box('A', 0, 0, 2000, 2000);
    box('B', 5000, 0, 7000, 2000);
    const result = store.run(mergeRooms, { keep: room('A').id, other: room('B').id });
    expect(!result.ok && result.reason.key).toBe('commands.merge.notNeighbours');
  });

  it('lists the Level warnings: not enclosed, sharing one area, unconnected Wall ends', () => {
    const { store, level, box } = setup();
    box('Keuken', 0, 0, 2670, 3730);
    box('Achterhal', 0, -4080, 2670, -140);
    expect(store.values.level(level).warnings()).toEqual([]);
    const shared = Object.values(store.model().walls).find(
      (w) => w.start.y === 0 && w.end.y === 0,
    )!;
    store.run(deleteElements, { walls: [shared.id], rooms: [] });
    const keys = store.values
      .level(level)
      .warnings()
      .map((w) => w.key);
    expect(keys.filter((k) => k === 'warnings.notEnclosed')).toHaveLength(2);
    expect(keys).toContain('warnings.unconnectedEnds');
  });
});
