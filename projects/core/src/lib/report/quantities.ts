/**
 * The Quantities table (Slice 1 spec): every Room and every Level with the figures a homeowner
 * buys materials with, and its CSV export. Values are in mm, mm² and mm³, as everywhere in core;
 * the table and the CSV show m, m² and m³.
 */
import { levelsInOrder } from '../model/levels';
import type { LevelId, Model, RoomId } from '../model/types';
import type { BuildingValues } from '../values/building-values';
import { netWallArea, type MeasurementRule } from '../values/surfaces';

export interface QuantityRow {
  readonly kind: 'room' | 'level';
  readonly level: LevelId;
  readonly room?: RoomId;
  /** The Room's or the Level's name */
  readonly name: string;
  /** mm², Levels only: inside the outer faces of the merged footprint */
  readonly grossFloorArea: number | null;
  /** mm² */
  readonly netFloorArea: number | null;
  /** mm³ */
  readonly volume: number | null;
  /** mm² */
  readonly floorFinishArea: number | null;
  /** mm² */
  readonly ceilingArea: number | null;
  /** mm², under the chosen Measurement rule */
  readonly netWallArea: number | null;
  /** mm² */
  readonly revealArea: number | null;
}

const sum = (values: readonly (number | null)[]) =>
  values.reduce<number>((total, v) => total + (v ?? 0), 0);

/** Rows per Level, lowest first: its Rooms by name, then a total row for the Level. */
export function quantityRows(
  model: Model,
  values: BuildingValues,
  rule: MeasurementRule,
): QuantityRow[] {
  const rows: QuantityRow[] = [];
  for (const level of levelsInOrder(model)) {
    const rooms = Object.values(model.rooms)
      .filter((r) => r.level === level.id)
      .sort((a, b) => a.name.localeCompare(b.name) || (a.id < b.id ? -1 : 1));
    const roomRows = rooms.map((r): QuantityRow => {
      const v = values.room(r.id);
      const s = v.surfaces();
      return {
        kind: 'room',
        level: level.id,
        room: r.id,
        name: r.name,
        grossFloorArea: null,
        netFloorArea: v.netFloorArea(),
        volume: v.volume(),
        floorFinishArea: v.floorFinishArea(),
        ceilingArea: v.ceilingArea(),
        netWallArea: s ? netWallArea(s, rule) : null,
        revealArea: s ? s.revealArea : null,
      };
    });
    const lv = values.level(level.id);
    rows.push(...roomRows, {
      kind: 'level',
      level: level.id,
      name: level.name,
      grossFloorArea: lv.grossArea(),
      netFloorArea: lv.netFloorArea(),
      volume: sum(roomRows.map((r) => r.volume)),
      floorFinishArea: sum(roomRows.map((r) => r.floorFinishArea)),
      ceilingArea: sum(roomRows.map((r) => r.ceilingArea)),
      netWallArea: sum(roomRows.map((r) => r.netWallArea)),
      revealArea: sum(roomRows.map((r) => r.revealArea)),
    });
  }
  return rows;
}

/** UTF-8 byte order mark: Excel then reads the file as UTF-8 ("m²"). */
const BOM = String.fromCharCode(0xfeff);

export interface CsvFormat {
  /** ';' for Dutch, ',' for English */
  readonly separator: string;
  /** Dutch: 9,96 */
  readonly decimalComma: boolean;
}

/**
 * CSV that Excel opens correctly in the UI language: UTF-8 with a BOM (so "m²" shows), CRLF line
 * ends, numbers with 2 decimals, text quoted when needed.
 */
export function toCsv(
  header: readonly string[],
  rows: readonly (readonly (string | number | null)[])[],
  format: CsvFormat,
): string {
  const cell = (value: string | number | null): string => {
    if (value === null) return '';
    if (typeof value === 'number') {
      const text = value.toFixed(2);
      return format.decimalComma ? text.replace('.', ',') : text;
    }
    return /["\r\n]/.test(value) || value.includes(format.separator)
      ? `"${value.replace(/"/g, '""')}"`
      : value;
  };
  const line = (values: readonly (string | number | null)[]) =>
    values.map(cell).join(format.separator);
  return BOM + [header, ...rows].map((r) => line(r) + '\r\n').join('');
}
