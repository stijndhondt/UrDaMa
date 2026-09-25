import { counterIds } from '../model/ids';
import { createProject } from '../model/new-project';
import type { Command } from './command';
import type { LevelId, Vec, Wall, WallId } from '../model/types';
import { message } from '../model/message';
import { ProjectStore } from '../store/project-store';
import { drawWall, type DrawWallArgs } from './draw-wall';

function setup() {
  const ids = counterIds();
  const store = new ProjectStore(createProject({ name: 'T', levelName: 'Ground floor' }, ids), ids);
  const level = Object.keys(store.model().levels)[0] as LevelId;
  let n = 0;
  const wall = (start: Vec, end: Vec, side: DrawWallArgs['side'] = 'right') => {
    const result = store.run(drawWall, { level, start, end, side, roomName: () => `Room ${++n}` });
    if (!result.ok) throw new Error(result.reason.key);
    return result;
  };
  const walls = () => Object.values(store.model().walls);
  const conns = () => Object.values(store.model().wallConnections);
  return { store, level, wall, walls, conns };
}

const round = (v: Vec) => ({ x: Math.round(v.x * 1000) / 1000, y: Math.round(v.y * 1000) / 1000 });

describe('drawWall (ticket 07)', () => {
  it('draws a free Wall with no connections', () => {
    const { wall, walls, conns } = setup();
    wall({ x: 0, y: 0 }, { x: 3730, y: 0 });
    expect(walls()).toHaveLength(1);
    expect(conns()).toHaveLength(0);
  });

  it('connects a Wall starting at a free Wall end as a corner, and a third one as a T', () => {
    const { wall, conns } = setup();
    wall({ x: 0, y: 0 }, { x: 3000, y: 0 });
    wall({ x: 3000, y: 0 }, { x: 3000, y: 2000 });
    expect(conns().map((c) => c.kind)).toEqual(['corner']);
    wall({ x: 3000, y: 0 }, { x: 5000, y: 0 });
    expect(
      conns()
        .map((c) => c.kind)
        .sort(),
    ).toEqual(['corner', 'tee']);
  });

  it('T-connects a Wall ending on another Wall face', () => {
    const { wall, conns } = setup();
    wall({ x: 0, y: 0 }, { x: 4000, y: 0 }); // occupies y 0..140
    wall({ x: 2000, y: 2000 }, { x: 2000, y: 140 }, 'centre');
    expect(conns()).toHaveLength(1);
    expect(conns()[0]!.kind).toBe('tee');
  });

  it('splits a Wall drawn through another Wall into two, T-connected to both faces', () => {
    const { wall, walls, conns } = setup();
    wall({ x: 0, y: 0 }, { x: 4000, y: 0 }); // occupies y 0..140
    wall({ x: 2000, y: -1000 }, { x: 2000, y: 1000 }, 'centre');
    const vertical = walls().filter((w) => w.start.x === 2000);
    expect(vertical).toHaveLength(2);
    expect(vertical.map((w) => [round(w.start).y, round(w.end).y])).toEqual([
      [-1000, 0],
      [140, 1000],
    ]);
    expect(conns().filter((c) => c.kind === 'tee')).toHaveLength(2);
  });

  it('moves a Wall drawn onto another Wall against its face, side by side', () => {
    const { wall, walls } = setup();
    wall({ x: 0, y: 0 }, { x: 3000, y: 0 }); // occupies y 0..140
    wall({ x: 500, y: 80 }, { x: 2500, y: 80 }); // would occupy y 80..220
    const moved = walls().find((w) => w.start.x === 500)!;
    expect(round(moved.start).y).toBe(140);
  });

  it('creates a Room when a Wall closes a loop', () => {
    const { store, wall } = setup();
    // Clockwise, thickness to the right (outward = left on a clockwise loop → use 'left').
    wall({ x: 0, y: 0 }, { x: 2670, y: 0 }, 'left');
    wall({ x: 2670, y: 0 }, { x: 2670, y: 3730 }, 'left');
    wall({ x: 2670, y: 3730 }, { x: 0, y: 3730 }, 'left');
    expect(Object.keys(store.model().rooms)).toHaveLength(0);
    wall({ x: 0, y: 3730 }, { x: 0, y: 0 }, 'left');
    const rooms = Object.values(store.model().rooms);
    expect(rooms.map((r) => r.name)).toEqual(['Room 1']);
    expect(Math.round(store.values.room(rooms[0]!.id).netFloorArea()! / 1e4) / 100).toBe(9.96);
  });

  it('keeps a Room on one side when a new Wall splits it, and makes a Room of the other side', () => {
    const { store, wall } = setup();
    wall({ x: 0, y: 0 }, { x: 2670, y: 0 }, 'left');
    wall({ x: 2670, y: 0 }, { x: 2670, y: 3730 }, 'left');
    wall({ x: 2670, y: 3730 }, { x: 0, y: 3730 }, 'left');
    wall({ x: 0, y: 3730 }, { x: 0, y: 0 }, 'left');
    wall({ x: -1000, y: 1800 }, { x: 3670, y: 1800 }); // right across, over the Room's Seed point
    const rooms = Object.values(store.model().rooms);
    expect(rooms.map((r) => r.name).sort()).toEqual(['Room 1', 'Room 2']);
    for (const r of rooms) expect(store.values.room(r.id).detection()?.status).toBe('enclosed');
  });

  it('never lets Walls overlap: a command that would is refused', () => {
    const { store, level, wall } = setup();
    wall({ x: 0, y: 0 }, { x: 3000, y: 0 });
    const overlapping: Command<null> = (model) => {
      const w: Wall = {
        id: 'wal_x' as WallId,
        level,
        start: { x: 100, y: 50 },
        end: { x: 900, y: 50 },
        side: 'right',
        roomBounding: true,
      };
      return {
        ok: true,
        model: { ...model, walls: { ...model.walls, [w.id]: w } },
        label: message('test'),
      };
    };
    const result = store.run(overlapping, null);
    expect(!result.ok && result.reason.key).toBe('invariants.overlap');
  });

  it('refuses a Wall that is too short', () => {
    const { store, level } = setup();
    const result = store.run(drawWall, {
      level,
      start: { x: 0, y: 0 },
      end: { x: 5, y: 0 },
      side: 'right',
      roomName: () => 'R',
    });
    expect(!result.ok && result.reason.key).toBe('commands.drawWall.tooShort');
  });
});
