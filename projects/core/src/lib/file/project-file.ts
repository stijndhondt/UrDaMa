/**
 * The project file `.lakudemis.json` (ADR 0004): Source data only, as flat collections sorted by
 * ID, keys in a fixed order, lengths rounded to 0.001 mm, nothing written for values that follow a
 * Preset, 2-space indentation and a trailing newline. Saving the same model twice gives
 * byte-identical files. Older files are migrated on open; newer ones are refused.
 */
import { checkInvariants } from '../model/invariants';
import { message, type Message } from '../model/message';
import { COLLECTIONS } from '../model/patch';
import type { CollectionName, Model } from '../model/types';

export const FILE_FORMAT = 'lakudemis';
export const CURRENT_SCHEMA_VERSION = 1;
export const FILE_EXTENSION = '.lakudemis.json';

type Doc = Record<string, unknown>;

/**
 * Migration steps: MIGRATIONS[n] upgrades a version-n document to version n+1.
 * Each is a pure function, tested with a fixture file of version n.
 */
export const MIGRATIONS: Readonly<Record<number, (doc: Doc) => Doc>> = {};

/** The fixed key order of every element kind; keys not listed never appear in a file. */
const KEY_ORDER: Readonly<
  Record<CollectionName | 'project' | 'presets' | 'vec', readonly string[]>
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
  openings: ['id', 'wall', 'kind', 'offset', 'width', 'height', 'sill', 'hinge', 'swing'],
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
    doc['format'] !== FILE_FORMAT ||
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
