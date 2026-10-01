/**
 * An Elevation on a canvas (ticket 14): core's Elevation drawn straight on, in the plan's colours,
 * fitted to the panel. Look and select only: a click picks the front-most Wall face or Opening.
 */
import type { Elevation, ElevationShape, LevelId, OpeningId, WallId } from '@lakudemis/core';
import { DEFAULT_PLAN_COLORS, planColors, usePlanColors, type PlanColors } from './draw-plan';

export interface ElevationHost {
  /** The theme's colours, read before each draw */
  colors?(): PlanColors;
  /** A click: the shape under the pointer, or null for empty space */
  picked(shape: ElevationShape | null): void;
}

export interface ElevationSelection {
  readonly walls: ReadonlySet<WallId>;
  readonly openings: ReadonlySet<OpeningId>;
}

const MARGIN = 24; // px around the drawing

export class ElevationView {
  private readonly ctx: CanvasRenderingContext2D;
  private readonly resize: ResizeObserver;
  private elevation: Elevation | null = null;
  private hidden: ReadonlySet<LevelId> = new Set();
  private selection: ElevationSelection = { walls: new Set(), openings: new Set() };
  private width = 0;
  private height = 0;
  private frame = 0;
  /** px per mm and the screen position of u = 0, z = 0 */
  private k = 1;
  private ox = 0;
  private oy = 0;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly host: ElevationHost,
  ) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas2D is not available');
    this.ctx = ctx;
    canvas.addEventListener('click', this.onClick);
    this.resize = new ResizeObserver(() => this.measure());
    this.resize.observe(canvas);
    this.measure();
  }

  /** What to draw, and which Levels the Building panel hides. */
  set(elevation: Elevation, hidden: ReadonlySet<LevelId>): void {
    this.elevation = elevation;
    this.hidden = hidden;
    this.invalidate();
  }

  setSelection(selection: ElevationSelection): void {
    this.selection = selection;
    this.invalidate();
  }

  /** The theme changed. */
  redraw(): void {
    this.invalidate();
  }

  destroy(): void {
    cancelAnimationFrame(this.frame);
    this.resize.disconnect();
    this.canvas.removeEventListener('click', this.onClick);
  }

  /** The shapes shown, back to front. */
  private shapes(): readonly ElevationShape[] {
    return this.elevation?.shapes.filter((s) => !this.hidden.has(s.level)) ?? [];
  }

  private readonly onClick = (e: MouseEvent): void => {
    const r = this.canvas.getBoundingClientRect();
    const u = (e.clientX - r.left - this.ox) / this.k;
    const z = (this.oy - (e.clientY - r.top)) / this.k;
    const hit = [...this.shapes()]
      .reverse()
      .find(
        (s) =>
          s.kind !== 'slabEdge' &&
          u >= s.rect.u0 &&
          u <= s.rect.u1 &&
          z >= s.rect.z0 &&
          z <= s.rect.z1,
      );
    this.host.picked(hit ?? null);
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

  /** Fits the shown shapes into the canvas, centred. */
  private fit(shapes: readonly ElevationShape[]): void {
    if (!shapes.length) return;
    const u0 = Math.min(...shapes.map((s) => s.rect.u0));
    const u1 = Math.max(...shapes.map((s) => s.rect.u1));
    const z0 = Math.min(...shapes.map((s) => s.rect.z0));
    const z1 = Math.max(...shapes.map((s) => s.rect.z1));
    const w = Math.max(this.width - 2 * MARGIN, 1);
    const h = Math.max(this.height - 2 * MARGIN, 1);
    this.k = Math.min(w / Math.max(u1 - u0, 1), h / Math.max(z1 - z0, 1));
    this.ox = (this.width - (u1 - u0) * this.k) / 2 - u0 * this.k;
    this.oy = (this.height + (z1 - z0) * this.k) / 2 + z0 * this.k;
  }

  private draw(): void {
    usePlanColors(this.host.colors?.() ?? DEFAULT_PLAN_COLORS);
    const c = planColors();
    const ctx = this.ctx;
    const dpr = window.devicePixelRatio || 1;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = c.paper;
    ctx.fillRect(0, 0, this.width, this.height);
    const shapes = this.shapes();
    if (!shapes.length) return;
    this.fit(shapes);

    // The ground line under the lowest Slab.
    const ground = Math.min(...shapes.map((s) => s.rect.z0));
    ctx.strokeStyle = c.wallStroke;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(MARGIN / 2, this.y(ground));
    ctx.lineTo(this.width - MARGIN / 2, this.y(ground));
    ctx.stroke();

    for (const s of shapes) this.drawShape(s, c);
  }

  private drawShape(s: ElevationShape, c: PlanColors): void {
    const ctx = this.ctx;
    const x = this.x(s.rect.u0);
    const y = this.y(s.rect.z1);
    const w = (s.rect.u1 - s.rect.u0) * this.k;
    const h = (s.rect.z1 - s.rect.z0) * this.k;
    const selected =
      (s.kind === 'opening' && this.selection.openings.has(s.opening)) ||
      (s.kind === 'wallFace' && this.selection.walls.has(s.wall));
    ctx.setLineDash([]);
    ctx.lineWidth = 1;
    switch (s.kind) {
      case 'wallFace':
        ctx.fillStyle = selected ? c.areaChanged : c.area;
        ctx.fillRect(x, y, w, h);
        ctx.strokeStyle = selected ? c.accent : c.wallStroke;
        ctx.lineWidth = selected ? 2 : 1;
        ctx.strokeRect(x, y, w, h);
        return;
      case 'slabEdge':
        ctx.fillStyle = c.wallFill;
        ctx.fillRect(x, y, w, h);
        ctx.strokeStyle = c.wallStroke;
        ctx.strokeRect(x, y, w, h);
        return;
      case 'opening': {
        ctx.fillStyle = s.openingKind === 'window' ? c.levelBelow : c.paper;
        ctx.fillRect(x, y, w, h);
        ctx.strokeStyle = selected ? c.accent : c.wallStroke;
        ctx.lineWidth = selected ? 2 : 1.25;
        if (s.openingKind === 'wallOpening') ctx.setLineDash([5, 4]);
        ctx.strokeRect(x, y, w, h);
        ctx.setLineDash([]);
        ctx.lineWidth = 1;
        ctx.beginPath();
        if (s.openingKind === 'window' && w > 12) {
          // The frame's middle post.
          ctx.moveTo(x + w / 2, y);
          ctx.lineTo(x + w / 2, y + h);
        } else if (s.openingKind === 'garageDoor') {
          // Its sections.
          for (let i = 1; i < 5; i++) {
            ctx.moveTo(x, y + (h * i) / 5);
            ctx.lineTo(x + w, y + (h * i) / 5);
          }
        } else if (s.openingKind === 'door') {
          // The handle side.
          ctx.moveTo(x + w * 0.85, y + h * 0.5);
          ctx.lineTo(x + w * 0.85, y + h * 0.56);
        }
        ctx.stroke();
        return;
      }
    }
  }

  private x(u: number): number {
    return this.ox + u * this.k;
  }

  private y(z: number): number {
    return this.oy - z * this.k;
  }
}
