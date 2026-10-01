/**
 * The building seen from outside (tickets 13, 14): its four sides relative to its front (the
 * plan's bottom edge), which side a face looks towards, and every Level's outside Wall faces.
 * Façades count them; Elevations draw them.
 */
import { levelsInOrder } from '../model/levels';
import type { LevelId, Model, Vec } from '../model/types';
import type { BuildingValues } from '../values/building-values';
import type { RoomWallFace } from '../values/surfaces';

export type FacadeSide = 'front' | 'back' | 'left' | 'right';
export const FACADE_SIDES: readonly FacadeSide[] = ['front', 'back', 'left', 'right'];

/** Plan directions (the plan's y runs down): which way each Façade looks, and its viewer's right. */
export const FACADE_VIEW: Readonly<
  Record<FacadeSide, { readonly normal: Vec; readonly right: Vec }>
> = {
  front: { normal: { x: 0, y: 1 }, right: { x: 1, y: 0 } },
  back: { normal: { x: 0, y: -1 }, right: { x: -1, y: 0 } },
  left: { normal: { x: -1, y: 0 }, right: { x: 0, y: 1 } },
  right: { normal: { x: 1, y: 0 }, right: { x: 0, y: -1 } },
};

/** The Façade a face looking this way belongs to (a 45° face counts as front or back). */
export function facadeSide(normal: Vec): FacadeSide {
  if (Math.abs(normal.y) >= Math.abs(normal.x) - 1e-9) return normal.y > 0 ? 'front' : 'back';
  return normal.x > 0 ? 'right' : 'left';
}

/** An outside Wall face and its Level, as Façades and Elevations need it. */
export interface PlacedFace {
  readonly level: LevelId;
  readonly face: RoomWallFace;
}

/** Every Level's outside Wall faces, lowest Level first. */
export function placedOutsideFaces(model: Model, values: BuildingValues): PlacedFace[] {
  return levelsInOrder(model).flatMap((level) =>
    values
      .level(level.id)
      .outsideFaces()
      .map((face) => ({ level: level.id, face })),
  );
}
