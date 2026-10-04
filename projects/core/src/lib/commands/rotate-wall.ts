/**
 * RotateWall: turning a Wall to an exact angle around one of its anchors (its four corners or its
 * centre). The anchor stays where it is; what is connected stays connected, in one of two modes:
 *
 * - **Neighbours tilt** ('wall'): the Wall keeps its length; a corner partner's end goes with the
 *   Wall's end (that Wall tilts).
 * - **Ends slide** ('slide'): each connected end slides along the Wall it meets, so the neighbours
 *   keep their direction; this Wall's length changes to reach them.
 *
 * In both modes a T end of this Wall slides along its host's face, Walls T-connected onto this Wall
 * keep their direction and reach it again, attached Room separators do the same, and Openings
 * turn with the Wall.
 */
import { levelWallOutlines } from '../geometry/level-geometry';
import { faceOffsets, wallDirection, wallFrame } from '../geometry/wall-outlines';
import { add, cross, dot, lineIntersection, normalize, scale, sub } from '../geometry/vec';
import { wallNumbers } from '../model/levels';
import { message } from '../model/message';
import type {
  Model,
  Opening,
  RoomSeparator,
  Vec,
  Wall,
  WallConnection,
  WallEnd,
  WallId,
} from '../model/types';
import { refuse, type Command } from './command';
import { MIN_WALL_LENGTH } from './draw-wall';
import { carryTees } from './move-wall';
import { reseatSeeds } from './seeds';

/** A point a Wall turns around: a corner (its end, on its low or high face) or its centre. */
export type WallAnchor = 'centre' | 'start-lo' | 'start-hi' | 'end-lo' | 'end-hi';

export const WALL_ANCHORS: readonly WallAnchor[] = [
  'start-lo',
  'start-hi',
  'centre',
  'end-lo',
  'end-hi',
];

export interface RotateWallArgs {
  readonly wall: WallId;
  /** Degrees: the new angle of the Baseline, as `wallAngle` gives it. */
  readonly angle: number;
  readonly anchor: WallAnchor;
  /** 'wall': neighbours tilt, this Wall keeps its length; 'slide': its ends slide along the neighbours. */
  readonly mode: 'wall' | 'slide';
  /**
   * Measure `angle` from the Wall connected at this end (as `angleAtEnd` gives it) instead of
   * from the plan's x axis. Exact with 'slide', where that Wall keeps its direction.
   */
  readonly relativeTo?: WallEnd;
}

/**
 * A Wall's angle on the plan in degrees, 0 ≤ angle < 180: anticlockwise as seen on screen from
 * the plan's x axis (a horizontal Wall is 0°, a vertical one 90°), whichever way it was drawn.
 */
export function wallAngle(wall: Wall): number {
  const deg = (Math.atan2(-(wall.end.y - wall.start.y), wall.end.x - wall.start.x) * 180) / Math.PI;
  const a = ((deg % 180) + 180) % 180;
  return a >= 180 - 1e-9 ? 0 : a;
}

/** Where a Wall's anchors are: the corners of its joined outline, and the middle of its box. */
export function wallAnchors(model: Model, wall: Wall): Record<WallAnchor, Vec> {
  const f = wallFrame(wall);
  const [lo, hi] = faceOffsets(wall, model.project.presets.wallThickness);
  const length = f.along(wall.end);
  const outline = levelWallOutlines(model, wall.level).get(wall.id);
  return {
    'start-lo': outline?.[0] ?? f.point(0, lo),
    'end-lo': outline?.[1] ?? f.point(length, lo),
    'end-hi': outline?.[2] ?? f.point(length, hi),
    'start-hi': outline?.[3] ?? f.point(0, hi),
    centre: f.point(length / 2, (lo + hi) / 2),
  };
}

/** A direction turned anticlockwise on screen (y points down) by some degrees. */
function turned(v: Vec, degrees: number): Vec {
  const rad = (degrees * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  return { x: v.x * cos + v.y * sin, y: -v.x * sin + v.y * cos };
}

/** The direction along a Wall away from one of its ends. */
const awayFrom = (w: Wall, end: WallEnd): Vec =>
  normalize(end === 'start' ? sub(w.end, w.start) : sub(w.start, w.end));

/**
 * The Wall connected at one end of a Wall, and the angle between the two there in degrees
 * (0–180): at a corner, how far the corner opens; against a T's host, the angle to the host's
 * Baseline as drawn (start to end). Null when nothing is connected at that end.
 */
export function angleAtEnd(
  model: Model,
  wall: Wall,
  end: WallEnd,
): {
  readonly other: Wall;
  readonly angle: number;
  /** The other Wall's direction the angle is measured from */
  readonly from: Vec;
} | null {
  const c = connectedAt(model, wall.id, end);
  const other = c && model.walls[c.wall === wall.id ? c.to : c.wall];
  if (!c || !other) return null;
  const theirs =
    c.kind === 'corner'
      ? awayFrom(other, c.wall === wall.id ? c.toEnd : c.end)
      : wallDirection(other);
  const cos = Math.max(-1, Math.min(1, dot(awayFrom(wall, end), theirs)));
  return { other, angle: (Math.acos(cos) * 180) / Math.PI, from: theirs };
}

/**
 * The angle on the plan (as `wallAngle` gives it) at which a Wall makes `angle` with the Wall
 * connected at one end: of the two ways to turn, the one nearest to where it is now.
 */
function planAngleFrom(model: Model, wall: Wall, end: WallEnd, angle: number): number | null {
  const at = angleAtEnd(model, wall, end);
  if (!at) return null;
  const mine = awayFrom(wall, end);
  const [a, b] = [turned(at.from, angle), turned(at.from, -angle)];
  const best = dot(a, mine) >= dot(b, mine) ? a : b;
  return wallAngle({ ...wall, start: { x: 0, y: 0 }, end: best });
}

/** The connection at one end of a Wall: a corner either way round, or a T of this Wall's own end. */
export function connectedAt(model: Model, id: WallId, end: WallEnd): WallConnection | undefined {
  return Object.values(model.wallConnections).find(
    (c) =>
      (c.wall === id && c.end === end) || (c.kind === 'corner' && c.to === id && c.toEnd === end),
  );
}

export const rotateWall: Command<RotateWallArgs> = (model, args) => {
  const wall = model.walls[args.wall];
  if (!wall) return refuse(message('invariants.missingReference', { what: 'wall', id: args.wall }));
  const target = args.relativeTo
    ? planAngleFrom(model, wall, args.relativeTo, args.angle)
    : args.angle;
  if (target === null) return refuse(message('commands.rotateWall.nothingConnected'));
  // The smallest turn to the new angle: a Wall's line looks the same turned by 180°.
  let turn = (((target - wallAngle(wall)) % 180) + 180) % 180;
  if (turn > 90) turn -= 180;
  if (Math.abs(turn) < 1e-9) return refuse(message('commands.rotateWall.same'));

  const pivot = wallAnchors(model, wall)[args.anchor];
  const rad = (turn * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  /** Anticlockwise on screen (y points down). */
  const rotate = (p: Vec): Vec => {
    const v = sub(p, pivot);
    return add(pivot, { x: v.x * cos + v.y * sin, y: -v.x * sin + v.y * cos });
  };
  const numbers = wallNumbers(model, wall.level);
  const number = (w: Wall) => numbers.get(w.id) ?? 0;

  // This Wall's new line, through its turned Baseline.
  const start0 = rotate(wall.start);
  const d = normalize(sub(rotate(wall.end), start0));
  const ends: Record<WallEnd, Vec> = { start: start0, end: rotate(wall.end) };
  for (const end of ['start', 'end'] as const) {
    const c = connectedAt(model, wall.id, end);
    const other = c && model.walls[c.wall === wall.id ? c.to : c.wall];
    if (!c || !other) continue;
    // Corners slide only when asked; a T end always slides along its host's face.
    if (c.kind === 'corner' && args.mode === 'wall') continue;
    const offset = c.kind === 'tee' ? across(other, wall[end]) : 0;
    const on = lineIntersection(start0, d, offsetPoint(other, offset), wallDirection(other));
    if (!on) return refuse(message('commands.rotateWall.parallel', { wall: number(other) }));
    ends[end] = on;
  }
  const turned: Wall = { ...wall, start: ends.start, end: ends.end };
  if (dot(sub(turned.end, turned.start), d) < MIN_WALL_LENGTH)
    return refuse(
      message('commands.rotateWall.tooShort', { wall: number(wall), min: MIN_WALL_LENGTH }),
    );

  const walls: Record<string, Wall> = { ...model.walls, [wall.id]: turned };
  const connections: Record<string, WallConnection> = { ...model.wallConnections };
  const moveEnd = (id: WallId, end: WallEnd, point: Vec) => {
    const w = walls[id];
    if (w) walls[id] = { ...w, [end]: point };
  };
  /** A point on a line through `p` along `dir`, where it meets this Wall's line `offset` across. */
  const reach = (p: Vec, dir: Vec, offset: number): Vec =>
    lineIntersection(p, dir, add(turned.start, scale(perpOf(d), offset)), d) ?? rotate(p);

  for (const c of Object.values(model.wallConnections)) {
    if (c.kind === 'corner' && (c.wall === wall.id || c.to === wall.id)) {
      const [id, end, mine] =
        c.wall === wall.id ? [c.to, c.toEnd, c.end] : [c.wall, c.end, c.toEnd];
      moveEnd(id, end, turned[mine]);
    } else if (c.kind === 'tee' && c.to === wall.id) {
      // A Wall T-connected onto this one keeps its direction and reaches it again.
      const tee = walls[c.wall];
      if (tee)
        moveEnd(c.wall, c.end, reach(tee[c.end], wallDirection(tee), across(wall, tee[c.end])));
    }
  }

  for (const [id, w] of Object.entries(walls)) {
    if (w === model.walls[id] || id === wall.id) continue;
    const before = model.walls[id]!;
    const v = sub(w.end, w.start);
    if (dot(v, sub(before.end, before.start)) <= 0 || Math.hypot(v.x, v.y) < MIN_WALL_LENGTH)
      return refuse(
        message('commands.rotateWall.tooShort', { wall: number(w), min: MIN_WALL_LENGTH }),
      );
  }

  const stranded = carryTees(model, walls, connections);
  if (stranded) return refuse(stranded);

  const roomSeparators: Record<string, RoomSeparator> = { ...model.roomSeparators };
  for (const s of Object.values(model.roomSeparators)) {
    if (s.startWall !== wall.id && s.endWall !== wall.id) continue;
    const dir = normalize(sub(s.end, s.start));
    roomSeparators[s.id] = {
      ...s,
      start: s.startWall === wall.id ? reach(s.start, dir, across(wall, s.start)) : s.start,
      end: s.endWall === wall.id ? reach(s.end, dir, across(wall, s.end)) : s.end,
    };
  }

  // Openings turn with the Wall: measured from the new start, they stay where they were on it.
  const shift = dot(sub(start0, turned.start), d);
  const openings: Record<string, Opening> = { ...model.openings };
  if (Math.abs(shift) > 1e-9)
    for (const o of Object.values(model.openings))
      if (o.wall === wall.id) openings[o.id] = { ...o, offset: o.offset + shift };

  const next: Model = { ...model, walls, wallConnections: connections, roomSeparators, openings };
  return {
    ok: true,
    model: reseatSeeds(model, next, wall.level),
    label: message('commands.rotateWall.label'),
  };
};

const perpOf = (d: Vec): Vec => ({ x: -d.y, y: d.x });
/** Signed distance of a point from a Wall's Baseline line, towards its normal. */
const across = (w: Wall, p: Vec): number => cross(wallDirection(w), sub(p, w.start));
/** A point on the line `offset` across a Wall's Baseline. */
const offsetPoint = (w: Wall, offset: number): Vec =>
  add(w.start, scale(perpOf(wallDirection(w)), offset));
