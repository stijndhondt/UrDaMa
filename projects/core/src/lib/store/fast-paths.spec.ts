/**
 * The speed-ups of ticket 15 must never change results: re-detecting Seed points is skipped only
 * when no Seed point can be displaced, and the overlap check only looks at the changed Walls.
 */
import { drawRoom } from '../commands/draw-room';
import { drawWall } from '../commands/draw-wall';
import { moveWall } from '../commands/move-wall';
import { setWallThickness } from '../commands/set-wall-thickness';
import { changedWalls } from '../model/invariants';
import { wallNormal } from '../geometry/wall-outlines';
import { counterIds } from '../model/ids';
import { createProject } from '../model/new-project';
import type { LevelId, Wall } from '../model/types';
import { ProjectStore } from './project-store';

const m2 = (mm2: number | null | undefined) => (mm2 == null ? null : Math.round(mm2 / 1e4) / 100);

function setup() {
  const ids = counterIds();
  const store = new ProjectStore(createProject({ name: 'T', levelName: 'Ground floor' }, ids), ids);
  const level = Object.keys(store.model().levels)[0] as LevelId;
  const room = (name: string) => Object.values(store.model().rooms).find((r) => r.name === name)!;
  const area = (name: string) => m2(store.values.room(room(name).id).netFloorArea());
  return { store, level, room, area };
}

describe('fast paths keep the results exact', () => {
  it("moves a Room's Seed point when a Wall is dragged across it", () => {
    const { store, level, room, area } = setup();
    store.run(drawRoom, {
      level,
      from: { x: 0, y: 0 },
      to: { x: 3000, y: 3000 },
      size: 'inside',
      name: 'A',
    });
    store.run(drawRoom, {
      level,
      from: { x: 3140, y: 0 },
      to: { x: 6140, y: 3000 },
      size: 'inside',
      name: 'B',
    });
    const shared = Object.values(store.model().walls).find(
      (w: Wall) => w.start.x === w.end.x && w.start.x > 2900 && w.start.x < 3200,
    )!;
    const seed = room('A').seed;
    // Towards A, past A's Seed point: A keeps the smaller area, B gets the rest.
    const offset = -2000 * Math.sign(wallNormal(shared).x);
    expect(store.run(moveWall, { wall: shared.id, offset }).ok).toBe(true);
    expect(room('A').seed).not.toEqual(seed);
    expect(area('A')).toBe(3);
    expect(area('B')).toBe(m2(5000 * 3000));
  });

  it('refuses dragging a free-standing Wall into another one', () => {
    const { store, level } = setup();
    store.run(drawRoom, {
      level,
      from: { x: 0, y: 0 },
      to: { x: 3000, y: 3000 },
      size: 'inside',
      name: 'A',
    });
    store.run(drawWall, {
      level,
      start: { x: 0, y: 5000 },
      end: { x: 3000, y: 5000 },
      side: 'centre',
      roomName: () => 'X',
    });
    const free = Object.values(store.model().walls).find((w) => w.start.y === 5000)!;
    const before = store.model();
    const offset = -1930 * Math.sign(wallNormal(free).y);
    const result = store.run(moveWall, { wall: free.id, offset });
    expect(!result.ok && result.reason.key).toBe('invariants.overlap');
    expect(store.model()).toBe(before);
  });

  it("counts a thicker Wall's partners as changed (their mitres move)", () => {
    const { store, level } = setup();
    store.run(drawRoom, {
      level,
      from: { x: 0, y: 0 },
      to: { x: 3000, y: 3000 },
      size: 'inside',
      name: 'A',
    });
    const wall = Object.values(store.model().walls)[0]!;
    const before = store.model();
    expect(store.run(setWallThickness, { wall: wall.id, thickness: 300 }).ok).toBe(true);
    const changed = changedWalls(before, store.model())!;
    const partners = Object.values(store.model().wallConnections)
      .filter((c) => c.wall === wall.id || c.to === wall.id)
      .flatMap((c) => [c.wall, c.to]);
    expect(partners.length).toBeGreaterThan(0);
    for (const id of partners) expect(changed.has(id)).toBe(true);
  });

  it('keeps a Room detected while Walls of an acute-angled Room are dragged', () => {
    const { store, level } = setup();
    // A long, thin triangle: the corner at (8000, 0) is about 11°, so its mitre reaches far.
    const points = [
      { x: 0, y: 0 },
      { x: 8000, y: 0 },
      { x: 0, y: 1600 },
    ];
    points.forEach((p, i) =>
      store.run(drawWall, {
        level,
        start: p,
        end: points[(i + 1) % points.length]!,
        side: 'left',
        roomName: () => 'Tri',
      }),
    );
    const room = Object.values(store.model().rooms)[0]!;
    const walls = Object.values(store.model().walls);
    for (const w of walls) {
      for (const offset of [-200, 150, -400]) {
        const result = store.run(moveWall, { wall: w.id, offset });
        if (!result.ok) continue;
        const d = store.values.room(room.id).detection();
        expect(d?.status).toBe('enclosed');
      }
    }
  });
});
