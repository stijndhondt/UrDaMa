/**
 * Patches: what a command changed, as per-element before/after pairs (ADR 0003, ticket 11 decisions).
 * Forward applies `after`, reverse applies `before`; undo and redo need no command-specific code.
 */
import type { Message } from './message';
import type { CollectionName, Model, Project } from './types';

export const COLLECTIONS: readonly CollectionName[] = [
  'buildings',
  'levels',
  'walls',
  'wallConnections',
  'openingFamilies',
  'openingTypes',
  'openings',
  'rooms',
  'roomSeparators',
  'slabs',
  'ceilings',
  'floorOpenings',
];

export type PatchOp =
  | { readonly collection: 'project'; readonly before: Project; readonly after: Project }
  | {
      readonly collection: CollectionName;
      readonly id: string;
      /** absent = the element was created */
      readonly before?: unknown;
      /** absent = the element was deleted */
      readonly after?: unknown;
    };

export interface Patch {
  readonly label: Message;
  readonly ops: readonly PatchOp[];
}

/** Compares two models element by element (by reference: models are immutable). */
export function diffModels(before: Model, after: Model, label: Message): Patch {
  const ops: PatchOp[] = [];
  if (before.project !== after.project)
    ops.push({ collection: 'project', before: before.project, after: after.project });
  for (const collection of COLLECTIONS) {
    const a = before[collection] as Record<string, unknown>;
    const b = after[collection] as Record<string, unknown>;
    if (a === b) continue;
    for (const id of new Set([...Object.keys(a), ...Object.keys(b)])) {
      if (a[id] !== b[id]) ops.push({ collection, id, before: a[id], after: b[id] });
    }
  }
  return { label, ops };
}

export function applyPatch(
  model: Model,
  patch: Patch,
  direction: 'forward' | 'reverse' = 'forward',
): Model {
  const draft: { -readonly [K in keyof Model]: Model[K] } = { ...model };
  const copied = new Set<CollectionName>();
  for (const op of patch.ops) {
    const value = direction === 'forward' ? op.after : op.before;
    if (op.collection === 'project') {
      draft.project = value as Project;
      continue;
    }
    if (!copied.has(op.collection)) {
      (draft as Record<CollectionName, unknown>)[op.collection] = { ...model[op.collection] };
      copied.add(op.collection);
    }
    const target = draft[op.collection] as Record<string, unknown>;
    if (value === undefined) delete target[op.id];
    else target[op.id] = value;
  }
  return draft;
}
