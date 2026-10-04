/**
 * Invariants checked at the end of every command (ticket 11): a command that would break one is
 * refused and changes nothing, so the model can never be saved in a broken state.
 */
import {
  Clipper64,
  ClipType,
  FillRule,
  area as pathArea,
  isPositive,
  type Path64,
} from 'clipper2-ts';
import { message, type Message } from './message';
import { wallNumbers } from './levels';
import { resolveOpening } from './opening-types';
import type { LevelId, Model, WallId } from './types';
import { distance } from '../geometry/vec';
import { levelWallOutlines } from '../geometry/level-geometry';
import { boundingBox, boxesOverlap } from '../geometry/polygon';
import { fullThicknessSpan, wallOutlines, type WallOutline } from '../geometry/wall-outlines';

/** Wall outlines overlapping by more than this (mm²) count as overlapping. */
const OVERLAP_TOLERANCE_MM2 = 10;
const UNITS = 1000;

const toPath = (ring: readonly { x: number; y: number }[]): Path64 => {
  const p = ring.map((v) => ({ x: Math.round(v.x * UNITS), y: Math.round(v.y * UNITS) }));
  return isPositive(p) ? p : p.reverse();
};
const areaOf = (paths: Path64[]) =>
  paths.reduce((s, p) => s + Math.abs(pathArea(p)), 0) / (UNITS * UNITS);
function union(paths: Path64[]): Path64[] {
  const clipper = new Clipper64();
  clipper.addSubject(paths);
  const out: Path64[] = [];
  clipper.execute(ClipType.Union, FillRule.NonZero, out);
  return out;
}
function overlapArea(a: WallOutline, b: WallOutline): number {
  const clipper = new Clipper64();
  clipper.addSubject([toPath(a)]);
  clipper.addClip([toPath(b)]);
  const out: Path64[] = [];
  clipper.execute(ClipType.Intersection, FillRule.NonZero, out);
  return areaOf(out);
}

/**
 * Penetration below this (mm) counts as merely touching: Walls up to 100 m long overlapping by
 * less cannot reach OVERLAP_TOLERANCE_MM2.
 */
const TOUCHING_MM = 1e-4;

function convex(ring: WallOutline): boolean {
  let sign = 0;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i]!;
    const b = ring[(i + 1) % ring.length]!;
    const c = ring[(i + 2) % ring.length]!;
    const cross = (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x);
    if (Math.abs(cross) < 1e-9) continue;
    if (sign && Math.sign(cross) !== sign) return false;
    sign = Math.sign(cross);
  }
  return true;
}

/** Separating-axis test for two convex outlines: true when they at most touch. */
function separated(a: WallOutline, b: WallOutline): boolean {
  for (const ring of [a, b]) {
    for (let i = 0; i < ring.length; i++) {
      const p = ring[i]!;
      const q = ring[(i + 1) % ring.length]!;
      const len = Math.hypot(q.x - p.x, q.y - p.y);
      if (len < 1e-9) continue;
      const n = { x: -(q.y - p.y) / len, y: (q.x - p.x) / len };
      const project = (r: WallOutline) => r.map((v) => v.x * n.x + v.y * n.y);
      const pa = project(a);
      const pb = project(b);
      const overlap =
        Math.min(Math.max(...pa), Math.max(...pb)) - Math.max(Math.min(...pa), Math.min(...pb));
      if (overlap <= TOUCHING_MM) return true;
    }
  }
  return false;
}

/** Whether two Wall outlines overlap by more than the tolerance. */
function overlapping(a: WallOutline, b: WallOutline): boolean {
  if (convex(a) && convex(b) && separated(a, b)) return false;
  return overlapArea(a, b) > OVERLAP_TOLERANCE_MM2;
}

/**
 * The first pair of Walls on a Level whose outlines overlap, if any (Walls never overlap).
 * With `only`, just the pairs involving those Walls are checked (the ones a command changed).
 */
export function overlappingWalls(
  model: Model,
  level: LevelId,
  only?: ReadonlySet<string>,
): readonly [WallId, WallId] | null {
  const walls = Object.values(model.walls).filter((w) => w.level === level);
  if (walls.length < 2) return null;
  const ids = new Set<string>(walls.map((w) => w.id));
  const outlines = wallOutlines(
    walls,
    Object.values(model.wallConnections).filter((c) => ids.has(c.wall)),
    model.project.presets.wallThickness,
  );
  const list = [...outlines.entries()];
  if (only) {
    const boxes = new Map(list.map(([id, o]) => [id, boundingBox(o)]));
    for (const [id, o] of list) {
      if (!only.has(id)) continue;
      const a = boxes.get(id)!;
      for (const [other, p] of list) {
        if (other === id || (only.has(other) && other < id)) continue;
        if (!boxesOverlap(a, boxes.get(other)!)) continue;
        if (overlapping(o, p)) return [id, other];
      }
    }
    return null;
  }
  const paths = list.map(([, o]) => toPath(o));
  // Cheap check first: the union of all outlines is as large as their sum when nothing overlaps.
  if (areaOf(paths) - areaOf(union(paths)) <= OVERLAP_TOLERANCE_MM2) return null;
  for (let i = 0; i < list.length; i++)
    for (let j = i + 1; j < list.length; j++)
      if (overlapArea(list[i]![1], list[j]![1]) > OVERLAP_TOLERANCE_MM2)
        return [list[i]![0], list[j]![0]];
  return null;
}

/**
 * Checks every invariant. With `before` (the model the command started from), the overlap check
 * only looks at the Walls the command changed, and the Walls whose connections changed.
 */
export function checkInvariants(model: Model, before?: Model): Message | null {
  const has = (collection: keyof Model, id: string) =>
    Object.hasOwn(model[collection] as object, id);
  const missing = (what: string, id: string) =>
    message('invariants.missingReference', { what, id });

  for (const l of Object.values(model.levels))
    if (!has('buildings', l.building)) return missing('building', l.building);
  for (const s of Object.values(model.slabs))
    if (!has('levels', s.level)) return missing('level', s.level);
  for (const w of Object.values(model.walls)) {
    if (!has('levels', w.level)) return missing('level', w.level);
    if (distance(w.start, w.end) <= 0) return message('invariants.zeroLength', { id: w.id });
  }
  const corners = new Set<string>();
  for (const c of Object.values(model.wallConnections)) {
    if (!has('walls', c.wall)) return missing('wall', c.wall);
    if (!has('walls', c.to)) return missing('wall', c.to);
    if (c.kind === 'corner') {
      for (const key of [`${c.wall}:${c.end}`, `${c.to}:${c.toEnd}`]) {
        if (corners.has(key)) return message('invariants.twoCorners', { wall: key.split(':')[0]! });
        corners.add(key);
      }
    }
  }
  const byWall = new Map<string, { start: number; end: number; id: string }[]>();
  const outlinesOf = new Map<LevelId, ReadonlyMap<WallId, WallOutline>>();
  for (const t of Object.values(model.openingTypes)) {
    if (!has('openingFamilies', t.family)) return missing('openingFamily', t.family);
    if (!(t.width > 0 && t.height > 0)) return message('commands.opening.badSize');
  }
  for (const opening of Object.values(model.openings)) {
    if (!has('walls', opening.wall)) return missing('wall', opening.wall);
    if (!has('openingTypes', opening.type)) return missing('openingType', opening.type);
    const o = resolveOpening(model, opening)!;
    const wall = model.walls[o.wall]!;
    let outlines = outlinesOf.get(wall.level);
    if (!outlines) {
      outlines = levelWallOutlines(model, wall.level);
      outlinesOf.set(wall.level, outlines);
    }
    const outline = outlines.get(wall.id);
    const span = outline
      ? fullThicknessSpan(wall, outline)
      : { start: 0, end: distance(wall.start, wall.end) };
    if (o.offset < span.start - 0.5 || o.offset + o.width > span.end + 0.5) {
      return message('invariants.openingOutsideWall', { id: o.id });
    }
    const list = byWall.get(o.wall) ?? [];
    for (const other of list) {
      if (o.offset < other.end - 0.5 && other.start < o.offset + o.width - 0.5) {
        return message('invariants.openingsOverlap', { a: other.id, b: o.id });
      }
    }
    list.push({ start: o.offset, end: o.offset + o.width, id: o.id });
    byWall.set(o.wall, list);
  }
  for (const r of Object.values(model.rooms))
    if (!has('levels', r.level)) return missing('level', r.level);
  for (const s of Object.values(model.roomSeparators)) {
    if (!has('levels', s.level)) return missing('level', s.level);
    if (!has('walls', s.startWall)) return missing('wall', s.startWall);
    if (!has('walls', s.endWall)) return missing('wall', s.endWall);
  }
  for (const c of Object.values(model.ceilings))
    if (!has('rooms', c.room)) return missing('room', c.room);
  const changed = before ? changedWalls(before, model) : null;
  for (const level of Object.keys(model.levels)) {
    if (changed && ![...changed].some((id) => model.walls[id]?.level === level)) continue;
    const pair = overlappingWalls(model, level as LevelId, changed ?? undefined);
    if (pair) {
      // Named as the Building panel numbers them, as every refusal names Walls.
      const numbers = wallNumbers(model, level as LevelId);
      return message('invariants.overlap', {
        a: numbers.get(pair[0]) ?? 0,
        b: numbers.get(pair[1]) ?? 0,
      });
    }
  }
  return null;
}

/**
 * Walls whose outline may differ between two models: changed or new Walls, both Walls of every
 * changed, new or removed connection (a mitre becomes a square end, and so on), and the direct
 * partners of all of those. Null when a Preset change may have changed every outline.
 */
export function changedWalls(before: Model, after: Model): Set<string> | null {
  if (before.project.presets.wallThickness !== after.project.presets.wallThickness) return null;
  const changed = new Set<string>();
  for (const [id, w] of Object.entries(after.walls)) if (before.walls[id] !== w) changed.add(id);
  const ids = new Set([
    ...Object.keys(before.wallConnections),
    ...Object.keys(after.wallConnections),
  ]);
  for (const id of ids) {
    const a = before.wallConnections[id];
    const b = after.wallConnections[id];
    if (a === b) continue;
    for (const c of [a, b]) if (c) changed.add(c.wall).add(c.to);
  }
  // An outline depends on its direct partners (a thicker Wall moves its partners' mitres).
  const direct = [...changed];
  for (const c of Object.values(after.wallConnections)) {
    if (direct.includes(c.wall)) changed.add(c.to);
    if (direct.includes(c.to)) changed.add(c.wall);
  }
  return changed;
}
