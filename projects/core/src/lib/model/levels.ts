/** The Levels of a model in their stacked order. */
import type { BuildingId, Level, Model } from './types';

/** A Building's Levels (or all Levels), lowest first. */
export function levelsInOrder(model: Model, building?: BuildingId): Level[] {
  return Object.values(model.levels)
    .filter((l) => building === undefined || l.building === building)
    .sort((a, b) => a.order - b.order);
}
