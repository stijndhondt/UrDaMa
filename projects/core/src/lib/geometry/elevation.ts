/**
 * What an Elevation draws (ticket 14; Slice 2 spec, "Elevations"), as plain data: the building
 * seen straight on from one side, all Levels stacked. In the Elevation's own coordinates: `u` mm
 * to the viewer's right, `z` mm up (absolute heights). Shapes come back to front, each referring
 * to its element so a click can select it. Hidden Levels are left out by the view.
 */
import { levelsInOrder } from '../model/levels';
import type { LevelId, Model, OpeningId, OpeningKind, SlabId, WallId } from '../model/types';
import { FACADE_VIEW, placedOutsideFaces, type FacadeSide } from './outside';
import type { BuildingValues } from '../values/building-values';
import type { WallFaceName } from '../values/surfaces';
import { dot } from './vec';
import { wallFrame } from './wall-outlines';

/** mm: a rectangle in the Elevation, u to the right, z up. */
export interface ElevationRect {
  readonly u0: number;
  readonly u1: number;
  readonly z0: number;
  readonly z1: number;
}

interface ShapeBase {
  readonly level: LevelId;
  readonly rect: ElevationRect;
  /** mm towards the viewer: nearer shapes cover farther ones */
  readonly depth: number;
}

export type ElevationShape =
  | (ShapeBase & {
      readonly kind: 'wallFace';
      readonly wall: WallId;
      readonly face: WallFaceName;
    })
  | (ShapeBase & {
      readonly kind: 'opening';
      readonly opening: OpeningId;
      readonly wall: WallId;
      readonly openingKind: OpeningKind;
    })
  | (ShapeBase & { readonly kind: 'slabEdge'; readonly slab: SlabId | null });

export interface ElevationLevel {
  readonly level: LevelId;
  readonly name: string;
  /** mm: finished floor */
  readonly elevation: number;
  /** mm, finished floor to the next one, as typed */
  readonly storeyHeight: number;
  /** mm: the bottom and top of its Slab (where its outside faces start) */
  readonly slabBottom: number;
  readonly slabTop: number;
  /** mm: the top of its outside faces (where a next Slab would start) */
  readonly top: number;
}

export interface Elevation {
  readonly side: FacadeSide;
  /** Back to front; an Opening right after the Wall face it is in */
  readonly shapes: readonly ElevationShape[];
  /** Lowest first */
  readonly levels: readonly ElevationLevel[];
  /** Around every shape; all 0 when there is nothing to draw */
  readonly bounds: ElevationRect;
}

const SEEN = 1e-6; // a face seen exactly edge-on shows nothing

export function elevation(model: Model, values: BuildingValues, side: FacadeSide): Elevation {
  const { normal, right } = FACADE_VIEW[side];
  const heights = values.levelHeights();
  const shapes: ElevationShape[] = [];

  for (const { level, face } of placedOutsideFaces(model, values)) {
    if (dot(face.normal, normal) <= SEEN) continue;
    const h = heights.get(level);
    const wall = model.walls[face.wall];
    if (!h || !wall) continue;
    const z0 = h.slabTop;
    const z1 = h.slabTop + face.height;
    const frame = wallFrame(wall);
    const openings =
      face.face === 'end'
        ? []
        : values
            .level(level)
            .slice()
            .openings.filter((o) => o.wall === wall.id);
    const slab = Object.values(model.slabs).find((s) => s.level === level);
    for (const [a, b] of face.segments) {
      const ua = dot(a, right);
      const ub = dot(b, right);
      const span = { u0: Math.min(ua, ub), u1: Math.max(ua, ub) };
      if (span.u1 - span.u0 <= SEEN) continue;
      const depth = (dot(a, normal) + dot(b, normal)) / 2;
      shapes.push({
        kind: 'wallFace',
        wall: wall.id,
        face: face.face,
        level,
        rect: { ...span, z0, z1 },
        depth,
      });
      shapes.push({
        kind: 'slabEdge',
        slab: slab?.id ?? null,
        level,
        rect: { ...span, z0: h.slabTop - h.slabThickness, z1: h.slabTop },
        depth,
      });
      // Openings in this stretch of the face, at their sill height and height.
      const across = frame.across(a);
      for (const o of openings) {
        const p = dot(frame.point(o.offset, across), right);
        const q = dot(frame.point(o.offset + o.width, across), right);
        const u0 = Math.max(Math.min(p, q), span.u0);
        const u1 = Math.min(Math.max(p, q), span.u1);
        if (u1 - u0 <= SEEN) continue;
        const bottom = h.elevation + o.sill;
        shapes.push({
          kind: 'opening',
          opening: o.id,
          wall: wall.id,
          openingKind: o.kind,
          level,
          rect: { u0, u1, z0: Math.max(bottom, z0), z1: Math.min(bottom + o.height, z1) },
          depth,
        });
      }
    }
  }

  // Back to front; at one depth the faces first, then their Slab edges and Openings.
  const layer = { wallFace: 0, slabEdge: 1, opening: 2 } as const;
  const order = shapes
    .map((s, i) => ({ s, i }))
    .sort((x, y) => x.s.depth - y.s.depth || layer[x.s.kind] - layer[y.s.kind] || x.i - y.i)
    .map(({ s }) => s);

  const levels = levelsInOrder(model).flatMap((l): ElevationLevel[] => {
    const h = heights.get(l.id);
    return h
      ? [
          {
            level: l.id,
            name: l.name,
            elevation: h.elevation,
            storeyHeight: h.storeyHeight,
            slabBottom: h.slabTop - h.slabThickness,
            slabTop: h.slabTop,
            top: h.slabTop + h.storeyHeight,
          },
        ]
      : [];
  });

  const bounds = order.length
    ? {
        u0: Math.min(...order.map((s) => s.rect.u0)),
        u1: Math.max(...order.map((s) => s.rect.u1)),
        z0: Math.min(...order.map((s) => s.rect.z0)),
        z1: Math.max(...order.map((s) => s.rect.z1)),
      }
    : { u0: 0, u1: 0, z0: 0, z1: 0 };
  return { side, shapes: order, levels, bounds };
}

/**
 * A height to dimension in an Elevation (ticket 15), z0 below z1 in mm: a Level's height (its
 * finished floor up its storey height), the total height (the ground line under the lowest Slab to
 * the top of the highest Walls), or an Opening's sill above its finished floor and its own height,
 * standing beside its right edge (`u`).
 */
export type HeightDimension =
  | {
      readonly kind: 'level';
      readonly level: LevelId;
      readonly name: string;
      readonly z0: number;
      readonly z1: number;
    }
  | { readonly kind: 'total'; readonly z0: number; readonly z1: number }
  | {
      readonly kind: 'sill' | 'openingHeight';
      readonly level: LevelId;
      readonly opening: OpeningId;
      readonly u: number;
      readonly z0: number;
      readonly z1: number;
    };

const SAME = 0.5; // mm: closer than this counts as equal

/** Whether a nearer Wall face covers this rectangle entirely. */
const covered = (r: ElevationRect, depth: number, faces: readonly ElevationShape[]) =>
  faces.some(
    (f) =>
      f.depth > depth + SAME &&
      f.rect.u0 <= r.u0 + SAME &&
      f.rect.u1 >= r.u1 - SAME &&
      f.rect.z0 <= r.z0 + SAME &&
      f.rect.z1 >= r.z1 - SAME,
  );

/**
 * The heights to show in an Elevation. Hidden Levels are left out; the others keep their own
 * heights. An Opening split over faces gets one set, over its whole width; one hidden behind a
 * nearer face gets none.
 */
export function elevationHeights(e: Elevation, hidden: ReadonlySet<LevelId>): HeightDimension[] {
  const shapes = e.shapes.filter((s) => !hidden.has(s.level));
  const shown = new Set(shapes.map((s) => s.level));
  const levels = e.levels.filter((l) => shown.has(l.level));
  const out: HeightDimension[] = levels.map((l) => ({
    kind: 'level',
    level: l.level,
    name: l.name,
    z0: l.elevation,
    z1: l.elevation + l.storeyHeight,
  }));
  const lowest = levels[0];
  const highest = levels[levels.length - 1];
  if (lowest && highest) out.push({ kind: 'total', z0: lowest.slabBottom, z1: highest.top });

  const floors = new Map(levels.map((l) => [l.level, l.elevation]));
  const faces = shapes.filter((s) => s.kind === 'wallFace');
  const pieces = new Map<OpeningId, Extract<ElevationShape, { kind: 'opening' }>[]>();
  for (const s of shapes) {
    if (s.kind !== 'opening' || covered(s.rect, s.depth, faces)) continue;
    pieces.set(s.opening, [...(pieces.get(s.opening) ?? []), s]);
  }
  for (const [opening, parts] of pieces) {
    const level = parts[0]!.level;
    const floor = floors.get(level)!;
    const u = Math.max(...parts.map((p) => p.rect.u1));
    const z0 = Math.min(...parts.map((p) => p.rect.z0));
    const z1 = Math.max(...parts.map((p) => p.rect.z1));
    const at = { level, opening, u };
    if (z0 - floor > SAME) out.push({ kind: 'sill', z0: floor, z1: z0, ...at });
    out.push({ kind: 'openingHeight', z0, z1, ...at });
  }
  return out;
}
