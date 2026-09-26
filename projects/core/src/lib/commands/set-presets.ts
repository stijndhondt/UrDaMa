/**
 * SetPresets: the project Presets panel. Elements without an override follow a Preset live; a new
 * wall thickness pushes each following Wall's growing face out, so Room sizes are kept.
 */
import { message } from '../model/message';
import type { Model, Presets } from '../model/types';
import { refuse, type Command } from './command';
import { changeThickness } from './set-wall-thickness';
import { reseatSeeds } from './seeds';

export type SetPresetsArgs = Partial<Presets>;

export const setPresets: Command<SetPresetsArgs> = (model, args) => {
  const entries = Object.entries(args).filter(([, v]) => v !== undefined) as [
    keyof Presets,
    number,
  ][];
  if (!entries.length) return refuse(message('commands.presets.nothing'));
  if (
    entries.some(([key, v]) => !(v > 0) && key !== 'windowSill') ||
    entries.some(([, v]) => v < 0)
  ) {
    return refuse(message('commands.presets.bad'));
  }
  let next: Model = model;
  const newThickness = args.wallThickness;
  if (newThickness !== undefined && newThickness !== model.project.presets.wallThickness) {
    // Push each Wall that follows the Preset, one by one, against the model as it now stands.
    const following = Object.values(model.walls)
      .filter((w) => w.thickness === undefined)
      .sort((a, b) => (a.id < b.id ? -1 : 1))
      .map((w) => w.id);
    for (const id of following) {
      const wall = next.walls[id]!;
      const result = changeThickness(next, wall, newThickness, newThickness);
      if (!result.ok) return result;
      // The Wall keeps following the Preset; the Preset itself changes below.
      const pushed = result.model;
      next = {
        ...pushed,
        walls: { ...pushed.walls, [id]: { ...pushed.walls[id]!, thickness: newThickness } },
      };
    }
    // Back to "follows the Preset" for every Wall that did.
    const walls = { ...next.walls };
    for (const id of following) {
      const { thickness: _t, ...rest } = walls[id]!;
      walls[id] = rest;
    }
    next = { ...next, walls };
  }
  next = { ...next, project: { ...next.project, presets: { ...next.project.presets, ...args } } };
  for (const level of Object.keys(next.levels)) next = reseatSeeds(model, next, level as never);
  return { ok: true, model: next, label: message('commands.presets.label') };
};
