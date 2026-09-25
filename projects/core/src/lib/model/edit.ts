/** Small helpers for commands: immutable updates of a model's collections. */
import type { CollectionName, Model } from './types';

type Element<C extends CollectionName> = Model[C][string];

export function put<C extends CollectionName>(
  model: Model,
  collection: C,
  element: Element<C> & { id: string },
): Model {
  return { ...model, [collection]: { ...model[collection], [element.id]: element } };
}

export function putAll<C extends CollectionName>(
  model: Model,
  collection: C,
  elements: readonly (Element<C> & { id: string })[],
): Model {
  if (!elements.length) return model;
  const next = { ...model[collection] } as Record<string, unknown>;
  for (const e of elements) next[e.id] = e;
  return { ...model, [collection]: next };
}

export function remove(model: Model, collection: CollectionName, ids: readonly string[]): Model {
  if (!ids.length) return model;
  const next = { ...model[collection] } as Record<string, unknown>;
  for (const id of ids) delete next[id];
  return { ...model, [collection]: next };
}
