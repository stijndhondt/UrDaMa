/**
 * The Room tool (R): the main way to draw (Box-drawing interaction, spec "Editor").
 * Drag a rectangle that is the Room's inside size as measured with a tape (S: outside size),
 * or click, then type width, Tab, depth, Enter. The Room and its area show live while dragging.
 */
import { drawRoom, type DrawRoomArgs, type Vec } from '@lakudemis/core';
import { increment, snapToIncrement } from '../snap';
import { parseLength } from '../units';
import type { PointerInfo, Tool, ToolContext } from './tool';

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
    if (this.state.kind === 'idle') return;
    this.state.current = this.snap(p);
    this.updatePreview();
  }

  pointerUp(p: PointerInfo): void {
    if (this.state.kind !== 'dragging') return;
    this.state.current = this.snap(p);
    const { start, current } = this.state;
    const dragged = Math.abs(current.x - start.x) > 0 || Math.abs(current.y - start.y) > 0;
    if (this.ctx.typed.isOpen) return; // wait for Enter
    if (!dragged) {
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
    if (e.key === 'Escape') {
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
    ctx.fillText(label, Math.max(a.x, b.x) + 10, Math.max(a.y, b.y) + 16);
    ctx.restore();
  }

  private snap(p: PointerInfo): Vec {
    return snapToIncrement(p.model, increment(p));
  }

  /** The rectangle to draw: from the start corner, typed sizes win over the pointer. */
  private rectangle(): { from: Vec; to: Vec } {
    if (this.state.kind === 'idle') return { from: { x: 0, y: 0 }, to: { x: 0, y: 0 } };
    const { start, current } = this.state;
    const sx = Math.sign(current.x - start.x) || 1;
    const sy = Math.sign(current.y - start.y) || 1;
    const to = {
      x: this.typed.w !== null ? start.x + sx * this.typed.w : current.x,
      y: this.typed.d !== null ? start.y + sy * this.typed.d : current.y,
    };
    return { from: start, to };
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
