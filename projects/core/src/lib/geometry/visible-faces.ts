/**
 * The visible parts of Wall faces (ticket 34): a long face minus where it lies against another
 * Wall (a T, the solid corner of ticket 25), split where a Room separator ends on it. They are
 * the stretches a Room or the outside sees, the ones the Quantities measure, worked out per Wall
 * from its neighbours so the plan can label them on every frame of a drag.
 */
import type { RoomSeparator, Vec, Wall, WallId } from '../model/types';
import { boundingBox, boxesOverlap, distanceToSegment } from './polygon';
import { cross, sub } from './vec';
import type { WallOutline } from './wall-outlines';

/** One visible stretch of a Wall face, from a to b along the face. */
export interface VisibleStretch {
  /** Which long face: 'lo' is the outline's first edge (0 → 1), 'hi' its opposite (3 → 2) */
  readonly side: 'lo' | 'hi';
  readonly a: Vec;
  readonly b: Vec;
}

/**
 * Stretches by outline (outlines are memoised per Wall, ticket 16), with the neighbours and
 * separators they were worked out among: during a drag only the moved Walls' change.
 */
const CACHE = new WeakMap<
  WallOutline,
  {
    readonly others: readonly WallOutline[];
    readonly separators: readonly RoomSeparator[];
    readonly stretches: VisibleStretch[];
  }
>();

/** mm: closer than this to another Wall's outline counts as against it */
const ON = 0.5;
/** mm: separator ends lie on a face within this */
const ON_SEPARATOR = 1;
/** mm: shorter visible pieces are slivers between touching outlines */
const MIN = 1;

/** The visible stretches of both long faces of every Wall (or those asked for), by Wall. */
export function visibleStretches(
  walls: readonly Wall[],
  outlines: ReadonlyMap<WallId, WallOutline>,
  separators: readonly RoomSeparator[],
  /** Only these Walls' stretches (the ones in view); every Wall still counts as a neighbour */
  only?: ReadonlySet<WallId>,
): Map<WallId, VisibleStretch[]> {
  const list = walls.flatMap((w) => {
    const o = outlines.get(w.id);
    return o ? [{ id: w.id, o, box: grow(boundingBox(o)) }] : [];
  });
  const out = new Map<WallId, VisibleStretch[]>();
  for (const { id, o, box } of list) {
    if (only && !only.has(id)) continue;
    const others = list.filter((x) => x.id !== id && boxesOverlap(box, x.box)).map((x) => x.o);
    // The same outline among the same neighbours and separators: the stretches are too.
    const cached = CACHE.get(o);
    if (cached && sameItems(cached.separators, separators) && sameItems(cached.others, others)) {
      out.set(id, cached.stretches);
      continue;
    }
    const stretches: VisibleStretch[] = [];
    for (const [side, a, b] of [
      ['lo', o[0], o[1]],
      ['hi', o[3], o[2]],
    ] as const) {
      for (const [t0, t1] of visible(a, b, others, separators))
        stretches.push({ side, a: at(a, b, t0), b: at(a, b, t1) });
    }
    CACHE.set(o, { others, separators, stretches });
    out.set(id, stretches);
  }
  return out;
}

/** The same elements in the same order (the lists themselves may be new). */
const sameItems = (a: readonly unknown[], b: readonly unknown[]) =>
  a.length === b.length && a.every((x, i) => x === b[i]);

const grow = (b: ReturnType<typeof boundingBox>) => ({
  min: { x: b.min.x - ON, y: b.min.y - ON },
  max: { x: b.max.x + ON, y: b.max.y + ON },
});

const at = (a: Vec, b: Vec, t: number): Vec => ({
  x: a.x + (b.x - a.x) * t,
  y: a.y + (b.y - a.y) * t,
});

/** The parts (0..1 along a → b) of a face not against another outline, split at separators. */
function visible(
  a: Vec,
  b: Vec,
  others: readonly WallOutline[],
  separators: readonly RoomSeparator[],
): [number, number][] {
  const length = Math.hypot(b.x - a.x, b.y - a.y);
  if (length < MIN) return [];
  let parts: [number, number][] = [[0, 1]];
  for (const o of others) {
    const hit = clip(a, b, o);
    if (hit) parts = parts.flatMap(([s, e]) => minus(s, e, hit[0], hit[1]));
  }
  // A Room separator ending on the face splits it: each side is another Room's.
  for (const s of separators)
    for (const p of [s.start, s.end]) {
      if (distanceToSegment(p, a, b) > ON_SEPARATOR) continue;
      const t = ((p.x - a.x) * (b.x - a.x) + (p.y - a.y) * (b.y - a.y)) / (length * length);
      parts = parts.flatMap(([s0, e0]) =>
        t > s0 && t < e0
          ? ([
              [s0, t],
              [t, e0],
            ] as [number, number][])
          : [[s0, e0]],
      );
    }
  return parts.filter(([s, e]) => (e - s) * length >= MIN);
}

/** [s, e] minus [c0, c1]. */
function minus(s: number, e: number, c0: number, c1: number): [number, number][] {
  if (c1 <= s || c0 >= e) return [[s, e]];
  const out: [number, number][] = [];
  if (c0 > s) out.push([s, c0]);
  if (c1 < e) out.push([c1, e]);
  return out;
}

/**
 * Where an outline lies against the segment a → b, as 0..1 along it: the part of the outline
 * within ON of the face line, projected onto it. A corner merely touching the face (a mitre
 * meeting its end) gives a sliver shorter than MIN, which doesn't count.
 */
function clip(a: Vec, b: Vec, o: WallOutline): [number, number] | null {
  const d = sub(b, a);
  const len = Math.hypot(d.x, d.y);
  const u = { x: d.x / len, y: d.y / len };
  const across = (p: Vec) => cross(u, sub(p, a));
  const along = (p: Vec) => (p.x - a.x) * u.x + (p.y - a.y) * u.y;
  // The outline clipped to the strip |across| <= ON (Sutherland–Hodgman, two half-planes).
  let ring: Vec[] = [...o];
  for (const k of [1, -1]) {
    const inside = (p: Vec) => k * across(p) <= ON;
    const next: Vec[] = [];
    ring.forEach((p, i) => {
      const q = ring[(i + 1) % ring.length]!;
      const pi = inside(p);
      const qi = inside(q);
      if (pi) next.push(p);
      if (pi !== qi) {
        const ap = k * across(p) - ON;
        const aq = k * across(q) - ON;
        const t = ap / (ap - aq);
        next.push({ x: p.x + (q.x - p.x) * t, y: p.y + (q.y - p.y) * t });
      }
    });
    ring = next;
    if (!ring.length) return null;
  }
  const ts = ring.map(along);
  const lo = Math.max(0, Math.min(...ts));
  const hi = Math.min(len, Math.max(...ts));
  if (hi - lo < MIN) return null;
  return [lo / len, hi / len];
}
