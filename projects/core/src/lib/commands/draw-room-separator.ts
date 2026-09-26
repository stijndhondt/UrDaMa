/**
 * DrawRoomSeparator: the Room separator tool (Slice 1 spec). A line with no physical form whose two
 * ends lie on Wall faces (stored as the Walls it is attached to). The Room already there keeps the
 * piece with its Seed point; the other piece becomes a new Room.
 */
import { levelGeometry, wallFaces } from '../geometry/level-geometry';
import { distanceToSegment } from '../geometry/polygon';
import { distance } from '../geometry/vec';
import { put } from '../model/edit';
import { message } from '../model/message';
import type { LevelId, RoomSeparator, RoomSeparatorId, Vec, WallId } from '../model/types';
import { refuse, type Command } from './command';
import { roomsForNewAreas } from './new-rooms';
import { reseatSeeds } from './seeds';

export interface DrawRoomSeparatorArgs {
  readonly level: LevelId;
  readonly start: Vec;
  readonly end: Vec;
  readonly roomName: (index: number) => string;
}

/** Shortest Room separator (mm). */
export const MIN_SEPARATOR_LENGTH = 100;
/** How close (mm) an end must be to a Wall face. */
const ON_FACE = 1;

export const drawRoomSeparator: Command<DrawRoomSeparatorArgs> = (model, args, context) => {
  if (!model.levels[args.level])
    return refuse(message('invariants.missingReference', { what: 'level', id: args.level }));
  if (distance(args.start, args.end) < MIN_SEPARATOR_LENGTH) {
    return refuse(message('commands.separator.tooShort', { min: MIN_SEPARATOR_LENGTH }));
  }
  const geometry = levelGeometry(model, args.level);
  const wallAt = (p: Vec): WallId | null => {
    for (const [id, outline] of geometry.outlines) {
      if (wallFaces(outline).some(([a, b]) => distanceToSegment(p, a, b) <= ON_FACE)) return id;
    }
    return null;
  };
  const startWall = wallAt(args.start);
  const endWall = wallAt(args.end);
  if (!startWall || !endWall) return refuse(message('commands.separator.notOnWalls'));

  const separator: RoomSeparator = {
    id: context.ids('roomSeparators') as RoomSeparatorId,
    level: args.level,
    start: args.start,
    end: args.end,
    startWall,
    endWall,
  };
  let next = put(model, 'roomSeparators', separator);
  next = reseatSeeds(model, next, args.level);
  next = roomsForNewAreas(
    model,
    next,
    args.level,
    (area) => area.outline.some((p) => distanceToSegment(p, args.start, args.end) <= ON_FACE),
    args.roomName,
    context,
  );
  return { ok: true, model: next, label: message('commands.separator.label') };
};
