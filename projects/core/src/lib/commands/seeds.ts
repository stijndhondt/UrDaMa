/**
 * Keeping Rooms on their areas when Walls change (ADR 0002; Slice 1 spec: a Room drawn inside
 * another Room, move and push carry Seed points along).
 *
 * After a command, a Room whose Seed point is no longer enclosed, or now shares an area with a
 * Room that has priority, moves its Seed point to the new area that overlaps its old area the
 * most, among the areas no other Room occupies. It keeps its name and properties.
 */
import { levelGeometry } from '../geometry/level-geometry';
import { interiorPoint, intersectionArea } from '../geometry/polygon';
import type { LevelId, Model, RoomId } from '../model/types';

export function reseatSeeds(
  before: Model,
  after: Model,
  level: LevelId,
  priority: ReadonlySet<RoomId> = new Set(),
): Model {
  const old = levelGeometry(before, level).footprint;
  const now = levelGeometry(after, level).footprint;
  let rooms = after.rooms;

  for (const room of Object.values(after.rooms)) {
    if (room.level !== level || priority.has(room.id)) continue;
    const detection = now.rooms.get(room.id);
    const displaced =
      !detection ||
      detection.status === 'notEnclosed' ||
      (detection.status === 'sharingArea' && detection.others.some((o) => priority.has(o)));
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
