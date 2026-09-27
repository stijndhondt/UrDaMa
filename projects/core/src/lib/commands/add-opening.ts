/**
 * AddOpening: the Door (D) and Window (N) tools. An Opening is hosted by a Wall, positioned along
 * its Baseline; sizes default to the Presets (door 930 × 2115 mm, window 1200 × 1200 mm on a 900 mm
 * sill). Openings never overlap each other or run past the Wall's ends (invariants).
 */
import { put } from '../model/edit';
import { message, type Message } from '../model/message';
import { BUILT_IN_FAMILIES, presetSize, typeWithSize } from '../model/opening-types';
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

/** Why an Opening's size is not possible, if it isn't: sizes above 0, a sill not below the floor. */
export function openingSizeProblem(o: {
  readonly width: number;
  readonly height: number;
  readonly sill: number;
}): Message | null {
  return o.width > 0 && o.height > 0 && o.sill >= 0 ? null : message('commands.opening.badSize');
}

export const addOpening: Command<AddOpeningArgs> = (model, args, { ids }) => {
  if (!model.walls[args.wall])
    return refuse(message('invariants.missingReference', { what: 'wall', id: args.wall }));
  const preset = presetSize(model.project.presets, args.kind);
  const size = {
    width: args.width ?? preset.width,
    height: args.height ?? preset.height,
    sill: args.sill ?? preset.sill,
  };
  const problem = openingSizeProblem(size);
  if (problem) return refuse(problem);
  // The Opening is an instance of its family's type with this size (a new type if none has it).
  const typed = typeWithSize(model, BUILT_IN_FAMILIES[args.kind], size.width, size.height, ids);
  const opening: Opening = {
    id: ids('openings') as OpeningId,
    wall: args.wall,
    type: typed.type,
    offset: args.offset,
    sill: size.sill,
    hinge: args.hinge ?? 'start',
    swing: args.swing ?? 'right',
  };
  const door = args.kind === 'door';
  return {
    ok: true,
    model: put(typed.model, 'openings', opening),
    label: message(door ? 'commands.opening.addDoor' : 'commands.opening.addWindow'),
  };
};
