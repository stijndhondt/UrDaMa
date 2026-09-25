/**
 * DrawRoom: the Room tool's command (Box-drawing interaction and Wall joins on the foundation map).
 *
 * The dragged rectangle is the Room's inside size (or its outside size). Walls are created around
 * it with the Preset thickness, growing outward. Where an existing Wall's face already lies along
 * an edge, that Wall is reused: Walls are created only for the uncovered parts of each edge, joined
 * by corner Wall connections at the rectangle's corners and by T connections where they meet an
 * existing Wall's face. The Room's Seed point sits at the rectangle's centre; a Room it covers
 * moves to its largest remaining piece. One command, one undo step.
 */
import { levelGeometry, wallFaces } from '../geometry/level-geometry';
import { distanceToSegment } from '../geometry/polygon';
import { wallDirection } from '../geometry/wall-outlines';
import { add, cross, dot, normalize, scale, sub, distance } from '../geometry/vec';
import { put, putAll } from '../model/edit';
import { message } from '../model/message';
import type {
  Ceiling,
  CeilingId,
  LevelId,
  Room,
  RoomId,
  Vec,
  Wall,
  WallConnection,
  WallConnectionId,
  WallId,
} from '../model/types';
import { refuse, type Command } from './command';
import { reseatSeeds } from './seeds';

export interface DrawRoomArgs {
  readonly level: LevelId;
  /** Two opposite corners of the dragged rectangle (mm, plan coordinates). */
  readonly from: Vec;
  readonly to: Vec;
  /** Whether the rectangle is the Room's inside size (Walls outside it) or outside size. */
  readonly size: 'inside' | 'outside';
  readonly name: string;
}

/** Smallest inside width or depth a drawn Room may have (mm). */
export const MIN_ROOM_SIZE = 300;
/** How close (mm) an existing face must lie to an edge to count as the same line. */
const SAME_LINE = 0.5;
/** Uncovered bits shorter than this (mm) get no Wall. */
const MIN_PIECE = 1;

interface Piece {
  readonly edge: number;
  readonly start: Vec;
  readonly end: Vec;
  /** Whether the piece starts / ends at a corner of the rectangle. */
  readonly atStartCorner: boolean;
  readonly atEndCorner: boolean;
}

export const drawRoom: Command<DrawRoomArgs> = (model, args, { ids }) => {
  if (!model.levels[args.level]) {
    return refuse(message('invariants.missingReference', { what: 'level', id: args.level }));
  }
  const t = model.project.presets.wallThickness;
  const inset = args.size === 'outside' ? t : 0;
  const x0 = Math.min(args.from.x, args.to.x) + inset;
  const x1 = Math.max(args.from.x, args.to.x) - inset;
  const y0 = Math.min(args.from.y, args.to.y) + inset;
  const y1 = Math.max(args.from.y, args.to.y) - inset;
  if (x1 - x0 < MIN_ROOM_SIZE || y1 - y0 < MIN_ROOM_SIZE) {
    return refuse(message('commands.drawRoom.tooSmall', { min: MIN_ROOM_SIZE }));
  }

  // Clockwise on screen (y down), so 'left' of each Baseline is outside the Room.
  const corners: Vec[] = [
    { x: x0, y: y0 },
    { x: x1, y: y0 },
    { x: x1, y: y1 },
    { x: x0, y: y1 },
  ];
  const existing = levelGeometry(model, args.level);
  const faces = [...existing.outlines.values()].flatMap((o) => wallFaces(o));
  const pieces = corners.flatMap((start, edge) =>
    uncoveredPieces(edge, start, corners[(edge + 1) % 4]!, faces),
  );

  const walls: Wall[] = pieces.map((p) => ({
    id: ids('walls') as WallId,
    level: args.level,
    start: p.start,
    end: p.end,
    side: 'left',
    roomBounding: true,
  }));

  const connections: WallConnection[] = [];
  const connect = (wall: Wall, end: 'start' | 'end', point: Vec) => {
    for (const host of existing.walls) {
      const outline = existing.outlines.get(host.id);
      if (!outline) continue;
      if (Math.abs(cross(wallDirection(host), wallDirection(wall))) < 1e-6) continue; // parallel: no T
      if (!wallFaces(outline).some(([a, b]) => distanceToSegment(point, a, b) <= SAME_LINE))
        continue;
      connections.push({
        id: ids('wallConnections') as WallConnectionId,
        wall: wall.id,
        end,
        kind: 'tee',
        to: host.id,
        at: dot(sub(point, host.start), wallDirection(host)),
      });
      return;
    }
  };
  pieces.forEach((piece, i) => {
    const wall = walls[i]!;
    // The next piece around the rectangle, if it continues from this one's corner.
    const next = pieces.findIndex((q) => q.edge === (piece.edge + 1) % 4 && q.atStartCorner);
    if (piece.atEndCorner && next >= 0) {
      connections.push({
        id: ids('wallConnections') as WallConnectionId,
        wall: wall.id,
        end: 'end',
        kind: 'corner',
        to: walls[next]!.id,
        toEnd: 'start',
      });
    } else {
      connect(wall, 'end', piece.end);
    }
    const previous = pieces.findIndex((q) => q.edge === (piece.edge + 3) % 4 && q.atEndCorner);
    if (!(piece.atStartCorner && previous >= 0)) connect(wall, 'start', piece.start);
  });

  const room: Room = {
    id: ids('rooms') as RoomId,
    level: args.level,
    name: args.name,
    seed: { x: (x0 + x1) / 2, y: (y0 + y1) / 2 },
  };
  const ceiling: Ceiling = { id: ids('ceilings') as CeilingId, room: room.id };

  let next = putAll(model, 'walls', walls);
  next = putAll(next, 'wallConnections', connections);
  next = put(next, 'rooms', room);
  next = put(next, 'ceilings', ceiling);
  next = reseatSeeds(model, next, args.level, new Set([room.id]));
  return { ok: true, model: next, label: message('commands.drawRoom.label', { name: args.name }) };
};

/** The parts of an edge not already covered by an existing Wall face on the same line. */
function uncoveredPieces(
  edge: number,
  from: Vec,
  to: Vec,
  faces: readonly (readonly [Vec, Vec])[],
): Piece[] {
  const u = normalize(sub(to, from));
  const length = distance(from, to);
  const covered: [number, number][] = [];
  for (const [a, b] of faces) {
    if (
      Math.abs(cross(u, sub(a, from))) > SAME_LINE ||
      Math.abs(cross(u, sub(b, from))) > SAME_LINE
    )
      continue;
    const ta = dot(sub(a, from), u);
    const tb = dot(sub(b, from), u);
    const lo = Math.max(0, Math.min(ta, tb));
    const hi = Math.min(length, Math.max(ta, tb));
    if (hi - lo > SAME_LINE) covered.push([lo, hi]);
  }
  covered.sort((p, q) => p[0] - q[0]);
  const pieces: Piece[] = [];
  let cursor = 0;
  const emit = (t0: number, t1: number) => {
    if (t1 - t0 < MIN_PIECE) return;
    pieces.push({
      edge,
      start: add(from, scale(u, t0)),
      end: add(from, scale(u, t1)),
      atStartCorner: t0 <= SAME_LINE,
      atEndCorner: t1 >= length - SAME_LINE,
    });
  };
  for (const [lo, hi] of covered) {
    if (lo > cursor) emit(cursor, lo);
    cursor = Math.max(cursor, hi);
  }
  if (cursor < length) emit(cursor, length);
  return pieces.map((p) => ({
    ...p,
    start: p.atStartCorner ? from : p.start,
    end: p.atEndCorner ? to : p.end,
  }));
}
