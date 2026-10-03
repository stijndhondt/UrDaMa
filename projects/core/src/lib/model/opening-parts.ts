/**
 * Opening family parts (ticket 19; ADR 0007): a family is one parametric design (frame, leaves,
 * glass, garage-door sections). One derivation turns a design, a type's sizes and a placement into
 * boxes in the Opening's own coordinates; the plan symbol, the Elevation drawing, the 3D solids and
 * the quantities (glass area) all come from those boxes, so they can never disagree.
 *
 * Opening coordinates, mm: `u` along the Wall's Baseline from the Opening's near edge (0..width),
 * `v` across the Wall from its face on the Baseline normal's low side (0..Wall thickness, towards
 * the normal, so a swing to the 'right' is towards higher v), `z` up from the Opening's bottom.
 */
import type { Opening, OpeningKind } from './types';

export type OpeningPartKind = 'frame' | 'leaf' | 'glass' | 'section';

/** A part: a box in Opening coordinates. */
export interface OpeningPart {
  readonly kind: OpeningPartKind;
  readonly u0: number;
  readonly u1: number;
  readonly v0: number;
  readonly v1: number;
  readonly z0: number;
  readonly z1: number;
}

/** What fills a frame. */
export type OpeningInfill =
  | { readonly kind: 'none' }
  | { readonly kind: 'leaves'; readonly count: 1 | 2; readonly thickness: number }
  | {
      readonly kind: 'glazing';
      /** Panes side by side; 'auto' is two from 1 m wide */
      readonly panes: 1 | 2 | 'auto';
      readonly thickness: number;
    }
  | { readonly kind: 'sections'; readonly count: number; readonly thickness: number };

/** An Opening family's design (mm). */
export interface OpeningDesign {
  /** The frame profile: its face width and its depth in the Wall; null for a plain hole */
  readonly frame: { readonly width: number; readonly depth: number } | null;
  /** Whether the frame closes at the bottom (a window's sill rail) */
  readonly bottomRail: boolean;
  readonly infill: OpeningInfill;
}

/** The design of each built-in family; a family's own design comes with its editor (ticket 20). */
export const DEFAULT_DESIGNS: Readonly<Record<OpeningKind, OpeningDesign>> = {
  door: {
    frame: { width: 60, depth: 100 },
    bottomRail: false,
    infill: { kind: 'leaves', count: 1, thickness: 40 },
  },
  window: {
    frame: { width: 60, depth: 70 },
    bottomRail: true,
    infill: { kind: 'glazing', panes: 'auto', thickness: 24 },
  },
  wallOpening: { frame: null, bottomRail: false, infill: { kind: 'none' } },
  garageDoor: {
    frame: { width: 60, depth: 80 },
    bottomRail: false,
    infill: { kind: 'sections', count: 4, thickness: 40 },
  },
};

/** mm above the finished floor where the plan cuts through Openings. */
export const PLAN_CUT = 1000;
/** mm: how far a garage door's overhead track runs into the Room, at most. */
const TRACK = 2500;

/** A point in the plan's (u, v) Opening coordinates. */
export interface UV {
  readonly u: number;
  readonly v: number;
}

/** The plan symbol in Opening coordinates (u, v). */
export interface OpeningPlanSymbol {
  /** Parts cut by the plan, and hinged leaves drawn standing open */
  readonly rects: readonly Pick<OpeningPart, 'kind' | 'u0' | 'u1' | 'v0' | 'v1'>[];
  /** Door swings: around `center`, from the open leaf's end to the closed leaf's free end */
  readonly arcs: readonly { readonly center: UV; readonly from: UV; readonly to: UV }[];
  /** Dashed lines: what is above the cut (a wall opening's head, a garage door's track) */
  readonly dashed: readonly (readonly [UV, UV])[];
}

/** Everything drawn and counted for one placed Opening. */
export interface OpeningShape {
  /** Back parts first; the frame last, so it shows over what it holds */
  readonly parts: readonly OpeningPart[];
  readonly plan: OpeningPlanSymbol;
  /** mm² of glass */
  readonly glassArea: number;
}

/** What the derivation needs of a placed Opening. */
export type OpeningPlacement = Pick<Opening, 'sill' | 'hinge' | 'swing'> & {
  /** mm, from its type */
  readonly width: number;
  readonly height: number;
};

/**
 * The parts of an Opening of this design, size and placement in a Wall `depth` mm thick, and
 * from them its plan symbol and glass area.
 */
export function openingShape(
  design: OpeningDesign,
  o: OpeningPlacement,
  depth: number,
): OpeningShape {
  const { width: w, height: h } = o;
  const parts: OpeningPart[] = [];
  const frame = design.frame;
  const fw = frame ? Math.min(frame.width, w / 4, h / 4) : 0;
  const fd = frame ? Math.min(frame.depth, depth) : depth;
  // The frame sits in the middle of the Wall's thickness.
  const fv0 = (depth - fd) / 2;
  const fv1 = fv0 + fd;
  const box = (
    kind: OpeningPartKind,
    u0: number,
    u1: number,
    v0: number,
    v1: number,
    z0: number,
    z1: number,
  ) => parts.push({ kind, u0, u1, v0, v1, z0, z1 });
  // The face of the frame the Opening swings or slides towards.
  const towards = o.swing === 'right' ? fv1 : fv0;
  /** v from and to of a part `t` mm thick against that face */
  const onSwingFace = (t: number): readonly [number, number] =>
    o.swing === 'right' ? [fv1 - t, fv1] : [fv0, fv0 + t];
  const bottom = design.bottomRail ? fw : 0;
  const top = h - fw;

  const infill = design.infill;
  if (infill.kind === 'leaves') {
    const n = infill.count;
    const leafWidth = (w - 2 * fw) / n;
    for (let i = 0; i < n; i++) {
      const [v0, v1] = onSwingFace(infill.thickness);
      box('leaf', fw + i * leafWidth, fw + (i + 1) * leafWidth, v0, v1, bottom, top);
    }
  } else if (infill.kind === 'glazing') {
    const panes = infill.panes === 'auto' ? (w >= 1000 ? 2 : 1) : infill.panes;
    const mid = (fv0 + fv1) / 2;
    const [g0, g1] = [mid - infill.thickness / 2, mid + infill.thickness / 2];
    if (panes === 2 && frame) {
      box('glass', fw, w / 2 - fw / 2, g0, g1, bottom, top);
      box('glass', w / 2 + fw / 2, w - fw, g0, g1, bottom, top);
    } else {
      box('glass', fw, w - fw, g0, g1, bottom, top);
    }
  } else if (infill.kind === 'sections') {
    const [v0, v1] = onSwingFace(infill.thickness);
    const each = (top - bottom) / infill.count;
    for (let i = 0; i < infill.count; i++)
      box('section', fw, w - fw, v0, v1, bottom + i * each, bottom + (i + 1) * each);
  }

  if (frame) {
    box('frame', 0, fw, fv0, fv1, 0, h);
    box('frame', w - fw, w, fv0, fv1, 0, h);
    box('frame', fw, w - fw, fv0, fv1, top, h);
    if (design.bottomRail) box('frame', fw, w - fw, fv0, fv1, 0, fw);
    const panes =
      infill.kind === 'glazing'
        ? infill.panes === 'auto'
          ? w >= 1000
            ? 2
            : 1
          : infill.panes
        : 1;
    if (panes === 2) box('frame', w / 2 - fw / 2, w / 2 + fw / 2, fv0, fv1, bottom, top);
  }

  return {
    parts,
    plan: planSymbol(design, o, parts, { fw, towards, depth }),
    glassArea: glass(parts),
  };
}

const glass = (parts: readonly OpeningPart[]) =>
  parts.reduce((a, p) => (p.kind === 'glass' ? a + (p.u1 - p.u0) * (p.z1 - p.z0) : a), 0);

/** The parts cut by the plan, hinged leaves swung open with their arcs, and what is above. */
function planSymbol(
  design: OpeningDesign,
  o: OpeningPlacement,
  parts: readonly OpeningPart[],
  { fw, towards, depth }: { fw: number; towards: number; depth: number },
): OpeningPlanSymbol {
  const w = o.width;
  // The cut always passes through the Opening, however high its sill.
  const cut = Math.min(Math.max(PLAN_CUT - o.sill, 1), o.height - 1);
  const out: Pick<OpeningPart, 'kind' | 'u0' | 'u1' | 'v0' | 'v1'>[] = [];
  const arcs: { center: UV; from: UV; to: UV }[] = [];
  const dashed: (readonly [UV, UV])[] = [];
  const away = o.swing === 'right' ? 1 : -1;
  for (const p of parts) {
    if (p.z0 > cut || p.z1 < cut) continue;
    if (p.kind !== 'leaf') {
      out.push({ kind: p.kind, u0: p.u0, u1: p.u1, v0: p.v0, v1: p.v1 });
      continue;
    }
    // A hinged leaf stands open at 90° on its swing side, hinged at its jamb: one leaf on the
    // hinge side, two leaves on both.
    const single = design.infill.kind === 'leaves' && design.infill.count === 1;
    const atStart = single ? o.hinge === 'start' : p.u0 <= fw + 0.5;
    const hingeU = atStart ? p.u0 : p.u1;
    const freeU = atStart ? p.u1 : p.u0;
    const length = p.u1 - p.u0;
    const t = p.v1 - p.v0;
    const reach = towards + away * length;
    out.push({
      kind: 'leaf',
      u0: atStart ? hingeU : hingeU - t,
      u1: atStart ? hingeU + t : hingeU,
      v0: Math.min(towards, reach),
      v1: Math.max(towards, reach),
    });
    arcs.push({
      center: { u: hingeU, v: towards },
      from: { u: hingeU, v: reach },
      to: { u: freeU, v: towards },
    });
  }
  if (design.infill.kind === 'none') {
    // A wall opening: its head above, dashed along both faces.
    for (const v of [0, depth])
      dashed.push([
        { u: 0, v },
        { u: w, v },
      ]);
  } else if (design.infill.kind === 'sections') {
    // A garage door: its overhead track, dashed into the Room it opens into.
    const face = o.swing === 'right' ? depth : 0;
    const end = face + away * Math.min(o.height, TRACK);
    const [a, b] = [fw, w - fw];
    dashed.push([
      { u: a, v: face },
      { u: a, v: end },
    ]);
    dashed.push([
      { u: b, v: face },
      { u: b, v: end },
    ]);
    dashed.push([
      { u: a, v: end },
      { u: b, v: end },
    ]);
  }
  return { rects: out, arcs, dashed };
}
