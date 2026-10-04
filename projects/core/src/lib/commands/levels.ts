/**
 * Levels and their Slabs (Slice 1 spec, "Levels"). Levels are stacked: only the lowest Level's
 * elevation is stored (the Building's base elevation); every other elevation follows from the
 * storey heights below it, so Levels never overlap or leave gaps.
 */
import { put, remove } from '../model/edit';
import { message } from '../model/message';
import { levelsInOrder, neighbourLevels } from '../model/levels';
import { defaultStoreyHeight } from '../model/new-project';
import type { Level, LevelId, Slab, SlabId } from '../model/types';
import { refuse, type Command } from './command';

export interface AddLevelArgs {
  readonly relativeTo: LevelId;
  readonly position: 'above' | 'below';
  readonly name: string;
  /** mm, floor to floor; absent = what the Presets need (build-up + Room + Ceiling + Slab) */
  readonly storeyHeight?: number;
}

/**
 * AddLevel: a new Level (with its Slab) above or below another. A Level added below the lowest
 * keeps every existing Level where it is; one added in between lifts the Levels above it.
 */
export const addLevel: Command<AddLevelArgs> = (model, args, { ids }) => {
  const ref = model.levels[args.relativeTo];
  if (!ref)
    return refuse(message('invariants.missingReference', { what: 'level', id: args.relativeTo }));
  if (!args.name.trim()) return refuse(message('commands.level.emptyName'));
  const storeyHeight = args.storeyHeight ?? defaultStoreyHeight(model.project.presets);
  if (!(storeyHeight > 0)) return refuse(message('commands.level.badStoreyHeight'));
  const stack = levelsInOrder(model, ref.building);
  const order = args.position === 'above' ? ref.order + 1 : ref.order;
  let next = model;
  for (const l of stack)
    if (l.order >= order) next = put(next, 'levels', { ...l, order: l.order + 1 });
  const level: Level = {
    id: ids('levels') as LevelId,
    building: ref.building,
    name: args.name.trim(),
    order,
    storeyHeight,
  };
  const slab: Slab = { id: ids('slabs') as SlabId, level: level.id };
  next = put(put(next, 'levels', level), 'slabs', slab);
  if (args.position === 'below' && ref.order === stack[0]!.order) {
    const building = next.buildings[ref.building]!;
    next = put(next, 'buildings', {
      ...building,
      baseElevation: building.baseElevation - storeyHeight,
    });
  }
  return { ok: true, model: next, label: message('commands.level.add', { name: level.name }) };
};

export interface UpdateLevelArgs {
  readonly level: LevelId;
  readonly name?: string;
  /** mm, floor to floor: the Levels above move with it */
  readonly storeyHeight?: number;
  /** mm, finished floor level: only for the lowest Level (the others are derived) */
  readonly elevation?: number;
}

export const updateLevel: Command<UpdateLevelArgs> = (model, args) => {
  const level = model.levels[args.level];
  if (!level)
    return refuse(message('invariants.missingReference', { what: 'level', id: args.level }));
  if (args.name !== undefined && !args.name.trim())
    return refuse(message('commands.level.emptyName'));
  if (args.storeyHeight !== undefined && !(args.storeyHeight > 0))
    return refuse(message('commands.level.badStoreyHeight'));
  let next = put(model, 'levels', {
    ...level,
    name: args.name?.trim() ?? level.name,
    storeyHeight: args.storeyHeight ?? level.storeyHeight,
  });
  if (args.elevation !== undefined) {
    if (levelsInOrder(model, level.building)[0]!.id !== level.id)
      return refuse(message('commands.level.elevationDerived'));
    const building = model.buildings[level.building]!;
    next = put(next, 'buildings', { ...building, baseElevation: args.elevation });
  }
  return { ok: true, model: next, label: message('commands.level.update', { name: level.name }) };
};

export interface UpdateSlabArgs {
  readonly level: LevelId;
  /** mm; null = follow the Slab-thickness Preset again */
  readonly thickness: number | null;
}

export const updateSlab: Command<UpdateSlabArgs> = (model, args) => {
  const slab = Object.values(model.slabs).find((s) => s.level === args.level);
  if (!slab)
    return refuse(message('invariants.missingReference', { what: 'slab', id: args.level }));
  if (args.thickness !== null && !(args.thickness > 0))
    return refuse(message('commands.level.badSlab'));
  const { thickness: _old, ...rest } = slab;
  const next: Slab = args.thickness === null ? rest : { ...rest, thickness: args.thickness };
  return { ok: true, model: put(model, 'slabs', next), label: message('commands.level.slab') };
};

export interface DeleteLevelArgs {
  readonly level: LevelId;
}

/** DeleteLevel: the Level and everything on it; the Levels above move down. Never the last one. */
export const deleteLevel: Command<DeleteLevelArgs> = (model, args) => {
  const level = model.levels[args.level];
  if (!level)
    return refuse(message('invariants.missingReference', { what: 'level', id: args.level }));
  const stack = levelsInOrder(model, level.building);
  if (stack.length === 1) return refuse(message('commands.level.lastLevel'));
  const walls = new Set<string>(
    Object.values(model.walls)
      .filter((w) => w.level === level.id)
      .map((w) => w.id),
  );
  const rooms = new Set<string>(
    Object.values(model.rooms)
      .filter((r) => r.level === level.id)
      .map((r) => r.id),
  );
  const ids = <T extends { id: string }>(items: Record<string, T>, keep: (x: T) => boolean) =>
    Object.values(items)
      .filter((x) => !keep(x))
      .map((x) => x.id);
  let next = remove(model, 'walls', [...walls]);
  next = remove(
    next,
    'wallConnections',
    ids(model.wallConnections, (c) => !walls.has(c.wall) && !walls.has(c.to)),
  );
  next = remove(
    next,
    'openings',
    ids(model.openings, (o) => !walls.has(o.wall)),
  );
  next = remove(
    next,
    'roomSeparators',
    ids(model.roomSeparators, (s) => s.level !== level.id),
  );
  next = remove(next, 'rooms', [...rooms]);
  next = remove(
    next,
    'ceilings',
    ids(model.ceilings, (c) => !rooms.has(c.room)),
  );
  next = remove(
    next,
    'slabs',
    ids(model.slabs, (s) => s.level !== level.id),
  );
  // A Floor opening connects its Level with the one below: it goes with either.
  const { above } = neighbourLevels(model, level.id);
  next = remove(
    next,
    'floorOpenings',
    ids(model.floorOpenings, (f) => f.level !== level.id && f.level !== above),
  );
  next = remove(next, 'levels', [level.id]);
  for (const l of stack)
    if (l.order > level.order) next = put(next, 'levels', { ...l, order: l.order - 1 });
  if (stack[0]!.id === level.id) {
    // The lowest Level goes: the next one keeps its elevation.
    const building = next.buildings[level.building]!;
    next = put(next, 'buildings', {
      ...building,
      baseElevation: building.baseElevation + level.storeyHeight,
    });
  }
  return { ok: true, model: next, label: message('commands.level.delete', { name: level.name }) };
};
