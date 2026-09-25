/**
 * Invariants checked at the end of every command (ticket 11): a command that would break one is
 * refused and changes nothing, so the model can never be saved in a broken state.
 */
import {
  Clipper64,
  ClipType,
  FillRule,
  area as pathArea,
  isPositive,
  type Path64,
} from 'clipper2-ts';
import { message, type Message } from './message';
import type { LevelId, Model, WallId } from './types';
import { distance } from '../geometry/vec';
import { wallOutlines, type WallOutline } from '../geometry/wall-outlines';

/** Wall outlines overlapping by more than this (mm²) count as overlapping. */
const OVERLAP_TOLERANCE_MM2 = 10;
const UNITS = 1000;

const toPath = (ring: readonly { x: number; y: number }[]): Path64 => {
  const p = ring.map((v) => ({ x: Math.round(v.x * UNITS), y: Math.round(v.y * UNITS) }));
  return isPositive(p) ? p : p.reverse();
};
const areaOf = (paths: Path64[]) =>
  paths.reduce((s, p) => s + Math.abs(pathArea(p)), 0) / (UNITS * UNITS);
function union(paths: Path64[]): Path64[] {
  const clipper = new Clipper64();
  clipper.addSubject(paths);
  const out: Path64[] = [];
  clipper.execute(ClipType.Union, FillRule.NonZero, out);
  return out;
}
function overlapArea(a: WallOutline, b: WallOutline): number {
  const clipper = new Clipper64();
  clipper.addSubject([toPath(a)]);
  clipper.addClip([toPath(b)]);
  const out: Path64[] = [];
  clipper.execute(ClipType.Intersection, FillRule.NonZero, out);
  return areaOf(out);
}

/** The first pair of Walls on a Level whose outlines overlap, if any (Walls never overlap). */
export function overlappingWalls(model: Model, level: LevelId): readonly [WallId, WallId] | null {
  const walls = Object.values(model.walls).filter((w) => w.level === level);
  if (walls.length < 2) return null;
  const ids = new Set<string>(walls.map((w) => w.id));
  const outlines = wallOutlines(
    walls,
    Object.values(model.wallConnections).filter((c) => ids.has(c.wall)),
    model.project.presets.wallThickness,
  );
  const list = [...outlines.entries()];
  const paths = list.map(([, o]) => toPath(o));
  // Cheap check first: the union of all outlines is as large as their sum when nothing overlaps.
  if (areaOf(paths) - areaOf(union(paths)) <= OVERLAP_TOLERANCE_MM2) return null;
  for (let i = 0; i < list.length; i++)
    for (let j = i + 1; j < list.length; j++)
      if (overlapArea(list[i]![1], list[j]![1]) > OVERLAP_TOLERANCE_MM2)
        return [list[i]![0], list[j]![0]];
  return null;
}

export function checkInvariants(model: Model): Message | null {
  const has = (collection: keyof Model, id: string) =>
    Object.hasOwn(model[collection] as object, id);
  const missing = (what: string, id: string) =>
    message('invariants.missingReference', { what, id });

  for (const l of Object.values(model.levels))
    if (!has('buildings', l.building)) return missing('building', l.building);
  for (const s of Object.values(model.slabs))
    if (!has('levels', s.level)) return missing('level', s.level);
  for (const w of Object.values(model.walls)) {
    if (!has('levels', w.level)) return missing('level', w.level);
    if (distance(w.start, w.end) <= 0) return message('invariants.zeroLength', { id: w.id });
  }
  const corners = new Set<string>();
  for (const c of Object.values(model.wallConnections)) {
    if (!has('walls', c.wall)) return missing('wall', c.wall);
    if (!has('walls', c.to)) return missing('wall', c.to);
    if (c.kind === 'corner') {
      for (const key of [`${c.wall}:${c.end}`, `${c.to}:${c.toEnd}`]) {
        if (corners.has(key)) return message('invariants.twoCorners', { wall: key.split(':')[0]! });
        corners.add(key);
      }
    }
  }
  for (const o of Object.values(model.openings))
    if (!has('walls', o.wall)) return missing('wall', o.wall);
  for (const r of Object.values(model.rooms))
    if (!has('levels', r.level)) return missing('level', r.level);
  for (const s of Object.values(model.roomSeparators)) {
    if (!has('levels', s.level)) return missing('level', s.level);
    if (!has('walls', s.startWall)) return missing('wall', s.startWall);
    if (!has('walls', s.endWall)) return missing('wall', s.endWall);
  }
  for (const c of Object.values(model.ceilings))
    if (!has('rooms', c.room)) return missing('room', c.room);
  for (const level of Object.keys(model.levels)) {
    const pair = overlappingWalls(model, level as LevelId);
    if (pair) return message('invariants.overlap', { a: pair[0], b: pair[1] });
  }
  return null;
}
