/**
 * Source data of the building model (Domain model v1, ADR 0001, ADR 0002, ADR 0004).
 *
 * Plan coordinates are in millimetres: x to the right, y downwards (as on screen).
 * Everything here is what the user states; nothing here is derived.
 */

declare const kind: unique symbol;
/** A stable identifier, typed per element kind (a WallId is never a RoomId). */
import type { OpeningDesign } from './opening-parts';

export type Id<K extends string> = string & { readonly [kind]: K };

export type ProjectId = Id<'project'>;
export type BuildingId = Id<'building'>;
export type LevelId = Id<'level'>;
export type WallId = Id<'wall'>;
export type WallConnectionId = Id<'wallConnection'>;
export type OpeningId = Id<'opening'>;
export type OpeningFamilyId = Id<'openingFamily'>;
export type OpeningTypeId = Id<'openingType'>;
export type RoomId = Id<'room'>;
export type RoomSeparatorId = Id<'roomSeparator'>;
export type SlabId = Id<'slab'>;
export type CeilingId = Id<'ceiling'>;
export type FloorOpeningId = Id<'floorOpening'>;

export interface Vec {
  readonly x: number;
  readonly y: number;
}

/**
 * Which side of the Baseline the thickness sits on, seen along the Baseline from start to end.
 * With y downwards, 'right' is the side of the normal (-dy, dx).
 */
export type WallSide = 'left' | 'centre' | 'right';
export type WallEnd = 'start' | 'end';

export interface Presets {
  /** mm */
  readonly wallThickness: number;
  /** mm */
  readonly slabThickness: number;
  /** mm, Floor build-up (insulation + screed + Floor finish) */
  readonly floorBuildUp: number;
  /** mm, floor to ceiling */
  readonly roomHeight: number;
  /** mm */
  readonly ceilingThickness: number;
  readonly doorWidth: number;
  readonly doorHeight: number;
  readonly windowWidth: number;
  readonly windowHeight: number;
  readonly windowSill: number;
}

export interface Project {
  readonly id: ProjectId;
  readonly name: string;
  readonly presets: Presets;
}

export interface Building {
  readonly id: BuildingId;
  readonly name: string;
  /** mm, finished floor level of the lowest Level (Levels are stacked). */
  readonly baseElevation: number;
}

export interface Level {
  readonly id: LevelId;
  readonly building: BuildingId;
  readonly name: string;
  /** Position in the stack, lowest first. */
  readonly order: number;
  /** mm, floor-to-floor */
  readonly storeyHeight: number;
}

export interface Wall {
  readonly id: WallId;
  readonly level: LevelId;
  readonly start: Vec;
  readonly end: Vec;
  readonly side: WallSide;
  /** mm; absent = follows the wall-thickness Preset */
  readonly thickness?: number;
  /** mm; absent = follows the Level's storey height */
  readonly height?: number;
  /** Whether this Wall bounds Rooms (false for bar walls, islands, low dividers). */
  readonly roomBounding: boolean;
  /** Its ends connected to nothing are Free ends, on purpose: no warning; absent = not stated */
  readonly freeEnds?: boolean;
}

/** A Wall end attached to another Wall's end (a corner) or to its face at a distance (a T). ADR 0001. */
export type WallConnection =
  | {
      readonly id: WallConnectionId;
      readonly wall: WallId;
      readonly end: WallEnd;
      readonly kind: 'corner';
      readonly to: WallId;
      readonly toEnd: WallEnd;
    }
  | {
      readonly id: WallConnectionId;
      readonly wall: WallId;
      readonly end: WallEnd;
      readonly kind: 'tee';
      readonly to: WallId;
      /** mm along the host Wall's Baseline, from its start */
      readonly at: number;
    };

/** A line with no physical form dividing an open area into Rooms; both ends sit on Wall faces. */
export interface RoomSeparator {
  readonly id: RoomSeparatorId;
  readonly level: LevelId;
  readonly start: Vec;
  readonly end: Vec;
  readonly startWall: WallId;
  readonly endWall: WallId;
}

export interface Room {
  readonly id: RoomId;
  readonly level: LevelId;
  readonly name: string;
  /** A point inside the Room: its outline is derived around it (ADR 0002). */
  readonly seed: Vec;
  /** mm, floor to ceiling; absent = Preset */
  readonly height?: number;
  /** mm; absent = Preset */
  readonly floorBuildUp?: number;
  readonly floorFinish?: string;
}

/** A door, a window, a plain wall opening (no frame, no leaf) or a garage door (ticket 17). */
export type OpeningKind = 'door' | 'window' | 'wallOpening' | 'garageDoor';

/**
 * A design of an Opening (ADR 0007), such as "interior door, single leaf". Its parts come with
 * ticket 19; for now a family is its kind. The built-in families have no name: the UI shows the
 * kind in the user's language.
 */
export interface OpeningFamily {
  readonly id: OpeningFamilyId;
  readonly kind: OpeningKind;
  readonly name?: string;
  /** Its parametric design (ticket 19); absent = its kind's default design */
  readonly design?: OpeningDesign;
}

/**
 * A named set of sizes within an Opening family, such as "90 × 211". Without a name the UI shows
 * its sizes.
 */
export interface OpeningType {
  readonly id: OpeningTypeId;
  readonly family: OpeningFamilyId;
  readonly name?: string;
  /** mm */
  readonly width: number;
  /** mm */
  readonly height: number;
}

/**
 * An Opening placed in a Wall: an instance of an Opening type. It keeps what differs per
 * placement; its kind and sizes come from its type (see resolveOpening).
 */
export interface Opening {
  readonly id: OpeningId;
  readonly wall: WallId;
  readonly type: OpeningTypeId;
  /** mm along the host Wall's Baseline from its start to the Opening's near edge */
  readonly offset: number;
  /** mm above the finished floor */
  readonly sill: number;
  /** Doors: which jamb the hinges are on, seen along the Baseline, and which face it opens towards. */
  readonly hinge: 'start' | 'end';
  readonly swing: 'left' | 'right';
}

export interface Slab {
  readonly id: SlabId;
  readonly level: LevelId;
  /** mm; absent = Preset */
  readonly thickness?: number;
}

export interface Ceiling {
  readonly id: CeilingId;
  readonly room: RoomId;
  /** mm; absent = Preset */
  readonly thickness?: number;
}

/**
 * A hole through the Slabs between two Levels, for a stair or a lift. It goes through the floor of
 * its upper Level (and of any Level added in between) and shows in the Ceilings of its lower one.
 */
export interface FloorOpening {
  readonly id: FloorOpeningId;
  /** The upper Level it connects: the top Slab it goes through */
  readonly level: LevelId;
  /** The lower Level it connects: it shows in that Level's Ceilings */
  readonly below: LevelId;
  /** Its outline in plan (mm), at least three points */
  readonly outline: readonly Vec[];
}

/** The whole Source data of a project: flat collections keyed by ID (ADR 0004). */
export interface Model {
  readonly project: Project;
  readonly buildings: Readonly<Record<string, Building>>;
  readonly levels: Readonly<Record<string, Level>>;
  readonly walls: Readonly<Record<string, Wall>>;
  readonly wallConnections: Readonly<Record<string, WallConnection>>;
  readonly openingFamilies: Readonly<Record<string, OpeningFamily>>;
  readonly openingTypes: Readonly<Record<string, OpeningType>>;
  readonly openings: Readonly<Record<string, Opening>>;
  readonly rooms: Readonly<Record<string, Room>>;
  readonly roomSeparators: Readonly<Record<string, RoomSeparator>>;
  readonly slabs: Readonly<Record<string, Slab>>;
  readonly ceilings: Readonly<Record<string, Ceiling>>;
  readonly floorOpenings: Readonly<Record<string, FloorOpening>>;
}

export type CollectionName = Exclude<keyof Model, 'project'>;
