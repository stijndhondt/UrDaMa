/** The Levels of a model in their stacked order. */
import type { BuildingId, Level, LevelId, Model, WallId } from './types';

/** A Building's Levels (or all Levels), lowest first. */
export function levelsInOrder(model: Model, building?: BuildingId): Level[] {
  return Object.values(model.levels)
    .filter((l) => building === undefined || l.building === building)
    .sort((a, b) => a.order - b.order);
}

/** The Levels just above and below a Level in its Building, if there are any. */
export function neighbourLevels(
  model: Model,
  level: LevelId,
): { readonly above: LevelId | null; readonly below: LevelId | null } {
  const l = model.levels[level];
  if (!l) return { above: null, below: null };
  const stack = levelsInOrder(model, l.building);
  const i = stack.findIndex((x) => x.id === level);
  return { above: stack[i + 1]?.id ?? null, below: stack[i - 1]?.id ?? null };
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
