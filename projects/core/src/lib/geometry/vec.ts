import type { Vec } from '../model/types';

export const vec = (x: number, y: number): Vec => ({ x, y });
export const add = (a: Vec, b: Vec): Vec => ({ x: a.x + b.x, y: a.y + b.y });
export const sub = (a: Vec, b: Vec): Vec => ({ x: a.x - b.x, y: a.y - b.y });
export const scale = (a: Vec, k: number): Vec => ({ x: a.x * k, y: a.y * k });
export const dot = (a: Vec, b: Vec): number => a.x * b.x + a.y * b.y;
export const cross = (a: Vec, b: Vec): number => a.x * b.y - a.y * b.x;
export const length = (a: Vec): number => Math.hypot(a.x, a.y);
export const distance = (a: Vec, b: Vec): number => Math.hypot(a.x - b.x, a.y - b.y);
export const normalize = (a: Vec): Vec => {
  const l = length(a);
  return l < 1e-12 ? { x: 0, y: 0 } : { x: a.x / l, y: a.y / l };
};
/** Rotates +90° in y-down plan coordinates: the visual right of a direction. */
export const perp = (a: Vec): Vec => ({ x: -a.y, y: a.x });

/** Intersection of the lines p + t·d and q + s·e, or null when (nearly) parallel. */
export function lineIntersection(p: Vec, d: Vec, q: Vec, e: Vec): Vec | null {
  const den = cross(d, e);
  if (Math.abs(den) < 1e-12) return null;
  return add(p, scale(d, cross(sub(q, p), e) / den));
}

/** Signed area of a ring in the unit² of its coordinates (positive = clockwise on screen). */
export function ringArea(ring: readonly Vec[]): number {
  let a = 0;
  for (let i = 0; i < ring.length; i++) {
    const p = ring[i]!;
    const q = ring[(i + 1) % ring.length]!;
    a += p.x * q.y - q.x * p.y;
  }
  return a / 2;
}
