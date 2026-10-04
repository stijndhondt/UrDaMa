/**
 * Ticket 02, the geometry go / no-go: one edit + full re-detection of Rooms must stay under
 * 16 ms (95th percentile) on the reference house and on a ~200-Wall plan (ADR 0003, ADR 0005).
 */
import type {
  LevelId,
  RoomId,
  Vec,
  Wall,
  WallConnection,
  WallConnectionId,
  WallId,
} from '../model/types';
import { footprint } from './footprint';
import { wallOutlines } from './wall-outlines';

const L1 = 'lvl_1' as LevelId;
const PRESET = 140;
const RUNS = 200;

interface Plan {
  walls: Wall[];
  conns: WallConnection[];
  seeds: { room: RoomId; seed: Vec }[];
}

/** One Room as four Walls around its inside size (thickness outward, mitred corners). */
function addBox(plan: Plan, name: string, x: number, y: number, w: number, d: number) {
  const pts: Vec[] = [
    { x, y },
    { x: x + w, y },
    { x: x + w, y: y + d },
    { x, y: y + d },
  ];
  for (let i = 0; i < 4; i++) {
    plan.walls.push({
      id: `${name}-${i}` as WallId,
      level: L1,
      start: pts[i]!,
      end: pts[(i + 1) % 4]!,
      side: 'left',
      roomBounding: true,
    });
    plan.conns.push({
      id: `${name}-c${i}` as WallConnectionId,
      wall: `${name}-${i}` as WallId,
      end: 'end',
      kind: 'corner',
      to: `${name}-${(i + 1) % 4}` as WallId,
      toEnd: 'start',
    });
  }
  plan.seeds.push({ room: name as RoomId, seed: { x: x + w / 2, y: y + d / 2 } });
}

/** The reference house ground floor, one box per rectangular Room at its tape size. */
function referenceHouse(): Plan {
  const plan: Plan = { walls: [], conns: [], seeds: [] };
  const t = 2 * PRESET;
  let y = 0;
  for (const [name, w, d] of [
    ['Berging', 3010, 1940],
    ['Badkamer', 2950, 1910],
    ['Achterhal', 2670, 3940],
    ['Keuken', 2670, 3730],
  ] as const) {
    addBox(plan, name, 3000, y, w, d);
    y += d + t;
  }
  addBox(plan, 'Eetkamer', 0, y, 2650, 3570);
  addBox(plan, 'Living', 0, y + 3570 + t, 3340, 3320);
  addBox(plan, 'Hal', 3340 + t, y, 1000, 6760);
  return plan;
}

/** A k×k grid of Rooms from shared, centred Walls extended over the crossings: 2k(k+1) Walls. */
function grid(k: number): Plan {
  const plan: Plan = { walls: [], conns: [], seeds: [] };
  const X = [0],
    Y = [0];
  for (let i = 0; i < k; i++) {
    X.push(X[i]! + 2600 + ((i * 7) % 5) * 300);
    Y.push(Y[i]! + 2400 + ((i * 5) % 4) * 350);
  }
  const h = PRESET / 2;
  let n = 0;
  for (let i = 0; i <= k; i++)
    for (let j = 0; j < k; j++)
      plan.walls.push({
        id: `v${n++}` as WallId,
        level: L1,
        start: { x: X[i]!, y: Y[j]! - h },
        end: { x: X[i]!, y: Y[j + 1]! + h },
        side: 'centre',
        roomBounding: true,
      });
  for (let j = 0; j <= k; j++)
    for (let i = 0; i < k; i++)
      plan.walls.push({
        id: `h${n++}` as WallId,
        level: L1,
        start: { x: X[i]! - h, y: Y[j]! },
        end: { x: X[i + 1]! + h, y: Y[j]! },
        side: 'centre',
        roomBounding: true,
      });
  for (let i = 0; i < k; i++)
    for (let j = 0; j < k; j++)
      plan.seeds.push({
        room: `r${i}-${j}` as RoomId,
        seed: { x: (X[i]! + X[i + 1]!) / 2, y: (Y[j]! + Y[j + 1]!) / 2 },
      });
  return plan;
}

function detect(plan: Plan) {
  const outlines = wallOutlines(plan.walls, plan.conns, PRESET);
  return footprint({ outlines: [...outlines.values()], separators: [], seeds: plan.seeds });
}

/** Times RUNS edits (a Wall nudged 10 mm back and forth), each followed by full re-detection. */
function bench(plan: Plan) {
  detect(plan); // warm-up
  const target = plan.walls.findIndex((w) => w.start.x === w.end.x);
  const times: number[] = [];
  for (let i = 0; i < RUNS; i++) {
    const w = plan.walls[target]!;
    const dx = i % 2 ? -10 : 10;
    plan.walls[target] = {
      ...w,
      start: { x: w.start.x + dx, y: w.start.y },
      end: { x: w.end.x + dx, y: w.end.y },
    };
    const t0 = performance.now();
    detect(plan);
    times.push(performance.now() - t0);
  }
  times.sort((a, b) => a - b);
  const at = (q: number) => times[Math.min(times.length - 1, Math.floor(q * times.length))]!;
  return { median: at(0.5), p95: at(0.95), worst: times[times.length - 1]! };
}

describe('geometry benchmark (ticket 02)', () => {
  it('detects the reference house Rooms at exactly their tape sizes', () => {
    const fp = detect(referenceHouse());
    const area = (name: string) => {
      const d = fp.rooms.get(name as RoomId)!;
      return d.status === 'enclosed' ? Math.round(d.area.area / 1e4) / 100 : NaN;
    };
    expect(area('Keuken')).toBe(9.96);
    expect(area('Badkamer')).toBe(5.63);
    expect(area('Berging')).toBe(5.84);
    expect(area('Living')).toBe(11.09);
    expect(area('Eetkamer')).toBe(9.46);
  });

  it.each([
    ['reference house', referenceHouse()],
    ['~200-Wall grid', grid(10)],
  ])('re-detects all Rooms after an edit in < 24 ms (95th percentile) on the %s', (label, plan) => {
    const r = bench(plan);
    console.log(
      `[benchmark] ${label}: ${plan.walls.length} Walls, ${plan.seeds.length} Rooms — median ${r.median.toFixed(2)} ms, ` +
        `p95 ${r.p95.toFixed(2)} ms, worst ${r.worst.toFixed(2)} ms`,
    );
    // The frame budget is 16 ms; the slack is for a busy machine, as in the edit benchmark.
    expect(r.p95).toBeLessThan(24);
  });
});
