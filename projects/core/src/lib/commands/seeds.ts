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
