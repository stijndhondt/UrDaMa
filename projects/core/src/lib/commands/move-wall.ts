/**
 * MoveWall: dragging a Wall (Slice 1 spec, "Select / move / delete").
 *
 * The Wall moves along its normal. What is connected follows: corner partners stretch, Walls
 * T-connected to it keep their ends on it, its own T ends slide along their host, attached Room
 * separators follow, and Openings move with it. Rooms the Wall passes over keep their best piece.
 *
 * A T stays where it is in the plan (ticket 35, CONTEXT.md Wall connection): when the move leaves
 * its host no longer reaching it, it is carried by the Wall that now does (one on the old host's
 * line first), and the move is refused when no Wall does.
 */
import { faceOffsets, wallDirection, wallNormal } from '../geometry/wall-outlines';
import { add, cross, dot, scale, sub } from '../geometry/vec';
import { wallNumbers } from '../model/levels';
import { message, type Message } from '../model/message';
import type { Model, Vec, Wall, WallConnection, WallEnd, WallId } from '../model/types';
import { refuse, type Command } from './command';
import { reseatSeeds } from './seeds';

export interface MoveWallArgs {
  readonly wall: WallId;
  /** mm along the Wall's normal (the visual right of its Baseline). */
  readonly offset: number;
}

export const moveWall: Command<MoveWallArgs> = (model, args) => {
  const wall = model.walls[args.wall];
  if (!wall) return refuse(message('invariants.missingReference', { what: 'wall', id: args.wall }));
  if (args.offset === 0) return refuse(message('commands.moveWall.nothing'));
  const v = scale(wallNormal(wall), args.offset);
  const next = moveWallBy(model, wall, v);
  if ('key' in next) return refuse(next);
  return {
    ok: true,
    model: reseatSeeds(model, next, wall.level),
    label: message('commands.moveWall.label'),
  };
};

/** mm: how far a T end may lie past its host's end and still be on it */
const ON = 0.5;

/**
 * Moves a Wall by a vector, dragging along everything connected to it; or why it can't: a T left
 * with no Wall to carry it.
 */
export function moveWallBy(model: Model, wall: Wall, v: Vec): Model | Message {
  return moveWallsBy(model, [wall.id], v);
}

/**
 * Moves several Walls together by one vector, as one move (a Room's side, ticket 36): a Wall
 * connected to two of them moves once, and the T's are carried once the whole move is done.
 */
export function moveWallsBy(model: Model, ids: readonly WallId[], v: Vec): Model | Message {
  const moving = new Set<string>(ids);
  const walls: Record<string, Wall> = { ...model.walls };
  const connections: Record<string, WallConnection> = { ...model.wallConnections };
  const movedEnds = new Set<string>();
  const moveEnd = (id: WallId, end: WallEnd) => {
    const w = walls[id];
    if (!w || moving.has(id) || movedEnds.has(`${id}:${end}`)) return;
    movedEnds.add(`${id}:${end}`);
    walls[id] = { ...w, [end]: add(w[end], v) };
  };

  for (const id of moving) {
    const w = walls[id];
    if (w) walls[id] = { ...w, start: add(w.start, v), end: add(w.end, v) };
  }
  for (const c of Object.values(model.wallConnections)) {
    if (c.kind === 'corner') {
      if (moving.has(c.wall)) moveEnd(c.to, c.toEnd);
      else if (moving.has(c.to)) moveEnd(c.wall, c.end);
    } else if (moving.has(c.to)) {
      // A Wall T-connected to a moving one: its end stays on it.
      moveEnd(c.wall, c.end);
    }
  }

  // Every T whose Wall or host moved finds its distance along its host again, or its carrier.
  const stranded = carryTees(model, walls, connections);
  if (stranded) return stranded;

  const roomSeparators = { ...model.roomSeparators };
  for (const s of Object.values(model.roomSeparators)) {
    const startMoves = !!s.startWall && moving.has(s.startWall);
    const endMoves = !!s.endWall && moving.has(s.endWall);
    if (startMoves || endMoves) {
      roomSeparators[s.id] = {
        ...s,
        start: startMoves ? add(s.start, v) : s.start,
        end: endMoves ? add(s.end, v) : s.end,
      };
    }
  }
  return { ...model, walls, wallConnections: connections, roomSeparators };
}

/**
 * Every T whose Wall or host moved: its distance along the host again, or, when the host no
 * longer reaches its end, the Wall that now carries it (ticket 35). Updates `connections`; returns
 * why it can't when no Wall carries a T.
 */
export function carryTees(
  model: Model,
  walls: Record<string, Wall>,
  connections: Record<string, WallConnection>,
): Message | null {
  for (const c of Object.values(connections)) {
    if (c.kind !== 'tee') continue;
    const tee = walls[c.wall];
    const host = walls[c.to];
    if (!tee || !host || (tee === model.walls[c.wall] && host === model.walls[c.to])) continue;
    const point = tee[c.end];
    const at = along(host, point);
    if (at >= -ON && at <= span(host) + ON) {
      connections[c.id] = { ...c, at };
      continue;
    }
    const carrier = carrierOf(model, walls, host, tee, point);
    // No Wall carries it, but it still meets its host's end (the corner, within the host's
    // thickness): it stays on its host, as a T at a Wall's end always could.
    const past = at < 0 ? -at : at - span(host);
    if (!carrier && past <= thicknessOf(model, host) + ON) {
      connections[c.id] = { ...c, at };
      continue;
    }
    if (!carrier) {
      const numbers = wallNumbers(model, tee.level);
      return message('commands.moveWall.noHost', {
        wall: numbers.get(tee.id) ?? 0,
        host: numbers.get(host.id) ?? 0,
      });
    }
    connections[c.id] = { ...c, to: carrier.id, at: along(carrier, point) };
  }
  return null;
}

const thicknessOf = (model: Model, w: Wall): number =>
  w.thickness ?? model.project.presets.wallThickness;
const along = (w: Wall, p: Vec): number => dot(sub(p, w.start), wallDirection(w));
const span = (w: Wall): number => Math.hypot(w.end.x - w.start.x, w.end.y - w.start.y);
/** Signed distance of a point from a Wall's Baseline line */
const across = (w: Wall, p: Vec): number => cross(wallDirection(w), sub(p, w.start));

/**
 * The Wall that now carries a T end the old host no longer reaches: a Wall parallel to the old
 * host, reaching the end, with the end on one of its faces (whatever its thickness). One on the
 * old host's line goes first.
 */
function carrierOf(
  model: Model,
  walls: Record<string, Wall>,
  old: Wall,
  tee: Wall,
  point: Vec,
): Wall | null {
  const d = wallDirection(old);
  const preset = model.project.presets.wallThickness;
  let best: Wall | null = null;
  for (const w of Object.values(walls)) {
    if (w.id === old.id || w.id === tee.id || w.level !== old.level) continue;
    if (Math.abs(cross(wallDirection(w), d)) > 1e-6) continue;
    const s = across(w, point);
    if (!faceOffsets(w, preset).some((f) => Math.abs(s - f) <= ON)) continue;
    const at = along(w, point);
    if (at < -ON || at > span(w) + ON) continue;
    const onLine = Math.abs(across(old, w.start)) <= ON;
    if (onLine) return w;
    best ??= w;
  }
  return best;
}
