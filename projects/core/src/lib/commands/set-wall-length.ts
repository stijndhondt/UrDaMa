/**
 * SetWallLength (slice 2, ticket 01): typing a Wall's length. One end moves (or both, by half the
 * difference each), in one of two modes:
 *
 * - **Move Room**: the Wall connected at the moving end (its corner partner, or the Wall its T end
 *   sits against) is pushed along this Wall's direction, as re-typing a Room's size does. The Room
 *   grows or shrinks, and everything beyond keeps its measured size.
 * - **Move only this Wall**: this Wall's end moves; a corner partner's end goes with it (that Wall
 *   tilts). Walls T-connected onto this Wall and its Openings stay where they are.
 */
import { wallDirection, wallLength } from '../geometry/wall-outlines';
import { add, scale } from '../geometry/vec';
import { put } from '../model/edit';
import { message } from '../model/message';
import type { Model, Opening, Vec, Wall, WallConnection, WallEnd, WallId } from '../model/types';
import { refuse, type Command, type CommandOutcome } from './command';
import { MIN_WALL_LENGTH } from './draw-wall';
import { faceToward, push } from './push';
import { reseatSeeds } from './seeds';

export interface SetWallLengthArgs {
  readonly wall: WallId;
  /** mm, the new length of the Baseline */
  readonly length: number;
  /** Which end moves; 'both' moves each end by half the difference. */
  readonly end: WallEnd | 'both';
  /** 'room': the Wall at the moving end shifts along (the Room grows); 'wall': only this Wall's end moves. */
  readonly mode: 'room' | 'wall';
}

export const setWallLength: Command<SetWallLengthArgs> = (model, args) => {
  const wall = model.walls[args.wall];
  if (!wall) return refuse(message('invariants.missingReference', { what: 'wall', id: args.wall }));
  if (!(args.length >= MIN_WALL_LENGTH))
    return refuse(message('commands.wallLength.tooShort', { min: MIN_WALL_LENGTH }));
  const delta = args.length - wallLength(wall);
  if (Math.abs(delta) < 1e-6) return refuse(message('commands.wallLength.same'));

  const steps: [WallEnd, number][] =
    args.end === 'both'
      ? [
          ['start', delta / 2],
          ['end', delta / 2],
        ]
      : [[args.end, delta]];
  let next = model;
  for (const [end, amount] of steps) {
    const outcome =
      args.mode === 'room'
        ? moveNeighbour(next, args.wall, end, amount)
        : moveEnd(next, args.wall, end, amount);
    if (!outcome.ok) return outcome;
    next = outcome.model;
  }
  return {
    ok: true,
    model: reseatSeeds(model, next, wall.level),
    label: message('commands.wallLength.label'),
  };
};

type Step = { readonly ok: true; readonly model: Model } | Extract<CommandOutcome, { ok: false }>;

/** The direction a Wall's end moves when the Wall gets longer at that end. */
const outward = (wall: Wall, end: WallEnd): Vec => {
  const d = wallDirection(wall);
  return end === 'end' ? d : scale(d, -1);
};

/** The Wall connected at one end: the corner partner, or the Wall a T end sits against. */
function connectedAt(model: Model, id: WallId, end: WallEnd): WallConnection | undefined {
  return Object.values(model.wallConnections).find(
    (c) =>
      (c.wall === id && c.end === end) || (c.kind === 'corner' && c.to === id && c.toEnd === end),
  );
}

/** Move Room: push the Wall at that end along this Wall, so the Room grows by `amount`. */
function moveNeighbour(model: Model, id: WallId, end: WallEnd, amount: number): Step {
  const wall = model.walls[id]!;
  const c = connectedAt(model, id, end);
  if (!c) return moveEnd(model, id, end, amount);
  const other = c.wall === id ? c.to : c.wall;
  const neighbour = model.walls[other];
  if (!neighbour) return moveEnd(model, id, end, amount);
  const u = outward(wall, end);
  const result = push(model, {
    level: wall.level,
    facePoint: faceToward(neighbour, scale(u, -1), model.project.presets.wallThickness),
    direction: u,
    amount,
    from: neighbour.id,
    rigid: [neighbour.id],
  });
  return result.ok ? { ok: true, model: result.model } : { ok: false, reason: result.reason };
}

/** Move only this Wall: its end moves along it, and a corner partner's end goes with it. */
function moveEnd(model: Model, id: WallId, end: WallEnd, amount: number): Step {
  const wall = model.walls[id]!;
  const c = connectedAt(model, id, end);
  if (c && c.kind === 'tee' && c.wall === id)
    return { ok: false, reason: message('commands.wallLength.teeEnd') };
  const v = scale(outward(wall, end), amount);
  const point = add(wall[end], v);
  let next = put(model, 'walls', { ...wall, [end]: point });
  if (c && c.kind === 'corner') {
    const [partnerId, partnerEnd] = c.wall === id ? [c.to, c.toEnd] : [c.wall, c.end];
    const partner = next.walls[partnerId];
    if (partner) next = put(next, 'walls', { ...partner, [partnerEnd]: point });
  }
  if (end === 'start') {
    // Positions along this Wall are measured from its start: keep what hangs on it in place.
    for (const t of Object.values(next.wallConnections)) {
      if (t.kind === 'tee' && t.to === id)
        next = put(next, 'wallConnections', { ...t, at: t.at + amount });
    }
    for (const o of Object.values(next.openings)) {
      if (o.wall === id)
        next = put(next, 'openings', { ...o, offset: o.offset + amount } satisfies Opening);
    }
  }
  return { ok: true, model: next };
}
