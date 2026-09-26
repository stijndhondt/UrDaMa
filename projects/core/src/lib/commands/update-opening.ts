/** UpdateOpening: a committed field of an Opening, or a flip of a door (F / Shift+F). One step each. */
import { put } from '../model/edit';
import { message } from '../model/message';
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

export const updateOpening: Command<UpdateOpeningArgs> = (model, args) => {
  const o = model.openings[args.opening];
  if (!o)
    return refuse(message('invariants.missingReference', { what: 'opening', id: args.opening }));
  const next: Opening = {
    ...o,
    offset: args.offset ?? o.offset,
    width: args.width ?? o.width,
    height: args.height ?? o.height,
    sill: args.sill ?? o.sill,
    hinge: args.flipHinge ? (o.hinge === 'start' ? 'end' : 'start') : o.hinge,
    swing: args.flipSwing ? (o.swing === 'left' ? 'right' : 'left') : o.swing,
  };
  const problem = openingSizeProblem(next);
  if (problem) return refuse(problem);
  return {
    ok: true,
    model: put(model, 'openings', next),
    label: message('commands.opening.update'),
  };
};
