/**
 * An Elevation on a canvas (tickets 14, 15): core's Elevation drawn straight on, in the plan's
 * colours, fitted to the panel, with its heights: each Level's finished floor and its height on
 * the left, the total height on the right, and each Opening's sill and height beside it. Look and
 * select only: a click picks the front-most Wall face or Opening.
 */
import {
  elevationHeights,
  type Elevation,
  type ElevationShape,
  type HeightDimension,
  type LevelId,
  type OpeningId,
  type WallFaceName,
  type WallId,
} from '@urdama/core';
import {
  DEFAULT_PLAN_COLORS,
  partFill,
  planColors,
  usePlanColors,
  type PlanColors,
} from './draw-plan';

export interface ElevationHost {
  /** The theme's colours, read before each draw */
  colors?(): PlanColors;
  /** A click: the shape under the pointer, or null for empty space */
  picked(shape: ElevationShape | null): void;
  /** mm as metres the way the user reads them ("2,94") */
  metres(mm: number): string;
  /** A translated text ("Total height") */
  text(key: string): string;
}

export interface ElevationSelection {
  readonly walls: ReadonlySet<WallId>;
  readonly openings: ReadonlySet<OpeningId>;
  /** Single Wall faces, as `level/wall/face` (a Façade picked in the Quantities) */
  readonly faces: ReadonlySet<string>;
}

/** The key of one Wall face of a Level, as ElevationSelection.faces holds it. */
export const wallFaceKey = (level: LevelId, wall: WallId, face: WallFaceName): string =>
  `${level}/${wall}/${face}`;

/** px around the drawing: room for the heights on the left and the right */
const MARGIN = { left: 96, right: 92, top: 18, bottom: 22 } as const;
const FONT = '11px system-ui, sans-serif';

export class ElevationView {
  private readonly ctx: CanvasRenderingContext2D;
  private readonly resize: ResizeObserver;
  private elevation: Elevation | null = null;
  private hidden: ReadonlySet<LevelId> = new Set();
  private selection: ElevationSelection = {
    walls: new Set(),
    openings: new Set(),
    faces: new Set(),
  };
  private width = 0;
  private height = 0;
  private frame = 0;
  /** px per mm and the screen position of u = 0, z = 0 */
  private k = 1;
  /** The shown drawing's extent in the Elevation (mm), from the last fit */
  private extent = { u0: 0, u1: 0 };
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
    this.extent = { u0, u1 };
    const w = Math.max(this.width - MARGIN.left - MARGIN.right, 1);
    const h = Math.max(this.height - MARGIN.top - MARGIN.bottom, 1);
    this.k = Math.min(w / Math.max(u1 - u0, 1), h / Math.max(z1 - z0, 1));
    this.ox = MARGIN.left + (w - (u1 - u0) * this.k) / 2 - u0 * this.k;
    this.oy = MARGIN.top + (h + (z1 - z0) * this.k) / 2 + z0 * this.k;
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
    ctx.moveTo(8, this.y(ground));
    ctx.lineTo(this.width - 8, this.y(ground));
    ctx.stroke();

    for (const s of shapes) this.drawShape(s, c);
    if (this.elevation) this.drawHeights(elevationHeights(this.elevation, this.hidden), shapes, c);
  }

  /** The heights: the Levels on the left, the total on the right, each Opening beside it. */
  private drawHeights(
    dims: readonly HeightDimension[],
    shapes: readonly ElevationShape[],
    c: PlanColors,
  ): void {
    const ctx = this.ctx;
    const left = this.x(this.extent.u0);
    const right = this.x(this.extent.u1);
    ctx.save();
    ctx.font = FONT;
    ctx.textBaseline = 'middle';
    for (const d of dims) {
      if (d.kind === 'level') {
        // Its finished floor: a level line under the drawing's left edge, with its height.
        const y = this.y(d.z0);
        ctx.strokeStyle = c.muted;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(left - 30, y);
        ctx.lineTo(left - 2, y);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = c.label;
        ctx.textAlign = 'right';
        const sign = d.z0 > 0.5 ? '+' : d.z0 < -0.5 ? '−' : '±';
        ctx.fillText(this.fitText(d.name, MARGIN.left - 40), left - 32, y - 19);
        ctx.fillText(`${sign}${this.host.metres(Math.abs(d.z0))}`, left - 32, y - 7);
        this.dimension(left - 16, d, c, 'left');
      } else if (d.kind === 'total') {
        this.dimension(right + 16, d, c, 'right', this.host.text('layout.heights.total'));
      } else {
        this.dimension(this.x(d.u) + 6, d, c, 'right');
      }
    }
    ctx.restore();
  }

  /** The text, shortened with an ellipsis to fit `width` px. */
  private fitText(text: string, width: number): string {
    if (this.ctx.measureText(text).width <= width) return text;
    let t = text;
    while (t.length > 1 && this.ctx.measureText(t + '…').width > width) t = t.slice(0, -1);
    return t + '…';
  }

  /** A vertical dimension at screen x, with its value (and a caption) on one side. */
  private dimension(
    x: number,
    d: HeightDimension,
    c: PlanColors,
    side: 'left' | 'right',
    caption?: string,
  ): void {
    const ctx = this.ctx;
    const y0 = this.y(d.z0);
    const y1 = this.y(d.z1);
    ctx.strokeStyle = c.muted;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, y0);
    ctx.lineTo(x, y1);
    for (const y of [y0, y1]) {
      ctx.moveTo(x - 3, y + 3);
      ctx.lineTo(x + 3, y - 3);
    }
    ctx.stroke();
    // Too short to label: the line alone.
    if (Math.abs(y0 - y1) < 12) return;
    const value = this.host.metres(d.z1 - d.z0);
    ctx.fillStyle = d.kind === 'total' ? c.label : c.muted;
    ctx.textAlign = side === 'left' ? 'right' : 'left';
    const dx = side === 'left' ? -4 : 4;
    const mid = (y0 + y1) / 2;
    if (caption) {
      ctx.fillText(caption, x + dx, mid - 7);
      ctx.fillText(value, x + dx, mid + 7);
    } else {
      ctx.fillText(value, x + dx, mid);
    }
  }

  private drawShape(s: ElevationShape, c: PlanColors): void {
    const ctx = this.ctx;
    const x = this.x(s.rect.u0);
    const y = this.y(s.rect.z1);
    const w = (s.rect.u1 - s.rect.u0) * this.k;
    const h = (s.rect.z1 - s.rect.z0) * this.k;
    const selected =
      (s.kind === 'opening' && this.selection.openings.has(s.opening)) ||
      (s.kind === 'wallFace' &&
        (this.selection.walls.has(s.wall) ||
          this.selection.faces.has(wallFaceKey(s.level, s.wall, s.face))));
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
        // The hole, then the family's parts seen straight on (ticket 19); a plain wall
        // opening has none and shows dashed.
        ctx.fillStyle = c.paper;
        ctx.fillRect(x, y, w, h);
        for (const p of s.parts) {
          const px = this.x(p.rect.u0);
          const py = this.y(p.rect.z1);
          const pw = (p.rect.u1 - p.rect.u0) * this.k;
          const ph = (p.rect.z1 - p.rect.z0) * this.k;
          ctx.fillStyle = partFill(p.kind, c);
          ctx.fillRect(px, py, pw, ph);
          ctx.strokeStyle = c.wallStroke;
          ctx.lineWidth = p.kind === 'glass' ? 0.5 : 0.75;
          ctx.strokeRect(px, py, pw, ph);
        }
        ctx.strokeStyle = selected ? c.accent : c.wallStroke;
        ctx.lineWidth = selected ? 2 : 1.25;
        if (!s.parts.length) ctx.setLineDash([5, 4]);
        ctx.strokeRect(x, y, w, h);
        ctx.setLineDash([]);
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
