/**
 * Derived values of the building (ADR 0003): lazy, cached, named, and recalculated only when
 * something they read has changed.
 *
 * Granularity: per Level for topology (joined outlines, merged footprint, Rooms), per element
 * for simple values. A Level's Source-data slice compares its elements by reference, so an edit
 * on another Level yields an equal slice and nothing downstream is recalculated.
 */
import { derived, type Derived } from '../reactive';
import { footprint, type Footprint, type RoomDetection } from '../geometry/footprint';
import { wallOutlines, type WallOutline } from '../geometry/wall-outlines';
import type {
  Level,
  LevelId,
  Model,
  Opening,
  Presets,
  Room,
  RoomId,
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
  sameList(a.openings, b.openings);

export interface LevelValues {
  readonly slice: Derived<LevelSlice>;
  readonly outlines: Derived<ReadonlyMap<WallId, WallOutline>>;
  readonly footprint: Derived<Footprint>;
  /** mm², inside the outer faces of the merged footprint */
  readonly grossArea: Derived<number>;
}

export interface RoomValues {
  readonly room: Derived<Room | undefined>;
  readonly detection: Derived<RoomDetection | undefined>;
  /** mm², or null when the Room is not enclosed */
  readonly netFloorArea: Derived<number | null>;
}

export class BuildingValues {
  private readonly levels = new Map<LevelId, LevelValues>();
  private readonly rooms = new Map<RoomId, RoomValues>();

  constructor(private readonly model: () => Model) {}

  level(id: LevelId): LevelValues {
    let values = this.levels.get(id);
    if (!values) {
      values = this.createLevel(id);
      this.levels.set(id, values);
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
    return { slice, outlines, footprint: fp, grossArea };
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
    return { room, detection, netFloorArea };
  }
}
