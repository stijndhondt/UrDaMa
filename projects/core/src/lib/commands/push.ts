/**
 * Push (Slice 1 spec): changing a thickness, or resizing a Room, moves a Wall face; everything in
 * front of that face moves with it, so measured Room sizes are kept.
 *
 * "In front" = the Walls reachable through Wall connections that lie entirely beyond the face and
 * face it (their extent along the face overlaps what is pushed), together with the Rooms, Room
 * separators and Openings among them. A Wall merely touching the end of the face stays put. Walls crossing the face line
 * stretch; that only works when they run along the push direction, otherwise the push is refused.
 */
import { openingWidth } from '../model/opening-types';
import { faceOffsets, wallDirection, wallNormal } from '../geometry/wall-outlines';
import { add, cross, dot, perp, scale, sub } from '../geometry/vec';
import { levelGeometry } from '../geometry/level-geometry';
import { message, type Message } from '../model/message';
import type {
  LevelId,
  Model,
  Opening,
  RoomSeparator,
  Vec,
  Wall,
  WallConnection,
  WallId,
} from '../model/types';

/** Points this close to the face (mm) count as on it. */
const ON = 0.5;

export interface PushSpec {
  readonly level: LevelId;
  /** A point on the face that moves, and the direction it moves in (unit vector). */
  readonly facePoint: Vec;
  readonly direction: Vec;
  /** mm the face moves along `direction`. */
  readonly amount: number;
  /** The Wall whose face moves: the search for what is in front starts from it. */
  readonly from: WallId;
  /** Walls that move rigidly anyway (a Wall being moved itself). */
  readonly rigid?: readonly WallId[];
}

export type PushResult =
  { readonly ok: true; readonly model: Model } | { readonly ok: false; readonly reason: Message };

/** The face of a Wall that faces `direction`: a point on it. */
export function faceToward(wall: Wall, direction: Vec, presetThickness: number): Vec {
  const n = wallNormal(wall);
  const [lo, hi] = faceOffsets(wall, presetThickness);
  return add(wall.start, scale(n, dot(n, direction) > 0 ? hi : lo));
}

export function push(model: Model, spec: PushSpec): PushResult {
  if (spec.amount === 0) return { ok: true, model };
  const u = spec.direction;
  const geometry = levelGeometry(model, spec.level);
  const inFront = (p: Vec) => dot(sub(p, spec.facePoint), u) >= -ON;
  const connections = Object.values(model.wallConnections);
  const neighbours = new Map<string, string[]>();
  const link = (a: string, b: string) => neighbours.set(a, [...(neighbours.get(a) ?? []), b]);
  for (const c of connections) {
    link(c.wall, c.to);
    link(c.to, c.wall);
  }

  // What lies in front of the face, reachable through Wall connections, and facing it: its extent
  // along the face must overlap what is being pushed (which grows as the search goes on). A Wall that
  // only touches the end of the face is beside it, not in front of it, and stays put.
  const along = perp(u);
  const extentOf = (w: Wall): [number, number] => {
    const outline = geometry.outlines.get(w.id);
    const points = outline ? [...outline] : [w.start, w.end];
    const t = points.map((p) => dot(sub(p, spec.facePoint), along));
    return [Math.min(...t), Math.max(...t)];
  };
  const baselineExtent = (w: Wall): [number, number] => {
    const a = dot(sub(w.start, spec.facePoint), along);
    const b = dot(sub(w.end, spec.facePoint), along);
    return [Math.min(a, b), Math.max(a, b)];
  };
  const origin = model.walls[spec.from];
  let span: [number, number] = origin ? extentOf(origin) : [0, 0];
  for (const id of spec.rigid ?? []) {
    const w = model.walls[id];
    if (w) {
      const [a, b] = extentOf(w);
      span = [Math.min(span[0], a), Math.max(span[1], b)];
    }
  }
  const facing = (w: Wall) => {
    const [a, b] = baselineExtent(w);
    return b - a > ON
      ? Math.min(b, span[1]) - Math.max(a, span[0]) > ON
      : a > span[0] + ON && a < span[1] - ON;
  };
  const rigid = new Set<string>(spec.rigid ?? []);
  const queue = [spec.from, ...rigid];
  const seen = new Set<string>(queue);
  while (queue.length) {
    const current = queue.shift()!;
    for (const next of neighbours.get(current) ?? []) {
      if (seen.has(next)) continue;
      const wall = model.walls[next as WallId];
      if (!wall || wall.level !== spec.level || !facing(wall)) continue;
      // A Wall T-connected to the Wall whose face moves sits on it by definition: judge it by its other end.
      const onFrom = (end: 'start' | 'end') =>
        connections.some(
          (c) => c.kind === 'tee' && c.wall === wall.id && c.end === end && c.to === spec.from,
        );
      if ((!onFrom('start') && !inFront(wall.start)) || (!onFrom('end') && !inFront(wall.end)))
        continue;
      seen.add(next);
      rigid.add(next);
      queue.push(next);
      const [a, b] = extentOf(wall);
      span = [Math.min(span[0], a), Math.max(span[1], b)];
    }
  }

  const v = scale(u, spec.amount);
  const moved = new Map<string, { start: boolean; end: boolean }>();
  const mark = (id: string, end: 'start' | 'end') => {
    const m = moved.get(id) ?? { start: false, end: false };
    m[end] = true;
    moved.set(id, m);
  };
  for (const id of rigid) {
    mark(id, 'start');
    mark(id, 'end');
  }
  for (const c of connections) {
    if (c.kind === 'corner') {
      if (rigid.has(c.wall) && !rigid.has(c.to)) mark(c.to, c.toEnd);
      if (rigid.has(c.to) && !rigid.has(c.wall)) mark(c.wall, c.end);
    } else if (rigid.has(c.to) && !rigid.has(c.wall)) {
      mark(c.wall, c.end); // a Wall T-connected to a moving Wall stays on it
    }
  }

  // Stretching only works along the push direction.
  const nextWalls: Record<string, Wall> = { ...model.walls };
  for (const [id, m] of moved) {
    const wall = model.walls[id as WallId]!;
    if (!(m.start && m.end) && Math.abs(cross(wallDirection(wall), u)) > 1e-6) {
      return { ok: false, reason: message('commands.push.skewed', { wall: id }) };
    }
    nextWalls[id] = {
      ...wall,
      start: m.start ? add(wall.start, v) : wall.start,
      end: m.end ? add(wall.end, v) : wall.end,
    };
  }

  // A moving Wall's T end slides along a host that stays.
  const nextConnections: Record<string, WallConnection> = { ...model.wallConnections };
  for (const c of connections) {
    if (c.kind !== 'tee' || !moved.has(c.wall) || moved.has(c.to)) continue;
    const host = nextWalls[c.to]!;
    const end = nextWalls[c.wall]![c.end];
    nextConnections[c.id] = { ...c, at: dot(sub(end, host.start), wallDirection(host)) };
  }

  // Openings keep their place: in front they move with the push, behind they stay.
  const nextOpenings: Record<string, Opening> = { ...model.openings };
  for (const o of Object.values(model.openings)) {
    const before = model.walls[o.wall];
    const after = nextWalls[o.wall];
    if (!before || !after || before === after) continue;
    const d = wallDirection(before);
    const centre = add(before.start, scale(d, o.offset + openingWidth(model, o) / 2));
    const newCentre = inFront(centre) ? add(centre, v) : centre;
    nextOpenings[o.id] = {
      ...o,
      offset: dot(sub(newCentre, after.start), wallDirection(after)) - openingWidth(model, o) / 2,
    };
  }

  const nextSeparators: Record<string, RoomSeparator> = { ...model.roomSeparators };
  for (const s of Object.values(model.roomSeparators)) {
    if (s.level !== spec.level) continue;
    const moves = (p: Vec, wall: WallId) => moved.has(wall) && inFront(p);
    const start = moves(s.start, s.startWall) ? add(s.start, v) : s.start;
    const end = moves(s.end, s.endWall) ? add(s.end, v) : s.end;
    if (start !== s.start || end !== s.end) nextSeparators[s.id] = { ...s, start, end };
  }

  // Rooms entirely in front move with it.
  const rooms = { ...model.rooms };
  for (const room of Object.values(model.rooms)) {
    if (room.level !== spec.level) continue;
    const d = geometry.footprint.rooms.get(room.id);
    const all = d && d.status !== 'notEnclosed' ? d.area.outline : [room.seed];
    if (all.every(inFront) && inFront(room.seed))
      rooms[room.id] = { ...room, seed: add(room.seed, v) };
  }

  return {
    ok: true,
    model: {
      ...model,
      walls: nextWalls,
      wallConnections: nextConnections,
      openings: nextOpenings,
      roomSeparators: nextSeparators,
      rooms,
    },
  };
}
