/**
 * The exterior of the Quantities tree (ticket 13): the building's Façades, front, back, left side
 * and right side, relative to its front (the plan's bottom edge). Each outside Wall face belongs
 * to the Façade it looks towards; faces in one plane form a Façade part. Every Façade and part
 * has its totals per Level and for the whole height. Values in mm and mm².
 */
import { dot } from '../geometry/vec';
import { levelsInOrder, wallNumbers } from '../model/levels';
import type { LevelId, Model, Vec, WallId } from '../model/types';
import type { BuildingValues } from '../values/building-values';
import {
  faceNetArea,
  openingArea,
  type MeasurementRule,
  type RoomWallFace,
  type WallFaceName,
} from '../values/surfaces';

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

/** mm²: gross, the Openings subtracted under the Measurement rule, and what is left. */
export interface FacadeFigures {
  readonly gross: number;
  readonly openings: number;
  readonly net: number;
}

export interface QuantityFacadeFace extends FacadeFigures {
  readonly level: LevelId;
  readonly wall: WallId;
  /** The Wall's number on its Level, as the Building panel shows it */
  readonly wallNumber: number;
  readonly face: WallFaceName;
  /** mm */
  readonly length: number;
  readonly height: number;
}

export interface QuantityFacadeLevel extends FacadeFigures {
  readonly level: LevelId;
  readonly name: string;
}

export interface QuantityFacadePart extends FacadeFigures {
  /** 1, 2, 3… left to right as seen from outside */
  readonly number: number;
  readonly levels: readonly QuantityFacadeLevel[];
  readonly faces: readonly QuantityFacadeFace[];
}

export interface QuantityFacade extends FacadeFigures {
  readonly side: FacadeSide;
  readonly levels: readonly QuantityFacadeLevel[];
  readonly parts: readonly QuantityFacadePart[];
}

/** An outside Wall face and its Level, as Façades and Elevations need it. */
export interface PlacedFace {
  readonly level: LevelId;
  readonly face: RoomWallFace;
}

const PLANE = 0.5; // mm: faces closer than this to one plane lie in it

/** Every Level's outside Wall faces, lowest Level first. */
export function placedOutsideFaces(model: Model, values: BuildingValues): PlacedFace[] {
  return levelsInOrder(model).flatMap((level) =>
    values
      .level(level.id)
      .outsideFaces()
      .map((face) => ({ level: level.id, face })),
  );
}

const add = (a: FacadeFigures, b: FacadeFigures): FacadeFigures => ({
  gross: a.gross + b.gross,
  openings: a.openings + b.openings,
  net: a.net + b.net,
});
const ZERO: FacadeFigures = { gross: 0, openings: 0, net: 0 };
const total = (xs: readonly FacadeFigures[]) => xs.reduce(add, ZERO);

/** The four Façades (those with faces), front, back, left side, right side. */
export function facadeTree(
  model: Model,
  values: BuildingValues,
  rule: MeasurementRule,
): QuantityFacade[] {
  const levels = levelsInOrder(model);
  const numbers = new Map(levels.map((l) => [l.id, wallNumbers(model, l.id)]));
  const perLevel = (faces: readonly QuantityFacadeFace[]): QuantityFacadeLevel[] =>
    levels.flatMap((l) => {
      const here = faces.filter((f) => f.level === l.id);
      return here.length ? [{ level: l.id, name: l.name, ...total(here) }] : [];
    });

  const placed = placedOutsideFaces(model, values);
  return FACADE_SIDES.flatMap((side): QuantityFacade[] => {
    const { right } = FACADE_VIEW[side];
    const mine = placed.filter((p) => facadeSide(p.face.normal) === side);
    if (!mine.length) return [];
    // Faces in one plane: the same direction and the same distance along it.
    const planes: { normal: Vec; offset: number; faces: PlacedFace[] }[] = [];
    for (const p of mine) {
      const offset = dot(p.face.segments[0]![0], p.face.normal);
      const plane = planes.find(
        (q) => dot(q.normal, p.face.normal) > 1 - 1e-9 && Math.abs(q.offset - offset) <= PLANE,
      );
      if (plane) plane.faces.push(p);
      else planes.push({ normal: p.face.normal, offset, faces: [p] });
    }
    // Left to right as seen from outside.
    const start = (q: (typeof planes)[number]) =>
      Math.min(...q.faces.flatMap((p) => p.face.segments.flat().map((v) => dot(v, right))));
    planes.sort((a, b) => start(a) - start(b));

    const parts = planes.map((plane, i): QuantityFacadePart => {
      const faces = plane.faces.map(({ level, face }): QuantityFacadeFace => {
        const gross = face.gross;
        return {
          level,
          wall: face.wall,
          wallNumber: numbers.get(level)?.get(face.wall) ?? 0,
          face: face.face,
          length: face.length,
          height: face.height,
          gross,
          openings: openingArea(face.openings, rule),
          net: faceNetArea(face, rule),
        };
      });
      return { number: i + 1, ...total(faces), levels: perLevel(faces), faces };
    });
    const faces = parts.flatMap((p) => p.faces);
    return [{ side, ...total(faces), levels: perLevel(faces), parts }];
  });
}
