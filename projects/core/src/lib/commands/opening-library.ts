/**
 * The personal Opening library (ticket 21): families with their types, kept in the browser apart
 * from any project. A family is saved from a project as a LibraryFamily, and imported back as a
 * copy with new IDs, so every project stays self-contained (ADR 0007).
 */
import { put } from '../model/edit';
import { message } from '../model/message';
import { designFits, type OpeningDesign } from '../model/opening-parts';
import { familyTypes, OPENING_KINDS } from '../model/opening-types';
import type {
  Model,
  OpeningFamily,
  OpeningFamilyId,
  OpeningKind,
  OpeningType,
  OpeningTypeId,
} from '../model/types';
import { typeSizeProblem } from './add-opening';
import { refuse, type Command } from './command';

/** A family as the library keeps it: no project IDs, its types by name and size. */
export interface LibraryFamily {
  /** The library's own ID for it */
  readonly id: string;
  readonly kind: OpeningKind;
  readonly name?: string;
  readonly design?: OpeningDesign;
  readonly types: readonly LibraryType[];
}

/** A type as the library keeps it: its name, if any, and its sizes. */
export interface LibraryType {
  readonly name?: string;
  /** mm */
  readonly width: number;
  /** mm */
  readonly height: number;
  /** mm above the floor; absent = the kind's Preset */
  readonly sill?: number;
}

/** A project family and its types, for the library under `id`; null when it doesn't exist. */
export function libraryFamily(
  model: Model,
  family: OpeningFamilyId,
  id: string,
): LibraryFamily | null {
  const f = model.openingFamilies[family];
  if (!f) return null;
  return {
    id,
    kind: f.kind,
    ...(f.name ? { name: f.name } : {}),
    ...(f.design ? { design: f.design } : {}),
    types: familyTypes(model, family).map((t) => ({
      ...(t.name ? { name: t.name } : {}),
      width: t.width,
      height: t.height,
      ...(t.sill === undefined ? {} : { sill: t.sill }),
    })),
  };
}

/** Whether a library family is damaged (edited by hand, from an older app): not importable. */
function isDamaged(f: LibraryFamily): boolean {
  if (!OPENING_KINDS.includes(f.kind) || !f.types.length) return true;
  if (f.design && !designFits(f.kind, f.design)) return true;
  return f.types.some(
    (t) =>
      typeof t.width !== 'number' ||
      typeof t.height !== 'number' ||
      (t.name !== undefined && typeof t.name !== 'string') ||
      (t.sill !== undefined && !(typeof t.sill === 'number' && t.sill >= 0)) ||
      typeSizeProblem(t.width, t.height) !== null,
  );
}

/** The name, or "Name (2)", "Name (3)"… when another family of the project already has it. */
function freeName(model: Model, name: string, shown: readonly string[]): string {
  const used = new Set([...Object.values(model.openingFamilies).map((f) => f.name), ...shown]);
  if (!used.has(name)) return name;
  const base = name.replace(/ \(\d+\)$/, '');
  let n = 2;
  while (used.has(`${base} (${n})`)) n++;
  return `${base} (${n})`;
}

export interface ImportOpeningFamilyArgs {
  readonly family: LibraryFamily;
  /** Names the project's unnamed families show (their kind's, in the user's language) */
  readonly shownNames?: readonly string[];
}

/** A library family into the project: a new family with new types, one undo step. */
export const importOpeningFamily: Command<ImportOpeningFamilyArgs> = (model, args, { ids }) => {
  const source = args.family;
  if (isDamaged(source)) return refuse(message('commands.openingLibrary.badFamily'));
  const family: OpeningFamily = {
    id: ids('openingFamilies') as OpeningFamilyId,
    kind: source.kind,
    ...(source.name ? { name: freeName(model, source.name, args.shownNames ?? []) } : {}),
    ...(source.design ? { design: source.design } : {}),
  };
  let next = put(model, 'openingFamilies', family);
  for (const t of source.types) {
    const type: OpeningType = {
      id: ids('openingTypes') as OpeningTypeId,
      family: family.id,
      ...(t.name ? { name: t.name } : {}),
      width: t.width,
      height: t.height,
      ...(t.sill === undefined ? {} : { sill: t.sill }),
    };
    next = put(next, 'openingTypes', type);
  }
  return { ok: true, model: next, label: message('commands.openingLibrary.import') };
};
