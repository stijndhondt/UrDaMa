/**
 * Typed lengths in the editor (Slice 1 spec, "Units on screen and when typing"): every entry
 * field takes mm, so a bare number means mm; a typed unit (m, cm, mm) always wins. Lengths are
 * shown in m on the plan and in labels.
 * A decimal comma is accepted as well as a decimal point.
 */
const PATTERN = /^\s*(\d+(?:[.,]\d+)?)\s*(mm|cm|m)?\s*$/i;

/**
 * Millimetres, or null when the text isn't a positive length. `orZero`: 0 is a length too, for a
 * height above the floor such as a sill.
 */
export function parseLength(text: string, options: { orZero?: boolean } = {}): number | null {
  const match = PATTERN.exec(text);
  if (!match) return null;
  const value = Number(match[1]!.replace(',', '.'));
  if (!(value > 0) && !(options.orZero && value === 0)) return null;
  const unit = match[2]?.toLowerCase() ?? 'mm';
  const mm = unit === 'm' ? value * 1000 : unit === 'cm' ? value * 10 : value;
  return Math.round(mm * 1000) / 1000;
}

/** Degrees from typed text (decimal point or comma), or null. */
export function parseAngle(text: string): number | null {
  const match = /^\s*(-?\d+(?:[.,]\d+)?)\s*°?\s*$/.exec(text);
  return match ? Number(match[1]!.replace(',', '.')) : null;
}
