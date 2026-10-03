/**
 * Opening family parts (ticket 19; ADR 0007): a family is one parametric design (frame, leaves,
 * glass, panels such as a garage door's). One derivation turns a design, a type's sizes and a placement into
 * boxes in the Opening's own coordinates; the plan symbol, the Elevation drawing, the 3D solids and
 * the quantities (glass area) all come from those boxes, so they can never disagree.
 *
 * Opening coordinates, mm: `u` along the Wall's Baseline from the Opening's near edge (0..width),
 * `v` across the Wall from its face on the Baseline normal's low side (0..Wall thickness, towards
 * the normal, so a swing to the 'right' is towards higher v), `z` up from the Opening's bottom.
 */
import type { Opening, OpeningFamily, OpeningKind } from './types';

export type OpeningPartKind = 'frame' | 'leaf' | 'glass' | 'panel';

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
  /** Panels stacked bottom to top, such as a sectional garage door's */
  | { readonly kind: 'panels'; readonly count: number; readonly thickness: number };

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
    infill: { kind: 'panels', count: 4, thickness: 40 },
  },
};

/** A family's design: its own, or its kind's default. */
export const designOf = (family: OpeningFamily): OpeningDesign =>
  family.design ?? DEFAULT_DESIGNS[family.kind];

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

/** How many panes a glazing has: 'auto' is two from 1 m wide. */
const paneCount = (infill: OpeningInfill, width: number): number =>
  infill.kind !== 'glazing' ? 1 : infill.panes === 'auto' ? (width >= 1000 ? 2 : 1) : infill.panes;

/** Where an Opening's frame sits, worked out once for its parts and its plan symbol. */
interface FrameFit {
  /** mm: the frame profile's face width (0 without a frame) */
  readonly width: number;
  /** mm across the Wall: the frame's two faces */
  readonly back: number;
  readonly front: number;
  /** v of the frame face the Opening swings or slides towards */
  readonly towards: number;
  /** z where the infill starts and ends (above a sill rail, under the head) */
  readonly bottom: number;
  readonly top: number;
}

/**
 * The parts of an Opening of this design, size and placement in a Wall `depth` mm thick, and
 * from them its plan symbol and glass area. Thicknesses never exceed the frame's depth.
 */
export function openingShape(
  design: OpeningDesign,
  o: OpeningPlacement,
  depth: number,
): OpeningShape {
  const { width: w, height: h } = o;
  const parts: OpeningPart[] = [];
  const add = (part: OpeningPart) => parts.push(part);
  const frame = design.frame;
  const frameWidth = frame ? Math.min(frame.width, w / 4, h / 4) : 0;
  const frameDepth = frame ? Math.min(frame.depth, depth) : depth;
  // The frame sits in the middle of the Wall's thickness.
  const back = (depth - frameDepth) / 2;
  const front = back + frameDepth;
  const fit: FrameFit = {
    width: frameWidth,
    back,
    front,
    towards: o.swing === 'right' ? front : back,
    bottom: design.bottomRail ? frameWidth : 0,
    top: h - frameWidth,
  };
  const { bottom, top } = fit;
  /** v from and to of a part `t` mm thick against the face it swings towards */
  const onSwingFace = (t: number): readonly [number, number] => {
    const thick = Math.min(t, frameDepth);
    return o.swing === 'right' ? [front - thick, front] : [back, back + thick];
  };

  const infill = design.infill;
  const panes = paneCount(infill, w);
  if (infill.kind === 'leaves') {
    const leafWidth = (w - 2 * frameWidth) / infill.count;
    const [v0, v1] = onSwingFace(infill.thickness);
    for (let i = 0; i < infill.count; i++) {
      const u0 = frameWidth + i * leafWidth;
      add({ kind: 'leaf', u0, u1: u0 + leafWidth, v0, v1, z0: bottom, z1: top });
    }
  } else if (infill.kind === 'glazing') {
    const mid = (back + front) / 2;
    const half = Math.min(infill.thickness, frameDepth) / 2;
    const glass = { kind: 'glass', v0: mid - half, v1: mid + half, z0: bottom, z1: top } as const;
    if (panes === 2 && frame) {
      add({ ...glass, u0: frameWidth, u1: w / 2 - frameWidth / 2 });
      add({ ...glass, u0: w / 2 + frameWidth / 2, u1: w - frameWidth });
    } else {
      add({ ...glass, u0: frameWidth, u1: w - frameWidth });
    }
  } else if (infill.kind === 'panels') {
    const [v0, v1] = onSwingFace(infill.thickness);
    const each = (top - bottom) / infill.count;
    for (let i = 0; i < infill.count; i++) {
      const z0 = bottom + i * each;
      add({ kind: 'panel', u0: frameWidth, u1: w - frameWidth, v0, v1, z0, z1: z0 + each });
    }
  }

  if (frame) {
    const bar = { kind: 'frame', v0: back, v1: front } as const;
    add({ ...bar, u0: 0, u1: frameWidth, z0: 0, z1: h });
    add({ ...bar, u0: w - frameWidth, u1: w, z0: 0, z1: h });
    add({ ...bar, u0: frameWidth, u1: w - frameWidth, z0: top, z1: h });
    if (design.bottomRail) add({ ...bar, u0: frameWidth, u1: w - frameWidth, z0: 0, z1: bottom });
    if (panes === 2) {
      add({ ...bar, u0: w / 2 - frameWidth / 2, u1: w / 2 + frameWidth / 2, z0: bottom, z1: top });
    }
  }

  return { parts, plan: planSymbol(design, o, parts, fit, depth), glassArea: glassAreaOf(parts) };
}

const glassAreaOf = (parts: readonly OpeningPart[]) =>
  parts.reduce((a, p) => (p.kind === 'glass' ? a + (p.u1 - p.u0) * (p.z1 - p.z0) : a), 0);

/** The parts cut by the plan, hinged leaves swung open with their arcs, and what is above. */
function planSymbol(
  design: OpeningDesign,
  o: OpeningPlacement,
  parts: readonly OpeningPart[],
  fit: FrameFit,
  depth: number,
): OpeningPlanSymbol {
  const w = o.width;
  // The plan cuts 1 m above the floor; an Opening wholly above or below that (a high window) is
  // cut through the middle of its infill, so the plan still shows what it is.
  const atCut = PLAN_CUT - o.sill;
  const cut = atCut > fit.bottom && atCut < fit.top ? atCut : (fit.bottom + fit.top) / 2;
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
    // A hinged leaf stands open at 90 degrees on its swing side, hinged at its jamb: one leaf on
    // the Opening's hinge side, two leaves each at their own jamb.
    const single = design.infill.kind === 'leaves' && design.infill.count === 1;
    const atStart = single ? o.hinge === 'start' : p.u0 <= fit.width + 0.5;
    const hingeU = atStart ? p.u0 : p.u1;
    const freeU = atStart ? p.u1 : p.u0;
    const length = p.u1 - p.u0;
    const t = p.v1 - p.v0;
    const reach = fit.towards + away * length;
    out.push({
      kind: 'leaf',
      u0: atStart ? hingeU : hingeU - t,
      u1: atStart ? hingeU + t : hingeU,
      v0: Math.min(fit.towards, reach),
      v1: Math.max(fit.towards, reach),
    });
    arcs.push({
      center: { u: hingeU, v: fit.towards },
      from: { u: hingeU, v: reach },
      to: { u: freeU, v: fit.towards },
    });
  }
  const line = (u0: number, v0: number, u1: number, v1: number) =>
    dashed.push([
      { u: u0, v: v0 },
      { u: u1, v: v1 },
    ]);
  if (design.infill.kind === 'none') {
    // A wall opening: its head above, dashed along both faces.
    for (const v of [0, depth]) line(0, v, w, v);
  } else if (design.infill.kind === 'panels') {
    // A garage door: its overhead track, dashed into the Room it opens into.
    const face = o.swing === 'right' ? depth : 0;
    const end = face + away * Math.min(o.height, TRACK);
    const [a, b] = [fit.width, w - fit.width];
    line(a, face, a, end);
    line(b, face, b, end);
    line(a, end, b, end);
  }
  return { rects: out, arcs, dashed };
}
