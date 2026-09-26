/**
 * ResizeRoom: re-typing a Room's measured inside width or depth (Slice 1 spec, "Resizing a Room").
 * The Wall(s) on the chosen side move by the difference and push what is in front of them, so
 * every other Room keeps its size. Only rectangular, axis-aligned Rooms can be resized this way.
 */
import { levelGeometry, wallFaces } from '../geometry/level-geometry';
import { distanceToSegment } from '../geometry/polygon';
import { message } from '../model/message';
import type { RoomId, Vec, WallId } from '../model/types';
import { refuse, type Command } from './command';
import { faceToward, push } from './push';
import { reseatSeeds } from './seeds';

export interface ResizeRoomArgs {
  readonly room: RoomId;
  /** 'x' = width (left–right on the plan), 'y' = depth (top–bottom). */
  readonly axis: 'x' | 'y';
  /** The new inside size (mm). */
  readonly size: number;
  /** Which side moves: 'min' = left / top, 'max' = right / bottom. */
  readonly side: 'min' | 'max';
}

const ON = 0.5;

export const resizeRoom: Command<ResizeRoomArgs> = (model, args) => {
  const room = model.rooms[args.room];
  if (!room) return refuse(message('invariants.missingReference', { what: 'room', id: args.room }));
  if (!(args.size > 0)) return refuse(message('commands.resizeRoom.bad'));
  const geometry = levelGeometry(model, room.level);
  const detection = geometry.footprint.rooms.get(room.id);
  if (!detection || detection.status !== 'enclosed')
    return refuse(message('commands.resizeRoom.notEnclosed'));
  const rect = rectangle(detection.area.outline, detection.area.islands.length);
  if (!rect) return refuse(message('commands.resizeRoom.notRectangular'));

  const current = args.axis === 'x' ? rect.max.x - rect.min.x : rect.max.y - rect.min.y;
  const delta = args.size - current;
  if (Math.abs(delta) < 1e-6) return refuse(message('commands.resizeRoom.sameSize'));

  // The edge that moves, and the direction pointing away from the Room.
  const sign = args.side === 'max' ? 1 : -1;
  const direction: Vec = args.axis === 'x' ? { x: sign, y: 0 } : { x: 0, y: sign };
  const edge =
    args.axis === 'x'
      ? {
          a: { x: args.side === 'max' ? rect.max.x : rect.min.x, y: rect.min.y },
          b: { x: args.side === 'max' ? rect.max.x : rect.min.x, y: rect.max.y },
        }
      : {
          a: { x: rect.min.x, y: args.side === 'max' ? rect.max.y : rect.min.y },
          b: { x: rect.max.x, y: args.side === 'max' ? rect.max.y : rect.min.y },
        };
  const mid = { x: (edge.a.x + edge.b.x) / 2, y: (edge.a.y + edge.b.y) / 2 };

  // The Walls whose face runs along that edge bound the Room there.
  const bounding: WallId[] = [];
  for (const wall of geometry.walls) {
    const outline = geometry.outlines.get(wall.id);
    if (!outline || !wall.roomBounding) continue;
    if (
      wallFaces(outline).some(
        ([a, b]) =>
          distanceToSegment(mid, a, b) <= ON ||
          (distanceToSegment(edge.a, a, b) <= ON && distanceToSegment(edge.b, a, b) <= ON),
      )
    ) {
      bounding.push(wall.id);
    }
  }
  if (!bounding.length) return refuse(message('commands.resizeRoom.noWall'));

  const preset = model.project.presets.wallThickness;
  const result = push(model, {
    level: room.level,
    facePoint: faceToward(model.walls[bounding[0]!]!, { x: -direction.x, y: -direction.y }, preset),
    direction,
    amount: delta,
    from: bounding[0]!,
    rigid: bounding,
  });
  if (!result.ok) return result;
  return {
    ok: true,
    model: reseatSeeds(model, result.model, room.level),
    label: message('commands.resizeRoom.label', { name: room.name }),
  };
};

/** The bounding box of an axis-aligned rectangular outline, or null when it isn't one. */
function rectangle(outline: readonly Vec[], islands: number): { min: Vec; max: Vec } | null {
  if (islands) return null;
  const xs = outline.map((p) => p.x);
  const ys = outline.map((p) => p.y);
  const min = { x: Math.min(...xs), y: Math.min(...ys) };
  const max = { x: Math.max(...xs), y: Math.max(...ys) };
  const onBox = outline.every(
    (p) =>
      (Math.abs(p.x - min.x) <= ON || Math.abs(p.x - max.x) <= ON) &&
      (Math.abs(p.y - min.y) <= ON || Math.abs(p.y - max.y) <= ON),
  );
  return onBox ? { min, max } : null;
}
