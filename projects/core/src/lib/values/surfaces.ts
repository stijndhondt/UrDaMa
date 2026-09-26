/**
 * The surfaces around a Room (Slice 1 spec, "Calculations"): the wall perimeter and its area at
 * the Room height, the Openings cut out of it, and the reveals (shown separately, never added).
 * Room separators bound the floor but have no surface. Which Openings are subtracted is decided by
 * a Measurement rule, chosen per report and never stored.
 */
import { distanceToSegment } from '../geometry/polygon';
import { wallFrame, type WallFrame, type WallOutline } from '../geometry/wall-outlines';
import type { Opening, OpeningId, RoomSeparator, Vec, Wall, WallId } from '../model/types';

export type MeasurementRule = 'exact' | 'belgianMasonry';

/** Openings smaller than this (mm²) are not subtracted. */
export const MEASUREMENT_RULES: Readonly<
  Record<MeasurementRule, { readonly minOpeningArea: number }>
> = {
  exact: { minOpeningArea: 0 },
  belgianMasonry: { minOpeningArea: 0.25e6 },
};

/** One Opening in the walls around a Room. */
export interface OpeningCut {
  readonly opening: OpeningId;
  /** mm², the Opening's full size (width × height), compared with the rule's threshold */
  readonly size: number;
  /** mm², the part of it in this Room's wall surface, below the Ceiling */
  readonly cut: number;
}

export interface RoomSurfaces {
  /** mm, the Room's outline along Wall faces (Room separators excluded) */
  readonly wallLength: number;
  /** mm², wallLength × Room height */
  readonly grossWallArea: number;
  readonly openings: readonly OpeningCut[];
  /** mm², sides, head and window sill inside the wall thickness (this Room's share) */
  readonly revealArea: number;
}

/** Net wall area around a Room under a Measurement rule. */
export function netWallArea(s: RoomSurfaces, rule: MeasurementRule): number {
  const min = MEASUREMENT_RULES[rule].minOpeningArea;
  return s.openings.reduce((area, o) => (o.size < min ? area : area - o.cut), s.grossWallArea);
}

export interface SurfaceInput {
  /** The Room's enclosed area: its outline and any islands inside it. */
  readonly rings: readonly (readonly Vec[])[];
  /** mm, absolute: the top of the Room's Floor build-up */
  readonly floor: number;
  /** mm, Room height (floor to Ceiling) */
  readonly height: number;
}

/** mm of [aBottom, aTop] that lies within [bBottom, bTop]. */
export const heightOverlap = (aBottom: number, aTop: number, bBottom: number, bTop: number) =>
  Math.max(0, Math.min(aTop, bTop) - Math.max(aBottom, bBottom));

/** A Wall's frame with its two face offsets across the Baseline. */
interface Frame extends WallFrame {
  readonly wall: Wall;
  readonly lo: number;
  readonly hi: number;
}

const ON = 0.5; // mm: an edge closer than this to a face lies on it
const ON_SEPARATOR = 0.01; // mm: separator strips are 0.002 mm wide

function frameOf(wall: Wall, outline: WallOutline): Frame {
  const f = wallFrame(wall);
  return { ...f, wall, lo: f.across(outline[0]), hi: f.across(outline[3]) };
}

/**
 * Surfaces of every Room on a Level at once: a door's reveals are shared between the Rooms on
 * both sides of it, so each Room's share depends on the others. Sills are measured from
 * `elevation`, the Level's finished floor (at the Floor-build-up Preset).
 */
export function levelRoomSurfaces<K>(
  elevation: number,
  rooms: ReadonlyMap<K, SurfaceInput>,
  walls: readonly Wall[],
  outlines: ReadonlyMap<WallId, WallOutline>,
  separators: readonly RoomSeparator[],
  openings: readonly Opening[],
): Map<K, RoomSurfaces> {
  const frames = new Map<string, Frame>();
  for (const w of walls) {
    const outline = outlines.get(w.id);
    if (outline) frames.set(w.id, frameOf(w, outline));
  }
  // Per Room: its wall length and, per Opening, the width of it along the Room's edges.
  const found = new Map<K, { wallLength: number; widths: Map<Opening, number> }>();
  const roomsPerOpening = new Map<Opening, number>();
  for (const [key, room] of rooms) {
    let wallLength = 0;
    const widths = new Map<Opening, number>();
    for (const ring of room.rings) {
      ring.forEach((a, i) => {
        const b = ring[(i + 1) % ring.length]!;
        const length = Math.hypot(b.x - a.x, b.y - a.y);
        if (length < 1e-6) return;
        const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
        if (separators.some((s) => distanceToSegment(mid, s.start, s.end) <= ON_SEPARATOR)) return;
        wallLength += length;
        for (const o of openings) {
          const f = frames.get(o.wall);
          if (!f) continue;
          const sa = f.across(a);
          const sb = f.across(b);
          const onFace = (face: number) => Math.abs(sa - face) <= ON && Math.abs(sb - face) <= ON;
          if (!onFace(f.lo) && !onFace(f.hi)) continue;
          const ta = f.along(a);
          const tb = f.along(b);
          const overlap =
            Math.min(Math.max(ta, tb), o.offset + o.width) - Math.max(Math.min(ta, tb), o.offset);
          if (overlap > 1e-6) widths.set(o, (widths.get(o) ?? 0) + overlap);
        }
      });
    }
    for (const o of widths.keys()) roomsPerOpening.set(o, (roomsPerOpening.get(o) ?? 0) + 1);
    found.set(key, { wallLength, widths });
  }

  const result = new Map<K, RoomSurfaces>();
  for (const [key, { wallLength, widths }] of found) {
    const { floor, height } = rooms.get(key)!;
    const ceiling = floor + height;
    let revealArea = 0;
    const cuts: OpeningCut[] = [];
    for (const [o, width] of widths) {
      const bottom = elevation + o.sill;
      const top = bottom + o.height;
      const below = heightOverlap(bottom, top, floor, ceiling);
      cuts.push({ opening: o.id, size: o.width * o.height, cut: width * below });
      const f = frames.get(o.wall)!;
      const depth = Math.abs(f.hi - f.lo) / (roomsPerOpening.get(o) ?? 1);
      const head = top <= ceiling && top > floor ? o.width : 0;
      const sill = o.kind === 'window' && bottom > floor && bottom < ceiling ? o.width : 0;
      revealArea += depth * (2 * below + head + sill);
    }
    cuts.sort((x, y) => (x.opening < y.opening ? -1 : x.opening > y.opening ? 1 : 0));
    result.set(key, { wallLength, grossWallArea: wallLength * height, openings: cuts, revealArea });
  }
  return result;
}
