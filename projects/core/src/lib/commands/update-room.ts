/** UpdateRoom: a committed field in the Room's properties panel (one field, one undo step). */
import { put } from '../model/edit';
import { message } from '../model/message';
import type { Room, RoomId } from '../model/types';
import { refuse, type Command } from './command';

export interface UpdateRoomArgs {
  readonly room: RoomId;
  readonly name?: string;
  /** mm, floor to ceiling; null = follow the Room-height Preset again */
  readonly height?: number | null;
  /** mm; null = follow the Floor build-up Preset again */
  readonly floorBuildUp?: number | null;
  readonly floorFinish?: string | null;
}

export const updateRoom: Command<UpdateRoomArgs> = (model, args) => {
  const room = model.rooms[args.room];
  if (!room) return refuse(message('invariants.missingReference', { what: 'room', id: args.room }));
  if (args.name !== undefined && !args.name.trim())
    return refuse(message('commands.updateRoom.emptyName'));
  if (typeof args.height === 'number' && !(args.height > 0))
    return refuse(message('commands.updateRoom.badHeight'));
  let next: Room = { ...room };
  if (args.name !== undefined) next = { ...next, name: args.name.trim() };
  next = withOptional(next, 'height', args.height);
  next = withOptional(next, 'floorBuildUp', args.floorBuildUp);
  next = withOptional(
    next,
    'floorFinish',
    args.floorFinish === null ? null : args.floorFinish?.trim() || args.floorFinish,
  );
  return {
    ok: true,
    model: put(model, 'rooms', next),
    label: message('commands.updateRoom.label', { name: next.name }),
  };
};

/** Sets an optional property; null removes it (the element follows the Preset again). */
function withOptional<K extends 'height' | 'floorBuildUp' | 'floorFinish'>(
  room: Room,
  key: K,
  value: Room[K] | null | undefined,
): Room {
  if (value === undefined) return room;
  if (value === null || value === '') {
    const { [key]: _removed, ...rest } = room;
    return rest as Room;
  }
  return { ...room, [key]: value };
}
