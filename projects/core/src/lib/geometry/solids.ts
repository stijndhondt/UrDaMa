/**
 * What the 3D view draws (Slice 1 spec, "3D view"), as plain data: vertical prisms in plan
 * coordinates (mm, x right, y down) with a bottom and top height (mm above the base, z up).
 * Turning them into meshes (and cutting the Openings) is the 3D renderer's job; nothing is
 * calculated from it (ADR 0003).
 */
import type { LevelId, Model, RoomId, SlabId, Vec, WallId } from '../model/types';
import type { BuildingValues } from '../values/building-values';

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
  | { readonly kind: 'floor'; readonly id: RoomId; readonly level: LevelId; readonly body: Prism };

export interface BuildingSolids {
  /** Lowest first */
  readonly levels: readonly { readonly id: LevelId; readonly name: string }[];
  readonly solids: readonly Solid[];
}

/** How far (mm) a cut reaches past the Wall faces (and below its foot), for clean holes. */
const CUT_MARGIN = 10;

export function buildingSolids(model: Model, values: BuildingValues): BuildingSolids {
  const heights = values.levelHeights();
  const levels = Object.values(model.levels).sort(
    (a, b) => (heights.get(a.id)?.elevation ?? 0) - (heights.get(b.id)?.elevation ?? 0),
  );
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
      const top = bottom + (wall.height ?? level.storeyHeight);
      const length = Math.hypot(wall.end.x - wall.start.x, wall.end.y - wall.start.y) || 1;
      const d = {
        x: (wall.end.x - wall.start.x) / length,
        y: (wall.end.y - wall.start.y) / length,
      };
      const n = { x: -d.y, y: d.x };
      const across = outline.map((p) => (p.x - wall.start.x) * n.x + (p.y - wall.start.y) * n.y);
      const lo = Math.min(...across) - CUT_MARGIN;
      const hi = Math.max(...across) + CUT_MARGIN;
      const at = (t: number, s: number): Vec => ({
        x: wall.start.x + d.x * t + n.x * s,
        y: wall.start.y + d.y * t + n.y * s,
      });
      const cuts = slice.openings
        .filter((o) => o.wall === wall.id)
        .map((o): Prism => {
          const t0 = o.offset;
          const t1 = o.offset + o.width;
          return {
            rings: [[at(t0, lo), at(t1, lo), at(t1, hi), at(t0, hi)]],
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
      const buildUp = room.floorBuildUp ?? slice.presets.floorBuildUp;
      if (buildUp <= 0) continue;
      solids.push({
        kind: 'floor',
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
