/**
 * The Room tool (R): the main way to draw (Box-drawing interaction, spec "Editor").
 * Drag a rectangle that is the Room's inside size as measured with a tape (S: outside size),
 * or click, then type width, Tab, depth, Enter. Corners snap to Wall corners and faces, so a Room
 * started on an existing Wall's far face shares that Wall. Clicking inside an enclosed area that
 * has no Room turns it into a Room. The Room and its area show live while dragging.
 */
import {
  addRoom,
  drawRoom,
  insideArea,
  levelWallOutlines,
  type DrawRoomArgs,
  type Vec,
} from '@lakudemis/core';
import {
  drawSnap,
  increment,
  snapToIncrement,
  snapToWalls,
  SNAP_RADIUS_PX,
  type WallSnap,
} from '../snap';
import { parseLength } from '../units';
import { wallEnds, type PointerInfo, type Tool, type ToolContext } from './tool';

type State =
  | { readonly kind: 'idle' }
  | { readonly kind: 'dragging'; readonly start: Vec; current: Vec }
  /** A click set the start corner; waiting for typed sizes or a second click. */
  | { readonly kind: 'placed'; readonly start: Vec; current: Vec };

export class RoomTool implements Tool {
  readonly name = 'room' as const;
  private state: State = { kind: 'idle' };
  private size: 'inside' | 'outside' = 'inside';
  private typed: { w: number | null; d: number | null } = { w: null, d: null };
  private snapped: WallSnap | null = null;

  constructor(private readonly ctx: ToolContext) {}

  pointerDown(p: PointerInfo): void {
    if (this.state.kind === 'placed') {
      this.state.current = this.snap(p);
      this.commit();
      return;
    }
    const start = this.snap(p);
    this.state = { kind: 'dragging', start, current: start };
    this.ctx.invalidate();
  }

  pointerMove(p: PointerInfo): void {
    const point = this.snap(p);
    if (this.state.kind === 'idle') {
      this.ctx.invalidate(); // show the snap marker
      return;
    }
    this.state.current = point;
    this.updatePreview();
  }

  pointerUp(p: PointerInfo): void {
    if (this.state.kind !== 'dragging') return;
    this.state.current = this.snap(p);
    const { start, current } = this.state;
    const dragged = current.x !== start.x || current.y !== start.y;
    if (this.ctx.typed.isOpen) return; // wait for Enter
    if (!dragged) {
      if (this.createRoomInEmptyArea(p)) return;
      // A click: the start corner is placed; type the sizes or click the opposite corner.
      this.state = { kind: 'placed', start, current };
      this.ctx.invalidate();
      return;
    }
    this.commit();
  }

  keyDown(e: KeyboardEvent, last: PointerInfo | null): boolean {
    if (e.key === 's' || e.key === 'S') {
      this.size = this.size === 'inside' ? 'outside' : 'inside';
      this.updatePreview();
      return true;
    }
    if (e.key === 'Escape' && this.state.kind !== 'idle') {
      this.cancel();
      return true;
    }
    if (this.state.kind !== 'idle' && /^[0-9.,]$/.test(e.key) && !this.ctx.typed.isOpen) {
      const at = last?.screen ?? this.ctx.view.toScreen(this.state.current);
      this.ctx.typed.open(
        [
          { label: this.ctx.host.text('editor.typed.width') },
          { label: this.ctx.host.text('editor.typed.depth') },
        ],
        at,
        {
          change: ([w, d]) => {
            this.typed = { w: parseLength(w ?? ''), d: parseLength(d ?? '') };
            this.updatePreview();
          },
          commit: ([w, d]) => {
            this.typed = { w: parseLength(w ?? ''), d: parseLength(d ?? '') };
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
    this.typed = { w: null, d: null };
    this.ctx.typed.close();
    this.ctx.host.store.cancelPreview();
    this.ctx.invalidate();
  }

  drawOverlay(ctx: CanvasRenderingContext2D): void {
    if (this.snapped) drawSnap(ctx, this.ctx.view.toScreen(this.snapped.point), this.snapped.kind);
    if (this.state.kind === 'idle') return;
    const { from, to } = this.rectangle();
    const a = this.ctx.view.toScreen(from);
    const b = this.ctx.view.toScreen(to);
    ctx.save();
    ctx.setLineDash([5, 4]);
    ctx.strokeStyle = '#2f6fde';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(
      Math.min(a.x, b.x),
      Math.min(a.y, b.y),
      Math.abs(b.x - a.x),
      Math.abs(b.y - a.y),
    );
    ctx.setLineDash([]);
    const s = this.ctx.view.toScreen(this.state.start);
    ctx.fillStyle = '#2f6fde';
    ctx.beginPath();
    ctx.arc(s.x, s.y, 4, 0, Math.PI * 2);
    ctx.fill();
    const w = Math.abs(to.x - from.x);
    const d = Math.abs(to.y - from.y);
    const label = `${this.ctx.host.format.length(w)} × ${this.ctx.host.format.length(d)} · ${this.ctx.host.text(
      this.size === 'inside' ? 'editor.room.insideSize' : 'editor.room.outsideSize',
    )}`;
    ctx.font = '600 12px system-ui, sans-serif';
    ctx.fillStyle = '#2f6fde';
    ctx.textAlign = 'left';
    ctx.fillText(label, Math.max(a.x, b.x) + 10, Math.max(a.y, b.y) + 16);
    ctx.restore();
  }

  /** Wall corners and faces win over drag increments. */
  private snap(p: PointerInfo): Vec {
    // Snap to committed Walls only: never to the Room being drawn.
    const outlines = levelWallOutlines(
      this.ctx.host.store.committedModel(),
      this.ctx.host.level(),
    ).values();
    this.snapped = snapToWalls(
      p.model,
      outlines,
      SNAP_RADIUS_PX / this.ctx.view.scale,
      increment(p),
      wallEnds(this.ctx),
    );
    return this.snapped?.point ?? snapToIncrement(p.model, increment(p));
  }

  /** A click inside an enclosed area without a Room makes it a Room. */
  private createRoomInEmptyArea(p: PointerInfo): boolean {
    const level = this.ctx.host.level();
    const empty = this.ctx.host.store.values
      .level(level)
      .footprint()
      .areas.find((a) => !a.rooms.length && insideArea(p.model, a.outline, a.islands));
    if (!empty) return false;
    const result = this.ctx.host.store.run(addRoom, {
      level,
      seed: p.model,
      name: this.ctx.host.nextRoomName(),
    });
    if (!result.ok) this.ctx.host.refused(result.reason, p.screen);
    this.state = { kind: 'idle' };
    this.ctx.invalidate();
    return true;
  }

  /** The rectangle to draw: from the start corner, typed sizes win over the pointer. */
  private rectangle(): { from: Vec; to: Vec } {
    if (this.state.kind === 'idle') return { from: { x: 0, y: 0 }, to: { x: 0, y: 0 } };
    const { start, current } = this.state;
    const sx = Math.sign(current.x - start.x) || 1;
    const sy = Math.sign(current.y - start.y) || 1;
    return {
      from: start,
      to: {
        x: this.typed.w !== null ? start.x + sx * this.typed.w : current.x,
        y: this.typed.d !== null ? start.y + sy * this.typed.d : current.y,
      },
    };
  }

  private args(): DrawRoomArgs {
    const { from, to } = this.rectangle();
    return {
      level: this.ctx.host.level(),
      from,
      to,
      size: this.size,
      name: this.ctx.host.nextRoomName(),
    };
  }

  private updatePreview(): void {
    if (this.state.kind === 'idle') return;
    const outcome = this.ctx.host.store.preview(drawRoom, this.args());
    if (!outcome.ok) this.ctx.host.store.cancelPreview();
    this.ctx.invalidate();
  }

  private commit(): void {
    if (this.state.kind === 'idle') return;
    const args = this.args();
    const at = this.ctx.view.toScreen(args.to);
    this.ctx.host.store.cancelPreview();
    const result = this.ctx.host.store.run(drawRoom, args);
    if (!result.ok) this.ctx.host.refused(result.reason, at);
    this.state = { kind: 'idle' };
    this.typed = { w: null, d: null };
    this.ctx.typed.close();
    this.ctx.invalidate();
  }
}
