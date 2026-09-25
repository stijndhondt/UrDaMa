/**
 * DrawRoom: the Room tool's command (Box-drawing interaction on the foundation map).
 *
 * The dragged rectangle is the Room's inside size (or its outside size). Four Walls are created
 * around it with the Preset thickness, growing outward, joined by corner Wall connections; the
 * Room's Seed point sits at the rectangle's centre. One command, one undo step.
 */
import { putAll, put } from '../model/edit';
import { message } from '../model/message';
import type {
  Ceiling,
  CeilingId,
  LevelId,
  Room,
  RoomId,
  Vec,
  Wall,
  WallConnection,
  WallConnectionId,
  WallId,
} from '../model/types';
import { refuse, type Command } from './command';

export interface DrawRoomArgs {
  readonly level: LevelId;
  /** Two opposite corners of the dragged rectangle (mm, plan coordinates). */
  readonly from: Vec;
  readonly to: Vec;
  /** Whether the rectangle is the Room's inside size (Walls outside it) or outside size. */
  readonly size: 'inside' | 'outside';
  readonly name: string;
}

/** Smallest inside width or depth a drawn Room may have (mm). */
export const MIN_ROOM_SIZE = 300;

export const drawRoom: Command<DrawRoomArgs> = (model, args, { ids }) => {
  const t = model.project.presets.wallThickness;
  const inset = args.size === 'outside' ? t : 0;
  const x0 = Math.min(args.from.x, args.to.x) + inset;
  const x1 = Math.max(args.from.x, args.to.x) - inset;
  const y0 = Math.min(args.from.y, args.to.y) + inset;
  const y1 = Math.max(args.from.y, args.to.y) - inset;
  if (x1 - x0 < MIN_ROOM_SIZE || y1 - y0 < MIN_ROOM_SIZE) {
    return refuse(message('commands.drawRoom.tooSmall', { min: MIN_ROOM_SIZE }));
  }

  // Clockwise on screen (y down), so 'left' of each Baseline is outside the Room.
  const corners: Vec[] = [
    { x: x0, y: y0 },
    { x: x1, y: y0 },
    { x: x1, y: y1 },
    { x: x0, y: y1 },
  ];
  const walls: Wall[] = corners.map((start, i) => ({
    id: ids('walls') as WallId,
    level: args.level,
    start,
    end: corners[(i + 1) % 4]!,
    side: 'left',
    roomBounding: true,
  }));
  const connections: WallConnection[] = walls.map((w, i) => ({
    id: ids('wallConnections') as WallConnectionId,
    wall: w.id,
    end: 'end',
    kind: 'corner',
    to: walls[(i + 1) % 4]!.id,
    toEnd: 'start',
  }));
  const room: Room = {
    id: ids('rooms') as RoomId,
    level: args.level,
    name: args.name,
    seed: { x: (x0 + x1) / 2, y: (y0 + y1) / 2 },
  };
  const ceiling: Ceiling = { id: ids('ceilings') as CeilingId, room: room.id };

  let next = putAll(model, 'walls', walls);
  next = putAll(next, 'wallConnections', connections);
  next = put(next, 'rooms', room);
  next = put(next, 'ceilings', ceiling);
  return { ok: true, model: next, label: message('commands.drawRoom.label', { name: args.name }) };
};
