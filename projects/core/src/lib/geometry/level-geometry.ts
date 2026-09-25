/**
 * A Level's geometry computed directly from a model, for commands (which work on plain models,
 * not on the reactive Derived values). Same functions, same results.
 */
import type { LevelId, Model, Vec, Wall, WallId } from '../model/types';
import { footprint, type Footprint } from './footprint';
import { wallOutlines, type WallOutline } from './wall-outlines';

export interface LevelGeometry {
  readonly walls: readonly Wall[];
  readonly outlines: ReadonlyMap<WallId, WallOutline>;
  readonly footprint: Footprint;
}

/** Only the joined Wall outlines of a Level (cheaper than the full geometry; used for snapping). */
export function levelWallOutlines(model: Model, level: LevelId): ReadonlyMap<WallId, WallOutline> {
  const walls = Object.values(model.walls).filter((w) => w.level === level);
  const ids = new Set<string>(walls.map((w) => w.id));
  const connections = Object.values(model.wallConnections).filter((c) => ids.has(c.wall));
  return wallOutlines(walls, connections, model.project.presets.wallThickness);
}

export function levelGeometry(model: Model, level: LevelId): LevelGeometry {
  const walls = Object.values(model.walls).filter((w) => w.level === level);
  const ids = new Set<string>(walls.map((w) => w.id));
  const connections = Object.values(model.wallConnections).filter((c) => ids.has(c.wall));
  const outlines = wallOutlines(walls, connections, model.project.presets.wallThickness);
  return {
    walls,
    outlines,
    footprint: footprint({
      outlines: walls
        .filter((w) => w.roomBounding)
        .flatMap((w) => (outlines.has(w.id) ? [outlines.get(w.id)!] : [])),
      separators: Object.values(model.roomSeparators).filter((s) => s.level === level),
      seeds: Object.values(model.rooms)
        .filter((r) => r.level === level)
        .map((r) => ({ room: r.id, seed: r.seed })),
    }),
  };
}

/** The two faces of a Wall outline as segments: low face (start → end) and high face. */
export function wallFaces(
  outline: WallOutline,
): readonly [readonly [Vec, Vec], readonly [Vec, Vec]] {
  return [
    [outline[0], outline[1]],
    [outline[3], outline[2]],
  ];
}
