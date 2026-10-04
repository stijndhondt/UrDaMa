import { drawRoom } from '../commands/draw-room';
import { drawRoomSeparator } from '../commands/draw-room-separator';
import { drawWall } from '../commands/draw-wall';
import { counterIds } from '../model/ids';
import { createProject } from '../model/new-project';
import type { LevelId, Vec } from '../model/types';
import { ProjectStore } from '../store/project-store';
import { visibleStretches } from './visible-faces';

function project() {
  const ids = counterIds();
  const store = new ProjectStore(createProject({ name: 'T', levelName: 'Ground floor' }, ids), ids);
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
  return { store, level, draw };
}

/** A segment as text that ignores its direction and sub-mm noise. */
const key = ([a, b]: readonly [Vec, Vec]) => {
  const p = [a, b].map((v) => `${Math.round(v.x)},${Math.round(v.y)}`).sort();
  return `${p[0]} ${p[1]}`;
};

/** The visible stretches against the Room and outside faces' segments (long faces only). */
function compare(store: ProjectStore, level: LevelId) {
  const lv = store.values.level(level);
  const faces = [...lv.roomSurfaces().values()]
    .flatMap((s) => s.faces)
    .concat(lv.outsideFaces())
    .filter((f) => f.face !== 'end');
  const expected = faces.flatMap((f) => f.segments.map(key)).sort();
  const slice = lv.slice();
  const actual = [...visibleStretches(slice.walls, lv.outlines(), slice.separators).values()]
    .flat()
    .map((s) => key([s.a, s.b]))
    .sort();
  return { expected, actual };
}

describe('Visible stretches of Wall faces (ticket 34)', () => {
  it('on a grid of Rooms: each Room side its own 3.00 m, nothing running into the corners', () => {
    const { store, level, draw } = project();
    for (let j = 0; j < 4; j++)
      for (let i = 0; i < 4; i++)
        draw(`R${i}-${j}`, i * 3140, j * 3140, i * 3140 + 3000, j * 3140 + 3000);
    const { expected, actual } = compare(store, level);
    expect(actual).toEqual(expected);
    // An inner Room (R1-1) sees 3.00 m on each of its four sides, where the outline faces of the
    // Walls it borders run 3.14 m into the corners; those stretches are among the visible ones.
    const lv = store.values.level(level);
    const inner = Object.values(store.model().rooms).find((r) => r.name === 'R1-1')!;
    const sides = lv
      .roomSurfaces()
      .get(inner.id)!
      .faces.filter((f) => f.face !== 'end');
    expect(sides.map((f) => Math.round(f.length))).toEqual([3000, 3000, 3000, 3000]);
    for (const f of sides) for (const seg of f.segments) expect(actual).toContain(key(seg));
  });

  it('on the reference house', () => {
    const { store, level, draw } = project();
    draw('Keuken', 0, 0, 2670, 3730);
    draw('Achterhal', 0, -140 - 3940, 2670, -140);
    draw('Badkamer', 0, -280 - 3940 - 1910, 2950, -280 - 3940);
    draw('Berging', 0, -420 - 3940 - 1910 - 1940, 3010, -420 - 3940 - 1910);
    draw('WC', 0, -140 - 3940, 1120, -140 - 3940 + 1000);
    draw('Eetkamer', 0, 3730 + 140, 2650, 3730 + 140 + 3570);
    draw('Living', 0, 3730 + 280 + 3570, 3340, 3730 + 280 + 3570 + 3320);
    const { expected, actual } = compare(store, level);
    expect(actual).toEqual(expected);
  });

  it('keeps the whole faces of a free-standing Wall and of an unfinished Room visible', () => {
    const { store, level } = project();
    const wall = (start: Vec, end: Vec) =>
      store.run(drawWall, { level, start, end, side: 'left', roomName: (i) => `N${i}` });
    wall({ x: 0, y: 10000 }, { x: 4000, y: 10000 });
    // Three Walls of a Room not yet closed.
    wall({ x: 0, y: 0 }, { x: 3000, y: 0 });
    wall({ x: 3000, y: 0 }, { x: 3000, y: 3000 });
    wall({ x: 3000, y: 3000 }, { x: 0, y: 3000 });
    const { expected, actual } = compare(store, level);
    expect(actual).toEqual(expected);
    const lv = store.values.level(level);
    const free = lv.slice().walls.find((w) => w.start.y === 10000)!;
    const stretches = visibleStretches(lv.slice().walls, lv.outlines(), [])
      .get(free.id)!
      .map((s) => Math.round(Math.hypot(s.b.x - s.a.x, s.b.y - s.a.y)));
    expect(stretches).toEqual([4000, 4000]);
  });

  it('splits a face where a Room separator ends on it', () => {
    const { store, level, draw } = project();
    draw('Hall', 0, 0, 6000, 3000);
    const r = store.run(drawRoomSeparator, {
      level,
      start: { x: 2500, y: 0 },
      end: { x: 2500, y: 3000 },
      roomName: (i) => `Part ${i}`,
    });
    expect(r.ok).toBe(true);
    const { expected, actual } = compare(store, level);
    expect(actual).toEqual(expected);
    expect(actual.length).toBeGreaterThan(8);
  });
});
