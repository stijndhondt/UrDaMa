/**
 * The project file `.urdama.json` (ADR 0004): Source data only, as flat collections sorted by
 * ID, keys in a fixed order, lengths rounded to 0.001 mm, nothing written for values that follow a
 * Preset, 2-space indentation and a trailing newline. Saving the same model twice gives
 * byte-identical files. Older files are migrated on open; newer ones are refused. Files saved
 * before the app was called Urdama (`.lakudemis.json`, format "lakudemis") still open.
 */
import { checkInvariants } from '../model/invariants';
import { message, type Message } from '../model/message';
import { COLLECTIONS } from '../model/patch';
import type { CollectionName, Model } from '../model/types';

export const FILE_FORMAT = 'urdama';
export const CURRENT_SCHEMA_VERSION = 3;
export const FILE_EXTENSION = '.urdama.json';
/** The app's earlier name: its files are read, never written. */
export const LEGACY_FILE_FORMATS: readonly string[] = ['lakudemis'];
export const LEGACY_FILE_EXTENSIONS: readonly string[] = ['.lakudemis.json'];

type Doc = Record<string, unknown>;

/**
 * Migration steps: MIGRATIONS[n] upgrades a version-n document to version n+1.
 * Each is a pure function, tested with a fixture file of version n.
 */
export const MIGRATIONS: Readonly<Record<number, (doc: Doc) => Doc>> = {
  1: openingTypesFromSizes,
  2: wallOpeningAndGarageDoorFamilies,
};

/**
 * Version 2 → 3 (ticket 17): the built-in wall opening and garage door families, each with its
 * default type, as every new project has them. Values written out, as in step 1.
 */
function wallOpeningAndGarageDoorFamilies(doc: Doc): Doc {
  const added = [
    { family: 'ofm_wall_opening', kind: 'wallOpening', width: 900, height: 2110 },
    { family: 'ofm_garage_door', kind: 'garageDoor', width: 2400, height: 2125 },
  ];
  return {
    ...doc,
    schemaVersion: 3,
    openingFamilies: [
      ...((doc['openingFamilies'] ?? []) as Doc[]),
      ...added.map((a) => ({ id: a.family, kind: a.kind })),
    ],
    openingTypes: [
      ...((doc['openingTypes'] ?? []) as Doc[]),
      ...added.map((a) => ({
        id: `oty_${a.kind}_${a.width}x${a.height}`,
        family: a.family,
        width: a.width,
        height: a.height,
      })),
    ],
  };
}

/**
 * Version 1 → 2 (ticket 16, ADR 0007): doors and windows become Openings of the built-in door and
 * window families. Every size in use, and each family's Preset size, becomes an Opening type; an
 * Opening keeps its Wall, position, sill, hinge and swing and refers to the type of its size.
 * Types made here get IDs from their kind and size (a migration has no ID generator). The values
 * are written out here, not taken from the live code, so this step keeps giving the same result.
 */
function openingTypesFromSizes(doc: Doc): Doc {
  const families = { door: 'ofm_door', window: 'ofm_window' } as const;
  const presets = ((doc['project'] as Doc | undefined)?.['presets'] ?? {}) as Record<
    string,
    number
  >;
  const types = new Map<string, Doc>();
  const typeFor = (kind: string, width: number, height: number): string => {
    const id = `oty_${kind}_${width}x${height}`.replace(/\./g, '-');
    if (!types.has(id))
      types.set(id, { id, family: families[kind as keyof typeof families], width, height });
    return id;
  };
  typeFor('door', presets['doorWidth'] ?? 930, presets['doorHeight'] ?? 2115);
  typeFor('window', presets['windowWidth'] ?? 1200, presets['windowHeight'] ?? 1200);
  const openings = ((doc['openings'] ?? []) as Doc[]).map((o) => {
    const { kind, width, height, ...rest } = o as Doc & {
      kind: string;
      width: number;
      height: number;
    };
    return { ...rest, type: typeFor(kind, width, height) };
  });
  return {
    ...doc,
    schemaVersion: 2,
    openingFamilies: (['door', 'window'] as const).map((kind) => ({ id: families[kind], kind })),
    openingTypes: [...types.values()],
    openings,
  };
}

/** The fixed key order of every element kind; keys not listed never appear in a file. */
const KEY_ORDER: Readonly<
  Record<
    CollectionName | 'project' | 'presets' | 'vec' | 'design' | 'frame' | 'infill',
    readonly string[]
  >
> = {
  project: ['id', 'name', 'presets'],
  presets: [
    'wallThickness',
    'slabThickness',
    'floorBuildUp',
    'roomHeight',
    'ceilingThickness',
    'doorWidth',
    'doorHeight',
    'windowWidth',
    'windowHeight',
    'windowSill',
  ],
  vec: ['x', 'y'],
  buildings: ['id', 'name', 'baseElevation'],
  levels: ['id', 'building', 'name', 'order', 'storeyHeight'],
  walls: ['id', 'level', 'start', 'end', 'side', 'thickness', 'height', 'roomBounding'],
  wallConnections: ['id', 'wall', 'end', 'kind', 'to', 'toEnd', 'at'],
  openingFamilies: ['id', 'kind', 'name', 'design'],
  design: ['frame', 'bottomRail', 'infill'],
  frame: ['width', 'depth'],
  infill: ['kind', 'count', 'panes', 'thickness', 'operation', 'glazed', 'style'],
  openingTypes: ['id', 'family', 'name', 'width', 'height'],
  openings: ['id', 'wall', 'type', 'offset', 'sill', 'hinge', 'swing'],
  rooms: ['id', 'level', 'name', 'seed', 'height', 'floorBuildUp', 'floorFinish'],
  roomSeparators: ['id', 'level', 'start', 'end', 'startWall', 'endWall'],
  slabs: ['id', 'level', 'thickness'],
  ceilings: ['id', 'room', 'thickness'],
};

/** Which nested objects use which key order. */
const NESTED: Readonly<Record<string, keyof typeof KEY_ORDER>> = {
  presets: 'presets',
  start: 'vec',
  end: 'vec',
  seed: 'vec',
  design: 'design',
  frame: 'frame',
  infill: 'infill',
};

const round = (n: number) => {
  const r = Math.round(n * 1000) / 1000;
  return Object.is(r, -0) ? 0 : r;
};

function ordered(value: unknown, keys: readonly string[]): Doc {
  const source = value as Doc;
  const out: Doc = {};
  for (const key of keys) {
    const v = source[key];
    if (v === undefined || v === null) continue;
    out[key] = clean(v, NESTED[key]);
  }
  return out;
}

function clean(value: unknown, kind?: keyof typeof KEY_ORDER): unknown {
  if (typeof value === 'number') return round(value);
  if (kind && value && typeof value === 'object') return ordered(value, KEY_ORDER[kind]);
  return value;
}

export function serializeProject(model: Model): string {
  const doc: Doc = {
    format: FILE_FORMAT,
    schemaVersion: CURRENT_SCHEMA_VERSION,
    units: { length: 'mm' },
    project: ordered(model.project, KEY_ORDER.project),
  };
  for (const collection of COLLECTIONS) {
    doc[collection] = Object.values(model[collection] as Record<string, { id: string }>)
      .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
      .map((element) => ordered(element, KEY_ORDER[collection]));
  }
  return `${JSON.stringify(doc, null, 2)}\n`;
}

export type ParseResult =
  { readonly ok: true; readonly model: Model } | { readonly ok: false; readonly reason: Message };

export function parseProject(text: string): ParseResult {
  let doc: Doc;
  try {
    doc = JSON.parse(text) as Doc;
  } catch {
    return { ok: false, reason: message('file.notJson') };
  }
  if (
    !doc ||
    typeof doc !== 'object' ||
    (doc['format'] !== FILE_FORMAT && !LEGACY_FILE_FORMATS.includes(doc['format'] as string)) ||
    typeof doc['schemaVersion'] !== 'number'
  ) {
    return { ok: false, reason: message('file.notAProject') };
  }
  let version = doc['schemaVersion'] as number;
  if (version > CURRENT_SCHEMA_VERSION) {
    return {
      ok: false,
      reason: message('file.newerVersion', { version, supported: CURRENT_SCHEMA_VERSION }),
    };
  }
  while (version < CURRENT_SCHEMA_VERSION) {
    const step = MIGRATIONS[version];
    if (!step) return { ok: false, reason: message('file.cannotMigrate', { version }) };
    doc = step(doc);
    version++;
  }

  const project = doc['project'] as Model['project'] | undefined;
  if (!project || typeof project !== 'object' || !project.presets) {
    return { ok: false, reason: message('file.notAProject') };
  }
  const model: Record<string, unknown> = {
    project: { ...project, presets: { ...project.presets } },
  };
  for (const collection of COLLECTIONS) {
    const list = doc[collection];
    if (!Array.isArray(list)) return { ok: false, reason: message('file.notAProject') };
    model[collection] = Object.fromEntries(
      list.map((element: { id: string }) => [element.id, element]),
    );
  }
  const broken = checkInvariants(model as unknown as Model);
  if (broken) return { ok: false, reason: message('file.broken', { detail: broken.key }) };
  return { ok: true, model: model as unknown as Model };
}
