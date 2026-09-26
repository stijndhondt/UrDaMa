/**
 * The Door (D) and Window (N) tools (Slice 1 spec). Hover a Wall: the Opening slides along it,
 * showing its distance to both inside corners, as measured with a tape. Click places it; or type
 * the distance (from the first corner), width and height (and sill), Tab between fields, Enter.
 * F / Shift+F flip a door's hinge side / swing direction.
 */
import {
  addOpening,
  insideRing,
  levelWallOutlines,
  wallDirection,
  fullThicknessSpan,
  wallNormal,
  type AddOpeningArgs,
  type OpeningKind,
  type Vec,
  type Wall,
  type WallId,
  type WallOutline,
} from '@lakudemis/core';
import { distanceToSegment } from '@lakudemis/core';
import { increment } from '../snap';
import { parseLength } from '../units';
import type { PointerInfo, Tool, ToolContext } from './tool';

interface Hover {
  readonly wall: WallId;
  /** mm along the Baseline to the near edge */
  readonly offset: number;
  /** Which face the pointer is on: distances are measured along it. */
  readonly face: 'lo' | 'hi';
  /** mm along the Baseline: where the pointer is (picks the stretch of face between corners) */
  readonly at: number;
}

export class OpeningTool implements Tool {
  readonly name: 'door' | 'window';
  private hover: Hover | null = null;
  private hinge: 'start' | 'end' = 'start';
  private swing: 'left' | 'right' = 'right';
  private typed: {
    distance: number | null;
    width: number | null;
    height: number | null;
    sill: number | null;
  } = {
    distance: null,
    width: null,
    height: null,
    sill: null,
  };

  constructor(
    private readonly ctx: ToolContext,
    private readonly kind: OpeningKind,
  ) {
    this.name = kind;
  }

  pointerDown(p: PointerInfo): void {
    this.update(p);
    this.commit(p.screen);
  }

  pointerMove(p: PointerInfo): void {
    if (this.ctx.typed.isOpen) return;
    this.update(p);
  }

  pointerUp(): void {
    // placed on press
  }

  keyDown(e: KeyboardEvent, last: PointerInfo | null): boolean {
    if ((e.key === 'f' || e.key === 'F') && this.kind === 'door') {
      if (e.shiftKey) this.swing = this.swing === 'left' ? 'right' : 'left';
      else this.hinge = this.hinge === 'start' ? 'end' : 'start';
      this.preview();
      return true;
    }
    if (e.key === 'Escape' && (this.hover || this.ctx.typed.isOpen)) {
      this.cancel();
      return true;
    }
    if (this.hover && /^[0-9.,]$/.test(e.key) && !this.ctx.typed.isOpen) {
      const t = (k: string) => this.ctx.host.text(k);
      const fields = [
        { label: t('editor.opening.distance') },
        { label: t('editor.opening.width'), value: String(this.size().width) },
        { label: t('editor.opening.height'), value: String(this.size().height) },
        ...(this.kind === 'window'
          ? [{ label: t('editor.opening.sill'), value: String(this.size().sill) }]
          : []),
      ];
      const read = (values: readonly string[]) => {
        this.typed = {
          distance: parseLength(values[0] ?? ''),
          width: parseLength(values[1] ?? ''),
          height: parseLength(values[2] ?? ''),
          sill: this.kind === 'window' ? parseLength(values[3] ?? '') : 0,
        };
      };
      this.ctx.typed.open(
        fields,
        last?.screen ?? { x: 100, y: 100 },
        {
          change: (values) => {
            read(values);
            this.preview();
          },
          commit: (values) => {
            read(values);
            this.commit(last?.screen ?? { x: 100, y: 100 });
          },
          cancel: () => this.cancel(),
        },
        e.key,
      );
      return true;
    }
    return false;
  }

  cancel(): void {
    this.hover = null;
    this.typed = { distance: null, width: null, height: null, sill: null };
    this.ctx.typed.close();
    this.ctx.host.store.cancelPreview();
    this.ctx.invalidate();
  }

  drawOverlay(ctx: CanvasRenderingContext2D): void {
    const args = this.args();
    if (!args || !this.hover) return;
    const wall = this.ctx.host.store.committedModel().walls[args.wall];
    const outline = levelWallOutlines(
      this.ctx.host.store.committedModel(),
      this.ctx.host.level(),
    ).get(args.wall);
    if (!wall || !outline) return;
    const { first, last } = this.insideCorners(wall, outline, this.hover.face, this.hover.at);
    const d = wallDirection(wall);
    const n = wallNormal(wall);
    const faceOffset = this.hover.face === 'lo' ? 0 : 1;
    const facePoint = outline[faceOffset === 0 ? 0 : 3]!;
    const offsetN = (facePoint.x - wall.start.x) * n.x + (facePoint.y - wall.start.y) * n.y;
    const out = this.hover.face === 'lo' ? -1 : 1;
    const at = (t: number, extra: number): Vec => {
      const base = {
        x: wall.start.x + d.x * t + n.x * offsetN,
        y: wall.start.y + d.y * t + n.y * offsetN,
      };
      return this.ctx.view.toScreen({
        x: base.x + n.x * out * extra,
        y: base.y + n.y * out * extra,
      });
    };
    const width = args.width ?? 0;
    const pad = 18 / this.ctx.view.scale;
    const labels: [number, number][] = [
      [first, args.offset],
      [args.offset + width, last],
    ];
    ctx.save();
    ctx.font = '600 12px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const [from, to] of labels) {
      if (to - from < 1) continue;
      const a = at(from, pad);
      const b = at(to, pad);
      ctx.strokeStyle = '#2f6fde';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      const text = this.ctx.host.format.length(to - from);
      const w = ctx.measureText(text).width + 8;
      ctx.fillStyle = 'rgba(255,255,255,.92)';
      ctx.fillRect(mid.x - w / 2, mid.y - 9, w, 18);
      ctx.fillStyle = '#2f6fde';
      ctx.fillText(text, mid.x, mid.y);
    }
    ctx.restore();
  }

  private size(): { width: number; height: number; sill: number } {
    const p = this.ctx.host.store.committedModel().project.presets;
    const door = this.kind === 'door';
    return {
      width: this.typed.width ?? (door ? p.doorWidth : p.windowWidth),
      height: this.typed.height ?? (door ? p.doorHeight : p.windowHeight),
      sill: this.typed.sill ?? (door ? 0 : p.windowSill),
    };
  }

  /**
   * The inside corners around a point on one face, as Baseline positions: where the face ends,
   * or where another Wall (a corner or a T) meets it, whichever is nearest on each side.
   */
  private insideCorners(
    wall: Wall,
    outline: WallOutline,
    face: 'lo' | 'hi',
    at: number,
  ): { first: number; last: number } {
    const d = wallDirection(wall);
    const n = wallNormal(wall);
    const t = (p: Vec) => (p.x - wall.start.x) * d.x + (p.y - wall.start.y) * d.y;
    const s = (p: Vec) => (p.x - wall.start.x) * n.x + (p.y - wall.start.y) * n.y;
    const [a, b] = face === 'lo' ? [outline[0], outline[1]] : [outline[3], outline[2]];
    const onFace = s(a);
    let first = Math.min(t(a), t(b));
    let last = Math.max(t(a), t(b));
    const outlines = levelWallOutlines(this.ctx.host.store.committedModel(), this.ctx.host.level());
    for (const [id, other] of outlines) {
      if (id === wall.id) continue;
      const touching = other.filter((p) => Math.abs(s(p) - onFace) < 0.5).map(t);
      if (!touching.length) continue;
      const lo = Math.min(...touching);
      const hi = Math.max(...touching);
      if (hi <= at) first = Math.max(first, hi);
      else if (lo >= at) last = Math.min(last, lo);
    }
    return { first, last };
  }

  private update(p: PointerInfo): void {
    const model = this.ctx.host.store.committedModel();
    const outlines = levelWallOutlines(model, this.ctx.host.level());
    const radius = 12 / this.ctx.view.scale;
    let best: { wall: Wall; outline: WallOutline; d: number } | null = null;
    for (const [id, outline] of outlines) {
      const wall = model.walls[id];
      if (!wall) continue;
      const inside = insideRing(p.model, outline);
      const d = inside
        ? 0
        : Math.min(
            ...[0, 1, 2, 3].map((i) =>
              distanceToSegment(p.model, outline[i]!, outline[(i + 1) % 4]!),
            ),
          );
      if (d <= radius && (!best || d < best.d)) best = { wall, outline, d };
    }
    if (!best) {
      if (this.hover) {
        this.hover = null;
        this.ctx.host.store.cancelPreview();
        this.ctx.invalidate();
      }
      return;
    }
    const { wall } = best;
    const d = wallDirection(wall);
    const n = wallNormal(wall);
    const t = (p.model.x - wall.start.x) * d.x + (p.model.y - wall.start.y) * d.y;
    const side = (p.model.x - wall.start.x) * n.x + (p.model.y - wall.start.y) * n.y;
    const loOffset =
      (best.outline[0].x - wall.start.x) * n.x + (best.outline[0].y - wall.start.y) * n.y;
    const hiOffset =
      (best.outline[3].x - wall.start.x) * n.x + (best.outline[3].y - wall.start.y) * n.y;
    const face: 'lo' | 'hi' = Math.abs(side - loOffset) <= Math.abs(side - hiOffset) ? 'lo' : 'hi';
    const { width } = this.size();
    const step = increment(p);
    // Snap the distance from the inside corner, and stay where the Wall is full thickness.
    const { first, last } = this.insideCorners(wall, best.outline, face, t);
    const span = fullThicknessSpan(wall, best.outline);
    const min = Math.max(first, span.start);
    const max = Math.min(last, span.end) - width;
    const offset = Math.max(
      min,
      Math.min(max, first + Math.round((t - width / 2 - first) / step) * step),
    );
    this.hover = { wall: wall.id, offset, face, at: t };
    this.preview();
  }

  private args(): AddOpeningArgs | null {
    if (!this.hover) return null;
    const size = this.size();
    let offset = this.hover.offset;
    if (this.typed.distance !== null) {
      const wall = this.ctx.host.store.committedModel().walls[this.hover.wall];
      const outline = levelWallOutlines(
        this.ctx.host.store.committedModel(),
        this.ctx.host.level(),
      ).get(this.hover.wall);
      if (wall && outline)
        offset =
          this.insideCorners(wall, outline, this.hover.face, this.hover.at).first +
          this.typed.distance;
    }
    return {
      wall: this.hover.wall,
      kind: this.kind,
      offset,
      width: size.width,
      height: size.height,
      sill: size.sill,
      hinge: this.hinge,
      swing: this.swing,
    };
  }

  private preview(): void {
    const args = this.args();
    if (!args) return;
    if (!this.ctx.host.store.preview(addOpening, args).ok) this.ctx.host.store.cancelPreview();
    this.ctx.invalidate();
  }

  private commit(at: Vec): void {
    const args = this.args();
    this.ctx.host.store.cancelPreview();
    this.ctx.typed.close();
    this.typed = { distance: null, width: null, height: null, sill: null };
    if (!args) return;
    const result = this.ctx.host.store.run(addOpening, args);
    if (!result.ok) this.ctx.host.refused(result.reason, at);
    this.ctx.invalidate();
  }
}
