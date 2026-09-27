import { counterIds } from '../model/ids';
import { createProject } from '../model/new-project';
import type { LevelId, Wall } from '../model/types';
import { ProjectStore } from '../store/project-store';
import { drawRoom } from './draw-room';
import { drawWall } from './draw-wall';
import { setWallLength } from './set-wall-length';

const m2 = (mm2: number | null | undefined) => (mm2 == null ? null : Math.round(mm2 / 1e4) / 100);

/** The reference house ground floor, drawn with the Room tool at its tape sizes. */
function referenceHouse() {
  const ids = counterIds();
  const store = new ProjectStore(
    createProject({ name: 'Thuis', levelName: 'Gelijkvloers' }, ids),
    ids,
  );
  const level = Object.keys(store.model().levels)[0] as LevelId;
  const draw = (name: string, x0: number, y0: number, x1: number, y1: number) => {
    const r = store.run(drawRoom, {
      level,
      from: { x: x0, y: y0 },
      to: { x: x1, y: y1 },
      size: 'inside',
      name,
    });
    if (!r.ok) throw new Error(`${name}: ${r.reason.key}`);
  };
  draw('Keuken', 0, 0, 2670, 3730);
  draw('Achterhal', 0, -140 - 3940, 2670, -140);
  draw('Badkamer', 0, -280 - 3940 - 1910, 2950, -280 - 3940);
  draw('Berging', 0, -420 - 3940 - 1910 - 1940, 3010, -420 - 3940 - 1910);
  draw('Eetkamer', 0, 3730 + 140, 2650, 3730 + 140 + 3570);
  draw('Living', 0, 3730 + 280 + 3570, 3340, 3730 + 280 + 3570 + 3320);
  const areas = () =>
    Object.fromEntries(
      Object.values(store.model().rooms).map((r) => [
        r.name,
        m2(store.values.room(r.id).netFloorArea()),
      ]),
    );
  /** The Keuken's top Wall: horizontal, along its inside face at y = 0. */
  const keukenTop = () =>
    Object.values(store.model().walls).find(
      (w) =>
        w.start.y === w.end.y &&
        w.start.y >= -140 &&
        w.start.y <= 0 &&
        Math.min(w.start.x, w.end.x) <= 0 &&
        Math.max(w.start.x, w.end.x) >= 2670,
    )!;
  return { store, level, areas, keukenTop };
}

/** The end of a horizontal Wall that lies to the right. */
const rightEnd = (w: Wall) => (w.end.x > w.start.x ? 'end' : 'start');
const length = (w: Wall) => Math.hypot(w.end.x - w.start.x, w.end.y - w.start.y);

describe("typing a Wall's length (slice 2, ticket 01)", () => {
  it("Move Room: the Keuken's top Wall 2.67 → 2.70 m to the right widens the Keuken, every other Room keeps its size", () => {
    const { store, areas, keukenTop } = referenceHouse();
    const before = areas();
    const wall = keukenTop();
    expect(length(wall)).toBe(2670);
    const result = store.run(setWallLength, {
      wall: wall.id,
      length: 2700,
      end: rightEnd(wall),
      mode: 'room',
    });
    expect(result.ok).toBe(true);
    const after = areas();
    expect(after['Keuken']).toBe(10.07);
    for (const name of Object.keys(before))
      if (name !== 'Keuken') expect(after[name]).toBe(before[name]);
    expect(length(store.model().walls[wall.id]!)).toBe(2700);
  });

  it('Move Room, both ends: each side moves half the difference', () => {
    const { store, areas, keukenTop } = referenceHouse();
    const wall = keukenTop();
    const left = Math.min(wall.start.x, wall.end.x);
    const result = store.run(setWallLength, {
      wall: wall.id,
      length: 2870,
      end: 'both',
      mode: 'room',
    });
    expect(result.ok).toBe(true);
    const moved = store.model().walls[wall.id]!;
    expect(Math.min(moved.start.x, moved.end.x)).toBe(left - 100);
    expect(length(moved)).toBe(2870);
    expect(areas()['Keuken']).toBe(m2(2870 * 3730));
  });

  it('Only this Wall: its end moves and the Wall connected there tilts, its far end staying put', () => {
    const ids = counterIds();
    const store = new ProjectStore(
      createProject({ name: 'T', levelName: 'Ground floor' }, ids),
      ids,
    );
    const level = Object.keys(store.model().levels)[0] as LevelId;
    const roomName = () => 'Room';
    store.run(drawWall, {
      level,
      start: { x: 0, y: 0 },
      end: { x: 3000, y: 0 },
      side: 'left',
      roomName,
    });
    store.run(drawWall, {
      level,
      start: { x: 3000, y: 0 },
      end: { x: 3000, y: 2000 },
      side: 'left',
      roomName,
    });
    const walls = Object.values(store.model().walls);
    const first = walls.find((w) => w.start.y === 0 && w.end.y === 0)!;
    const second = walls.find((w) => w.id !== first.id)!;
    expect(Object.values(store.model().wallConnections)).toHaveLength(1);

    const result = store.run(setWallLength, {
      wall: first.id,
      length: 3500,
      end: rightEnd(first),
      mode: 'wall',
    });
    expect(result.ok).toBe(true);
    const a = store.model().walls[first.id]!;
    const b = store.model().walls[second.id]!;
    expect(Math.max(a.start.x, a.end.x)).toBe(3500);
    // The corner point moved with it; the second Wall's far end did not.
    const corner = a.end.x > a.start.x ? a.end : a.start;
    expect([b.start, b.end]).toContainEqual(corner);
    expect([b.start, b.end]).toContainEqual({ x: 3000, y: 2000 });
  });

  it('refuses a length that is too short or unchanged, leaving the model as it was', () => {
    const { store, keukenTop } = referenceHouse();
    const wall = keukenTop();
    const before = store.model();
    const short = store.run(setWallLength, { wall: wall.id, length: 20, end: 'end', mode: 'room' });
    expect(!short.ok && short.reason.key).toBe('commands.wallLength.tooShort');
    const same = store.run(setWallLength, {
      wall: wall.id,
      length: 2670,
      end: 'end',
      mode: 'room',
    });
    expect(!same.ok && same.reason.key).toBe('commands.wallLength.same');
    expect(store.model()).toBe(before);
  });

  it("refuses Only this Wall at an end that sits against another Wall's face (a T)", () => {
    const ids = counterIds();
    const store = new ProjectStore(
      createProject({ name: 'T', levelName: 'Ground floor' }, ids),
      ids,
    );
    const level = Object.keys(store.model().levels)[0] as LevelId;
    const roomName = () => 'Room';
    store.run(drawWall, {
      level,
      start: { x: 0, y: 0 },
      end: { x: 4000, y: 0 },
      side: 'centre',
      roomName,
    });
    store.run(drawWall, {
      level,
      start: { x: 2000, y: 70 },
      end: { x: 2000, y: 2000 },
      side: 'centre',
      roomName,
    });
    const tee = Object.values(store.model().wallConnections).find((c) => c.kind === 'tee');
    expect(tee).toBeDefined();
    const before = store.model();
    const result = store.run(setWallLength, {
      wall: tee!.wall,
      length: 2500,
      end: tee!.end,
      mode: 'wall',
    });
    expect(!result.ok && result.reason.key).toBe('commands.wallLength.teeEnd');
    expect(store.model()).toBe(before);
  });

  it('is one undo step', () => {
    const { store, keukenTop } = referenceHouse();
    const before = store.model();
    const wall = keukenTop();
    store.run(setWallLength, { wall: wall.id, length: 2700, end: rightEnd(wall), mode: 'room' });
    store.undo();
    expect(store.model()).toEqual(before);
  });

  it('refuses Move Room when the Wall that must shift cannot follow, and says to use Only this Wall', () => {
    const ids = counterIds();
    const store = new ProjectStore(
      createProject({ name: 'T', levelName: 'Ground floor' }, ids),
      ids,
    );
    const level = Object.keys(store.model().levels)[0] as LevelId;
    const roomName = () => 'Room';
    // A triangle: the long side is diagonal, so the Walls around it cannot shift along it.
    const points = [
      { x: 0, y: 0 },
      { x: 4000, y: 0 },
      { x: 0, y: 3000 },
    ];
    points.forEach((p, i) =>
      store.run(drawWall, { level, start: p, end: points[(i + 1) % 3]!, side: 'left', roomName }),
    );
    const diagonal = Object.values(store.model().walls).find(
      (w) => w.start.x !== w.end.x && w.start.y !== w.end.y,
    )!;
    const before = store.model();
    const result = store.run(setWallLength, {
      wall: diagonal.id,
      length: 5200,
      end: 'end',
      mode: 'room',
    });
    expect(!result.ok && result.reason.key).toBe('commands.wallLength.cannotShift');
    expect(store.model()).toBe(before);
    // Only this Wall works on the same Wall.
    expect(
      store.run(setWallLength, { wall: diagonal.id, length: 5200, end: 'end', mode: 'wall' }).ok,
    ).toBe(true);
  });
});
