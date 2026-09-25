/**
 * Room detection as holes in the merged wall footprint ("Wall joins and room detection").
 *
 * The joined outlines of all room-bounding Walls on a Level are merged (Clipper2 union, in
 * integer units of 0.001 mm). Every hole in the result, at any depth, is an enclosed area,
 * already measured to the inner faces: its Net outline. Room separators join the union as
 * hairline strips, so they cut holes without meaningfully changing their area. Each Room is the
 * enclosed area containing its Seed point (ADR 0002). The outer boundaries give the Gross outline.
 */
import {
  Clipper64,
  ClipType,
  FillRule,
  PointInPolygonResult,
  PolyTree64,
  area as pathArea,
  isPositive,
  pointInPolygon,
  type Path64,
  type PolyPath64,
} from 'clipper2-ts';
import type { RoomId, Vec } from '../model/types';
import { add, normalize, perp, scale, sub } from './vec';

/** Clipper2 integer units per millimetre (1 unit = 0.001 mm). */
const UNITS_PER_MM = 1000;
/** Enclosed areas smaller than this are rounding leftovers, not areas (0.01 m²). */
export const MIN_ENCLOSED_AREA_MM2 = 0.01 * 1e6;
/** Room separators are strips this wide (mm), reaching this far into the Walls at both ends. */
const SEPARATOR_WIDTH_MM = 0.002;
const SEPARATOR_OVERLAP_MM = 0.01;

export interface FootprintInput {
  /** Joined outlines of the room-bounding Walls. */
  readonly outlines: readonly (readonly Vec[])[];
  readonly separators: readonly { readonly start: Vec; readonly end: Vec }[];
  readonly seeds: readonly { readonly room: RoomId; readonly seed: Vec }[];
}

/** An enclosed area: a hole of the footprint minus any free-standing islands inside it. */
export interface EnclosedArea {
  readonly outline: readonly Vec[];
  readonly islands: readonly (readonly Vec[])[];
  /** mm² */
  readonly area: number;
  /** Rooms whose Seed point lies in this area. */
  readonly rooms: readonly RoomId[];
}

export type RoomDetection =
  | { readonly status: 'enclosed'; readonly area: EnclosedArea }
  | {
      readonly status: 'sharingArea';
      readonly area: EnclosedArea;
      readonly others: readonly RoomId[];
    }
  | { readonly status: 'notEnclosed' };

export interface Footprint {
  /** Outer boundaries of the merged footprint (the Gross outline). */
  readonly outer: readonly (readonly Vec[])[];
  /** mm², area inside the outer boundaries */
  readonly grossArea: number;
  readonly areas: readonly EnclosedArea[];
  readonly rooms: ReadonlyMap<RoomId, RoomDetection>;
}

const toPath = (ring: readonly Vec[]): Path64 =>
  ring.map((p) => ({ x: Math.round(p.x * UNITS_PER_MM), y: Math.round(p.y * UNITS_PER_MM) }));
/** Union with NonZero needs one winding direction: opposite rings would cancel instead of merge. */
const positive = (path: Path64): Path64 => (isPositive(path) ? path : [...path].reverse());
const toRing = (path: Path64): Vec[] =>
  path.map((p) => ({ x: p.x / UNITS_PER_MM, y: p.y / UNITS_PER_MM }));
const areaMm2 = (path: Path64): number => Math.abs(pathArea(path)) / (UNITS_PER_MM * UNITS_PER_MM);

function separatorStrip(start: Vec, end: Vec): Vec[] {
  const d = normalize(sub(end, start));
  const n = scale(perp(d), SEPARATOR_WIDTH_MM / 2);
  const a = sub(start, scale(d, SEPARATOR_OVERLAP_MM));
  const b = add(end, scale(d, SEPARATOR_OVERLAP_MM));
  return [add(a, n), add(b, n), sub(b, n), sub(a, n)];
}

interface Piece {
  readonly hole: Path64;
  readonly islands: Path64[];
  readonly area: number;
}

export function footprint(input: FootprintInput): Footprint {
  const subjects: Path64[] = [
    ...input.outlines.map(toPath),
    ...input.separators.map((s) => toPath(separatorStrip(s.start, s.end))),
  ].map(positive);
  const tree = new PolyTree64();
  if (subjects.length) {
    const clipper = new Clipper64();
    clipper.addSubject(subjects);
    clipper.execute(ClipType.Union, FillRule.NonZero, tree);
  }

  const outer: Path64[] = [];
  const pieces: Piece[] = [];
  const visit = (node: PolyPath64) => {
    for (let i = 0; i < node.count; i++) {
      const child = node.child(i);
      const polygon = child.polygon;
      if (polygon) {
        if (child.isHole) {
          const islands: Path64[] = [];
          for (let j = 0; j < child.count; j++) {
            const island = child.child(j).polygon;
            if (island) islands.push(island);
          }
          const area = areaMm2(polygon) - islands.reduce((s, p) => s + areaMm2(p), 0);
          if (area >= MIN_ENCLOSED_AREA_MM2) pieces.push({ hole: polygon, islands, area });
        } else if (node === tree) {
          outer.push(polygon);
        }
      }
      visit(child);
    }
  };
  visit(tree);

  const inside = (pt: Vec, piece: Piece): boolean => {
    const p = { x: Math.round(pt.x * UNITS_PER_MM), y: Math.round(pt.y * UNITS_PER_MM) };
    if (pointInPolygon(p, piece.hole) !== PointInPolygonResult.IsInside) return false;
    return piece.islands.every((isl) => pointInPolygon(p, isl) === PointInPolygonResult.IsOutside);
  };

  const roomsPerPiece = pieces.map(() => [] as RoomId[]);
  const pieceOfRoom = new Map<RoomId, number>();
  for (const { room, seed } of input.seeds) {
    const index = pieces.findIndex((piece) => inside(seed, piece));
    if (index >= 0) {
      roomsPerPiece[index]!.push(room);
      pieceOfRoom.set(room, index);
    }
  }

  const areas: EnclosedArea[] = pieces.map((piece, i) => ({
    outline: toRing(piece.hole),
    islands: piece.islands.map(toRing),
    area: piece.area,
    rooms: roomsPerPiece[i]!,
  }));

  const rooms = new Map<RoomId, RoomDetection>();
  for (const { room } of input.seeds) {
    const index = pieceOfRoom.get(room);
    if (index === undefined) {
      rooms.set(room, { status: 'notEnclosed' });
      continue;
    }
    const area = areas[index]!;
    const others = area.rooms.filter((r) => r !== room);
    rooms.set(
      room,
      others.length ? { status: 'sharingArea', area, others } : { status: 'enclosed', area },
    );
  }

  return {
    outer: outer.map(toRing),
    grossArea: outer.reduce((s, p) => s + areaMm2(p), 0),
    areas,
    rooms,
  };
}
