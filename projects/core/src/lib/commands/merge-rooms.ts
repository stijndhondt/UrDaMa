/**
 * MergeRooms: two neighbouring Rooms become one (Slice 1 spec; the L-shaped halls). What lies
 * between them is removed: a Room separator, or the stretch of Wall they share (a Wall shared only
 * in part is split around that stretch). Straight Walls that met at the removed stretch are joined
 * into one, so the corners stay closed. The first Room keeps its name and properties.
 */
import { openingWidth } from '../model/opening-types';
import { levelGeometry, wallFaces } from '../geometry/level-geometry';
import { insideArea } from '../geometry/polygon';
import type { EnclosedArea } from '../geometry/footprint';
import { wallDirection, wallLength, wallNormal, wallThickness } from '../geometry/wall-outlines';
import { add, cross, distance, dot, scale, sub } from '../geometry/vec';
import { remove } from '../model/edit';
import { message } from '../model/message';
import type {
  Model,
  Opening,
  RoomId,
  Vec,
  Wall,
  WallConnection,
  WallConnectionId,
  WallEnd,
  WallId,
} from '../model/types';
import { refuse, type Command, type CommandContext } from './command';

export interface MergeRoomsArgs {
  readonly keep: RoomId;
  readonly other: RoomId;
}

const ON = 1;
const PROBE = 2;
const MIN_PIECE = 10;

export const mergeRooms: Command<MergeRoomsArgs> = (model, args, context) => {
  const keep = model.rooms[args.keep];
  const other = model.rooms[args.other];
  if (!keep || !other || keep.id === other.id) return refuse(message('commands.merge.twoRooms'));
  if (keep.level !== other.level) return refuse(message('commands.merge.notNeighbours'));
  const geometry = levelGeometry(model, keep.level);
  const a = geometry.footprint.rooms.get(keep.id);
  const b = geometry.footprint.rooms.get(other.id);
  if (!a || !b || a.status !== 'enclosed' || b.status !== 'enclosed')
    return refuse(message('commands.merge.notEnclosed'));
  const inA = (p: Vec) => insideArea(p, a.area.outline, a.area.islands);
  const inB = (p: Vec) => insideArea(p, b.area.outline, b.area.islands);

  // Room separators between them.
  const separators = Object.values(model.roomSeparators).filter((s) => {
    if (s.level !== keep.level) return false;
    const mid = scale(add(s.start, s.end), 0.5);
    const n = wallNormalOf(s.start, s.end);
    const p = add(mid, scale(n, PROBE));
    const q = sub(mid, scale(n, PROBE));
    return (inA(p) && inB(q)) || (inA(q) && inB(p));
  });

  // Stretches of Wall between them: where one face borders A and the other face borders B.
  const shared: { wall: Wall; t0: number; t1: number }[] = [];
  for (const wall of geometry.walls) {
    const outline = geometry.outlines.get(wall.id);
    if (!outline) continue;
    const [lo, hi] = wallFaces(outline);
    const along = (face: readonly [Vec, Vec], area: EnclosedArea) => bordering(wall, face, area);
    const intervals = [
      ...intersect(along(lo, a.area), along(hi, b.area)),
      ...intersect(along(hi, a.area), along(lo, b.area)),
    ];
    for (const [t0, t1] of intervals) if (t1 - t0 > ON) shared.push({ wall, t0, t1 });
  }
  if (!separators.length && !shared.length) return refuse(message('commands.merge.notNeighbours'));

  let next = remove(
    model,
    'roomSeparators',
    separators.map((s) => s.id),
  );
  const freed: { wall: WallId; end: WallEnd }[] = [];
  for (const piece of shared)
    next = removeStretch(next, piece.wall.id, piece.t0, piece.t1, freed, context);
  next = joinStraightWalls(next, freed, context);

  next = remove(next, 'rooms', [other.id]);
  next = remove(
    next,
    'ceilings',
    Object.values(next.ceilings)
      .filter((c) => c.room === other.id)
      .map((c) => c.id),
  );
  const merged = levelGeometry(next, keep.level).footprint.rooms.get(keep.id);
  if (!merged || merged.status !== 'enclosed') return refuse(message('commands.merge.notEnclosed'));
  return {
    ok: true,
    model: next,
    label: message('commands.merge.label', { a: keep.name, b: other.name }),
  };
};

function wallNormalOf(start: Vec, end: Vec): Vec {
  const d = sub(end, start);
  const l = Math.hypot(d.x, d.y) || 1;
  return { x: -d.y / l, y: d.x / l };
}

/** Intervals (mm along the Wall's Baseline) where an area's outline runs along a face of the Wall. */
function bordering(wall: Wall, face: readonly [Vec, Vec], area: EnclosedArea): [number, number][] {
  const d = wallDirection(wall);
  const n = wallNormal(wall);
  const faceOffset = dot(sub(face[0], wall.start), n);
  const out: [number, number][] = [];
  for (const ring of [area.outline, ...area.islands]) {
    for (let i = 0; i < ring.length; i++) {
      const p = ring[i]!;
      const q = ring[(i + 1) % ring.length]!;
      if (
        Math.abs(dot(sub(p, wall.start), n) - faceOffset) > ON ||
        Math.abs(dot(sub(q, wall.start), n) - faceOffset) > ON
      )
        continue;
      const tp = dot(sub(p, wall.start), d);
      const tq = dot(sub(q, wall.start), d);
      out.push([Math.min(tp, tq), Math.max(tp, tq)]);
    }
  }
  return out;
}

function intersect(xs: [number, number][], ys: [number, number][]): [number, number][] {
  const out: [number, number][] = [];
  for (const [a0, a1] of xs)
    for (const [b0, b1] of ys) {
      const lo = Math.max(a0, b0);
      const hi = Math.min(a1, b1);
      if (hi - lo > ON) out.push([lo, hi]);
    }
  return out;
}

/**
 * Removes the stretch [t0, t1] (mm along the Baseline) of a Wall, keeping the parts before and
 * after it. Wall connections move to the part they belong to; those on the removed stretch go, and
 * the Wall ends they held are recorded as freed.
 */
function removeStretch(
  model: Model,
  wallId: WallId,
  t0: number,
  t1: number,
  freed: { wall: WallId; end: WallEnd }[],
  context: CommandContext,
): Model {
  const wall = model.walls[wallId];
  if (!wall) return model;
  const length = wallLength(wall);
  const d = wallDirection(wall);
  const at = (t: number) => add(wall.start, scale(d, t));
  const hasBefore = t0 > MIN_PIECE;
  const hasAfter = length - t1 > MIN_PIECE;
  const before: Wall | null = hasBefore ? { ...wall, end: at(t0) } : null;
  const after: Wall | null = hasAfter
    ? { ...wall, id: (hasBefore ? context.ids('walls') : wall.id) as WallId, start: at(t1) }
    : null;

  const walls: Record<string, Wall> = { ...model.walls };
  delete walls[wall.id];
  if (before) walls[before.id] = before;
  if (after) walls[after.id] = after;

  const connections: Record<string, WallConnection> = {};
  const cornerTaken = (w: WallId, end: WallEnd) =>
    Object.values(model.wallConnections).some(
      (x) =>
        x.kind === 'corner' && ((x.wall === w && x.end === end) || (x.to === w && x.toEnd === end)),
    );
  for (const c of Object.values(model.wallConnections)) {
    if (c.wall === wall.id) {
      // This Wall's own ends.
      const target = c.end === 'start' ? before : after;
      if (target) connections[c.id] = { ...c, wall: target.id };
      else if (c.kind === 'corner') freed.push({ wall: c.to, end: c.toEnd });
      continue;
    }
    if (c.to !== wall.id) {
      connections[c.id] = c;
      continue;
    }
    if (c.kind === 'corner') {
      const target = c.toEnd === 'start' ? before : after;
      if (target) connections[c.id] = { ...c, to: target.id };
      else freed.push({ wall: c.wall, end: c.end });
      continue;
    }
    // A T onto this Wall: onto the part it lands on, or freed when it landed on the removed stretch.
    // A perpendicular T landing exactly at a cut becomes a corner with that part (closing the corner).
    const teeWall = walls[c.wall];
    const perpendicular = teeWall && Math.abs(dot(wallDirection(teeWall), d)) < 1e-6;
    if (before && perpendicular && Math.abs(c.at - t0) <= ON && !cornerTaken(c.wall, c.end)) {
      walls[c.wall] = { ...teeWall, [c.end]: before.end };
      connections[c.id] = {
        id: c.id,
        wall: c.wall,
        end: c.end,
        kind: 'corner',
        to: before.id,
        toEnd: 'end',
      };
    } else if (after && perpendicular && Math.abs(c.at - t1) <= ON && !cornerTaken(c.wall, c.end)) {
      walls[c.wall] = { ...teeWall, [c.end]: after.start };
      connections[c.id] = {
        id: c.id,
        wall: c.wall,
        end: c.end,
        kind: 'corner',
        to: after.id,
        toEnd: 'start',
      };
    } else if (before && c.at <= t0 + ON) connections[c.id] = { ...c, to: before.id };
    else if (after && c.at >= t1 - ON) connections[c.id] = { ...c, to: after.id, at: c.at - t1 };
    else freed.push({ wall: c.wall, end: c.end });
  }

  const openings: Record<string, Opening> = {};
  for (const o of Object.values(model.openings)) {
    if (o.wall !== wall.id) {
      openings[o.id] = o;
      continue;
    }
    if (before && o.offset + openingWidth(model, o) <= t0)
      openings[o.id] = { ...o, wall: before.id };
    else if (after && o.offset >= t1)
      openings[o.id] = { ...o, wall: after.id, offset: o.offset - t1 };
    // An Opening on the removed stretch goes with it.
  }
  return { ...model, walls, wallConnections: connections, openings };
}

/** Joins pairs of straight, matching Walls whose freed ends face each other across a small gap. */
function joinStraightWalls(
  model: Model,
  freed: readonly { wall: WallId; end: WallEnd }[],
  context: CommandContext,
): Model {
  let next = model;
  const preset = model.project.presets.wallThickness;
  const used = new Set<string>();
  for (let i = 0; i < freed.length; i++) {
    for (let j = i + 1; j < freed.length; j++) {
      const fa = freed[i]!;
      const fb = freed[j]!;
      if (used.has(fa.wall) || used.has(fb.wall) || fa.wall === fb.wall) continue;
      const wa = next.walls[fa.wall];
      const wb = next.walls[fb.wall];
      if (!wa || !wb) continue;
      const da = wallDirection(wa);
      const db = wallDirection(wb);
      if (Math.abs(cross(da, db)) > 1e-6) continue;
      if (Math.abs(dot(sub(wb.start, wa.start), wallNormal(wa))) > ON) continue; // not on one line
      const sameWay = dot(da, db) > 0;
      const sideB = sameWay
        ? wb.side
        : wb.side === 'left'
          ? 'right'
          : wb.side === 'right'
            ? 'left'
            : 'centre';
      if (wa.side !== sideB || wallThickness(wa, preset) !== wallThickness(wb, preset)) continue;
      if (wa.height !== wb.height || wa.roomBounding !== wb.roomBounding) continue;
      const pa = wa[fa.end];
      const pb = wb[fb.end];
      if (distance(pa, pb) > wallThickness(wa, preset) * 2 + ON) continue;
      next = join(next, wa, fa.end, wb, fb.end, context);
      used.add(fa.wall);
      used.add(fb.wall);
    }
  }
  return next;
}

/** Joins Wall b onto Wall a across their freed ends: a keeps its ID and direction. */
function join(
  model: Model,
  a: Wall,
  aEnd: WallEnd,
  b: Wall,
  bEnd: WallEnd,
  _context: CommandContext,
): Model {
  const bFar: WallEnd = bEnd === 'start' ? 'end' : 'start';
  const joined: Wall = { ...a, [aEnd]: b[bFar] };
  const d = wallDirection(joined);
  const walls: Record<string, Wall> = { ...model.walls, [a.id]: joined };
  delete walls[b.id];

  const connections: Record<string, WallConnection> = {};
  for (const c of Object.values(model.wallConnections)) {
    let next: WallConnection = c;
    if (c.wall === b.id) {
      if (c.end === bEnd) continue;
      next = { ...next, wall: a.id, end: aEnd };
    }
    if (next.to === b.id) {
      if (next.kind === 'corner') {
        if (next.toEnd === bEnd) continue;
        next = { ...next, to: a.id, toEnd: aEnd };
      } else {
        const point = add(b.start, scale(wallDirection(b), next.at));
        next = { ...next, to: a.id, at: dot(sub(point, joined.start), d) };
      }
    }
    if (next.wall === a.id && next.end === aEnd && c.wall === a.id) continue; // a's freed end had none
    connections[next.id as WallConnectionId] = next;
  }

  const openings: Record<string, Opening> = {};
  for (const o of Object.values(model.openings)) {
    const host = o.wall === b.id ? b : o.wall === a.id ? a : null;
    if (!host) {
      openings[o.id] = o;
      continue;
    }
    const centre = add(
      host.start,
      scale(wallDirection(host), o.offset + openingWidth(model, o) / 2),
    );
    openings[o.id] = {
      ...o,
      wall: a.id,
      offset: dot(sub(centre, joined.start), d) - openingWidth(model, o) / 2,
    };
  }
  return { ...model, walls, wallConnections: connections, openings };
}
