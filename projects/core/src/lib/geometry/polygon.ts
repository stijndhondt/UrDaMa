/** Polygon helpers for commands and Derived values (mm, plan coordinates). */
import {
  Clipper64,
  ClipType,
  FillRule,
  area as pathArea,
  isPositive,
  type Path64,
} from 'clipper2-ts';
import type { Vec } from '../model/types';
import { dot, sub } from './vec';

const UNITS = 1000;
const toPath = (ring: readonly Vec[]): Path64 => {
  const p = ring.map((v) => ({ x: Math.round(v.x * UNITS), y: Math.round(v.y * UNITS) }));
  return isPositive(p) ? p : p.reverse();
};

/** Distance from a point to a segment. */
export function distanceToSegment(p: Vec, a: Vec, b: Vec): number {
  const ab = sub(b, a);
  const len2 = dot(ab, ab);
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, dot(sub(p, a), ab) / len2));
  return Math.hypot(p.x - (a.x + ab.x * t), p.y - (a.y + ab.y * t));
}

/** Whether a point lies strictly inside a ring (even-odd). */
export function insideRing(p: Vec, ring: readonly Vec[]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i]!;
    const b = ring[j]!;
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x)
      inside = !inside;
  }
  return inside;
}

/** Whether a point lies inside an area: inside its outline and outside all its islands. */
export function insideArea(
  p: Vec,
  outline: readonly Vec[],
  islands: readonly (readonly Vec[])[] = [],
): boolean {
  return insideRing(p, outline) && islands.every((isl) => !insideRing(p, isl));
}

/**
 * A point well inside an area (for placing a Seed point): the middle of the widest horizontal
 * run inside the area, on the scan line through the middle of its height.
 */
export function interiorPoint(
  outline: readonly Vec[],
  islands: readonly (readonly Vec[])[] = [],
): Vec {
  const ys = outline.map((p) => p.y);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  let best: Vec | null = null;
  let bestWidth = -1;
  for (const f of [0.5, 0.3, 0.7, 0.2, 0.8, 0.1, 0.9]) {
    const y = minY + (maxY - minY) * f;
    const xs: number[] = [];
    for (const ring of [outline, ...islands]) {
      for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const a = ring[i]!;
        const b = ring[j]!;
        if (a.y > y !== b.y > y) xs.push(((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x);
      }
    }
    xs.sort((a, b) => a - b);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      const width = xs[k + 1]! - xs[k]!;
      const mid = { x: (xs[k]! + xs[k + 1]!) / 2, y };
      if (width > bestWidth && insideArea(mid, outline, islands)) {
        bestWidth = width;
        best = mid;
      }
    }
    if (best) return best;
  }
  return best ?? outline[0]!;
}

/** Area (mm²) of the intersection of two areas, each an outline with optional islands. */
export function intersectionArea(
  a: { outline: readonly Vec[]; islands?: readonly (readonly Vec[])[] },
  b: { outline: readonly Vec[]; islands?: readonly (readonly Vec[])[] },
): number {
  const subject = [toPath(a.outline), ...(a.islands ?? []).map((r) => toPath(r).reverse())];
  const clip = [toPath(b.outline), ...(b.islands ?? []).map((r) => toPath(r).reverse())];
  const clipper = new Clipper64();
  clipper.addSubject(subject);
  clipper.addClip(clip);
  const out: Path64[] = [];
  clipper.execute(ClipType.Intersection, FillRule.NonZero, out);
  return out.reduce((s, p) => s + pathArea(p), 0) / (UNITS * UNITS);
}
