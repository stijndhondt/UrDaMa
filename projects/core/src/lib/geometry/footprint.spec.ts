import type {
  LevelId,
  RoomId,
  Vec,
  Wall,
  WallConnection,
  WallConnectionId,
  WallId,
} from '../model/types';
import { footprint, type FootprintInput } from './footprint';
import { wallOutlines } from './wall-outlines';

const L1 = 'lvl_1' as LevelId;
const m2 = (mm2: number) => mm2 / 1e6;

/** A closed box of four Walls whose inside faces are the given rectangle (thickness outward). */
function box(
  prefix: string,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  t = 140,
  skip: string[] = [],
) {
  const pts: Vec[] = [
    { x: x0, y: y0 },
    { x: x1, y: y0 },
    { x: x1, y: y1 },
    { x: x0, y: y1 },
  ];
  const walls: Wall[] = [];
  const conns: WallConnection[] = [];
  for (let i = 0; i < 4; i++) {
    const id = `${prefix}${i}`;
    if (skip.includes(id)) continue;
    walls.push({
      id: id as WallId,
      level: L1,
      start: pts[i]!,
      end: pts[(i + 1) % 4]!,
      side: 'left',
      thickness: t,
      roomBounding: true,
    });
  }
  for (let i = 0; i < 4; i++) {
    const a = `${prefix}${i}`,
      b = `${prefix}${(i + 1) % 4}`;
    if (skip.includes(a) || skip.includes(b)) continue;
    conns.push({
      id: `c${a}` as WallConnectionId,
      wall: a as WallId,
      end: 'end',
      kind: 'corner',
      to: b as WallId,
      toEnd: 'start',
    });
  }
  return { walls, conns };
}

function input(
  parts: { walls: Wall[]; conns: WallConnection[] }[],
  seeds: [string, number, number][],
  separators: FootprintInput['separators'] = [],
): FootprintInput {
  const walls = parts.flatMap((p) => p.walls);
  const conns = parts.flatMap((p) => p.conns);
  return {
    outlines: [...wallOutlines(walls, conns, 140).values()],
    separators,
    seeds: seeds.map(([room, x, y]) => ({ room: room as RoomId, seed: { x, y } })),
  };
}

describe('footprint (room detection as holes in the merged wall footprint)', () => {
  it('finds a closed box as one enclosed area of exactly its inside size', () => {
    const fp = footprint(input([box('k', 0, 0, 2670, 3730)], [['keuken', 1300, 1800]]));
    const k = fp.rooms.get('keuken' as RoomId)!;
    expect(k.status).toBe('enclosed');
    expect(k.status === 'enclosed' && m2(k.area.area)).toBeCloseTo(9.9591, 6);
    expect(m2(fp.grossArea)).toBeCloseTo((2.67 + 0.28) * (3.73 + 0.28), 6);
  });

  it('splits an open space with a Room separator', () => {
    const fp = footprint(
      input(
        [box('f', 0, 0, 3340, 6890)],
        [
          ['living', 1500, 5000],
          ['eetkamer', 1500, 1500],
        ],
        [{ start: { x: 0, y: 3570 }, end: { x: 3340, y: 3570 } }],
      ),
    );
    const living = fp.rooms.get('living' as RoomId)!;
    const eet = fp.rooms.get('eetkamer' as RoomId)!;
    expect(living.status === 'enclosed' && m2(living.area.area)).toBeCloseTo(3.34 * 3.32, 2);
    expect(eet.status === 'enclosed' && m2(eet.area.area)).toBeCloseTo(3.34 * 3.57, 2);
  });

  it('reports a Room as not enclosed when its Seed point is inside a Wall or its outline has a gap', () => {
    const inWall = footprint(input([box('k', 0, 0, 2670, 3730)], [['r', -70, 1000]]));
    expect(inWall.rooms.get('r' as RoomId)!.status).toBe('notEnclosed');
    const gap = footprint(input([box('k', 0, 0, 2670, 3730, 140, ['k1'])], [['r', 1300, 1800]]));
    expect(gap.rooms.get('r' as RoomId)!.status).toBe('notEnclosed');
  });

  it('flags two Seed points in one area as sharing one area', () => {
    const fp = footprint(
      input(
        [box('k', 0, 0, 2670, 3730)],
        [
          ['a', 500, 500],
          ['b', 2000, 3000],
        ],
      ),
    );
    expect(fp.rooms.get('a' as RoomId)!.status).toBe('sharingArea');
    expect(fp.rooms.get('b' as RoomId)!.status).toBe('sharingArea');
  });

  it('subtracts a free-standing box inside a Room from the outer Room', () => {
    const outer = box('o', 0, 0, 4000, 5000);
    const inner = box('i', 1000, 1000, 2000, 2000, 100); // inside 1×1 m, outside 1.2×1.2 m
    const fp = footprint(
      input(
        [outer, inner],
        [
          ['outer', 3500, 4500],
          ['inner', 1500, 1500],
        ],
      ),
    );
    const o = fp.rooms.get('outer' as RoomId)!;
    const i = fp.rooms.get('inner' as RoomId)!;
    expect(o.status === 'enclosed' && m2(o.area.area)).toBeCloseTo(20 - 1.44, 6);
    expect(i.status === 'enclosed' && m2(i.area.area)).toBeCloseTo(1, 6);
  });

  it('ignores enclosed slivers below 0.01 m² as rounding leftovers', () => {
    const tiny = box('s', 0, 0, 50, 50); // 0.0025 m² inside
    const room = box('r', 1000, 0, 2000, 1000);
    const fp = footprint(input([tiny, room], []));
    expect(fp.areas.map((a) => Math.round(m2(a.area) * 100) / 100)).toEqual([1]);
  });
});
