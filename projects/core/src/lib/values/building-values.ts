/**
 * Derived values of the building (ADR 0003): lazy, cached, named, and recalculated only when
 * something they read has changed.
 *
 * Granularity: per Level for topology (joined outlines, merged footprint, Rooms), per element
 * for simple values. A Level's Source-data slice compares its elements by reference, so an edit
 * on another Level yields an equal slice and nothing downstream is recalculated.
 */
import { derived, type Derived } from '../reactive';
import { message, type Message } from '../model/message';
import { footprint, type Footprint, type RoomDetection } from '../geometry/footprint';
import { wallOutlines, type WallOutline } from '../geometry/wall-outlines';
import { levelRoomSurfaces, type RoomSurfaces, type SurfaceInput } from './surfaces';
import type {
  Ceiling,
  Level,
  LevelId,
  Model,
  Opening,
  Presets,
  Room,
  RoomId,
  Vec,
  RoomSeparator,
  Wall,
  WallConnection,
  WallId,
} from '../model/types';

/** Everything on one Level that its geometry depends on. */
export interface LevelSlice {
  readonly level: Level | undefined;
  readonly presets: Presets;
  readonly walls: readonly Wall[];
  readonly connections: readonly WallConnection[];
  readonly separators: readonly RoomSeparator[];
  readonly rooms: readonly Room[];
  readonly openings: readonly Opening[];
  readonly ceilings: readonly Ceiling[];
}

const byId = (a: { id: string }, b: { id: string }) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
const sameList = (a: readonly unknown[], b: readonly unknown[]) =>
  a.length === b.length && a.every((x, i) => x === b[i]);
const sameSlice = (a: LevelSlice, b: LevelSlice) =>
  a.level === b.level &&
  a.presets === b.presets &&
  sameList(a.walls, b.walls) &&
  sameList(a.connections, b.connections) &&
  sameList(a.separators, b.separators) &&
  sameList(a.rooms, b.rooms) &&
  sameList(a.openings, b.openings) &&
  sameList(a.ceilings, b.ceilings);

/** Where a Level sits in the stack (all mm, absolute heights). */
export interface LevelHeights {
  readonly order: number;
  /** Finished floor level at the Floor-build-up Preset (the Level's elevation) */
  readonly elevation: number;
  readonly storeyHeight: number;
  /** Top of this Level's Slab: elevation − Floor-build-up Preset */
  readonly slabTop: number;
  readonly slabThickness: number;
  /** The Level above in the same Building, if any */
  readonly above: LevelId | null;
}

const sameHeights = (
  a: ReadonlyMap<LevelId, LevelHeights>,
  b: ReadonlyMap<LevelId, LevelHeights>,
) =>
  a.size === b.size &&
  [...a].every(([id, x]) => {
    const y = b.get(id);
    return (
      !!y &&
      x.order === y.order &&
      x.elevation === y.elevation &&
      x.storeyHeight === y.storeyHeight &&
      x.slabTop === y.slabTop &&
      x.slabThickness === y.slabThickness &&
      x.above === y.above
    );
  });

export interface SlabValues {
  /** mm */
  readonly thickness: Derived<number>;
  /** The outer faces of the Level's merged footprint */
  readonly outline: Derived<readonly (readonly Vec[])[]>;
  /** mm² */
  readonly area: Derived<number>;
}

export interface LevelValues {
  readonly slice: Derived<LevelSlice>;
  readonly outlines: Derived<ReadonlyMap<WallId, WallOutline>>;
  readonly footprint: Derived<Footprint>;
  /** mm², inside the outer faces of the merged footprint */
  readonly grossArea: Derived<number>;
  /** mm², the Net floor areas of the enclosed areas that hold Rooms */
  readonly netFloorArea: Derived<number>;
  /** The surfaces around each enclosed Room (a door's reveals are shared, hence per Level). */
  readonly roomSurfaces: Derived<ReadonlyMap<RoomId, RoomSurfaces>>;
  /** Things to fix: Rooms not enclosed or sharing one area, Wall ends connected to nothing. */
  readonly warnings: Derived<readonly Message[]>;
}

/** One face of a Wall: its length, and its area gross (face length × Wall height) and net of Openings. */
export interface FaceValues {
  /** mm */
  readonly length: number;
  /** mm² */
  readonly gross: number;
  /** mm² */
  readonly net: number;
}

export interface WallValues {
  readonly wall: Derived<Wall | undefined>;
  /** mm: the Wall's own height, or the Level's storey height */
  readonly height: Derived<number>;
  /** The face along the drawn Baseline, and the other face (undefined when the Wall is gone). */
  readonly faces: Derived<{ readonly drawn: FaceValues; readonly other: FaceValues } | undefined>;
}

export interface RoomValues {
  readonly room: Derived<Room | undefined>;
  readonly detection: Derived<RoomDetection | undefined>;
  /** mm², or null when the Room is not enclosed */
  readonly netFloorArea: Derived<number | null>;
  /** mm: the Room's own height, or the Preset */
  readonly height: Derived<number>;
  /** mm: the Room's own Floor build-up, or the Preset */
  readonly floorBuildUp: Derived<number>;
  /** mm, absolute: top of the Floor build-up (the Room height is measured from here) */
  readonly floorTop: Derived<number>;
  /** mm, absolute: floorTop + Room height */
  readonly ceilingUnderside: Derived<number>;
  /** mm, between the top of the Ceiling and the underside of the Slab above; null without a Level above */
  readonly ceilingVoid: Derived<number | null>;
  /** mm³: Net floor area × Room height */
  readonly volume: Derived<number | null>;
  /** mm² (= Net floor area in Slice 1) */
  readonly floorFinishArea: Derived<number | null>;
  /** mm² (= Net floor area in Slice 1) */
  readonly ceilingArea: Derived<number | null>;
  /** Wall perimeter, Openings and reveals; null when the Room is not enclosed */
  readonly surfaces: Derived<RoomSurfaces | null>;
}

export class BuildingValues {
  private readonly levels = new Map<LevelId, LevelValues>();
  private readonly rooms = new Map<RoomId, RoomValues>();
  private readonly walls = new Map<WallId, WallValues>();
  private readonly slabs = new Map<LevelId, SlabValues>();

  /** Every Level's place in its Building's stack; unchanged unless Levels, Slabs or Presets change. */
  readonly levelHeights: Derived<ReadonlyMap<LevelId, LevelHeights>> = derived(
    'Level stack',
    () => {
      const m = this.model();
      const result = new Map<LevelId, LevelHeights>();
      const buildUp = m.project.presets.floorBuildUp;
      for (const building of Object.values(m.buildings)) {
        const stack = Object.values(m.levels)
          .filter((l) => l.building === building.id)
          .sort((a, b) => a.order - b.order);
        let elevation = building.baseElevation;
        stack.forEach((level, i) => {
          const slab = Object.values(m.slabs).find((s) => s.level === level.id);
          result.set(level.id, {
            order: level.order,
            elevation,
            storeyHeight: level.storeyHeight,
            slabTop: elevation - buildUp,
            slabThickness: slab?.thickness ?? m.project.presets.slabThickness,
            above: stack[i + 1]?.id ?? null,
          });
          elevation += level.storeyHeight;
        });
      }
      return result;
    },
    sameHeights,
  );

  slab(level: LevelId): SlabValues {
    let values = this.slabs.get(level);
    if (!values) {
      const lv = this.level(level);
      values = {
        thickness: derived(
          `${level} · Slab thickness`,
          () => this.levelHeights().get(level)?.slabThickness ?? 0,
        ),
        outline: derived(`${level} · Slab outline`, () => lv.footprint().outer),
        area: derived(`${level} · Slab area`, () => lv.grossArea()),
      };
      this.slabs.set(level, values);
    }
    return values;
  }

  constructor(private readonly model: () => Model) {}

  level(id: LevelId): LevelValues {
    let values = this.levels.get(id);
    if (!values) {
      values = this.createLevel(id);
      this.levels.set(id, values);
    }
    return values;
  }

  wall(id: WallId): WallValues {
    let values = this.walls.get(id);
    if (!values) {
      values = this.createWall(id);
      this.walls.set(id, values);
    }
    return values;
  }

  room(id: RoomId): RoomValues {
    let values = this.rooms.get(id);
    if (!values) {
      values = this.createRoom(id);
      this.rooms.set(id, values);
    }
    return values;
  }

  private levelName(id: LevelId) {
    return () => this.model().levels[id]?.name ?? id;
  }

  private createLevel(id: LevelId): LevelValues {
    const name = this.levelName(id);
    const slice = derived(
      () => `${name()} · Source data`,
      (): LevelSlice => {
        const m = this.model();
        const walls = Object.values(m.walls)
          .filter((w) => w.level === id)
          .sort(byId);
        const wallIds = new Set<string>(walls.map((w) => w.id));
        return {
          level: m.levels[id],
          presets: m.project.presets,
          walls,
          connections: Object.values(m.wallConnections)
            .filter((c) => wallIds.has(c.wall))
            .sort(byId),
          separators: Object.values(m.roomSeparators)
            .filter((s) => s.level === id)
            .sort(byId),
          rooms: Object.values(m.rooms)
            .filter((r) => r.level === id)
            .sort(byId),
          openings: Object.values(m.openings)
            .filter((o) => wallIds.has(o.wall))
            .sort(byId),
          ceilings: Object.values(m.ceilings)
            .filter((c) => m.rooms[c.room]?.level === id)
            .sort(byId),
        };
      },
      sameSlice,
    );
    const outlines = derived(
      () => `${name()} · joined Wall outlines`,
      () => {
        const s = slice();
        return wallOutlines(s.walls, s.connections, s.presets.wallThickness);
      },
    );
    const fp = derived(
      () => `${name()} · merged footprint`,
      () => {
        const s = slice();
        const all = outlines();
        return footprint({
          outlines: s.walls
            .filter((w) => w.roomBounding)
            .flatMap((w) => (all.has(w.id) ? [all.get(w.id)!] : [])),
          separators: s.separators,
          seeds: s.rooms.map((r) => ({ room: r.id, seed: r.seed })),
        });
      },
    );
    const grossArea = derived(
      () => `${name()} · Gross floor area`,
      () => fp().grossArea,
    );
    const netFloorArea = derived(
      () => `${name()} · Net floor area`,
      () => fp().areas.reduce((sum, a) => (a.rooms.length ? sum + a.area : sum), 0),
    );
    const roomSurfaces = derived(
      () => `${name()} · Room surfaces`,
      () => {
        const s = slice();
        const f = fp();
        const rooms = new Map<RoomId, SurfaceInput>();
        for (const r of s.rooms) {
          const d = f.rooms.get(r.id);
          if (!d || d.status === 'notEnclosed') continue;
          rooms.set(r.id, {
            rings: [d.area.outline, ...d.area.islands],
            height: r.height ?? s.presets.roomHeight,
          });
        }
        return levelRoomSurfaces(rooms, s.walls, outlines(), s.separators, s.openings);
      },
    );
    const warnings = derived(
      () => `${name()} · warnings`,
      (): readonly Message[] => {
        const s = slice();
        const f = fp();
        const out: Message[] = [];
        const names = new Map(s.rooms.map((r) => [r.id as string, r.name]));
        const reported = new Set<string>();
        for (const room of s.rooms) {
          const d = f.rooms.get(room.id);
          if (!d || d.status === 'notEnclosed') {
            out.push(message('warnings.notEnclosed', { room: room.name }));
          } else if (d.status === 'sharingArea' && !reported.has(room.id)) {
            const group = [room.id, ...d.others];
            group.forEach((id) => reported.add(id));
            out.push(
              message('warnings.sharingArea', {
                rooms: group.map((id) => names.get(id) ?? id).join(', '),
              }),
            );
          }
        }
        const connected = new Set<string>();
        for (const c of s.connections) {
          connected.add(`${c.wall}:${c.end}`);
          if (c.kind === 'corner') connected.add(`${c.to}:${c.toEnd}`);
        }
        const open = s.walls.reduce(
          (n, w) =>
            n + (connected.has(`${w.id}:start`) ? 0 : 1) + (connected.has(`${w.id}:end`) ? 0 : 1),
          0,
        );
        if (open) out.push(message('warnings.unconnectedEnds', { count: open }));
        // A Ceiling running into the Slab above: a warning, never a refusal.
        const heights = this.levelHeights();
        const here = heights.get(id);
        const above = here?.above ? heights.get(here.above) : undefined;
        if (here && above) {
          const slabBottom = above.slabTop - above.slabThickness;
          for (const room of s.rooms) {
            const top =
              here.slabTop +
              (room.floorBuildUp ?? s.presets.floorBuildUp) +
              (room.height ?? s.presets.roomHeight) +
              (s.ceilings.find((c) => c.room === room.id)?.thickness ?? s.presets.ceilingThickness);
            if (top > slabBottom + 0.5)
              out.push(
                message('warnings.ceilingIntoSlab', {
                  room: room.name,
                  mm: Math.round(top - slabBottom),
                }),
              );
          }
        }
        return out;
      },
    );
    return { slice, outlines, footprint: fp, grossArea, netFloorArea, roomSurfaces, warnings };
  }

  private createWall(id: WallId): WallValues {
    const wall = derived(`${id} · Source data`, () => this.model().walls[id]);
    const height = derived(`${id} · Wall height`, () => {
      const w = wall();
      return w ? (w.height ?? this.model().levels[w.level]?.storeyHeight ?? 0) : 0;
    });
    const faces = derived(`${id} · faces`, () => {
      const w = wall();
      if (!w) return undefined;
      const level = this.level(w.level);
      const outline = level.outlines().get(id);
      if (!outline) return undefined;
      const h = height();
      const openings = level
        .slice()
        .openings.filter((o) => o.wall === id)
        .reduce((sum, o) => sum + o.width * Math.max(0, Math.min(o.height, h - o.sill)), 0);
      const face = (a: { x: number; y: number }, b: { x: number; y: number }): FaceValues => {
        const length = Math.hypot(b.x - a.x, b.y - a.y);
        return { length, gross: length * h, net: length * h - openings };
      };
      const lo = face(outline[0], outline[1]);
      const hi = face(outline[3], outline[2]);
      // The drawn face is the one on the Baseline: 'right' → low (offset 0), 'left' → high.
      return w.side === 'left' ? { drawn: hi, other: lo } : { drawn: lo, other: hi };
    });
    return { wall, height, faces };
  }

  private createRoom(id: RoomId): RoomValues {
    const name = () => this.model().rooms[id]?.name ?? id;
    const room = derived(
      () => `${name()} · Source data`,
      () => this.model().rooms[id],
    );
    const detection = derived(
      () => `${name()} · outline`,
      () => {
        const r = room();
        return r ? this.level(r.level).footprint().rooms.get(id) : undefined;
      },
    );
    const netFloorArea = derived(
      () => `${name()} · Net floor area`,
      () => {
        const d = detection();
        return d && d.status !== 'notEnclosed' ? d.area.area : null;
      },
    );
    const height = derived(
      () => `${name()} · Room height`,
      () => room()?.height ?? this.model().project.presets.roomHeight,
    );
    const floorBuildUp = derived(
      () => `${name()} · Floor build-up`,
      () => room()?.floorBuildUp ?? this.model().project.presets.floorBuildUp,
    );
    const floorTop = derived(
      () => `${name()} · floor level`,
      () => {
        const r = room();
        const slabTop = r ? (this.levelHeights().get(r.level)?.slabTop ?? 0) : 0;
        return slabTop + floorBuildUp();
      },
    );
    const ceilingUnderside = derived(
      () => `${name()} · Ceiling level`,
      () => floorTop() + height(),
    );
    const ceilingVoid = derived(
      () => `${name()} · Ceiling void`,
      () => {
        const r = room();
        if (!r) return null;
        const heights = this.levelHeights();
        const above = heights.get(heights.get(r.level)?.above ?? ('' as LevelId));
        if (!above) return null;
        const m = this.model();
        const ceiling = Object.values(m.ceilings).find((c) => c.room === id);
        const thickness = ceiling?.thickness ?? m.project.presets.ceilingThickness;
        return above.slabTop - above.slabThickness - (ceilingUnderside() + thickness);
      },
    );
    const volume = derived(
      () => `${name()} · volume`,
      () => {
        const area = netFloorArea();
        return area === null ? null : area * height();
      },
    );
    const surfaces = derived(
      () => `${name()} · surfaces`,
      () => {
        const r = room();
        return (r && this.level(r.level).roomSurfaces().get(id)) ?? null;
      },
    );
    return {
      room,
      detection,
      netFloorArea,
      height,
      floorBuildUp,
      floorTop,
      ceilingUnderside,
      ceilingVoid,
      volume,
      floorFinishArea: netFloorArea,
      ceilingArea: netFloorArea,
      surfaces,
    };
  }
}
