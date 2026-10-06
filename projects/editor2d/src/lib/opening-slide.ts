/**
 * Placing and moving an Opening along its Wall (the Opening tools; dragging in Select): its
 * distance to both inside corners, as measured with a tape, and where it may go.
 */
import {
  fullThicknessSpan,
  levelWallOutlines,
  wallFrame,
  type LevelId,
  type Model,
  type Vec,
  type Wall,
  type WallOutline,
} from '@urdama/core';
import { planColors } from './draw-plan';
import type { EditorHost } from './host';
import type { View } from './view';

/**
 * The inside corners around a point on one face, as Baseline positions: where the face ends, or
 * where another Wall (a corner or a T) meets it, whichever is nearest on each side.
 */
export function insideCorners(
  model: Model,
  level: LevelId,
  wall: Wall,
  outline: WallOutline,
  face: 'lo' | 'hi',
  at: number,
): { first: number; last: number } {
  const f = wallFrame(wall);
  const t = (p: Vec) => f.along(p);
  const s = (p: Vec) => f.across(p);
  const [a, b] = face === 'lo' ? [outline[0], outline[1]] : [outline[3], outline[2]];
  const onFace = s(a);
  let first = Math.min(t(a), t(b));
  let last = Math.max(t(a), t(b));
  for (const [id, other] of levelWallOutlines(model, level)) {
    if (id === wall.id) continue;
    const touching = other.filter((p) => Math.abs(s(p) - onFace) < 0.5).map(t);
    if (!touching.length) continue;
    const lo = Math.min(...touching);
    const hi = Math.max(...touching);
    if (hi <= at) first = Math.max(first, hi);
    else if (lo >= at) last = Math.min(last, lo);
  }
  return { first, last };
}

/**
 * Where an Opening `width` wide lands when it is put at `raw` (mm along the Baseline, its near
 * edge): its distance from the inside corner rounded by `round`, kept between the inside corners
 * of `face` around `at` and where the Wall is full thickness.
 */
export function slideOffset(
  model: Model,
  level: LevelId,
  wall: Wall,
  outline: WallOutline,
  face: 'lo' | 'hi',
  at: number,
  raw: number,
  width: number,
  round: (mm: number) => number,
): number {
  const { first, last } = insideCorners(model, level, wall, outline, face, at);
  const span = fullThicknessSpan(wall, outline);
  const min = Math.max(first, span.start);
  const max = Math.min(last, span.end) - width;
  return Math.max(min, Math.min(max, first + round(raw - first)));
}

/** The face of a Wall's outline a point is nearer to. */
export function nearerFace(wall: Wall, outline: WallOutline, p: Vec): 'lo' | 'hi' {
  const f = wallFrame(wall);
  const side = f.across(p);
  return Math.abs(side - f.across(outline[0])) <= Math.abs(side - f.across(outline[3]))
    ? 'lo'
    : 'hi';
}

/**
 * The tape distances from an Opening at `offset`, `width` wide, to both inside corners of `face`:
 * dimension lines just outside that face, with their lengths.
 */
export function drawOpeningDistances(
  ctx: CanvasRenderingContext2D,
  view: View,
  format: EditorHost['format'],
  corners: { first: number; last: number },
  wall: Wall,
  outline: WallOutline,
  face: 'lo' | 'hi',
  offset: number,
  width: number,
): void {
  const f = wallFrame(wall);
  const faceAt = f.across(outline[face === 'lo' ? 0 : 3]);
  const out = face === 'lo' ? -1 : 1;
  // A dimension line just outside the face, `extra` mm away from it.
  const at = (t: number, extra: number): Vec => view.toScreen(f.point(t, faceAt + out * extra));
  const pad = 18 / view.scale;
  const spans: [number, number][] = [
    [corners.first, offset],
    [offset + width, corners.last],
  ];
  ctx.save();
  ctx.font = '600 12px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (const [from, to] of spans) {
    if (to - from < 1) continue;
    const a = at(from, pad);
    const b = at(to, pad);
    ctx.strokeStyle = planColors().accent;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
    const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    const text = format.length(to - from);
    const w = ctx.measureText(text).width + 8;
    ctx.fillStyle = planColors().paper;
    ctx.fillRect(mid.x - w / 2, mid.y - 9, w, 18);
    ctx.fillStyle = planColors().accent;
    ctx.fillText(text, mid.x, mid.y);
  }
  ctx.restore();
}
