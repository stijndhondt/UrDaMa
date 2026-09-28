/**
 * The Quantities tree (ticket 12): per Level its Rooms, per Room its floor, its ceiling and each
 * of its Wall faces, with the figures a homeowner buys materials with. Values in mm, mm² and mm³;
 * the web app shows m, m² and m³ and writes the same tree to CSV.
 */
import { levelsInOrder } from '../model/levels';
import type { LevelId, Model, RoomId, WallId } from '../model/types';
import type { BuildingValues } from '../values/building-values';
import {
  faceNetArea,
  MEASUREMENT_RULES,
  netWallArea,
  type MeasurementRule,
} from '../values/surfaces';

export interface QuantityFace {
  readonly wall: WallId;
  /** The Wall's number on its Level (in ID order), as the Building panel shows it */
  readonly wallNumber: number;
  readonly face: 'drawn' | 'other';
  /** mm */
  readonly length: number;
  readonly height: number;
  /** mm² */
  readonly gross: number;
  /** mm², the Openings subtracted under the Measurement rule */
  readonly openings: number;
  readonly net: number;
  readonly reveals: number;
}

export interface QuantityRoom {
  readonly room: RoomId;
  readonly name: string;
  /** mm² */
  readonly netFloorArea: number | null;
  /** mm³ */
  readonly volume: number | null;
  /** mm² */
  readonly floorArea: number | null;
  readonly ceilingArea: number | null;
  readonly netWallArea: number | null;
  readonly reveals: number | null;
  readonly faces: readonly QuantityFace[];
}

export interface QuantityLevel {
  readonly level: LevelId;
  readonly name: string;
  /** mm², inside the outer faces of the merged footprint */
  readonly grossFloorArea: number;
  readonly netFloorArea: number;
  /** mm³ */
  readonly volume: number;
  readonly rooms: readonly QuantityRoom[];
}

/** The tree, lowest Level first, Rooms by name. */
export function quantityTree(
  model: Model,
  values: BuildingValues,
  rule: MeasurementRule,
): QuantityLevel[] {
  const min = MEASUREMENT_RULES[rule].minOpeningArea;
  return levelsInOrder(model).map((level) => {
    const numbers = new Map(
      Object.values(model.walls)
        .filter((w) => w.level === level.id)
        .sort((a, b) => (a.id < b.id ? -1 : 1))
        .map((w, i) => [w.id as string, i + 1]),
    );
    const rooms = Object.values(model.rooms)
      .filter((r) => r.level === level.id)
      .sort((a, b) => a.name.localeCompare(b.name) || (a.id < b.id ? -1 : 1))
      .map((r): QuantityRoom => {
        const v = values.room(r.id);
        const s = v.surfaces();
        return {
          room: r.id,
          name: r.name,
          netFloorArea: v.netFloorArea(),
          volume: v.volume(),
          floorArea: v.floorFinishArea(),
          ceilingArea: v.ceilingArea(),
          netWallArea: s ? netWallArea(s, rule) : null,
          reveals: s ? s.revealArea : null,
          faces: (s?.faces ?? []).map((f) => {
            const net = faceNetArea(f, rule);
            return {
              wall: f.wall,
              wallNumber: numbers.get(f.wall) ?? 0,
              face: f.face,
              length: f.length,
              height: f.height,
              gross: f.gross,
              openings: f.openings.reduce((sum, o) => (o.size < min ? sum : sum + o.cut), 0),
              net,
              reveals: f.revealArea,
            };
          }),
        };
      });
    const lv = values.level(level.id);
    return {
      level: level.id,
      name: level.name,
      grossFloorArea: lv.grossArea(),
      netFloorArea: lv.netFloorArea(),
      volume: rooms.reduce((sum, r) => sum + (r.volume ?? 0), 0),
      rooms,
    };
  });
}
