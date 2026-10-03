import { insideRing, type Vec, type WallOutline } from '@lakudemis/core';
import { planColors } from './draw-plan';

/** Drag increments (Slice 1 spec): 10 mm; Shift = coarse (100 mm); Ctrl = fine (1 mm). */
export function increment(mods: { shift: boolean; ctrl: boolean }): number {
  return mods.ctrl ? 1 : mods.shift ? 100 : 10;
}

export function snapToIncrement(p: Vec, step: number): Vec {
  return { x: Math.round(p.x / step) * step, y: Math.round(p.y / step) * step };
}

/** Snapping radius on screen (Wall joins decision: 12 px, independent of zoom). */
export const SNAP_RADIUS_PX = 12;

export interface WallSnap {
  readonly point: Vec;
  /** A corner of a Wall outline, or a point on a Wall face. */
  readonly kind: 'corner' | 'face';
}

/**
 * Snaps to the nearest point of interest within `radius` mm: a Wall outline corner, or a point on a
 * horizontal / vertical face aligned with one of `alignTo` (Wall ends: where a neighbouring Room's
 * inside corner belongs). Else the nearest point on a Wall face, rounded along it to `step`.
 */
export function snapToWalls(
  p: Vec,
  outlines: Iterable<WallOutline>,
  radius: number,
  step = 0,
  alignTo: readonly Vec[] = [],
): WallSnap | null {
  let best: WallSnap | null = null;
  let bestDistance = radius;
  const list = [...outlines];
  const consider = (c: Vec) => {
    const d = Math.hypot(c.x - p.x, c.y - p.y);
    if (d <= bestDistance) {
      bestDistance = d;
      best = { point: c, kind: 'corner' };
    }
  };
  for (const outline of list) {
    for (const c of outline) consider(c);
    for (let i = 0; i < 4; i++) {
      const a = outline[i]!;
      const b = outline[(i + 1) % 4]!;
      for (const q of alignTo) {
        if (Math.abs(a.y - b.y) < 1e-6 && q.x > Math.min(a.x, b.x) && q.x < Math.max(a.x, b.x))
          consider({ x: q.x, y: a.y });
        else if (Math.abs(a.x - b.x) < 1e-6 && q.y > Math.min(a.y, b.y) && q.y < Math.max(a.y, b.y))
          consider({ x: a.x, y: q.y });
      }
    }
  }
  if (best) return best;
  for (const outline of list) {
    for (let i = 0; i < 4; i++) {
      const a = outline[i]!;
      const b = outline[(i + 1) % 4]!;
      const abx = b.x - a.x;
      const aby = b.y - a.y;
      const len2 = abx * abx + aby * aby;
      if (len2 === 0) continue;
      const t = Math.max(0, Math.min(1, ((p.x - a.x) * abx + (p.y - a.y) * aby) / len2));
      let q = { x: a.x + abx * t, y: a.y + aby * t };
      if (step > 0 && Math.abs(aby) < 1e-6) q = { x: clampRound(q.x, a.x, b.x, step), y: q.y };
      else if (step > 0 && Math.abs(abx) < 1e-6) q = { x: q.x, y: clampRound(q.y, a.y, b.y, step) };
      const d = Math.hypot(q.x - p.x, q.y - p.y);
      if (d <= bestDistance) {
        bestDistance = d;
        best = { point: q, kind: 'face' };
      }
    }
  }
  return best;
}

/** Rounds to the step, but never past the ends of the face. */
function clampRound(v: number, a: number, b: number, step: number): number {
  return Math.min(Math.max(Math.round(v / step) * step, Math.min(a, b)), Math.max(a, b));
}

/** Draws the snap marker: a square for corners, a circle for faces. */
export function drawSnap(ctx: CanvasRenderingContext2D, screen: Vec, kind: WallSnap['kind']): void {
  ctx.save();
  ctx.strokeStyle = kind === 'corner' ? planColors().ok : planColors().accent;
  ctx.lineWidth = 2;
  if (kind === 'corner') ctx.strokeRect(screen.x - 6, screen.y - 6, 12, 12);
  else {
    ctx.beginPath();
    ctx.arc(screen.x, screen.y, 6, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

/** A dashed alignment guide: from the Wall corner a point lines up with, to that point. */
export interface AlignGuide {
  readonly from: Vec;
  readonly to: Vec;
}

/**
 * Alignment guides (ticket 26): a point within `radius` mm of the vertical or horizontal line
 * through a Wall outline corner moves onto that line, each axis on its own, so a corner drawn far
 * away still lines up with another Wall's outside. The nearest line wins on each axis.
 */
export function alignToCorners(
  p: Vec,
  outlines: Iterable<WallOutline>,
  radius: number,
): {
  /** The vertical and the horizontal line the point lines up with, where one is in reach */
  readonly x?: number;
  readonly y?: number;
  readonly guides: readonly AlignGuide[];
} {
  let bestX: Vec | null = null;
  let bestY: Vec | null = null;
  const closer = (best: Vec | null, c: Vec, axis: 'x' | 'y') => {
    const d = Math.abs(c[axis] - p[axis]);
    if (d > radius) return best;
    if (!best) return c;
    const db = Math.abs(best[axis] - p[axis]);
    if (d !== db) return d < db ? c : best;
    // On one line: the corner nearest the point draws the guide.
    return Math.hypot(c.x - p.x, c.y - p.y) < Math.hypot(best.x - p.x, best.y - p.y) ? c : best;
  };
  for (const outline of outlines) {
    for (const c of outline) {
      bestX = closer(bestX, c, 'x');
      bestY = closer(bestY, c, 'y');
    }
  }
  const point = { x: bestX?.x ?? p.x, y: bestY?.y ?? p.y };
  const guides = [bestX, bestY].flatMap((c) => (c ? [{ from: c, to: point }] : []));
  return { x: bestX?.x, y: bestY?.y, guides };
}

/**
 * A free point (no Wall corner or face under it): on alignment guides where they reach, the drag
 * increment on the other axis.
 */
export function alignOrRound(
  p: Vec,
  outlines: Iterable<WallOutline>,
  radius: number,
  step: number,
): { readonly point: Vec; readonly guides: readonly AlignGuide[] } {
  const aligned = alignToCorners(p, outlines, radius);
  const rounded = snapToIncrement(p, step);
  const point = { x: aligned.x ?? rounded.x, y: aligned.y ?? rounded.y };
  // The guides end where the point lands, its rounded axis included.
  return { point, guides: aligned.guides.map((g) => ({ from: g.from, to: point })) };
}

/** Draws alignment guides: thin dashed lines from the Wall corners to the point. */
export function drawGuides(
  ctx: CanvasRenderingContext2D,
  toScreen: (p: Vec) => Vec,
  guides: readonly AlignGuide[],
): void {
  if (!guides.length) return;
  ctx.save();
  ctx.strokeStyle = planColors().accent;
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  for (const g of guides) {
    const a = toScreen(g.from);
    const b = toScreen(g.to);
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
  }
  ctx.stroke();
  ctx.restore();
}

/**
 * The outer-corner rule (ticket 26): a Room drawn at inside size from the outer corner of an
 * existing Wall, along that Wall, shares it and starts one Wall `thickness` in, so its outer faces
 * run flush with the existing ones. Small probes around the corner tell which Wall the drag runs
 * along and that the corner is an outer one; drawn diagonally away, or from an inside corner, the
 * point is taken as it is.
 */
export function outerCornerStart(
  start: Vec,
  to: Vec,
  outlines: readonly WallOutline[],
  thickness: number,
): Vec {
  const sx = Math.sign(to.x - start.x) || 1;
  const sy = Math.sign(to.y - start.y) || 1;
  const wallAt = (dx: number, dy: number) =>
    outlines.some((o) => insideRing({ x: start.x + dx * PROBE, y: start.y + dy * PROBE }, o));
  // Past the corner (behind the drag) and in the new Room's way, there must be no Wall.
  if (wallAt(-sx, -sy) || wallAt(sx, sy)) return start;
  return {
    // A Wall runs along the drag's x direction, on the far side of the drag's y direction.
    x: wallAt(sx, -sy) ? start.x + sx * thickness : start.x,
    y: wallAt(-sx, sy) ? start.y + sy * thickness : start.y,
  };
}

/** mm: how far from a corner the rule looks for Walls. */
const PROBE = 1;
