import {
  counterIds,
  createProject,
  drawRoom,
  levelWallOutlines,
  ProjectStore,
  type LevelId,
  type Vec,
} from '@urdama/core';
import { alignToCorners, outerCornerStart } from './snap';

/** Room 1: 5.00 × 4.00 m inside at the origin, 140 mm Walls (outside -140..5140, -140..4140). */
function room1() {
  const ids = counterIds();
  const store = new ProjectStore(createProject({ name: 'T', levelName: 'G' }, ids), ids);
  const level = Object.keys(store.model().levels)[0] as LevelId;
  store.run(drawRoom, {
    level,
    from: { x: 0, y: 0 },
    to: { x: 5000, y: 4000 },
    size: 'inside',
    name: 'Room 1',
  });
  const outlines = [...levelWallOutlines(store.model(), level).values()];
  /** Draws a Room from the outer bottom-left corner the way the Room tool reads it. */
  const drawFrom = (corner: Vec, to: Vec) => {
    const from = outerCornerStart(corner, to, outlines, 140);
    store.run(drawRoom, { level, from, to, size: 'inside', name: 'Room 2' });
    return from;
  };
  return { store, outlines, drawFrom };
}

const corner = { x: -140, y: 4140 };

describe("the Room tool's outer-corner rule (ticket 26)", () => {
  it('drawn right and down from the outer corner, shares the bottom Wall with flush outer faces', () => {
    const { store, drawFrom } = room1();
    expect(drawFrom(corner, { x: 5000, y: 6430 })).toEqual({ x: 0, y: 4140 });
    // The new left Wall's outside lines up with Room 1's at x = -140.
    const xs = Object.values(store.model().walls).flatMap((w) => [w.start.x, w.end.x]);
    expect(Math.min(...xs)).toBe(0);
    const room = Object.values(store.model().rooms).find((r) => r.name === 'Room 2')!;
    expect(store.values.room(room.id).detection()?.status).toBe('enclosed');
  });

  it('drawn up and left from it, shares the left Wall with flush outer faces', () => {
    const { outlines } = room1();
    expect(outerCornerStart(corner, { x: -2000, y: 1000 }, outlines, 140)).toEqual({
      x: -140,
      y: 4000,
    });
  });

  it('drawn diagonally away, takes the corner as it is', () => {
    const { outlines } = room1();
    expect(outerCornerStart(corner, { x: -2000, y: 6000 }, outlines, 140)).toEqual(corner);
  });

  it('leaves an inside corner as it is', () => {
    const { outlines } = room1();
    // Room 1's inside bottom-left corner, drawn up into Room 1 or down through its Wall.
    expect(outerCornerStart({ x: 0, y: 4000 }, { x: 2000, y: 2000 }, outlines, 140)).toEqual({
      x: 0,
      y: 4000,
    });
    expect(outerCornerStart({ x: 0, y: 4000 }, { x: 2000, y: 6000 }, outlines, 140)).toEqual({
      x: 0,
      y: 4000,
    });
  });
});

describe('alignment guides (ticket 26)', () => {
  it("lines a point up with another Wall's outer corner, each axis on its own", () => {
    const { outlines } = room1();
    // Near the line x = 5140 (Room 1's right outside), far below it.
    const a = alignToCorners({ x: 5146, y: 6433 }, outlines, 12);
    expect(a.x).toBe(5140);
    expect(a.y).toBeUndefined();
    expect(a.guides).toHaveLength(1);
    expect(a.guides[0]!.from.x).toBe(5140);
  });

  it('lines up both axes at once, and leaves a point with nothing in line alone', () => {
    const { outlines } = room1();
    const both = alignToCorners({ x: 5136, y: -137 }, outlines, 12);
    expect([both.x, both.y]).toEqual([5140, -140]);
    const free = alignToCorners({ x: 2500, y: 9000 }, outlines, 12);
    expect([free.x, free.y]).toEqual([undefined, undefined]);
    expect(free.guides).toEqual([]);
  });
});
