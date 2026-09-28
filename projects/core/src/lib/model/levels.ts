/** The Levels of a model in their stacked order. */
import type { BuildingId, Level, LevelId, Model, WallId } from './types';

/** A Building's Levels (or all Levels), lowest first. */
export function levelsInOrder(model: Model, building?: BuildingId): Level[] {
  return Object.values(model.levels)
    .filter((l) => building === undefined || l.building === building)
    .sort((a, b) => a.order - b.order);
}

/**
 * The Walls of a Level numbered 1, 2, 3… in ID order: the "Wall 3" the Building panel and the
 * Quantities tree both show.
 */
export function wallNumbers(model: Model, level: LevelId): ReadonlyMap<WallId, number> {
  return new Map(
    Object.values(model.walls)
      .filter((w) => w.level === level)
      .sort((a, b) => (a.id < b.id ? -1 : 1))
      .map((w, i) => [w.id, i + 1]),
  );
}
