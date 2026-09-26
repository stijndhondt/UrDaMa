/** UpdateWall: a committed field in the Wall's properties panel (one field, one undo step). */
import { put } from '../model/edit';
import { message } from '../model/message';
import type { Wall, WallId } from '../model/types';
import { refuse, type Command } from './command';

export interface UpdateWallArgs {
  readonly wall: WallId;
  readonly roomBounding?: boolean;
  /** mm; null = follow the Level's storey height again */
  readonly height?: number | null;
}

export const updateWall: Command<UpdateWallArgs> = (model, args) => {
  const wall = model.walls[args.wall];
  if (!wall) return refuse(message('invariants.missingReference', { what: 'wall', id: args.wall }));
  if (typeof args.height === 'number' && !(args.height > 0))
    return refuse(message('commands.updateWall.badHeight'));
  let next: Wall = { ...wall };
  if (args.roomBounding !== undefined) next = { ...next, roomBounding: args.roomBounding };
  if (args.height === null) {
    const { height: _removed, ...rest } = next;
    next = rest;
  } else if (args.height !== undefined) next = { ...next, height: args.height };
  return {
    ok: true,
    model: put(model, 'walls', next),
    label: message('commands.updateWall.label'),
  };
};
