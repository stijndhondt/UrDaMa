/**
 * The Opening family editor's views (ticket 20): one family's parts seen from the top, bottom,
 * front, back, left or right, fitted to the panel, in the plan's colours. Every view projects the
 * same parts (core's openingShape), so they always agree. Handles on the views change the frame's
 * width and depth and the infill's thickness, in sensible steps.
 */
import {
  DESIGN_LIMITS,
  openingShape,
  type OpeningDesign,
  type OpeningPart,
  type OpeningPartKind,
  type OpeningPlacement,
} from '@lakudemis/core';
import {
  DEFAULT_PLAN_COLORS,
  partFill,
  planColors,
  usePlanColors,
  type PlanColors,
} from './draw-plan';

export type FamilySide = 'front' | 'back' | 'left' | 'right' | 'top' | 'bottom';
export const FAMILY_SIDES: readonly FamilySide[] = [
  'top',
  'front',
  'left',
  'bottom',
  'back',
  'right',
];

/** What a family view shows: a design at one type's size, in a Wall `depth` mm thick. */
export interface FamilyPreview {
  readonly design: OpeningDesign;
  readonly placement: OpeningPlacement;
  readonly depth: number;
}

/** A part seen from one side: its rectangle on the view (a across, b up), in mm. */
export interface ProjectedPart {
  readonly kind: OpeningPartKind;
  readonly a0: number;
  readonly a1: number;
  readonly b0: number;
  readonly b1: number;
}

interface Point3 {
  readonly u: number;
  readonly v: number;
  readonly z: number;
}

/** Where a point (u along the Wall, v across it, z up) lands on a side's view. */
function project(side: FamilySide, p: Point3, w: number, depth: number): { a: number; b: number } {
  switch (side) {
    case 'front':
      return { a: p.u, b: p.z };
    case 'back':
      return { a: w - p.u, b: p.z };
    case 'left':
      return { a: depth - p.v, b: p.z };
    case 'right':
      return { a: p.v, b: p.z };
    case 'top':
      return { a: p.u, b: p.v };
    case 'bottom':
      return { a: p.u, b: depth - p.v };
  }
}

/** How near a part is to the viewer: larger is nearer, drawn later. */
function nearness(side: FamilySide, p: OpeningPart): number {
  switch (side) {
    case 'front':
      return -p.v0;
    case 'back':
      return p.v1;
    case 'left':
      return -p.u0;
    case 'right':
      return p.u1;
    case 'top':
      return p.z1;
    case 'bottom':
      return -p.z0;
  }
}

/** The parts seen from one side, far to near (the order to paint them). */
export function projectParts(
  parts: readonly OpeningPart[],
  side: FamilySide,
  width: number,
  depth: number,
): ProjectedPart[] {
  return [...parts]
    .sort((p, q) => nearness(side, p) - nearness(side, q))
    .map((p) => {
      const a = project(side, { u: p.u0, v: p.v0, z: p.z0 }, width, depth);
      const b = project(side, { u: p.u1, v: p.v1, z: p.z1 }, width, depth);
      return {
        kind: p.kind,
        a0: Math.min(a.a, b.a),
        a1: Math.max(a.a, b.a),
        b0: Math.min(a.b, b.b),
        b1: Math.max(a.b, b.b),
      };
    });
}

/** The Opening's box (width × height × the Wall's depth) seen from one side. */
export function outlineOf(side: FamilySide, preview: FamilyPreview): ProjectedPart {
  const { width: w, height: h } = preview.placement;
  const across = side === 'left' || side === 'right' ? preview.depth : w;
  const up = side === 'top' || side === 'bottom' ? preview.depth : h;
  return { kind: 'frame', a0: 0, a1: across, b0: 0, b1: up };
}

/** A design parameter a handle changes. */
export type FamilyParameter = 'frameWidth' | 'frameDepth' | 'thickness';

/** A handle: where it sits (mm on the view), and the design it gives when dragged to a point. */
export interface FamilyHandle {
  readonly parameter: FamilyParameter;
  readonly a: number;
  readonly b: number;
  /** The design with the handle at (a, b) on the view, and the parameter's new value */
  drag(a: number, b: number): { readonly design: OpeningDesign; readonly value: number };
}

/** mm: frame sizes snap to this */
export const FRAME_STEP = 5;
/** mm: infill thicknesses snap to this */
export const THICKNESS_STEP = 2;

const snapTo = (value: number, step: number, lo: number, hi: number) =>
  Math.min(hi, Math.max(lo, Math.round(value / step) * step));

/** Where a point on a side's view lies along one model axis (u or v): `project` undone. */
function along(side: FamilySide, axis: 'u' | 'v', a: number, b: number, w: number, depth: number) {
  if (axis === 'u') return side === 'back' ? w - a : a;
  if (side === 'left') return depth - a;
  if (side === 'right') return a;
  return side === 'bottom' ? depth - b : b;
}

/**
 * The handles shown on one side's view: the frame's width where a jamb meets the opening (front
 * and back), the frame's depth on the head's face (all other sides), and the infill's thickness
 * on its face (the sides that see across the Wall).
 */
export function familyHandles(preview: FamilyPreview, side: FamilySide): FamilyHandle[] {
  const { design, placement, depth } = preview;
  const { width: w, height: h } = placement;
  const parts = openingShape(design, placement, depth).parts;
  const handles: FamilyHandle[] = [];
  const at = (p: Point3) => project(side, p, w, depth);
  const facing = side === 'front' || side === 'back';
  const jamb = parts.find((p) => p.kind === 'frame' && p.u0 === 0);
  const frame = design.frame;
  if (frame && jamb) {
    if (facing)
      handles.push({
        parameter: 'frameWidth',
        ...at({ u: jamb.u1, v: depth / 2, z: h / 2 }),
        drag: (a, b) => {
          const max = Math.min(DESIGN_LIMITS.frameWidth[1], Math.floor(Math.min(w, h) / 4));
          const value = snapTo(
            along(side, 'u', a, b, w, depth),
            FRAME_STEP,
            DESIGN_LIMITS.frameWidth[0],
            max,
          );
          return { design: { ...design, frame: { ...frame, width: value } }, value };
        },
      });
    else
      handles.push({
        parameter: 'frameDepth',
        ...at({
          u: jamb.u1 / 2,
          v: jamb.v1,
          z: side === 'top' || side === 'bottom' ? h : h - jamb.u1 / 2,
        }),
        drag: (a, b) => {
          const v = along(side, 'v', a, b, w, depth);
          const value = snapTo(
            2 * Math.abs(v - depth / 2),
            FRAME_STEP,
            DESIGN_LIMITS.frameDepth[0],
            depth,
          );
          return { design: { ...design, frame: { ...frame, depth: value } }, value };
        },
      });
  }
  const infill = design.infill;
  const kind = infill.kind === 'leaves' ? 'leaf' : infill.kind === 'panels' ? 'panel' : 'glass';
  const body = parts.find((p) => p.kind === kind);
  if (!facing && side !== 'top' && side !== 'bottom' && infill.kind !== 'none' && body) {
    // The thickness grows away from where the infill hangs: the middle of the frame for glass,
    // the Wall's face for a sliding leaf, the frame's face it swings towards otherwise.
    const sliding = infill.kind === 'leaves' && infill.operation === 'sliding';
    const mid = (body.v0 + body.v1) / 2;
    const towards = placement.swing === 'right';
    // A hinged leaf or panel lies against the frame face it swings towards, a sliding leaf on the
    // Wall face beyond it: with the swing to the back (v high) the anchor is the leaf's v1 when
    // hinged, its v0 when sliding, and the other way round with the swing to the front.
    const anchor = infill.kind === 'glazing' ? mid : towards === sliding ? body.v0 : body.v1;
    const free = anchor === body.v0 ? body.v1 : body.v0;
    // Within the frame, infill is never thicker than it (openingShape caps it there).
    const maxThickness = sliding
      ? DESIGN_LIMITS.thickness[1]
      : Math.min(DESIGN_LIMITS.thickness[1], frame ? Math.min(frame.depth, depth) : depth);
    handles.push({
      parameter: 'thickness',
      ...at({ u: w / 2, v: free, z: (body.z0 + body.z1) / 2 }),
      drag: (a, b) => {
        const v = along(side, 'v', a, b, w, depth);
        const raw = Math.abs(v - anchor) * (infill.kind === 'glazing' ? 2 : 1);
        const value = snapTo(raw, THICKNESS_STEP, DESIGN_LIMITS.thickness[0], maxThickness);
        return { design: { ...design, infill: { ...infill, thickness: value } }, value };
      },
    });
  }
  return handles;
}

export interface FamilyViewHost {
  /** The theme's colours, read before each draw */
  colors?(): PlanColors;
  /** A handle was dragged: the design to show (`done` false) or keep (`done` true, released) */
  changed(design: OpeningDesign, done: boolean): void;
  /** A drag was cancelled: show the design as it was */
  cancelled(): void;
  /** A size as the user reads it while dragging ("60 mm") */
  millimetres(mm: number): string;
}

/** px around the drawing */
const MARGIN = 24;
/** px: how near the pointer must be to grab a handle */
const GRAB = 9;
const FONT = '11px system-ui, sans-serif';

export class FamilyView {
  private readonly ctx: CanvasRenderingContext2D;
  private readonly resize: ResizeObserver;
  private preview: FamilyPreview | null = null;
  private width = 0;
  private height = 0;
  private frame = 0;
  /** px per mm, and the screen position of a = 0, b = 0 */
  private k = 1;
  private ox = 0;
  private oy = 0;
  private dragging: { handle: FamilyHandle; label: string; design: OpeningDesign } | null = null;
  private hover: FamilyHandle | null = null;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private side: FamilySide,
    private readonly host: FamilyViewHost,
  ) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas2D is not available');
    this.ctx = ctx;
    canvas.addEventListener('pointerdown', this.onDown);
    canvas.addEventListener('pointermove', this.onMove);
    canvas.addEventListener('pointerup', this.onUp);
    canvas.addEventListener('pointercancel', this.onCancel);
    this.resize = new ResizeObserver(() => this.measure());
    this.resize.observe(canvas);
    this.measure();
  }

  set(preview: FamilyPreview): void {
    this.preview = preview;
    this.invalidate();
  }

  setSide(side: FamilySide): void {
    this.side = side;
    this.invalidate();
  }

  /** The theme changed. */
  redraw(): void {
    this.invalidate();
  }

  destroy(): void {
    cancelAnimationFrame(this.frame);
    this.resize.disconnect();
    this.canvas.removeEventListener('pointerdown', this.onDown);
    this.canvas.removeEventListener('pointermove', this.onMove);
    this.canvas.removeEventListener('pointerup', this.onUp);
    this.canvas.removeEventListener('pointercancel', this.onCancel);
  }

  private handles(): FamilyHandle[] {
    return this.preview ? familyHandles(this.preview, this.side) : [];
  }

  /** The pointer on the view, in mm. */
  private toView(e: PointerEvent): { a: number; b: number; x: number; y: number } {
    const r = this.canvas.getBoundingClientRect();
    const x = e.clientX - r.left;
    const y = e.clientY - r.top;
    return { a: (x - this.ox) / this.k, b: (this.oy - y) / this.k, x, y };
  }

  private handleAt(x: number, y: number): FamilyHandle | null {
    return this.handles().find((h) => Math.hypot(this.x(h.a) - x, this.y(h.b) - y) <= GRAB) ?? null;
  }

  private readonly onDown = (e: PointerEvent): void => {
    if (e.button !== 0) return;
    const p = this.toView(e);
    const handle = this.handleAt(p.x, p.y);
    if (!handle || !this.preview) return;
    this.canvas.setPointerCapture(e.pointerId);
    this.dragging = { handle, label: '', design: this.preview.design };
  };

  private readonly onMove = (e: PointerEvent): void => {
    const p = this.toView(e);
    if (!this.dragging) {
      const hover = this.handleAt(p.x, p.y);
      if (hover?.parameter !== this.hover?.parameter) {
        this.hover = hover;
        this.canvas.style.cursor = hover ? 'grab' : '';
        this.invalidate();
      }
      return;
    }
    const { design, value } = this.dragging.handle.drag(p.a, p.b);
    const label = this.host.millimetres(value);
    this.dragging = { ...this.dragging, label, design };
    this.host.changed(design, false);
    this.invalidate();
  };

  private readonly onUp = (): void => {
    if (!this.dragging) return;
    const { design } = this.dragging;
    this.dragging = null;
    this.host.changed(design, true);
    this.invalidate();
  };

  private readonly onCancel = (): void => {
    if (!this.dragging) return;
    this.dragging = null;
    this.host.cancelled();
    this.invalidate();
  };

  private measure(): void {
    const dpr = window.devicePixelRatio || 1;
    this.width = this.canvas.clientWidth;
    this.height = this.canvas.clientHeight;
    this.canvas.width = Math.round(this.width * dpr);
    this.canvas.height = Math.round(this.height * dpr);
    this.invalidate();
  }

  private invalidate(): void {
    cancelAnimationFrame(this.frame);
    this.frame = requestAnimationFrame(() => this.draw());
  }

  /**
   * Fits the rectangles into the canvas, centred, at a scale every side shares (the object's
   * largest size across and up on any side), so the six views read as one object.
   */
  private fit(rects: readonly ProjectedPart[], parts: readonly OpeningPart[], depth: number): void {
    const a0 = Math.min(...rects.map((r) => r.a0));
    const a1 = Math.max(...rects.map((r) => r.a1));
    const b0 = Math.min(...rects.map((r) => r.b0));
    const b1 = Math.max(...rects.map((r) => r.b1));
    const size = (
      lo: (p: OpeningPart) => number,
      hi: (p: OpeningPart) => number,
      outline: number,
    ) => Math.max(...parts.map(hi), outline) - Math.min(...parts.map(lo), 0);
    const { width: ow, height: oh } = this.preview!.placement;
    const u = size(
      (p) => p.u0,
      (p) => p.u1,
      ow,
    );
    const v = size(
      (p) => p.v0,
      (p) => p.v1,
      depth,
    );
    const z = size(
      (p) => p.z0,
      (p) => p.z1,
      oh,
    );
    const w = Math.max(this.width - 2 * MARGIN, 1);
    const h = Math.max(this.height - 2 * MARGIN, 1);
    this.k = Math.min(w / Math.max(u, v, 1), h / Math.max(z, v, 1));
    this.ox = MARGIN + (w - (a1 - a0) * this.k) / 2 - a0 * this.k;
    this.oy = MARGIN + (h + (b1 - b0) * this.k) / 2 + b0 * this.k;
  }

  private draw(): void {
    usePlanColors(this.host.colors?.() ?? DEFAULT_PLAN_COLORS);
    const c = planColors();
    const ctx = this.ctx;
    const dpr = window.devicePixelRatio || 1;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = c.paper;
    ctx.fillRect(0, 0, this.width, this.height);
    const preview = this.preview;
    if (!preview) return;
    const { placement, depth } = preview;
    const shape = openingShape(preview.design, placement, depth).parts;
    const parts = projectParts(shape, this.side, placement.width, depth);
    const outline = outlineOf(this.side, preview);
    this.fit([outline, ...parts], shape, depth);

    // The hole in the Wall, dashed: what the parts sit in.
    ctx.setLineDash([5, 4]);
    ctx.strokeStyle = c.muted;
    ctx.lineWidth = 1;
    this.rect(outline, 'stroke');
    ctx.setLineDash([]);
    for (const p of parts) {
      ctx.fillStyle = partFill(p.kind, c);
      this.rect(p, 'fill');
      ctx.strokeStyle = c.wallStroke;
      ctx.lineWidth = p.kind === 'glass' ? 0.5 : 1;
      this.rect(p, 'stroke');
    }
    this.drawHandles(c);
  }

  private drawHandles(c: PlanColors): void {
    const ctx = this.ctx;
    const active = this.dragging?.handle.parameter ?? this.hover?.parameter;
    for (const h of this.handles()) {
      const x = this.x(h.a);
      const y = this.y(h.b);
      ctx.beginPath();
      ctx.arc(x, y, h.parameter === active ? 6 : 5, 0, Math.PI * 2);
      ctx.fillStyle = h.parameter === active ? c.accent : c.paper;
      ctx.fill();
      ctx.strokeStyle = c.accent;
      ctx.lineWidth = 2;
      ctx.stroke();
      if (this.dragging && h.parameter === this.dragging.handle.parameter && this.dragging.label) {
        ctx.font = FONT;
        ctx.fillStyle = c.label;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'bottom';
        ctx.fillText(this.dragging.label, x + 9, y - 6);
      }
    }
  }

  private rect(r: ProjectedPart, how: 'fill' | 'stroke'): void {
    const x = this.x(r.a0);
    const y = this.y(r.b1);
    const w = (r.a1 - r.a0) * this.k;
    const h = (r.b1 - r.b0) * this.k;
    if (how === 'fill') this.ctx.fillRect(x, y, w, h);
    else this.ctx.strokeRect(x, y, w, h);
  }

  private x(a: number): number {
    return this.ox + a * this.k;
  }

  private y(b: number): number {
    return this.oy - b * this.k;
  }
}
