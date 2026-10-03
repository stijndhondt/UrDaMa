/**
 * What the 3D view draws (Slice 1 spec, "3D view"), as plain data: vertical prisms in plan
 * coordinates (mm, x right, y down) with a bottom and top height (mm above the base, z up).
 * Turning them into meshes (and cutting the Openings) is the 3D renderer's job; nothing is
 * calculated from it (ADR 0003).
 */
import type { OpeningPartKind } from '../model/opening-parts';
import type { LevelId, Model, OpeningId, RoomId, SlabId, Vec, WallId } from '../model/types';
import { levelsInOrder } from '../model/levels';
import type { BuildingValues } from '../values/building-values';
import { partRing } from './opening-geometry';
import { openingRect } from './wall-outlines';

/** A vertical prism: plan rings (the first is the outline, the rest are holes), bottom to top. */
export interface Prism {
  readonly rings: readonly (readonly Vec[])[];
  /** mm */
  readonly bottom: number;
  /** mm */
  readonly top: number;
}

export type Solid =
  | {
      readonly kind: 'wall';
      readonly id: WallId;
      readonly level: LevelId;
      readonly body: Prism;
      /** Openings: boxes to subtract, through the full Wall thickness. */
      readonly cuts: readonly Prism[];
    }
  | { readonly kind: 'slab'; readonly id: SlabId; readonly level: LevelId; readonly body: Prism }
  | {
      readonly kind: 'floorBuildUp';
      readonly id: RoomId;
      readonly level: LevelId;
      readonly body: Prism;
    }
  | {
      /** One part of an Opening (ticket 19): its frame, a leaf, a pane of glass, a section */
      readonly kind: 'openingPart';
      readonly id: OpeningId;
      readonly level: LevelId;
      readonly part: OpeningPartKind;
      readonly body: Prism;
    };

/** Which element a solid (or its mesh) is: its kind, with the matching ID type, and its Level. */
export type SolidRef = Pick<Solid, 'kind' | 'id' | 'level'> &
  (
    | { readonly kind: 'wall'; readonly id: WallId }
    | { readonly kind: 'slab'; readonly id: SlabId }
    | { readonly kind: 'floorBuildUp'; readonly id: RoomId }
    | { readonly kind: 'openingPart'; readonly id: OpeningId; readonly part: OpeningPartKind }
  );

export function solidRef(s: Solid): SolidRef {
  switch (s.kind) {
    case 'wall':
      return { kind: s.kind, id: s.id, level: s.level };
    case 'slab':
      return { kind: s.kind, id: s.id, level: s.level };
    case 'floorBuildUp':
      return { kind: s.kind, id: s.id, level: s.level };
    case 'openingPart':
      return { kind: s.kind, id: s.id, level: s.level, part: s.part };
  }
}

export interface BuildingSolids {
  /** Lowest first */
  readonly levels: readonly { readonly id: LevelId; readonly name: string }[];
  readonly solids: readonly Solid[];
}

/** How far (mm) a cut reaches past the Wall faces (and below its foot), for clean holes. */
const CUT_MARGIN = 10;

export function buildingSolids(model: Model, values: BuildingValues): BuildingSolids {
  const heights = values.levelHeights();
  const levels = levelsInOrder(model);
  const solids: Solid[] = [];
  for (const level of levels) {
    const h = heights.get(level.id);
    if (!h) continue;
    const lv = values.level(level.id);
    const slice = lv.slice();
    const outlines = lv.outlines();

    for (const wall of slice.walls) {
      const outline = outlines.get(wall.id);
      if (!outline) continue;
      const bottom = h.slabTop;
      const top = bottom + values.wall(wall.id).height();
      const cuts = slice.openings
        .filter((o) => o.wall === wall.id)
        .map((o): Prism => {
          return {
            rings: [openingRect(wall, outline, o, CUT_MARGIN)],
            bottom: o.sill > 0 ? h.elevation + o.sill : bottom - CUT_MARGIN,
            top: h.elevation + o.sill + o.height,
          };
        });
      solids.push({
        kind: 'wall',
        id: wall.id,
        level: level.id,
        body: { rings: [outline], bottom, top },
        cuts,
      });
      // The Openings' parts: frames, leaves, glass, panels, from their family's design, cut off
      // at the top of the Wall as the Elevation clips them.
      for (const o of slice.openings) {
        if (o.wall !== wall.id) continue;
        const placed = values.opening(o.id).shape();
        if (!placed) continue;
        const base = h.elevation + o.sill;
        for (const part of placed.shape.parts) {
          const partTop = Math.min(base + part.z1, top);
          if (partTop - (base + part.z0) <= 0) continue;
          solids.push({
            kind: 'openingPart',
            id: o.id,
            level: level.id,
            part: part.kind,
            body: {
              rings: [partRing(placed.point, part)],
              bottom: base + part.z0,
              top: partTop,
            },
          });
        }
      }
    }

    const slab = Object.values(model.slabs).find((s) => s.level === level.id);
    const outer = lv.footprint().outer;
    if (slab && outer.length) {
      for (const ring of outer) {
        solids.push({
          kind: 'slab',
          id: slab.id,
          level: level.id,
          body: { rings: [ring], bottom: h.slabTop - h.slabThickness, top: h.slabTop },
        });
      }
    }

    for (const room of slice.rooms) {
      const d = values.room(room.id).detection();
      if (!d || d.status === 'notEnclosed') continue;
      const buildUp = values.room(room.id).floorBuildUp();
      if (buildUp <= 0) continue;
      solids.push({
        kind: 'floorBuildUp',
        id: room.id,
        level: level.id,
        body: {
          rings: [d.area.outline, ...d.area.islands],
          bottom: h.slabTop,
          top: h.slabTop + buildUp,
        },
      });
    }
  }
  return { levels: levels.map((l) => ({ id: l.id, name: l.name })), solids };
}
