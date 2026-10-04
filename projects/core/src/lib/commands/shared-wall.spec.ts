import { serializeProject } from '../file/project-file';
import { counterIds } from '../model/ids';
import { wallNumbers } from '../model/levels';
import { createProject } from '../model/new-project';
import type { LevelId, Wall } from '../model/types';
import { ProjectStore } from '../store/project-store';
import { drawRoom } from './draw-room';
import { moveWall } from './move-wall';
import { resizeRoom } from './resize-room';

/** Rooms of 3.00 × 3.00 m inside, each drawn on its own, 140 mm Walls between them. */
function grid(columns: number, rows: number) {
  const ids = counterIds();
  const store = new ProjectStore(
    createProject({ name: 'Grid', levelName: 'Ground floor' }, ids),
    ids,
  );
  const level = Object.keys(store.model().levels)[0] as LevelId;
  const draw = (name: string, x: number, y: number, w = 3000, h = 3000) => {
    const r = store.run(drawRoom, {
      level,
      from: { x, y },
      to: { x: x + w, y: y + h },
      size: 'inside',
      name,
    });
    if (!r.ok) throw new Error(`${name}: ${r.reason.key}`);
  };
  for (let j = 0; j < rows; j++)
    for (let i = 0; i < columns; i++) draw(`R${i}-${j}`, i * 3140, j * 3140);
  const size = (name: string) => {
    const room = Object.values(store.model().rooms).find((r) => r.name === name)!;
    const d = store.values.level(level).footprint().rooms.get(room.id);
    if (!d || d.status === 'notEnclosed') return null;
    const xs = d.area.outline.map((p) => p.x);
    const ys = d.area.outline.map((p) => p.y);
    return [Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)];
  };
  const sizes = () =>
    Object.fromEntries(Object.values(store.model().rooms).map((r) => [r.name, size(r.name)]));
  /** The vertical Wall whose Baseline runs at x and spans y, such as the one between two Rooms */
  const vertical = (x: number, y: number) =>
    Object.values(store.model().walls).find(
      (w: Wall) =>
        w.start.x === x &&
        w.end.x === x &&
        Math.min(w.start.y, w.end.y) <= y &&
        Math.max(w.start.y, w.end.y) >= y,
    )!;
  return { store, level, draw, sizes, vertical };
}

/** The Wall a Wall's T end is carried by. */
const hostOf = (store: ProjectStore, wall: Wall) =>
  Object.values(store.model().wallConnections).find((c) => c.kind === 'tee' && c.wall === wall.id)
    ?.to;

/** The horizontal Wall whose Baseline runs at y and spans x. */
const horizontal = (store: ProjectStore, y: number, x: number) =>
  Object.values(store.model().walls).find(
    (w: Wall) =>
      w.start.y === y &&
      w.end.y === y &&
      Math.min(w.start.x, w.end.x) <= x &&
      Math.max(w.start.x, w.end.x) >= x,
  )?.id;

/** mm along the Wall's normal that moves a vertical Wall by dx (its normal may point either way). */
const offsetFor = (w: Wall, dx: number) => (w.end.y > w.start.y ? -dx : dx);

describe('Moving a shared Wall carries its T-connections along (ticket 35)', () => {
  it('to the left: the Room on the left shrinks, the one on the right grows, nothing else moves', () => {
    const { store, sizes, vertical } = grid(4, 4);
    const before = sizes();
    // The Wall between R1-2 and R2-2 (R1-2's right Wall), 1.50 m to the left.
    const wall = vertical(3140 + 3000, 2 * 3140 + 1500);
    expect(wall).toBeDefined();
    const r = store.run(moveWall, { wall: wall.id, offset: offsetFor(wall, -1500) });
    expect(r.ok).toBe(true);
    const after = sizes();
    expect(after['R1-2']).toEqual([1500, 3000]);
    expect(after['R2-2']).toEqual([4500, 3000]);
    for (const name of Object.keys(before))
      if (name !== 'R1-2' && name !== 'R2-2') expect(after[name]).toEqual(before[name]);
    // R1-3's right Wall, a T at the old corner, is now carried by R2-2's bottom Wall.
    expect(hostOf(store, vertical(3140 + 3000, 3 * 3140 + 1500))).toBe(
      horizontal(store, 2 * 3140 + 3000, 2 * 3140 + 1500),
    );
  });

  it('to the right: the other way round', () => {
    const { store, sizes, vertical } = grid(4, 4);
    const before = sizes();
    const wall = vertical(3140 + 3000, 2 * 3140 + 1500);
    const r = store.run(moveWall, { wall: wall.id, offset: offsetFor(wall, 1500) });
    expect(r.ok).toBe(true);
    const after = sizes();
    expect(after['R1-2']).toEqual([4500, 3000]);
    expect(after['R2-2']).toEqual([1500, 3000]);
    for (const name of Object.keys(before))
      if (name !== 'R1-2' && name !== 'R2-2') expect(after[name]).toEqual(before[name]);
    // The moved Wall's own top end is now carried by R2-1's bottom Wall.
    expect(hostOf(store, wall)).toBe(horizontal(store, 3140 + 3000, 2 * 3140 + 1500));
  });

  it('undo puts every connection back exactly', () => {
    const { store, vertical } = grid(4, 4);
    const text = serializeProject(store.model());
    const wall = vertical(3140 + 3000, 2 * 3140 + 1500);
    store.run(moveWall, { wall: wall.id, offset: offsetFor(wall, -1500) });
    store.undo();
    expect(serializeProject(store.model())).toBe(text);
  });

  it('refuses a move that leaves a T with no Wall to carry it, naming the Walls by number', () => {
    // A and B side by side, B shallower; C under A, its right Wall a T on A's bottom Wall at the
    // corner. Moving the Wall between A and B to the left leaves nothing under C's right Wall.
    const { store, level, draw } = grid(0, 0);
    draw('A', 0, 0);
    draw('B', 3140, 0, 3000, 2000);
    draw('C', 0, 3140);
    const shared = Object.values(store.model().walls).find(
      (w: Wall) => w.start.x === w.end.x && w.start.x === 3000,
    )!;
    const before = store.model();
    const r = store.run(moveWall, { wall: shared.id, offset: offsetFor(shared, -1500) });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.reason.key).toBe('commands.moveWall.noHost');
    const numbers = new Set([...wallNumbers(store.model(), level).values()]);
    expect(numbers.has(r.reason.params!['wall'] as number)).toBe(true);
    expect(numbers.has(r.reason.params!['host'] as number)).toBe(true);
    expect(store.model()).toBe(before);
  });
});

describe("A Room's width or depth falls back to moving the shared Wall (ticket 36)", () => {
  const room = (store: ProjectStore, name: string) =>
    Object.values(store.model().rooms).find((r) => r.name === name)!;

  it('grows R2-2 to the left by moving its shared Wall when the row cannot be pushed', () => {
    const { store, sizes } = grid(4, 4);
    const before = sizes();
    const r = store.run(resizeRoom, {
      room: room(store, 'R2-2').id,
      axis: 'x',
      size: 4500,
      side: 'min',
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.patch.label).toEqual({
      key: 'commands.resizeRoom.sharedWall',
      params: { name: 'R2-2' },
    });
    const after = sizes();
    expect(after['R2-2']).toEqual([4500, 3000]);
    expect(after['R1-2']).toEqual([1500, 3000]);
    for (const name of Object.keys(before))
      if (name !== 'R1-2' && name !== 'R2-2') expect(after[name]).toEqual(before[name]);
    // One undo step.
    store.undo();
    expect(sizes()).toEqual(before);
  });

  it('works for the depth too', () => {
    const { store, sizes } = grid(4, 4);
    const r = store.run(resizeRoom, {
      room: room(store, 'R2-2').id,
      axis: 'y',
      size: 4000,
      side: 'max',
    });
    expect(r.ok).toBe(true);
    const after = sizes();
    expect(after['R2-2']).toEqual([3000, 4000]);
    expect(after['R2-3']).toEqual([3000, 2000]);
  });

  it('gives one message with both reasons, Walls by number, when neither works', () => {
    const { store, level } = grid(4, 4);
    const before = store.model();
    // 7 m to the left: no push, and the shared Wall would run through R1-2's other Walls.
    const r = store.run(resizeRoom, {
      room: room(store, 'R2-2').id,
      axis: 'x',
      size: 7000,
      side: 'min',
    });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.reason.key).toBe('commands.resizeRoom.neither');
    const numbers = new Set<unknown>([...wallNumbers(store.model(), level).values()]);
    const p = r.reason.params!;
    expect(p['push']).toBe('skewed');
    expect(['skewed', 'overlap', 'noHost']).toContain(p['move']);
    for (const k of ['pushA', 'moveA']) expect(numbers.has(p[k])).toBe(true);
    expect(store.model()).toBe(before);
  });
});
