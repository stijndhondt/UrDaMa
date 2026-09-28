/**
 * The Wall tool (W): for odd Walls (Box-drawing interaction on the foundation map).
 * Press, drag and release; or click the start point, type a length (now locked) and rotate with
 * the mouse, optionally Tab + angle, Enter. S cycles the side the thickness goes. Angles snap to
 * 15° (Shift: 45°, Ctrl: free to 1°); lengths to 10 mm (Shift: 100, Ctrl: 1). Ends snap to Wall
 * ends, outline corners and faces; how the new Wall joins them is decided by the DrawWall command.
 */
import {
  drawWall,
  levelWallOutlines,
  type DrawWallArgs,
  type Vec,
  type WallSide,
} from '@lakudemis/core';
import { drawSnap, increment, snapToWalls, SNAP_RADIUS_PX, type WallSnap } from '../snap';
import { parseAngle, parseLength } from '../units';
import type { PointerInfo, Tool, ToolContext } from './tool';
import { planColors } from '../draw-plan';

type State =
  | { readonly kind: 'idle' }
  | { readonly kind: 'dragging'; readonly start: Vec; end: Vec }
  /** A click set the start point; waiting for typed values or a second click. */
  | { readonly kind: 'placed'; readonly start: Vec; end: Vec };

const SIDES: readonly WallSide[] = ['right', 'left', 'centre'];
/** A press-and-release shorter than this (px) is a click, not a drag. */
const CLICK_PX = 4;

/** Visual angle in degrees: 0 = right, 90 = up (the plan's y points down). */
const angleOf = (v: Vec) => (Math.atan2(-v.y, v.x) * 180) / Math.PI;
const direction = (deg: number): Vec => ({
  x: Math.cos((deg * Math.PI) / 180),
  y: -Math.sin((deg * Math.PI) / 180),
});

export class WallTool implements Tool {
  readonly name = 'wall' as const;
  private state: State = { kind: 'idle' };
  private side: WallSide = 'right';
  private typed: { length: number | null; angle: number | null } = { length: null, angle: null };
  private snapped: WallSnap | null = null;
  private pressedAt: Vec | null = null;

  constructor(private readonly ctx: ToolContext) {}

  pointerDown(p: PointerInfo): void {
    if (this.state.kind === 'placed') {
      this.state.end = this.endFor(p);
      this.commit();
      return;
    }
    const start = this.snapPoint(p) ?? this.roundPoint(p);
    this.pressedAt = p.screen;
    this.state = { kind: 'dragging', start, end: start };
    this.ctx.invalidate();
  }

  pointerMove(p: PointerInfo): void {
    if (this.state.kind === 'idle') {
      this.snapPoint(p);
      this.ctx.invalidate();
      return;
    }
    this.state.end = this.endFor(p);
    this.updatePreview();
  }

  pointerUp(p: PointerInfo): void {
    if (this.state.kind !== 'dragging') return;
    const moved = this.pressedAt
      ? Math.hypot(p.screen.x - this.pressedAt.x, p.screen.y - this.pressedAt.y)
      : 0;
    if (this.ctx.typed.isOpen) return; // waiting for Enter
    if (moved < CLICK_PX) {
      this.state = { kind: 'placed', start: this.state.start, end: this.state.end };
      this.ctx.invalidate();
      return;
    }
    this.state.end = this.endFor(p);
    this.commit();
  }

  keyDown(e: KeyboardEvent, last: PointerInfo | null): boolean {
    if (e.key === 's' || e.key === 'S') {
      this.side = SIDES[(SIDES.indexOf(this.side) + 1) % SIDES.length]!;
      this.updatePreview();
      this.ctx.invalidate();
      return true;
    }
    if (e.key === 'Escape' && this.state.kind !== 'idle') {
      this.cancel();
      return true;
    }
    if (this.state.kind !== 'idle' && /^[0-9.,]$/.test(e.key) && !this.ctx.typed.isOpen) {
      const at = last?.screen ?? this.ctx.view.toScreen(this.state.end);
      this.ctx.typed.open(
        [
          { label: this.ctx.host.text('editor.typed.length') },
          { label: this.ctx.host.text('editor.typed.angle') },
        ],
        at,
        {
          change: ([length, angle]) => {
            this.typed = { length: parseLength(length ?? ''), angle: parseAngle(angle ?? '') };
            if (last) this.pointerMove(last);
          },
          commit: ([length, angle]) => {
            this.typed = { length: parseLength(length ?? ''), angle: parseAngle(angle ?? '') };
            if (last && this.state.kind !== 'idle') this.state.end = this.endFor(last);
            this.commit();
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
    this.state = { kind: 'idle' };
    this.typed = { length: null, angle: null };
    this.pressedAt = null;
    this.ctx.typed.close();
    this.ctx.host.store.cancelPreview();
    this.ctx.invalidate();
  }

  drawOverlay(ctx: CanvasRenderingContext2D): void {
    if (this.snapped) drawSnap(ctx, this.ctx.view.toScreen(this.snapped.point), this.snapped.kind);
    if (this.state.kind === 'idle') return;
    const a = this.ctx.view.toScreen(this.state.start);
    const b = this.ctx.view.toScreen(this.state.end);
    ctx.save();
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = planColors().label;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = planColors().accent;
    ctx.beginPath();
    ctx.arc(a.x, a.y, 4, 0, Math.PI * 2);
    ctx.fill();
    const v = {
      x: this.state.end.x - this.state.start.x,
      y: this.state.end.y - this.state.start.y,
    };
    const lengthText = this.ctx.host.format.length(Math.hypot(v.x, v.y));
    const locked =
      this.typed.length !== null ? ` (${this.ctx.host.text('editor.wall.locked')})` : '';
    const label = `${lengthText}${locked} · ${Math.round(angleOf(v))}° · ${this.ctx.host.text('editor.wall.side.' + this.side)}`;
    ctx.font = '600 12px system-ui, sans-serif';
    ctx.fillStyle = planColors().accent;
    ctx.textAlign = 'left';
    ctx.fillText(label, b.x + 12, b.y - 12);
    ctx.restore();
  }

  /** Snaps to Wall ends first, then outline corners and faces, within the snap radius. */
  private snapPoint(p: PointerInfo): Vec | null {
    const model = this.ctx.host.store.committedModel();
    const level = this.ctx.host.level();
    const radius = SNAP_RADIUS_PX / this.ctx.view.scale;
    let best: WallSnap | null = null;
    let bestDistance = radius;
    for (const w of Object.values(model.walls)) {
      if (w.level !== level) continue;
      for (const q of [w.start, w.end]) {
        const d = Math.hypot(q.x - p.model.x, q.y - p.model.y);
        if (d <= bestDistance) {
          bestDistance = d;
          best = { point: q, kind: 'corner' };
        }
      }
    }
    this.snapped =
      best ?? snapToWalls(p.model, levelWallOutlines(model, level).values(), radius, increment(p));
    return this.snapped?.point ?? null;
  }

  private roundPoint(p: PointerInfo): Vec {
    const step = increment(p);
    return { x: Math.round(p.model.x / step) * step, y: Math.round(p.model.y / step) * step };
  }

  /** The end point: typed length wins; else a snapped point; else angle and length increments. */
  private endFor(p: PointerInfo): Vec {
    if (this.state.kind === 'idle') return p.model;
    const start = this.state.start;
    const v = { x: p.model.x - start.x, y: p.model.y - start.y };
    let angle = this.typed.angle ?? snapAngle(angleOf(v), p);
    if (this.typed.length !== null) {
      this.snapped = null;
      const d = direction(angle);
      return { x: start.x + d.x * this.typed.length, y: start.y + d.y * this.typed.length };
    }
    const snapped = this.snapPoint(p);
    if (snapped && (snapped.x !== start.x || snapped.y !== start.y)) return snapped;
    if (this.typed.angle !== null) angle = this.typed.angle;
    const step = increment(p);
    const length = Math.round(Math.hypot(v.x, v.y) / step) * step;
    const d = direction(angle);
    return { x: start.x + d.x * length, y: start.y + d.y * length };
  }

  private args(): DrawWallArgs {
    const s = this.state as Exclude<State, { kind: 'idle' }>;
    return {
      level: this.ctx.host.level(),
      start: s.start,
      end: s.end,
      side: this.side,
      roomName: (i) => this.ctx.host.nextRoomName(i),
    };
  }

  private updatePreview(): void {
    if (this.state.kind === 'idle') return;
    const outcome = this.ctx.host.store.preview(drawWall, this.args());
    if (!outcome.ok) this.ctx.host.store.cancelPreview();
    this.ctx.invalidate();
  }

  private commit(): void {
    if (this.state.kind === 'idle') return;
    const args = this.args();
    const at = this.ctx.view.toScreen(args.end);
    this.ctx.host.store.cancelPreview();
    const result = this.ctx.host.store.run(drawWall, args);
    if (!result.ok) this.ctx.host.refused(result.reason, at);
    this.state = { kind: 'idle' };
    this.typed = { length: null, angle: null };
    this.pressedAt = null;
    this.ctx.typed.close();
    this.ctx.invalidate();
  }
}

/** Angle snapping (Slice 1 spec): 15° when close; Shift = 45° steps; Ctrl = free, to 1°. */
function snapAngle(angle: number, mods: { shift: boolean; ctrl: boolean }): number {
  if (mods.ctrl) return Math.round(angle);
  if (mods.shift) return Math.round(angle / 45) * 45;
  const nearest = Math.round(angle / 15) * 15;
  return Math.abs(angle - nearest) < 4 ? nearest : angle;
}
