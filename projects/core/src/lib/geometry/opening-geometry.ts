/**
 * A placed Opening's parts in the building (ticket 19): its family's design, its type's sizes and
 * its placement give its shape (model/opening-parts.ts); this maps that shape's own (u, v)
 * coordinates into the plan through its host Wall.
 */
import { DEFAULT_DESIGNS, openingShape, type OpeningShape } from '../model/opening-parts';
import { resolveOpening, type ResolvedOpening } from '../model/opening-types';
import type { Model, OpeningId, Vec, Wall } from '../model/types';
import type { BuildingValues } from '../values/building-values';
import { openingToPlan, type WallOutline } from './wall-outlines';

export interface PlacedOpeningShape {
  readonly shape: OpeningShape;
  /** The plan point of the Opening's (u, v) */
  readonly point: (u: number, v: number) => Vec;
}

/** An Opening's shape in its Wall, from its family's design (each kind's, until ticket 20). */
export function placedOpeningShape(
  wall: Wall,
  outline: WallOutline,
  o: ResolvedOpening,
): PlacedOpeningShape {
  const map = openingToPlan(wall, outline, o.offset);
  return { shape: openingShape(DEFAULT_DESIGNS[o.kind], o, map.depth), point: map.point };
}

/** A placed Opening's shape from the model, or null when its Wall or type is missing. */
export function openingShapeOf(
  model: Model,
  values: BuildingValues,
  id: OpeningId,
): PlacedOpeningShape | null {
  const opening = model.openings[id];
  const wall = opening && model.walls[opening.wall];
  const resolved = opening && resolveOpening(model, opening);
  const outline = wall && values.level(wall.level).outlines().get(wall.id);
  return wall && resolved && outline ? placedOpeningShape(wall, outline, resolved) : null;
}
