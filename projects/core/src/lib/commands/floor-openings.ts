/**
 * DrawFloorOpening: a Floor opening, for a stair or a lift, drawn as a rectangle on a Level
 * (CONTEXT.md Floor opening). It goes up, through the floor of the Level above, or down, through this Level's own
 * floor. Both Levels must exist: the user adds them first.
 */
import { boundingBox } from '../geometry/polygon';
import { put } from '../model/edit';
import { neighbourLevels } from '../model/levels';
import { message } from '../model/message';
import type { FloorOpening, FloorOpeningId, LevelId, Model, Vec } from '../model/types';
import { refuse, type Command } from './command';

export type FloorOpeningDirection = 'up' | 'down';

export interface DrawFloorOpeningArgs {
  /** The Level it is drawn on */
  readonly level: LevelId;
  /** Opposite corners of the rectangle (mm) */
  readonly from: Vec;
  readonly to: Vec;
  readonly direction: FloorOpeningDirection;
}

/** mm: the smallest size each way */
export const MIN_FLOOR_OPENING = 100;

/** Whether a rectangle between two corners is at least the smallest Floor opening each way. */
export function bigEnough(from: Vec, to: Vec): boolean {
  return (
    Math.abs(to.x - from.x) >= MIN_FLOOR_OPENING && Math.abs(to.y - from.y) >= MIN_FLOOR_OPENING
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
  const { min, max } = boundingBox([args.from, args.to]);
  if (!bigEnough(args.from, args.to))
    return refuse(message('commands.floorOpening.tooSmall', { min: MIN_FLOOR_OPENING }));
  const { above, below } = neighbourLevels(model, args.level);
  // Up: through the floor of the Level above. Down: through this Level's floor.
  if (args.direction === 'up' && !above)
    return refuse(message('commands.floorOpening.noLevelAbove'));
  if (args.direction === 'down' && !below)
    return refuse(message('commands.floorOpening.noLevelBelow'));
  const opening: FloorOpening = {
    id: ids('floorOpenings') as FloorOpeningId,
    level: args.direction === 'up' ? above! : args.level,
    outline: [min, { x: max.x, y: min.y }, max, { x: min.x, y: max.y }],
  };
  return {
    ok: true,
    model: put(model, 'floorOpenings', opening),
    label: message('commands.floorOpening.label'),
  };
};
