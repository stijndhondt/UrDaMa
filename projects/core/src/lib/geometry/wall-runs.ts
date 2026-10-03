/**
 * Wall runs (ticket 27; CONTEXT.md): two or more Walls whose outside faces continue one another
 * in a straight line, such as a house's whole left side. Its overall length is measured along
 * the outside. Worked out from a Level's outside Wall faces: same direction, in one line within
 * 0.5 mm, and joined end to end; Openings don't break a run, a step in the line does.
 */
import type { Vec, WallId } from '../model/types';
import type { RoomWallFace } from '../values/surfaces';
import { dot } from './vec';

export interface WallRun {
  /** The run's outside line, from one end to the other (plan mm) */
  readonly start: Vec;
  readonly end: Vec;
  /** mm, overall */
  readonly length: number;
  /** The way its outside looks */
  readonly normal: Vec;
  /** The Walls along it, in order */
  readonly walls: readonly WallId[];
}

/** mm: faces closer than this to one line, or to touching, count as such */
const ON_LINE = 0.5;

/** The Wall runs among a Level's outside Wall faces. */
export function wallRuns(faces: readonly RoomWallFace[]): WallRun[] {
  // Every stretch of face, with the line it lies on.
  // The Walls' long faces only: a free Wall end is no part of a run.
  const pieces = faces
    .filter((f) => f.face !== 'end')
    .flatMap((f) => f.segments.map(([a, b]) => ({ a, b, wall: f.wall, normal: f.normal })));
  const lines: { normal: Vec; offset: number; pieces: typeof pieces }[] = [];
  for (const p of pieces) {
    const offset = dot(p.a, p.normal);
    const line = lines.find(
      (l) => dot(l.normal, p.normal) > 1 - 1e-9 && Math.abs(l.offset - offset) <= ON_LINE,
    );
    if (line) line.pieces.push(p);
    else lines.push({ normal: p.normal, offset, pieces: [p] });
  }
  const runs: WallRun[] = [];
  for (const line of lines) {
    const t = { x: -line.normal.y, y: line.normal.x };
    const spans = line.pieces
      .map((p) => {
        const [s, e] = [dot(p.a, t), dot(p.b, t)];
        return { from: Math.min(s, e), to: Math.max(s, e), wall: p.wall };
      })
      .sort((a, b) => a.from - b.from);
    // Pieces that touch or overlap join into one chain.
    let chain: typeof spans = [];
    const endChain = () => {
      const walls = [...new Set(chain.map((c) => c.wall))];
      if (walls.length >= 2) {
        const from = chain[0]!.from;
        const to = Math.max(...chain.map((c) => c.to));
        const at = (u: number): Vec => ({
          x: line.normal.x * line.offset + t.x * u,
          y: line.normal.y * line.offset + t.y * u,
        });
        // (+ 0 turns a -0 from a flipped normal into 0)
        const normal = { x: line.normal.x + 0, y: line.normal.y + 0 };
        runs.push({ start: at(from), end: at(to), length: to - from, normal, walls });
      }
      chain = [];
    };
    for (const s of spans) {
      const chainEnd = chain.length ? Math.max(...chain.map((c) => c.to)) : -Infinity;
      if (chain.length && s.from > chainEnd + ON_LINE) endChain();
      chain.push(s);
    }
    if (chain.length) endChain();
  }
  return runs;
}
