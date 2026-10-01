/**
 * Opening type commands (ticket 18): add a type to a family, rename or delete it (refused while
 * Openings use it), change its sizes for every Opening of that type, and give an Opening another
 * type of its family. "Only this one" is UpdateOpening with a new size.
 */
import { put, remove } from '../model/edit';
import { message } from '../model/message';
import type {
  Model,
  Opening,
  OpeningFamilyId,
  OpeningId,
  OpeningType,
  OpeningTypeId,
} from '../model/types';
import { typeSizeProblem } from './add-opening';
import { refuse, type Command } from './command';

const missing = (what: string, id: string) =>
  refuse(message('invariants.missingReference', { what, id }));

/** How many Openings are of this type. */
export const openingsOfType = (model: Model, type: OpeningTypeId): number =>
  Object.values(model.openings).filter((o) => o.type === type).length;

/** A trimmed name; an empty one means "no name" (the UI shows the sizes). */
const cleanName = (name: string | undefined): string | undefined => name?.trim() || undefined;

/** Whether another type of the family already has this name (names tell types apart). */
const nameTaken = (model: Model, family: OpeningFamilyId, name: string, self?: OpeningTypeId) =>
  Object.values(model.openingTypes).some(
    (t) => t.family === family && t.id !== self && t.name === name,
  );

/**
 * An unnamed type is known by its sizes, so a family has one per size: an unnamed type that now
 * has the sizes of another moves its Openings to that one and goes.
 */
function mergeUnnamed(model: Model, type: OpeningType): Model {
  if (type.name) return model;
  const same = Object.values(model.openingTypes).find(
    (t) =>
      t.id !== type.id &&
      t.family === type.family &&
      !t.name &&
      t.width === type.width &&
      t.height === type.height,
  );
  if (!same) return model;
  const moved = Object.values(model.openings).filter((o) => o.type === type.id);
  let next = model;
  for (const o of moved) next = put(next, 'openings', { ...o, type: same.id });
  return remove(next, 'openingTypes', [type.id]);
}

export interface AddOpeningTypeArgs {
  readonly family: OpeningFamilyId;
  readonly name?: string;
  /** mm */
  readonly width: number;
  readonly height: number;
}

export const addOpeningType: Command<AddOpeningTypeArgs> = (model, args, { ids }) => {
  if (!model.openingFamilies[args.family]) return missing('openingFamily', args.family);
  const problem = typeSizeProblem(args.width, args.height);
  if (problem) return refuse(problem);
  const name = cleanName(args.name);
  if (name && nameTaken(model, args.family, name))
    return refuse(message('commands.openingType.nameTaken', { name }));
  const type: OpeningType = {
    id: ids('openingTypes') as OpeningTypeId,
    family: args.family,
    ...(name ? { name } : {}),
    width: args.width,
    height: args.height,
  };
  return {
    ok: true,
    model: put(model, 'openingTypes', type),
    label: message('commands.openingType.add'),
  };
};

export interface RenameOpeningTypeArgs {
  readonly type: OpeningTypeId;
  readonly name: string;
}

export const renameOpeningType: Command<RenameOpeningTypeArgs> = (model, args) => {
  const type = model.openingTypes[args.type];
  if (!type) return missing('openingType', args.type);
  const { name: _old, ...rest } = type;
  const name = cleanName(args.name);
  if (name && nameTaken(model, type.family, name, type.id))
    return refuse(message('commands.openingType.nameTaken', { name }));
  const renamed: OpeningType = name ? { ...rest, name } : rest;
  return {
    ok: true,
    model: mergeUnnamed(put(model, 'openingTypes', renamed), renamed),
    label: message('commands.openingType.rename'),
  };
};

export interface DeleteOpeningTypeArgs {
  readonly type: OpeningTypeId;
}

export const deleteOpeningType: Command<DeleteOpeningTypeArgs> = (model, args) => {
  if (!model.openingTypes[args.type]) return missing('openingType', args.type);
  const count = openingsOfType(model, args.type);
  if (count > 0) return refuse(message('commands.openingType.inUse', { count }));
  return {
    ok: true,
    model: remove(model, 'openingTypes', [args.type]),
    label: message('commands.openingType.delete'),
  };
};

export interface UpdateOpeningTypeArgs {
  readonly type: OpeningTypeId;
  readonly width?: number;
  readonly height?: number;
}

/** New sizes for a type: every Opening of it follows ("all of this type"). */
export const updateOpeningType: Command<UpdateOpeningTypeArgs> = (model, args) => {
  const type = model.openingTypes[args.type];
  if (!type) return missing('openingType', args.type);
  const width = args.width ?? type.width;
  const height = args.height ?? type.height;
  const problem = typeSizeProblem(width, height);
  if (problem) return refuse(problem);
  const resized: OpeningType = { ...type, width, height };
  return {
    ok: true,
    model: mergeUnnamed(put(model, 'openingTypes', resized), resized),
    label: message('commands.openingType.update'),
  };
};

export interface SetOpeningTypeArgs {
  readonly opening: OpeningId;
  readonly type: OpeningTypeId;
}

/** Another type of the same family for one Opening (a door can't become a window). */
export const setOpeningType: Command<SetOpeningTypeArgs> = (model, args) => {
  const o = model.openings[args.opening];
  if (!o) return missing('opening', args.opening);
  const type = model.openingTypes[args.type];
  if (!type) return missing('openingType', args.type);
  if (type.family !== model.openingTypes[o.type]?.family)
    return refuse(message('commands.openingType.otherFamily'));
  const next: Opening = { ...o, type: type.id };
  return {
    ok: true,
    model: put(model, 'openings', next),
    label: message('commands.opening.update'),
  };
};
