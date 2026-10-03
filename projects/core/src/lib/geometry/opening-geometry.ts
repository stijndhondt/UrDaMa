/**
 * A placed Opening's parts in the building (ticket 19): its family's design, its type's sizes and
 * its placement give its shape (model/opening-parts.ts); this maps that shape's own (u, v)
 * coordinates into the plan through its host Wall.
 */
import { openingShape, type OpeningPart, type OpeningShape } from '../model/opening-parts';
import { resolveOpening, type ResolvedOpening } from '../model/opening-types';
import type { Model, OpeningId, Vec, Wall } from '../model/types';
import { openingToPlan, type WallOutline } from './wall-outlines';

export interface PlacedOpeningShape {
  readonly shape: OpeningShape;
  /** The plan point of the Opening's (u, v) */
  readonly point: (u: number, v: number) => Vec;
}

/** An Opening's shape in its Wall, from its family's design. */
export function placedOpeningShape(
  wall: Wall,
  outline: WallOutline,
  o: ResolvedOpening,
): PlacedOpeningShape {
  const map = openingToPlan(wall, outline, o.offset);
  return { shape: openingShape(o.design, o, map.depth), point: map.point };
}

/** A placed Opening's shape from the model, or null when its Wall or type is missing. */
export function openingShapeOf(
  model: Model,
  outlines: (wall: Wall) => WallOutline | undefined,
  id: OpeningId,
): PlacedOpeningShape | null {
  const opening = model.openings[id];
  const wall = opening && model.walls[opening.wall];
  const resolved = opening && resolveOpening(model, opening);
  const outline = wall && outlines(wall);
  return wall && resolved && outline ? placedOpeningShape(wall, outline, resolved) : null;
}

/** A part's footprint in the plan: the ring of its four corners. */
export const partRing = (
  point: PlacedOpeningShape['point'],
  part: Pick<OpeningPart, 'u0' | 'u1' | 'v0' | 'v1'>,
): Vec[] => [
  point(part.u0, part.v0),
  point(part.u1, part.v0),
  point(part.u1, part.v1),
  point(part.u0, part.v1),
];
