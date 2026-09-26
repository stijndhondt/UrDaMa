/**
 * DrawWall: the Wall tool's command (Box-drawing interaction; Wall joins and room detection).
 *
 * The core, not the editor, decides how a new Wall joins the Walls already there:
 * - an end on another Wall's free end becomes a corner Wall connection; a taken corner, or an end
 *   on a Wall face, becomes a T;
 * - a Wall drawn onto an existing parallel Wall is moved against its face (side by side);
 * - a Wall drawn through an existing Wall is split there into Walls T-connected to both faces;
 * - enclosed areas the new Wall closes get a Room.
 */
import { levelGeometry, wallFaces } from '../geometry/level-geometry';
import { distanceToSegment, insideRing } from '../geometry/polygon';
import {
  faceOffsets,
  wallDirection,
  wallLength,
  type WallOutline,
} from '../geometry/wall-outlines';
import { add, cross, distance, dot, perp, scale, sub } from '../geometry/vec';
import { putAll } from '../model/edit';
import { message } from '../model/message';
import type {
  LevelId,
  Vec,
  Wall,
  WallConnection,
  WallConnectionId,
  WallEnd,
  WallId,
  WallSide,
} from '../model/types';
import { refuse, type Command, type CommandContext } from './command';
import { reseatSeeds } from './seeds';
import { roomsForNewAreas } from './new-rooms';

export interface DrawWallArgs {
  readonly level: LevelId;
  readonly start: Vec;
  readonly end: Vec;
  readonly side: WallSide;
  /** mm; absent = follows the wall-thickness Preset */
  readonly thickness?: number;
  /** Names for Rooms created when the Wall closes a loop: the 1st, 2nd, … new Room. */
  readonly roomName: (index: number) => string;
}

/** Shortest Wall that may be drawn (mm). */
export const MIN_WALL_LENGTH = 50;
/** How close (mm) a point must be to count as on an end or a face. */
const ON = 0.5;
/** Pieces shorter than this (mm) left over after splitting get no Wall. */
const MIN_PIECE = 10;

export const drawWall: Command<DrawWallArgs> = (model, args, context) => {
  if (!model.levels[args.level])
    return refuse(message('invariants.missingReference', { what: 'level', id: args.level }));
  if (distance(args.start, args.end) < MIN_WALL_LENGTH) {
    return refuse(message('commands.drawWall.tooShort', { min: MIN_WALL_LENGTH }));
  }
  const preset = model.project.presets.wallThickness;
  const existing = levelGeometry(model, args.level);
  const probe: Wall = {
    id: 'probe' as WallId,
    level: args.level,
    start: args.start,
    end: args.end,
    side: args.side,
    thickness: args.thickness,
    roomBounding: true,
  };
  const placed = besideParallelWalls(probe, existing.walls, preset);

  // Split where the Wall passes through existing Walls.
  const covered: { t0: number; t1: number; host: Wall }[] = [];
  for (const host of existing.walls) {
    const outline = existing.outlines.get(host.id);
    const span = outline && segmentInside(placed.start, placed.end, outline);
    if (!span || (span[1] - span[0]) * wallLength(placed) <= ON) continue;
    // Running along the outline's edge is touching, not passing through: the middle must be well inside.
    const mid = add(placed.start, scale(sub(placed.end, placed.start), (span[0] + span[1]) / 2));
    const clearance = Math.min(
      ...[0, 1, 2, 3].map((i) => distanceToSegment(mid, outline[i]!, outline[(i + 1) % 4]!)),
    );
    if (!insideRing(mid, outline) || clearance <= ON) continue;
    covered.push({ t0: span[0], t1: span[1], host });
  }
  covered.sort((a, b) => a.t0 - b.t0);
  const total = wallLength(placed);
  const pieces: { t0: number; t1: number; startHost?: Wall; endHost?: Wall }[] = [];
  let cursor = 0;
  let previousHost: Wall | undefined;
  for (const c of covered) {
    if ((c.t0 - cursor) * total >= MIN_PIECE)
      pieces.push({ t0: cursor, t1: c.t0, startHost: previousHost, endHost: c.host });
    cursor = Math.max(cursor, c.t1);
    previousHost = c.host;
  }
  if ((1 - cursor) * total >= MIN_PIECE)
    pieces.push({ t0: cursor, t1: 1, startHost: previousHost });
  if (!pieces.length) return refuse(message('commands.drawWall.insideWall'));

  const at = (t: number) => add(placed.start, scale(sub(placed.end, placed.start), t));
  const walls: Wall[] = pieces.map((p) => ({
    ...placed,
    id: context.ids('walls') as WallId,
    start: at(p.t0),
    end: at(p.t1),
    ...(args.thickness === undefined ? {} : { thickness: args.thickness }),
  }));
  if (args.thickness === undefined) walls.forEach((w, i) => (walls[i] = withoutThickness(w)));

  const connections: WallConnection[] = [];
  const takenCorners = new Set(
    Object.values(model.wallConnections).flatMap((c) =>
      c.kind === 'corner' ? [`${c.wall}:${c.end}`, `${c.to}:${c.toEnd}`] : [],
    ),
  );
  pieces.forEach((piece, i) => {
    const wall = walls[i]!;
    for (const end of ['start', 'end'] as const) {
      const host = end === 'start' ? piece.startHost : piece.endHost;
      const point = end === 'start' ? wall.start : wall.end;
      const connection = host
        ? tee(context, wall, end, host, point)
        : joinAt(context, wall, end, point, existing.walls, existing.outlines, takenCorners);
      if (connection) {
        connections.push(connection);
        if (connection.kind === 'corner') takenCorners.add(`${connection.to}:${connection.toEnd}`);
      }
    }
  });

  let next = putAll(model, 'walls', walls);
  next = putAll(next, 'wallConnections', connections);
  // Rooms the new Wall landed on keep their best-overlapping piece; what is left gets new Rooms.
  next = reseatSeeds(model, next, args.level);
  const newOutlines = levelGeometry(next, args.level);
  const added = walls.flatMap((w) =>
    newOutlines.outlines.has(w.id) ? [newOutlines.outlines.get(w.id)!] : [],
  );
  next = roomsForNewAreas(
    model,
    next,
    args.level,
    (area) =>
      area.outline.some((p) =>
        added.some(
          (o) =>
            wallFaces(o).some(([a, b]) => distanceToSegment(p, a, b) <= ON) || insideRing(p, o),
        ),
      ),
    args.roomName,
    context,
  );
  return { ok: true, model: next, label: message('commands.drawWall.label') };
};

function withoutThickness(wall: Wall): Wall {
  const { thickness: _unused, ...rest } = wall;
  return rest;
}

/** Moves a Wall that lies on top of a parallel existing Wall so that it sits against its face. */
function besideParallelWalls(wall: Wall, existing: readonly Wall[], preset: number): Wall {
  let current = wall;
  for (const other of existing) {
    const d = wallDirection(current);
    if (Math.abs(cross(d, wallDirection(other))) > 1e-6) continue;
    const n = perp(d);
    // Along the Wall: do they overlap in length?
    const a0 = dot(sub(other.start, current.start), d);
    const a1 = dot(sub(other.end, current.start), d);
    const lengthOverlap =
      Math.min(wallLength(current), Math.max(a0, a1)) - Math.max(0, Math.min(a0, a1));
    if (lengthOverlap <= ON) continue;
    // Across the Wall: do their thicknesses overlap?
    const [lo, hi] = faceOffsets(current, preset);
    const [oLo, oHi] = faceOffsets(other, preset);
    const base = dot(sub(other.start, current.start), n);
    const sign = dot(perp(wallDirection(other)), n);
    const a = base + Math.min(oLo * sign, oHi * sign);
    const b = base + Math.max(oLo * sign, oHi * sign);
    if (Math.min(hi, b) - Math.max(lo, a) <= ON) continue;
    const shift = (lo + hi) / 2 >= (a + b) / 2 ? b - lo : a - hi;
    const offset = scale(n, shift);
    current = { ...current, start: add(current.start, offset), end: add(current.end, offset) };
  }
  return current;
}

/** The part [t0, t1] of segment a→b inside a convex outline, or null (Cyrus–Beck clipping). */
function segmentInside(a: Vec, b: Vec, outline: WallOutline): [number, number] | null {
  const d = sub(b, a);
  let t0 = 0;
  let t1 = 1;
  // Orientation of the outline, so every edge's inside is on the same side.
  let orientation = 0;
  for (let i = 0; i < 4; i++) orientation += cross(outline[i]!, outline[(i + 1) % 4]!);
  const sign = orientation >= 0 ? 1 : -1;
  for (let i = 0; i < 4; i++) {
    const p = outline[i]!;
    const q = outline[(i + 1) % 4]!;
    const edge = sub(q, p);
    const inward = scale(perp(edge), sign); // points into the outline
    const denom = dot(inward, d);
    const num = dot(inward, sub(a, p));
    if (Math.abs(denom) < 1e-12) {
      if (num < 0) return null;
      continue;
    }
    const t = -num / denom;
    if (denom > 0) t0 = Math.max(t0, t);
    else t1 = Math.min(t1, t);
    if (t0 >= t1) return null;
  }
  return [t0, t1];
}

function tee(
  context: CommandContext,
  wall: Wall,
  end: WallEnd,
  host: Wall,
  point: Vec,
): WallConnection {
  return {
    id: context.ids('wallConnections') as WallConnectionId,
    wall: wall.id,
    end,
    kind: 'tee',
    to: host.id,
    at: dot(sub(point, host.start), wallDirection(host)),
  };
}

/** How a free Wall end joins what is there: a corner at a free Wall end, else a T on a face. */
function joinAt(
  context: CommandContext,
  wall: Wall,
  end: WallEnd,
  point: Vec,
  existing: readonly Wall[],
  outlines: ReadonlyMap<WallId, WallOutline>,
  takenCorners: ReadonlySet<string>,
): WallConnection | null {
  const direction = wallDirection(wall);
  for (const other of existing) {
    if (Math.abs(cross(direction, wallDirection(other))) < 1e-6) continue;
    for (const otherEnd of ['start', 'end'] as const) {
      if (distance(point, other[otherEnd]) > ON || takenCorners.has(`${other.id}:${otherEnd}`))
        continue;
      return {
        id: context.ids('wallConnections') as WallConnectionId,
        wall: wall.id,
        end,
        kind: 'corner',
        to: other.id,
        toEnd: otherEnd,
      };
    }
  }
  for (const other of existing) {
    if (Math.abs(cross(direction, wallDirection(other))) < 1e-6) continue;
    const outline = outlines.get(other.id);
    if (!outline) continue;
    const onFace = wallFaces(outline).some(([a, b]) => distanceToSegment(point, a, b) <= ON);
    const onBaselineEnd = ['start', 'end'].some((e) => distance(point, other[e as WallEnd]) <= ON);
    if (onFace || onBaselineEnd) return tee(context, wall, end, other, point);
  }
  return null;
}
