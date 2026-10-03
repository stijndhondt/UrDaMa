/**
 * Opening families and types (ADR 0007, ticket 16): the built-in families every project has, an
 * Opening resolved with its type's kind and sizes, and finding or making the type for a size.
 */
import { put } from './edit';
import { designOf, type OpeningDesign } from './opening-parts';
import type { IdGenerator } from './ids';
import type {
  Model,
  Opening,
  OpeningFamily,
  OpeningFamilyId,
  OpeningKind,
  OpeningType,
  OpeningTypeId,
  Presets,
} from './types';

/** The built-in families, one per kind; their IDs are the same in every project. */
export const BUILT_IN_FAMILIES = {
  door: 'ofm_door' as OpeningFamilyId,
  window: 'ofm_window' as OpeningFamilyId,
  wallOpening: 'ofm_wall_opening' as OpeningFamilyId,
  garageDoor: 'ofm_garage_door' as OpeningFamilyId,
} as const satisfies Record<OpeningKind, OpeningFamilyId>;

export const OPENING_KINDS: readonly OpeningKind[] = [
  'door',
  'window',
  'wallOpening',
  'garageDoor',
];

/** Windows and wall openings can sit above the floor; doors and garage doors stand on it. */
export const hasSill = (kind: OpeningKind): boolean => kind === 'window' || kind === 'wallOpening';

/** mm: the default sizes of the kinds that have no Preset (a passage; a single garage door). */
const DEFAULT_SIZES = {
  wallOpening: { width: 900, height: 2110, sill: 0 },
  garageDoor: { width: 2400, height: 2125, sill: 0 },
} as const;

/** The sizes a new Opening of a kind takes when none are given: the Presets. */
export function presetSize(p: Presets, kind: OpeningKind) {
  switch (kind) {
    case 'door':
      return { width: p.doorWidth, height: p.doorHeight, sill: 0 };
    case 'window':
      return { width: p.windowWidth, height: p.windowHeight, sill: p.windowSill };
    default:
      return DEFAULT_SIZES[kind];
  }
}

/** The built-in families and their default types (sized from the Presets) for a new project. */
export function builtInOpenings(
  presets: Presets,
  ids: IdGenerator,
): Pick<Model, 'openingFamilies' | 'openingTypes'> {
  const families: OpeningFamily[] = OPENING_KINDS.map((kind) => ({
    id: BUILT_IN_FAMILIES[kind],
    kind,
  }));
  const types: OpeningType[] = families.map((f) => {
    const { width, height } = presetSize(presets, f.kind);
    return { id: ids('openingTypes') as OpeningTypeId, family: f.id, width, height };
  });
  return {
    openingFamilies: Object.fromEntries(families.map((f) => [f.id, f])),
    openingTypes: Object.fromEntries(types.map((t) => [t.id, t])),
  };
}

/** An Opening with the kind and sizes of its type, as geometry and quantities need it. */
export interface ResolvedOpening extends Opening {
  readonly kind: OpeningKind;
  /** Its family's design (ticket 19) */
  readonly design: OpeningDesign;
  /** mm, from the Opening type */
  readonly width: number;
  /** mm, from the Opening type */
  readonly height: number;
}

/**
 * Resolved Openings are cached per Opening, type and family object, so an unchanged Opening
 * resolves to the same object and derived values that compare lists by identity stay cached.
 */
const cache = new WeakMap<
  Opening,
  { type: OpeningType; family: OpeningFamily; resolved: ResolvedOpening }
>();

/** The Opening with its type's kind and sizes; null when its type or family is missing. */
export function resolveOpening(model: Model, opening: Opening): ResolvedOpening | null {
  const type = model.openingTypes[opening.type];
  const family = type && model.openingFamilies[type.family];
  if (!type || !family) return null;
  const hit = cache.get(opening);
  if (hit && hit.type === type && hit.family === family) return hit.resolved;
  const resolved: ResolvedOpening = {
    ...opening,
    kind: family.kind,
    design: designOf(family),
    width: type.width,
    height: type.height,
  };
  cache.set(opening, { type, family, resolved });
  return resolved;
}

/** mm: how wide an Opening is (its type's width), 0 when its type is missing. */
export const openingWidth = (model: Model, o: Opening): number =>
  model.openingTypes[o.type]?.width ?? 0;

/** All Openings resolved, skipping any with a missing type (the invariants refuse those). */
export const resolveOpenings = (model: Model, openings: readonly Opening[]): ResolvedOpening[] =>
  openings.flatMap((o) => resolveOpening(model, o) ?? []);

/**
 * The unnamed type of a family with exactly these sizes: the existing one (placing and migrating
 * never make two unnamed types of one size in a family), or a new one. Named types are the
 * user's own and are never picked by size.
 */
export function typeWithSize(
  model: Model,
  family: OpeningFamilyId,
  width: number,
  height: number,
  ids: IdGenerator,
): { readonly model: Model; readonly type: OpeningTypeId } {
  const same = Object.values(model.openingTypes).find(
    (t) => t.family === family && !t.name && t.width === width && t.height === height,
  );
  if (same) return { model, type: same.id };
  const type: OpeningType = { id: ids('openingTypes') as OpeningTypeId, family, width, height };
  return { model: put(model, 'openingTypes', type), type: type.id };
}

/**
 * The type an Opening of type `from` moves to when it gets its own sizes ("only this one",
 * ticket 18): a named type gets a new type named after it, "Front door (2)", with the first free
 * number; an unnamed one moves to the unnamed type of that size.
 */
export function detachedType(
  model: Model,
  from: OpeningType,
  width: number,
  height: number,
  ids: IdGenerator,
): { readonly model: Model; readonly type: OpeningTypeId } {
  if (!from.name) return typeWithSize(model, from.family, width, height, ids);
  const base = from.name.replace(/ \(\d+\)$/, '');
  const used = new Set(
    Object.values(model.openingTypes)
      .filter((t) => t.family === from.family)
      .map((t) => t.name),
  );
  let n = 2;
  while (used.has(`${base} (${n})`)) n++;
  const type: OpeningType = {
    id: ids('openingTypes') as OpeningTypeId,
    family: from.family,
    name: `${base} (${n})`,
    width,
    height,
  };
  return { model: put(model, 'openingTypes', type), type: type.id };
}

/** A family's types, smallest first (width, then height). */
export const familyTypes = (model: Model, family: OpeningFamilyId | undefined): OpeningType[] =>
  Object.values(model.openingTypes)
    .filter((t) => t.family === family)
    .sort((a, b) => a.width - b.width || a.height - b.height || (a.id < b.id ? -1 : 1));
