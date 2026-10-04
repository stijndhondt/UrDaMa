/**
 * Which way a Wall grows when its length is typed (slice 2, ticket 01): the choice is shown in
 * plan terms (left / right for a horizontal Wall, up / down for a vertical one, start / end for a
 * diagonal one) and maps to the Baseline end that moves.
 */
import type { Wall, WallEnd } from '@urdama/core';

export interface GrowOption {
  /** How the choice is shown: `panel.wall.grow.<label>` */
  readonly label: 'left' | 'right' | 'up' | 'down' | 'start' | 'end' | 'both';
  /** The Baseline end that moves */
  readonly end: WallEnd | 'both';
}

/** mm: a Wall whose ends differ by no more than this across counts as horizontal (or vertical). */
const AXIS_TOLERANCE = 0.5;

/** The three choices, in order: towards the start of the plan's axis, both, towards its end. */
export function growOptions(wall: Wall): readonly GrowOption[] {
  const dx = wall.end.x - wall.start.x;
  const dy = wall.end.y - wall.start.y;
  const both: GrowOption = { label: 'both', end: 'both' };
  if (Math.abs(dy) <= AXIS_TOLERANCE) {
    const leftEnd: WallEnd = dx >= 0 ? 'start' : 'end';
    return [{ label: 'left', end: leftEnd }, both, { label: 'right', end: other(leftEnd) }];
  }
  if (Math.abs(dx) <= AXIS_TOLERANCE) {
    const upEnd: WallEnd = dy >= 0 ? 'start' : 'end';
    return [{ label: 'up', end: upEnd }, both, { label: 'down', end: other(upEnd) }];
  }
  return [{ label: 'start', end: 'start' }, both, { label: 'end', end: 'end' }];
}

const other = (end: WallEnd): WallEnd => (end === 'start' ? 'end' : 'start');

/** A length as an edit field shows it: metres with two decimals, which parseLength reads back. */
export const editableLength = (mm: number): string => (mm / 1000).toFixed(2);
