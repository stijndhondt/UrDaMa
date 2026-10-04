/**
 * DrawFloorOpening: a Floor opening, for a stair or a lift, drawn on a Level (CONTEXT.md Floor
 * opening): any outline, such as a rectangle, an L or a turned rectangle. It goes up, to the Level
 * above, or down, to the Level below. Both Levels must exist: the user adds them first.
 */
import { crossesItself } from '../geometry/polygon';
import { distance, ringArea } from '../geometry/vec';
import { put } from '../model/edit';
import { neighbourLevels } from '../model/levels';
import { message } from '../model/message';
import type { FloorOpening, FloorOpeningId, LevelId, Model, Vec } from '../model/types';
import { refuse, type Command } from './command';

export type FloorOpeningDirection = 'up' | 'down';

export interface DrawFloorOpeningArgs {
  /** The Level it is drawn on */
  readonly level: LevelId;
  /** Its outline (mm), at least three corners */
  readonly outline: readonly Vec[];
  readonly direction: FloorOpeningDirection;
}

/** mm: the shortest side */
export const MIN_FLOOR_OPENING = 100;

/** Whether an outline has at least three corners, each side at least the shortest one. */
export function bigEnough(outline: readonly Vec[]): boolean {
  return (
    outline.length >= 3 &&
    Math.abs(ringArea(outline)) > 0 &&
    outline.every((p, i) => distance(p, outline[(i + 1) % outline.length]!) >= MIN_FLOOR_OPENING)
  );
}

/** Which ways a Floor opening drawn on this Level can go: towards Levels that exist. */
export function floorOpeningDirections(model: Model, level: LevelId): FloorOpeningDirection[] {
  const { above, below } = neighbourLevels(model, level);
  return [...(above ? (['up'] as const) : []), ...(below ? (['down'] as const) : [])];
}

export const drawFloorOpening: Command<DrawFloorOpeningArgs> = (model, args, { ids }) => {
  if (!model.levels[args.level])
    return refuse(message('invariants.missingReference', { what: 'level', id: args.level }));
  if (crossesItself(args.outline)) return refuse(message('commands.floorOpening.crossesItself'));
  if (!bigEnough(args.outline))
    return refuse(message('commands.floorOpening.tooSmall', { min: MIN_FLOOR_OPENING }));
  const { above, below } = neighbourLevels(model, args.level);
  if (args.direction === 'up' && !above)
    return refuse(message('commands.floorOpening.noLevelAbove'));
  if (args.direction === 'down' && !below)
    return refuse(message('commands.floorOpening.noLevelBelow'));
  // Up: from this Level to the one above. Down: from the one below to this one.
  const opening: FloorOpening = {
    id: ids('floorOpenings') as FloorOpeningId,
    level: args.direction === 'up' ? above! : args.level,
    below: args.direction === 'up' ? args.level : below!,
    outline: args.outline,
  };
  return {
    ok: true,
    model: put(model, 'floorOpenings', opening),
    label: message('commands.floorOpening.label'),
  };
};
