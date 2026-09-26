/**
 * Joined Wall outlines (ADR 0001, "Wall joins and room detection" on the foundation map).
 *
 * A Wall is a box along its Baseline, on its side. Its two ends are shaped by its stored Wall
 * connections: a corner is mitred through the intersection of the two Walls' faces (which also
 * handles different thicknesses); a T stops the Wall against the host Wall's face on its own side.
 * Walls that are not connected are never joined, however close they are.
 */
import type { Vec, Wall, WallConnection, WallEnd, WallId } from '../model/types';
import { add, distance, dot, length, lineIntersection, normalize, perp, scale, sub } from './vec';

/** Four points: start on the low face, end on the low face, end on the high face, start on the high face. */
export type WallOutline = readonly [Vec, Vec, Vec, Vec];

interface EndCap {
  readonly lo: Vec;
  readonly hi: Vec;
}

export function wallThickness(wall: Wall, presetThickness: number): number {
  return wall.thickness ?? presetThickness;
}

/** Offsets of the two faces along the Wall's normal, low first. */
export function faceOffsets(wall: Wall, presetThickness: number): readonly [number, number] {
  const t = wallThickness(wall, presetThickness);
  return wall.side === 'right' ? [0, t] : wall.side === 'left' ? [-t, 0] : [-t / 2, t / 2];
}

export const wallDirection = (wall: Wall): Vec => normalize(sub(wall.end, wall.start));
export const wallNormal = (wall: Wall): Vec => perp(wallDirection(wall));
export const wallLength = (wall: Wall): number => distance(wall.start, wall.end);

interface Partner {
  readonly kind: 'corner' | 'tee';
  readonly other: WallId;
  readonly otherEnd?: WallEnd;
}

/** Joined outlines for a set of Walls (normally one Level), keyed by Wall ID. */
export function wallOutlines(
  walls: readonly Wall[],
  connections: readonly WallConnection[],
  presetThickness: number,
): Map<WallId, WallOutline> {
  const byId = new Map(walls.map((w) => [w.id, w]));
  const partners = new Map<string, Partner>();
  for (const c of connections) {
    if (!byId.has(c.wall) || !byId.has(c.to)) continue;
    partners.set(`${c.wall}:${c.end}`, {
      kind: c.kind,
      other: c.to,
      otherEnd: c.kind === 'corner' ? c.toEnd : undefined,
    });
    if (c.kind === 'corner')
      partners.set(`${c.to}:${c.toEnd}`, { kind: 'corner', other: c.wall, otherEnd: c.end });
  }

  const cap = (wall: Wall, end: WallEnd): EndCap => {
    const d = wallDirection(wall);
    const n = perp(d);
    const [lo, hi] = faceOffsets(wall, presetThickness);
    const p = end === 'start' ? wall.start : wall.end;
    const square: EndCap = { lo: add(p, scale(n, lo)), hi: add(p, scale(n, hi)) };
    const partner = partners.get(`${wall.id}:${end}`);
    const other = partner && byId.get(partner.other);
    if (!partner || !other || other === wall) return square;

    const dO = wallDirection(other);
    const nO = perp(dO);
    const [loO, hiO] = faceOffsets(other, presetThickness);
    const reach =
      Math.max(wallThickness(wall, presetThickness), wallThickness(other, presetThickness)) * 4 +
      50;

    if (partner.kind === 'corner') {
      const uW = end === 'start' ? d : scale(d, -1);
      const uO = partner.otherEnd === 'start' ? dO : scale(dO, -1);
      const sum = add(uW, uO);
      if (length(sum) < 1e-9) return square; // straight continuation
      const bisector = normalize(sum);
      const kW = dot(n, bisector);
      const kO = dot(nO, bisector);
      if (Math.abs(kW) < 1e-9) return square; // walls lying on top of each other
      const innerW = kW * hi >= kW * lo ? hi : lo;
      const outerW = innerW === hi ? lo : hi;
      const innerO = kO * hiO >= kO * loO ? hiO : loO;
      const outerO = innerO === hiO ? loO : hiO;
      const pIn = lineIntersection(
        add(wall.start, scale(n, innerW)),
        d,
        add(other.start, scale(nO, innerO)),
        dO,
      );
      const pOut = lineIntersection(
        add(wall.start, scale(n, outerW)),
        d,
        add(other.start, scale(nO, outerO)),
        dO,
      );
      if (!pIn || !pOut || distance(pIn, p) > reach || distance(pOut, p) > reach) return square;
      return innerW === lo ? { lo: pIn, hi: pOut } : { lo: pOut, hi: pIn };
    }

    // T: butt against the host face on the side this Wall comes from.
    const far = end === 'start' ? wall.end : wall.start;
    const face = dot(sub(far, other.start), nO) > 0 ? hiO : loO;
    const facePoint = add(other.start, scale(nO, face));
    const pLo = lineIntersection(add(wall.start, scale(n, lo)), d, facePoint, dO);
    const pHi = lineIntersection(add(wall.start, scale(n, hi)), d, facePoint, dO);
    if (!pLo || !pHi || distance(pLo, p) > reach * 3 || distance(pHi, p) > reach * 3) return square;
    return { lo: pLo, hi: pHi };
  };

  const out = new Map<WallId, WallOutline>();
  for (const wall of walls) {
    if (wallLength(wall) < 1e-6) continue;
    const ps = partners.get(`${wall.id}:start`);
    const pe = partners.get(`${wall.id}:end`);
    const deps: OutlineDeps = {
      preset: presetThickness,
      start: ps && byId.get(ps.other),
      startKind: ps ? `${ps.kind}:${ps.otherEnd ?? ''}` : '',
      end: pe && byId.get(pe.other),
      endKind: pe ? `${pe.kind}:${pe.otherEnd ?? ''}` : '',
    };
    const cached = memo.get(wall);
    if (cached && sameDeps(cached.deps, deps)) {
      out.set(wall.id, cached.outline);
      continue;
    }
    const a = cap(wall, 'start');
    const b = cap(wall, 'end');
    const outline: WallOutline = [a.lo, b.lo, b.hi, a.hi];
    memo.set(wall, { deps, outline });
    out.set(wall.id, outline);
  }
  return out;
}

/** What a Wall's outline depends on besides the Wall itself: its partners and the Preset. */
interface OutlineDeps {
  readonly preset: number;
  readonly start: Wall | undefined;
  readonly startKind: string;
  readonly end: Wall | undefined;
  readonly endKind: string;
}

const sameDeps = (a: OutlineDeps, b: OutlineDeps) =>
  a.preset === b.preset &&
  a.start === b.start &&
  a.startKind === b.startKind &&
  a.end === b.end &&
  a.endKind === b.endKind;

/**
 * Outlines per Wall object (models are immutable, so an unchanged Wall with unchanged partners
 * has the same outline): a drag recomputes only the moved Walls and their neighbours.
 */
const memo = new WeakMap<Wall, { readonly deps: OutlineDeps; readonly outline: WallOutline }>();
