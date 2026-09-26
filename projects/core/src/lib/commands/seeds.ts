/**
 * Keeping Rooms on their areas when Walls change (ADR 0002; Slice 1 spec: a Room drawn inside
 * another Room, move and push carry Seed points along).
 *
 * After a command, a Room whose Seed point is no longer enclosed, or now shares an area with a
 * Room that has priority, moves its Seed point to the new area that overlaps its old area the
 * most, among the areas no other Room occupies. It keeps its name and properties. When Rooms
 * end up sharing one area, the Room with priority, else the one whose old area overlaps it most,
 * keeps it.
 */
import { levelGeometry } from '../geometry/level-geometry';
import { interiorPoint, intersectionArea } from '../geometry/polygon';
import type { LevelId, Model, RoomId, Vec } from '../model/types';

export function reseatSeeds(
  before: Model,
  after: Model,
  level: LevelId,
  priority: ReadonlySet<RoomId> = new Set(),
): Model {
  if (!priority.size && seedsUntouched(before, after, level)) return after;
  const old = levelGeometry(before, level).footprint;
  const now = levelGeometry(after, level).footprint;
  let rooms = after.rooms;

  // Of Rooms that now share one area, the one whose old area overlaps it most keeps it.
  const keeper = new Map<number, RoomId>();
  now.areas.forEach((area, index) => {
    if (area.rooms.length < 2) return;
    const withPriority = area.rooms.find((r) => priority.has(r));
    if (withPriority) {
      keeper.set(index, withPriority);
      return;
    }
    let best: { room: RoomId; overlap: number } | null = null;
    for (const r of area.rooms) {
      const previous = old.rooms.get(r);
      const overlap =
        previous && previous.status !== 'notEnclosed' ? intersectionArea(previous.area, area) : 0;
      if (!best || overlap > best.overlap) best = { room: r, overlap };
    }
    if (best) keeper.set(index, best.room);
  });

  for (const room of Object.values(after.rooms)) {
    if (room.level !== level || priority.has(room.id)) continue;
    const detection = now.rooms.get(room.id);
    const areaIndex =
      detection && detection.status !== 'notEnclosed' ? now.areas.indexOf(detection.area) : -1;
    const displaced =
      !detection ||
      detection.status === 'notEnclosed' ||
      (detection.status === 'sharingArea' && keeper.get(areaIndex) !== room.id);
    if (!displaced) continue;

    const previous = old.rooms.get(room.id);
    if (!previous || previous.status === 'notEnclosed') continue;
    let best: { area: (typeof now.areas)[number]; overlap: number } | null = null;
    for (const area of now.areas) {
      if (area.rooms.some((r) => r !== room.id)) continue;
      const overlap = intersectionArea(previous.area, area);
      if (overlap > 0 && (!best || overlap > best.overlap)) best = { area, overlap };
    }
    if (!best) continue;
    rooms = {
      ...rooms,
      [room.id]: { ...room, seed: interiorPoint(best.area.outline, best.area.islands) },
    };
  }
  return rooms === after.rooms ? after : { ...after, rooms };
}

/**
 * True when the command cannot have displaced any Seed point, so the (costly) re-detection can be
 * skipped: the Level has the same Walls, connections, Room separators and Rooms as before, the
 * changed Walls and separators only moved their ends, and no Seed point lies near where they were
 * or now are. Moving Walls keeps their connections, so the areas themselves stay the same.
 */
function seedsUntouched(before: Model, after: Model, level: LevelId): boolean {
  if (after.rooms !== before.rooms) return false;
  const boxes: { min: Vec; max: Vec }[] = [];
  const sameKeys = (a: object, b: object) => {
    const ka = Object.keys(a);
    return ka.length === Object.keys(b).length && ka.every((k) => Object.hasOwn(b, k));
  };
  if (!sameKeys(before.walls, after.walls)) return false;
  if (!sameKeys(before.wallConnections, after.wallConnections)) return false;
  if (!sameKeys(before.roomSeparators, after.roomSeparators)) return false;
  if (after.project.presets.wallThickness !== before.project.presets.wallThickness) return false;
  const around = (points: Vec[], pad: number) => {
    const xs = points.map((p) => p.x);
    const ys = points.map((p) => p.y);
    boxes.push({
      min: { x: Math.min(...xs) - pad, y: Math.min(...ys) - pad },
      max: { x: Math.max(...xs) + pad, y: Math.max(...ys) + pad },
    });
  };
  for (const [id, w] of Object.entries(after.walls)) {
    const old = before.walls[id]!;
    if (old === w) continue;
    if (
      old.level !== w.level ||
      old.side !== w.side ||
      old.thickness !== w.thickness ||
      old.roomBounding !== w.roomBounding
    )
      return false;
    if (w.level !== level) continue;
    // Mitred corners reach past the Baseline ends; twice the thickness covers them.
    around(
      [old.start, old.end, w.start, w.end],
      2 * (w.thickness ?? after.project.presets.wallThickness) + 1,
    );
  }
  for (const [id, c] of Object.entries(after.wallConnections)) {
    const old = before.wallConnections[id]!;
    if (old === c) continue;
    if (old.kind !== c.kind || old.wall !== c.wall || old.to !== c.to || old.end !== c.end)
      return false;
  }
  for (const [id, sep] of Object.entries(after.roomSeparators)) {
    const old = before.roomSeparators[id]!;
    if (old === sep) continue;
    if (old.startWall !== sep.startWall || old.endWall !== sep.endWall) return false;
    around([old.start, old.end, sep.start, sep.end], 1);
  }
  return Object.values(after.rooms).every(
    (r) =>
      r.level !== level ||
      !boxes.some(
        (b) =>
          r.seed.x >= b.min.x && r.seed.x <= b.max.x && r.seed.y >= b.min.y && r.seed.y <= b.max.y,
      ),
  );
}
