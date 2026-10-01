import { addOpening } from '../commands/add-opening';
import { drawRoom } from '../commands/draw-room';
import { addLevel } from '../commands/levels';
import { counterIds } from '../model/ids';
import { createProject } from '../model/new-project';
import type { LevelId, Wall } from '../model/types';
import { ProjectStore } from '../store/project-store';
import { facadeTree, type QuantityFacade } from './facades';

function setup() {
  const ids = counterIds();
  const store = new ProjectStore(createProject({ name: 'T', levelName: 'Ground floor' }, ids), ids);
  const level = Object.keys(store.model().levels)[0] as LevelId;
  const draw = (name: string, x0: number, y0: number, x1: number, y1: number, on = level) => {
    const result = store.run(drawRoom, {
      level: on,
      from: { x: x0, y: y0 },
      to: { x: x1, y: y1 },
      size: 'inside',
      name,
    });
    if (!result.ok) throw new Error(`${name}: ${result.reason.key}`);
  };
  return { store, level, draw };
}

const sum = (xs: readonly number[]) => xs.reduce((a, b) => a + b, 0);
const side = (tree: readonly QuantityFacade[], s: QuantityFacade['side']) =>
  tree.find((f) => f.side === s)!;

describe('the exterior Façades (ticket 13)', () => {
  it("groups the reference house's outside Wall faces into four Façades", () => {
    const { store, draw } = setup();
    draw('Keuken', 0, 0, 2670, 3730);
    draw('Achterhal', 0, -140 - 3940, 2670, -140);
    draw('Badkamer', 0, -280 - 3940 - 1910, 2950, -280 - 3940);
    draw('Berging', 0, -420 - 3940 - 1910 - 1940, 3010, -420 - 3940 - 1910);
    draw('WC', 0, -140 - 3940, 1120, -140 - 3940 + 1000);
    draw('Eetkamer', 0, 3730 + 140, 2650, 3730 + 140 + 3570);
    draw('Living', 0, 3730 + 280 + 3570, 3340, 3730 + 280 + 3570 + 3320);

    const tree = facadeTree(store.model(), store.values, 'exact');
    expect(tree.map((f) => f.side)).toEqual(['front', 'back', 'left', 'right']);
    const level = Object.values(store.model().levels)[0]!;
    const height = level.storeyHeight;

    // The front is mostly the Living's outside face (its inside width and both Wall thicknesses),
    // plus the narrow steps where a Room behind is wider than the one in front of it.
    const front = side(tree, 'front');
    const widest = Math.max(...front.parts.map((p) => p.gross));
    expect(Math.round(widest)).toBe(Math.round((3340 + 280) * height));
    expect(front.parts.length).toBeGreaterThan(1);
    // The left side is flat: every Room starts at x = 0.
    expect(side(tree, 'left').parts).toHaveLength(1);
    // The right side steps with the Rooms' widths, so it splits into parts.
    expect(side(tree, 'right').parts.length).toBeGreaterThan(1);

    // Every outside face is in one Façade: together they wrap the footprint.
    const outer = store.values.level(level.id).footprint().outer;
    const perimeter = sum(
      outer.flatMap((ring) =>
        ring.map((a, i) => {
          const b = ring[(i + 1) % ring.length]!;
          return Math.hypot(b.x - a.x, b.y - a.y);
        }),
      ),
    );
    expect(Math.round(sum(tree.map((f) => f.gross)))).toBe(Math.round(perimeter * height));
  });

  it("splits an L-shaped house's front into two Façade parts that add up to the Façade", () => {
    const { store, draw } = setup();
    draw('Garage', 0, 0, 4000, 3000);
    draw('Hall', 0, 3140, 2000, 6000);
    const front = side(facadeTree(store.model(), store.values, 'exact'), 'front');
    expect(front.parts).toHaveLength(2);
    expect(Math.round(sum(front.parts.map((p) => p.gross)))).toBe(Math.round(front.gross));
    expect(Math.round(sum(front.parts.map((p) => p.net)))).toBe(Math.round(front.net));
    // Seen from the front, left to right: the Hall's face, then the Garage's beside it.
    const lengths = front.parts.map((p) => Math.round(sum(p.faces.map((f) => f.length))));
    expect(lengths).toEqual([2000 + 280, 4000 + 280 - (2000 + 280)]);
  });

  it('applies the Measurement rule to Façades as to inside faces', () => {
    const { store, draw } = setup();
    draw('Hall', 0, 0, 3000, 3000);
    const wall = Object.values(store.model().walls).find(
      (w: Wall) => w.start.y === 3000 && w.end.y === 3000,
    )!;
    store.run(addOpening, { wall: wall.id, kind: 'window', offset: 1000, width: 400, height: 400 });
    const exact = side(facadeTree(store.model(), store.values, 'exact'), 'front');
    const masonry = side(facadeTree(store.model(), store.values, 'belgianMasonry'), 'front');
    expect(exact.openings).toBe(400 * 400);
    expect(masonry.openings).toBe(0);
    expect(masonry.net - exact.net).toBe(400 * 400);
    expect(masonry.gross).toBe(exact.gross);
  });

  it('gives each Façade its totals per Level, adding up to the whole height', () => {
    const { store, level, draw } = setup();
    draw('Hall', 0, 0, 3000, 3000);
    store.run(addLevel, { relativeTo: level, position: 'above', name: 'First floor' });
    const first = Object.values(store.model().levels).find((l) => l.name === 'First floor')!;
    draw('Bedroom', 0, 0, 3000, 3000, first.id);
    const front = side(facadeTree(store.model(), store.values, 'exact'), 'front');
    expect(front.levels.map((l) => l.name)).toEqual(['Ground floor', 'First floor']);
    expect(Math.round(sum(front.levels.map((l) => l.gross)))).toBe(Math.round(front.gross));
    expect(Math.round(front.levels[1]!.gross)).toBe(Math.round((3000 + 280) * first.storeyHeight));
    // One plane over both Levels: one part, with a face per Level.
    expect(front.parts).toHaveLength(1);
    expect(front.parts[0]!.faces).toHaveLength(2);
  });
});
