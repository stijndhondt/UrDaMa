/**
 * The Room separator tool (E): a line with no physical form between two Wall faces, e.g. between
 * Living and Eetkamer in one open space. Drag from one Wall face to another, or click both ends.
 */
import { drawRoomSeparator, type Vec } from '@lakudemis/core';
import { drawGuides, drawSnap, type AlignGuide, type WallSnap } from '../snap';
import { snapFreePoint, type PointerInfo, type Tool, type ToolContext } from './tool';
import { planColors } from '../draw-plan';

const CLICK_PX = 4;

export class SeparatorTool implements Tool {
  readonly name = 'separator' as const;
  private start: Vec | null = null;
  private end: Vec | null = null;
  private placed = false;
  private pressedAt: Vec | null = null;
  private snapped: WallSnap | null = null;
  private guides: readonly AlignGuide[] = [];

  constructor(private readonly ctx: ToolContext) {}

  pointerDown(p: PointerInfo): void {
    if (this.start && this.placed) {
      this.end = this.point(p);
      this.commit(p);
      return;
    }
    this.start = this.point(p);
    this.end = this.start;
    this.pressedAt = p.screen;
    this.ctx.invalidate();
  }

  pointerMove(p: PointerInfo): void {
    const point = this.point(p);
    if (this.start) this.end = point;
    this.ctx.invalidate();
  }

  pointerUp(p: PointerInfo): void {
    if (!this.start || this.placed) return;
    const moved = this.pressedAt
      ? Math.hypot(p.screen.x - this.pressedAt.x, p.screen.y - this.pressedAt.y)
      : 0;
    if (moved < CLICK_PX) {
      this.placed = true;
      return;
    }
    this.end = this.point(p);
    this.commit(p);
  }

  keyDown(e: KeyboardEvent): boolean {
    if (e.key === 'Escape' && this.start) {
      this.cancel();
      return true;
    }
    return false;
  }

  cancel(): void {
    this.start = this.end = this.pressedAt = null;
    this.placed = false;
    this.ctx.invalidate();
  }

  drawOverlay(ctx: CanvasRenderingContext2D): void {
    if (this.snapped) drawSnap(ctx, this.ctx.view.toScreen(this.snapped.point), this.snapped.kind);
    drawGuides(ctx, (v) => this.ctx.view.toScreen(v), this.guides);
    if (!this.start || !this.end) return;
    const a = this.ctx.view.toScreen(this.start);
    const b = this.ctx.view.toScreen(this.end);
    ctx.save();
    ctx.setLineDash([8, 5]);
    ctx.strokeStyle = planColors().accent;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
    ctx.restore();
  }

  /**
   * Ends snap to Wall faces (where a Room separator must end), else to alignment guides, else to
   * drag increments; with snapping off the point is where the pointer is (ticket 26).
   */
  private point(p: PointerInfo): Vec {
    const snap = snapFreePoint(this.ctx, p);
    this.snapped = snap.wall;
    this.guides = snap.guides;
    return snap.point;
  }

  private commit(p: PointerInfo): void {
    const start = this.start;
    const end = this.end;
    this.cancel();
    if (!start || !end) return;
    const result = this.ctx.host.store.run(drawRoomSeparator, {
      level: this.ctx.host.level(),
      start,
      end,
      roomName: (i) => this.ctx.host.nextRoomName(i),
    });
    if (!result.ok) this.ctx.host.refused(result.reason, p.screen);
  }
}
