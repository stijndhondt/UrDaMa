/**
 * Opening family commands (ticket 20): a new name or design for a family. Every type of the
 * family and every Opening of those types follow it, as one undo step.
 */
import { put } from '../model/edit';
import { message } from '../model/message';
import { DEFAULT_DESIGNS, designFits, type OpeningDesign } from '../model/opening-parts';
import type { OpeningFamily, OpeningFamilyId } from '../model/types';
import { refuse, type Command } from './command';

export interface UpdateOpeningFamilyArgs {
  readonly family: OpeningFamilyId;
  /** An empty name shows the kind's name again */
  readonly name?: string;
  readonly design?: OpeningDesign;
}

export const updateOpeningFamily: Command<UpdateOpeningFamilyArgs> = (model, args) => {
  const family = model.openingFamilies[args.family];
  if (!family)
    return refuse(
      message('invariants.missingReference', { what: 'openingFamily', id: args.family }),
    );
  const design = args.design;
  // A family keeps its kind's infill: a window glazed, a door with leaves, and so on.
  if (design && !designFits(family.kind, design))
    return refuse(message('commands.openingFamily.badDesign'));
  const { name: _name, design: _design, ...plain } = family;
  const name = args.name === undefined ? family.name : args.name.trim() || undefined;
  // A design like its kind's default is no design of its own: the family follows the default.
  const own = !design
    ? family.design
    : sameValue(design, DEFAULT_DESIGNS[family.kind])
      ? undefined
      : design;
  const next: OpeningFamily = {
    ...plain,
    ...(name ? { name } : {}),
    ...(own ? { design: own } : {}),
  };
  return {
    ok: true,
    model: put(model, 'openingFamilies', next),
    label: message('commands.openingFamily.update'),
  };
};

/** Whether two plain values (numbers, strings, objects of them) are alike, key order aside. */
function sameValue(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || !a || !b) return false;
  const ka = Object.keys(a);
  const kb = Object.keys(b);
  return (
    ka.length === kb.length &&
    ka.every((k) => sameValue((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]))
  );
}
