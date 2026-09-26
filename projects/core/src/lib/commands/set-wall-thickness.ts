/**
 * SetWallThickness: a Wall's thickness override, or back to the Preset (Slice 1 spec, "Push").
 * The face that grows moves outward and pushes what is in front of it, so Room sizes are kept.
 */
import { wallNormal, wallThickness } from '../geometry/wall-outlines';
import { scale } from '../geometry/vec';
import { message } from '../model/message';
import type { Model, Wall, WallId } from '../model/types';
import { refuse, type Command } from './command';
import { faceToward, push, type PushResult } from './push';
import { reseatSeeds } from './seeds';

export interface SetWallThicknessArgs {
  readonly wall: WallId;
  /** mm; null = follow the wall-thickness Preset again */
  readonly thickness: number | null;
}

export const setWallThickness: Command<SetWallThicknessArgs> = (model, args) => {
  const wall = model.walls[args.wall];
  if (!wall) return refuse(message('invariants.missingReference', { what: 'wall', id: args.wall }));
  if (args.thickness !== null && !(args.thickness > 0))
    return refuse(message('commands.thickness.bad'));
  const result = changeThickness(model, wall, args.thickness, model.project.presets.wallThickness);
  if (!result.ok) return result;
  return {
    ok: true,
    model: reseatSeeds(model, result.model, wall.level),
    label: message('commands.thickness.label'),
  };
};

/**
 * Changes one Wall's thickness (a value, or null to follow `preset`), pushing what is in front of
 * the face that moves. `preset` is the Preset thickness the Wall will follow afterwards.
 */
export function changeThickness(
  model: Model,
  wall: Wall,
  thickness: number | null,
  preset: number,
): PushResult {
  const before = wallThickness(wall, model.project.presets.wallThickness);
  const after = thickness ?? preset;
  const delta = after - before;
  const { thickness: _old, ...rest } = wall;
  const updated: Wall = thickness === null ? rest : { ...rest, thickness };
  let next: Model = { ...model, walls: { ...model.walls, [wall.id]: updated } };
  if (delta === 0) return { ok: true, model: next };

  const n = wallNormal(wall);
  // Which faces move: 'right' grows along +n, 'left' along −n, 'centre' half each way.
  const moves =
    wall.side === 'right'
      ? [{ direction: n, amount: delta }]
      : wall.side === 'left'
        ? [{ direction: scale(n, -1), amount: delta }]
        : [
            { direction: n, amount: delta / 2 },
            { direction: scale(n, -1), amount: delta / 2 },
          ];
  for (const { direction, amount } of moves) {
    const result = push(next, {
      level: wall.level,
      facePoint: faceToward(wall, direction, model.project.presets.wallThickness),
      direction,
      amount,
      from: wall.id,
    });
    if (!result.ok) return result;
    next = result.model;
  }
  return { ok: true, model: next };
}
