import type { IdGenerator } from './ids';
import { builtInOpenings } from './opening-types';
import type {
  Building,
  BuildingId,
  Level,
  LevelId,
  Model,
  Presets,
  ProjectId,
  Slab,
  SlabId,
} from './types';

export const DEFAULT_PRESETS: Presets = {
  wallThickness: 140,
  slabThickness: 200,
  floorBuildUp: 120,
  roomHeight: 2600,
  ceilingThickness: 15,
  doorWidth: 930,
  doorHeight: 2115,
  windowWidth: 1200,
  windowHeight: 1200,
  windowSill: 900,
};

export interface NewProjectOptions {
  readonly name: string;
  /** The first Level's name, in the user's language (e.g. "Ground floor", "Gelijkvloers"). */
  readonly levelName: string;
  readonly wallThickness?: number;
  readonly roomHeight?: number;
}

/** Storey height that fits a Room of the given height: floor build-up + Room + Ceiling + Slab above. */
export const defaultStoreyHeight = (p: Presets): number =>
  p.floorBuildUp + p.roomHeight + p.ceilingThickness + p.slabThickness;

/**
 * A new project: one Building with one Level ("Ground floor") at elevation 0, and its Slab, plus
 * the built-in door and window families with a default type each.
 */
export function createProject(options: NewProjectOptions, ids: IdGenerator): Model {
  const presets: Presets = {
    ...DEFAULT_PRESETS,
    wallThickness: options.wallThickness ?? DEFAULT_PRESETS.wallThickness,
    roomHeight: options.roomHeight ?? DEFAULT_PRESETS.roomHeight,
  };
  const building: Building = {
    id: ids('buildings') as BuildingId,
    name: options.name,
    baseElevation: 0,
  };
  const level: Level = {
    id: ids('levels') as LevelId,
    building: building.id,
    name: options.levelName,
    order: 0,
    storeyHeight: defaultStoreyHeight(presets),
  };
  const slab: Slab = { id: ids('slabs') as SlabId, level: level.id };
  return {
    project: { id: ids('project') as ProjectId, name: options.name, presets },
    buildings: { [building.id]: building },
    levels: { [level.id]: level },
    walls: {},
    wallConnections: {},
    ...builtInOpenings(presets, ids),
    openings: {},
    rooms: {},
    roomSeparators: {},
    slabs: { [slab.id]: slab },
    ceilings: {},
    floorOpenings: {},
  };
}
