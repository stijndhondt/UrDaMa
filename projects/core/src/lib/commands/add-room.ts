/**
 * AddRoom: turns an enclosed area that has no Room into a Room (clicking a "no Room" area).
 */
import { levelGeometry } from '../geometry/level-geometry';
import { insideArea } from '../geometry/polygon';
import { put } from '../model/edit';
import { message } from '../model/message';
import type { Ceiling, CeilingId, LevelId, Room, RoomId, Vec } from '../model/types';
import { refuse, type Command } from './command';

export interface AddRoomArgs {
  readonly level: LevelId;
  /** Where the user clicked: becomes the Seed point. */
  readonly seed: Vec;
  readonly name: string;
}

export const addRoom: Command<AddRoomArgs> = (model, args, { ids }) => {
  const area = levelGeometry(model, args.level).footprint.areas.find((a) =>
    insideArea(args.seed, a.outline, a.islands),
  );
  if (!area) return refuse(message('commands.addRoom.notEnclosed'));
  if (area.rooms.length) return refuse(message('commands.addRoom.occupied'));
  const room: Room = {
    id: ids('rooms') as RoomId,
    level: args.level,
    name: args.name,
    seed: args.seed,
  };
  const ceiling: Ceiling = { id: ids('ceilings') as CeilingId, room: room.id };
  const next = put(put(model, 'rooms', room), 'ceilings', ceiling);
  return { ok: true, model: next, label: message('commands.addRoom.label', { name: args.name }) };
};
