/**
 * MoveWall: dragging a Wall (Slice 1 spec, "Select / move / delete").
 *
 * The Wall moves along its normal. What is connected follows: corner partners stretch, Walls
 * T-connected to it keep their ends on it, its own T ends slide along their host, attached Room
 * separators follow, and Openings move with it. Rooms the Wall passes over keep their best piece.
 */
import { wallDirection, wallNormal } from '../geometry/wall-outlines';
import { add, dot, scale, sub } from '../geometry/vec';
import { message } from '../model/message';
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
  return {
    ok: true,
    model: reseatSeeds(model, next, wall.level),
    label: message('commands.moveWall.label'),
  };
};

/** Moves a Wall by a vector, dragging along everything connected to it. */
export function moveWallBy(model: Model, wall: Wall, v: Vec): Model {
  const walls: Record<string, Wall> = { ...model.walls };
  const connections: Record<string, WallConnection> = { ...model.wallConnections };
  const moveEnd = (id: WallId, end: WallEnd) => {
    const w = walls[id];
    if (w) walls[id] = { ...w, [end]: add(w[end], v) };
  };

  walls[wall.id] = { ...wall, start: add(wall.start, v), end: add(wall.end, v) };
  for (const c of Object.values(model.wallConnections)) {
    if (c.kind === 'corner') {
      if (c.wall === wall.id) moveEnd(c.to, c.toEnd);
      else if (c.to === wall.id) moveEnd(c.wall, c.end);
    } else if (c.to === wall.id) {
      // A Wall T-connected to this one: its end stays on this Wall.
      moveEnd(c.wall, c.end);
    } else if (c.wall === wall.id) {
      // This Wall's own T end slides along its host.
      const host = walls[c.to];
      if (host) {
        const moved = walls[wall.id]!;
        connections[c.id] = { ...c, at: dot(sub(moved[c.end], host.start), wallDirection(host)) };
      }
    }
  }

  const roomSeparators = { ...model.roomSeparators };
  for (const s of Object.values(model.roomSeparators)) {
    if (s.startWall === wall.id || s.endWall === wall.id) {
      roomSeparators[s.id] = {
        ...s,
        start: s.startWall === wall.id ? add(s.start, v) : s.start,
        end: s.endWall === wall.id ? add(s.end, v) : s.end,
      };
    }
  }
  return { ...model, walls, wallConnections: connections, roomSeparators };
}
