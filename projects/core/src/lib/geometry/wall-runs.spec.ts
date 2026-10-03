import { addOpening } from '../commands/add-opening';
import { drawRoom } from '../commands/draw-room';
import { counterIds } from '../model/ids';
import { createProject } from '../model/new-project';
import type { LevelId, Wall } from '../model/types';
import { ProjectStore } from '../store/project-store';

/** Room 1, 5.00 × 4.00 m inside at the origin, and Room 2 behind it (below on the plan). */
function rooms(room2Width: number) {
  const ids = counterIds();
  const store = new ProjectStore(createProject({ name: 'T', levelName: 'G' }, ids), ids);
  const level = Object.keys(store.model().levels)[0] as LevelId;
  const draw = (name: string, x0: number, y0: number, x1: number, y1: number) =>
    store.run(drawRoom, {
      level,
      from: { x: x0, y: y0 },
      to: { x: x1, y: y1 },
      size: 'inside',
      name,
    });
  draw('Room 1', 0, 0, 5000, 4000);
  draw('Room 2', 0, 4140, room2Width, 6430);
  return { store, level, runs: () => store.values.level(level).wallRuns() };
}

describe('Wall runs (ticket 27)', () => {
  it('gives each straight side of two Rooms one behind the other its overall outside length', () => {
    const { runs } = rooms(5000);
    const sides = runs()
      .map((r) => ({ length: Math.round(r.length), walls: r.walls.length, normal: r.normal }))
      .sort((a, b) => a.normal.x - b.normal.x);
    // The left and right sides, from -140 to 6570: 4.28 m + 2.43 m.
    expect(sides).toEqual([
      { length: 6710, walls: 2, normal: { x: -1, y: 0 } },
      { length: 6710, walls: 2, normal: { x: 1, y: 0 } },
    ]);
  });

  it('stops at a step in the outside line, and gives a single Wall none', () => {
    // Room 2 is 30 cm wider: its right Wall's outside is 30 cm further out.
    const { runs } = rooms(5300);
    const all = runs();
    expect(all).toHaveLength(1);
    expect(all[0]!.normal).toEqual({ x: -1, y: 0 });
  });

  it('runs on across an Opening', () => {
    const { store, runs } = rooms(5000);
    const left = Object.values(store.model().walls).find(
      (w: Wall) => w.start.x === w.end.x && w.start.x === 0 && Math.max(w.start.y, w.end.y) > 4000,
    )!;
    store.run(addOpening, { wall: left.id, kind: 'window', offset: 500 });
    expect(runs().map((r) => Math.round(r.length))).toEqual([6710, 6710]);
  });
});
