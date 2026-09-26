/**
 * Enclosed areas that a command newly bounded (a Wall closing a loop, a Room separator splitting an
 * area) and that have no Room get one, with a Seed point well inside them.
 */
import { levelGeometry } from '../geometry/level-geometry';
import { interiorPoint } from '../geometry/polygon';
import type { EnclosedArea } from '../geometry/footprint';
import { put } from '../model/edit';
import type { Ceiling, CeilingId, LevelId, Model, Room, RoomId } from '../model/types';
import type { CommandContext } from './command';

export function roomsForNewAreas(
  before: Model,
  after: Model,
  level: LevelId,
  /** Whether an area touches what the command added. */
  touchesNew: (area: EnclosedArea) => boolean,
  roomName: (index: number) => string,
  context: CommandContext,
): Model {
  const previous = levelGeometry(before, level).footprint.areas;
  const now = levelGeometry(after, level).footprint.areas;
  let next = after;
  let count = 0;
  for (const area of now) {
    if (area.rooms.length || !touchesNew(area)) continue;
    const existedBefore = previous.some(
      (old) => !old.rooms.length && Math.abs(old.area - area.area) < 1,
    );
    if (existedBefore) continue;
    const room: Room = {
      id: context.ids('rooms') as RoomId,
      level,
      name: roomName(count++),
      seed: interiorPoint(area.outline, area.islands),
    };
    const ceiling: Ceiling = { id: context.ids('ceilings') as CeilingId, room: room.id };
    next = put(put(next, 'rooms', room), 'ceilings', ceiling);
  }
  return next;
}
