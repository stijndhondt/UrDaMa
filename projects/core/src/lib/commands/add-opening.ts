/**
 * AddOpening: the Door (D) and Window (N) tools. An Opening is hosted by a Wall, positioned along
 * its Baseline; sizes default to the Presets (door 930 × 2115 mm, window 1200 × 1200 mm on a 900 mm
 * sill). Openings never overlap each other or run past the Wall's ends (invariants).
 */
import { put } from '../model/edit';
import { message } from '../model/message';
import type { Opening, OpeningId, OpeningKind, WallId } from '../model/types';
import { refuse, type Command } from './command';

export interface AddOpeningArgs {
  readonly wall: WallId;
  readonly kind: OpeningKind;
  /** mm along the Wall's Baseline from its start to the Opening's near edge */
  readonly offset: number;
  readonly width?: number;
  readonly height?: number;
  readonly sill?: number;
  readonly hinge?: Opening['hinge'];
  readonly swing?: Opening['swing'];
}

export const addOpening: Command<AddOpeningArgs> = (model, args, { ids }) => {
  if (!model.walls[args.wall])
    return refuse(message('invariants.missingReference', { what: 'wall', id: args.wall }));
  const p = model.project.presets;
  const door = args.kind === 'door';
  const opening: Opening = {
    id: ids('openings') as OpeningId,
    wall: args.wall,
    kind: args.kind,
    offset: args.offset,
    width: args.width ?? (door ? p.doorWidth : p.windowWidth),
    height: args.height ?? (door ? p.doorHeight : p.windowHeight),
    sill: args.sill ?? (door ? 0 : p.windowSill),
    hinge: args.hinge ?? 'start',
    swing: args.swing ?? 'right',
  };
  if (!(opening.width > 0 && opening.height > 0) || opening.sill < 0)
    return refuse(message('commands.opening.badSize'));
  return {
    ok: true,
    model: put(model, 'openings', opening),
    label: message(door ? 'commands.opening.addDoor' : 'commands.opening.addWindow'),
  };
};
