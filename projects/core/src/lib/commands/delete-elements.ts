/**
 * DeleteElements: the Delete key (ticket 11 decisions, Slice 1 spec).
 *
 * Deleting a Wall also deletes its Openings, the Wall connections involving it and the Room
 * separators attached to it; the neighbouring ends become unconnected. Rooms are never deleted
 * silently: they stay, possibly flagged "not enclosed" or "sharing one area". Deleting a Room
 * deletes its Ceiling; its Walls stay, and its area shows as "no Room".
 */
import { remove } from '../model/edit';
import { message } from '../model/message';
import type { FloorOpeningId, OpeningId, RoomId, RoomSeparatorId, WallId } from '../model/types';
import { refuse, type Command } from './command';

export interface DeleteElementsArgs {
  readonly walls: readonly WallId[];
  readonly rooms: readonly RoomId[];
  readonly separators?: readonly RoomSeparatorId[];
  readonly openings?: readonly OpeningId[];
  readonly floorOpenings?: readonly FloorOpeningId[];
}

export const deleteElements: Command<DeleteElementsArgs> = (model, args) => {
  const walls = new Set<string>(args.walls.filter((id) => model.walls[id]));
  const rooms = new Set<string>(args.rooms.filter((id) => model.rooms[id]));
  const separators = new Set<string>(
    (args.separators ?? []).filter((id) => model.roomSeparators[id]),
  );
  const chosenOpenings = new Set<string>((args.openings ?? []).filter((id) => model.openings[id]));
  const floorOpenings = (args.floorOpenings ?? []).filter((id) => model.floorOpenings[id]);
  if (
    !walls.size &&
    !rooms.size &&
    !separators.size &&
    !chosenOpenings.size &&
    !floorOpenings.length
  )
    return refuse(message('commands.delete.nothing'));

  for (const s of Object.values(model.roomSeparators)) {
    if (walls.has(s.startWall) || walls.has(s.endWall)) separators.add(s.id);
  }
  const connections = Object.values(model.wallConnections)
    .filter((c) => walls.has(c.wall) || walls.has(c.to))
    .map((c) => c.id);
  const openings = Object.values(model.openings)
    .filter((o) => walls.has(o.wall) || chosenOpenings.has(o.id))
    .map((o) => o.id);
  const ceilings = Object.values(model.ceilings)
    .filter((c) => rooms.has(c.room))
    .map((c) => c.id);

  let next = remove(model, 'walls', [...walls]);
  next = remove(next, 'wallConnections', connections);
  next = remove(next, 'openings', openings);
  next = remove(next, 'roomSeparators', [...separators]);
  next = remove(next, 'rooms', [...rooms]);
  next = remove(next, 'ceilings', ceilings);
  next = remove(next, 'floorOpenings', floorOpenings);
  const count =
    walls.size + rooms.size + separators.size + chosenOpenings.size + floorOpenings.length;
  return { ok: true, model: next, label: message('commands.delete.label', { count }) };
};
