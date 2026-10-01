/** UpdateOpening: a committed field of an Opening, or a flip of a door (F / Shift+F). One step each. */
import { put } from '../model/edit';
import { message } from '../model/message';
import { detachedType, resolveOpening } from '../model/opening-types';
import type { Opening, OpeningId } from '../model/types';
import { openingSizeProblem } from './add-opening';
import { refuse, type Command } from './command';

export interface UpdateOpeningArgs {
  readonly opening: OpeningId;
  readonly offset?: number;
  readonly width?: number;
  readonly height?: number;
  readonly sill?: number;
  /** F: hinges to the other jamb */
  readonly flipHinge?: boolean;
  /** Shift+F: opens to the other face */
  readonly flipSwing?: boolean;
}

export const updateOpening: Command<UpdateOpeningArgs> = (model, args, { ids }) => {
  const o = model.openings[args.opening];
  const resolved = o && resolveOpening(model, o);
  if (!o || !resolved)
    return refuse(message('invariants.missingReference', { what: 'opening', id: args.opening }));
  const width = args.width ?? resolved.width;
  const height = args.height ?? resolved.height;
  const sill = args.sill ?? o.sill;
  const problem = openingSizeProblem({ width, height, sill });
  if (problem) return refuse(problem);
  // A new size here changes only this Opening ("only this one"): it detaches into a type of its
  // own. Changing the type for all its Openings is UpdateOpeningType.
  const sized =
    width === resolved.width && height === resolved.height
      ? { model, type: o.type }
      : detachedType(model, model.openingTypes[o.type]!, width, height, ids);
  const next: Opening = {
    ...o,
    type: sized.type,
    offset: args.offset ?? o.offset,
    sill,
    hinge: args.flipHinge ? (o.hinge === 'start' ? 'end' : 'start') : o.hinge,
    swing: args.flipSwing ? (o.swing === 'left' ? 'right' : 'left') : o.swing,
  };
  return {
    ok: true,
    model: put(sized.model, 'openings', next),
    label: message('commands.opening.update'),
  };
};
