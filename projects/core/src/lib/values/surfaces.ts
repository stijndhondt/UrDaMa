/**
 * The surfaces around a Room (Slice 1 spec, "Calculations"): the wall perimeter and its area at
 * the Room height, the Openings cut out of it, and the reveals (shown separately, never added).
 * Room separators bound the floor but have no surface. Which Openings are subtracted is decided by
 * a Measurement rule, chosen per report and never stored.
 */
import type { ResolvedOpening } from '../model/opening-types';
import { distanceToSegment } from '../geometry/polygon';
import { wallFrame, type WallFrame, type WallOutline } from '../geometry/wall-outlines';
import type { OpeningId, RoomSeparator, Vec, Wall, WallId } from '../model/types';

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

/**
 * The part of one Wall face that bounds a Room (ticket 12): a Wall shared by two Rooms, or broken
 * by a Room separator, has a face per Room.
 */
export interface RoomWallFace {
  readonly wall: WallId;
  /** The Wall's drawn face (on its Baseline) or its other face */
  readonly face: 'drawn' | 'other';
  /** mm, along the Room's outline */
  readonly length: number;
  /** mm, the Room height */
  readonly height: number;
  /** mm², length × height */
  readonly gross: number;
  /** The Openings in this face, as for the Room */
  readonly openings: readonly OpeningCut[];
  /** mm², this face's share of its Openings' reveals */
  readonly revealArea: number;
}

/** mm², the part of these Openings subtracted under a Measurement rule. */
export function openingArea(openings: readonly OpeningCut[], rule: MeasurementRule): number {
  const min = MEASUREMENT_RULES[rule].minOpeningArea;
  return openings.reduce((area, o) => (o.size < min ? area : area + o.cut), 0);
}

/** Net area of a Room's Wall face under a Measurement rule. */
export function faceNetArea(f: RoomWallFace, rule: MeasurementRule): number {
  return f.gross - openingArea(f.openings, rule);
}

export interface RoomSurfaces {
  /** mm, the Room's outline along Wall faces (Room separators excluded) */
  readonly wallLength: number;
  /** mm², wallLength × Room height */
  readonly grossWallArea: number;
  readonly openings: readonly OpeningCut[];
  /** mm², sides, head and window sill inside the wall thickness (this Room's share) */
  readonly revealArea: number;
  /** The Wall faces around the Room; their areas and reveals add up to the Room's */
  readonly faces: readonly RoomWallFace[];
}

/** Net wall area around a Room under a Measurement rule. */
export function netWallArea(s: RoomSurfaces, rule: MeasurementRule): number {
  return s.grossWallArea - openingArea(s.openings, rule);
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

/** A Wall's frame with its two face offsets across the Baseline and how far each face runs. */
interface Frame extends WallFrame {
  readonly wall: Wall;
  readonly lo: number;
  readonly hi: number;
  /** mm along the Baseline: where the low and the high face start and end */
  readonly loSpan: readonly [number, number];
  readonly hiSpan: readonly [number, number];
}

const ON = 0.5; // mm: an edge closer than this to a face lies on it
const ON_SEPARATOR = 0.01; // mm: separator strips are 0.002 mm wide

function frameOf(wall: Wall, outline: WallOutline): Frame {
  const f = wallFrame(wall);
  const span = (a: Vec, b: Vec): [number, number] => {
    const ta = f.along(a);
    const tb = f.along(b);
    return [Math.min(ta, tb), Math.max(ta, tb)];
  };
  return {
    ...f,
    wall,
    lo: f.across(outline[0]),
    hi: f.across(outline[3]),
    loSpan: span(outline[0], outline[1]),
    hiSpan: span(outline[3], outline[2]),
  };
}

/** One Room's part of one Wall face while it is being measured. */
interface FaceTally {
  readonly frame: Frame;
  readonly side: 'lo' | 'hi';
  length: number;
  readonly widths: Map<ResolvedOpening, number>;
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
  openings: readonly ResolvedOpening[],
): Map<K, RoomSurfaces> {
  const frames = new Map<string, Frame>();
  for (const w of walls) {
    const outline = outlines.get(w.id);
    if (outline) frames.set(w.id, frameOf(w, outline));
  }
  // Per Room: its wall length and, per Wall face it touches, the length along it and the width
  // of each Opening in it.
  const found = new Map<K, { wallLength: number; faces: Map<string, FaceTally> }>();
  // An Opening's reveals are shared between the Room faces it is in (one per side, or both
  // faces of a Wall standing inside one Room).
  const facesPerOpening = new Map<ResolvedOpening, number>();
  for (const [key, room] of rooms) {
    let wallLength = 0;
    const faces = new Map<string, FaceTally>();
    for (const ring of room.rings) {
      ring.forEach((a, i) => {
        const b = ring[(i + 1) % ring.length]!;
        const length = Math.hypot(b.x - a.x, b.y - a.y);
        if (length < 1e-6) return;
        const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
        if (separators.some((s) => distanceToSegment(mid, s.start, s.end) <= ON_SEPARATOR)) return;
        wallLength += length;
        for (const f of frames.values()) {
          const sa = f.across(a);
          const sb = f.across(b);
          for (const side of ['lo', 'hi'] as const) {
            const face = f[side];
            if (Math.abs(sa - face) > ON || Math.abs(sb - face) > ON) continue;
            // The edge's part along this face (collinear Walls each take their own stretch).
            const [s0, s1] = side === 'lo' ? f.loSpan : f.hiSpan;
            const t0 = Math.max(Math.min(f.along(a), f.along(b)), s0);
            const t1 = Math.min(Math.max(f.along(a), f.along(b)), s1);
            if (t1 - t0 <= 1e-6) continue;
            const faceKey = `${f.wall.id}:${side}`;
            let tally = faces.get(faceKey);
            if (!tally) {
              tally = { frame: f, side, length: 0, widths: new Map() };
              faces.set(faceKey, tally);
            }
            tally.length += t1 - t0;
            for (const o of openings) {
              if (o.wall !== f.wall.id) continue;
              const overlap = Math.min(t1, o.offset + o.width) - Math.max(t0, o.offset);
              if (overlap > 1e-6) tally.widths.set(o, (tally.widths.get(o) ?? 0) + overlap);
            }
          }
        }
      });
    }
    for (const t of faces.values()) {
      for (const o of t.widths.keys()) facesPerOpening.set(o, (facesPerOpening.get(o) ?? 0) + 1);
    }
    found.set(key, { wallLength, faces });
  }

  const result = new Map<K, RoomSurfaces>();
  const byOpening = (x: OpeningCut, y: OpeningCut) =>
    x.opening < y.opening ? -1 : x.opening > y.opening ? 1 : 0;
  for (const [key, { wallLength, faces }] of found) {
    const { floor, height } = rooms.get(key)!;
    const ceiling = floor + height;
    const roomFaces: RoomWallFace[] = [];
    for (const tally of faces.values()) {
      const f = tally.frame;
      let revealArea = 0;
      const cuts: OpeningCut[] = [];
      for (const [o, width] of tally.widths) {
        const bottom = elevation + o.sill;
        const top = bottom + o.height;
        const below = heightOverlap(bottom, top, floor, ceiling);
        cuts.push({ opening: o.id, size: o.width * o.height, cut: width * below });
        const depth = Math.abs(f.hi - f.lo) / (facesPerOpening.get(o) ?? 1);
        const head = top <= ceiling && top > floor ? o.width : 0;
        // A sill inside the Wall wherever the Opening starts above the floor (windows, a raised
        // wall opening).
        const sill = bottom > floor && bottom < ceiling ? o.width : 0;
        revealArea += depth * (2 * below + head + sill);
      }
      roomFaces.push({
        wall: f.wall.id,
        face: Math.abs(f[tally.side]) <= ON ? 'drawn' : 'other',
        length: tally.length,
        height,
        gross: tally.length * height,
        openings: cuts.sort(byOpening),
        revealArea,
      });
    }
    roomFaces.sort((x, y) =>
      x.wall < y.wall ? -1 : x.wall > y.wall ? 1 : x.face < y.face ? -1 : 1,
    );
    // The Room's Openings: an Opening across two faces of the Room (rare) counts once, summed.
    const cutsByOpening = new Map<OpeningId, OpeningCut>();
    for (const c of roomFaces.flatMap((rf) => rf.openings)) {
      const had = cutsByOpening.get(c.opening);
      cutsByOpening.set(c.opening, had ? { ...had, cut: had.cut + c.cut } : c);
    }
    result.set(key, {
      wallLength,
      grossWallArea: wallLength * height,
      openings: [...cutsByOpening.values()].sort(byOpening),
      revealArea: roomFaces.reduce((sum, rf) => sum + rf.revealArea, 0),
      faces: roomFaces,
    });
  }
  return result;
}
