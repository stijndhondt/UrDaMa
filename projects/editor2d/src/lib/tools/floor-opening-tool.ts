/**
 * The Floor opening tool: a hole for a stair or a lift through the Slab between two Levels
 * (CONTEXT.md Floor opening). Drag its rectangle, or click two opposite corners; corners snap like a Room's.
 * Then it asks which way it goes, up or down, when both Levels exist; with only one neighbouring
 * Level it goes there, and with none it is refused (the user adds the Level first).
 */
import {
  bigEnough,
  drawFloorOpening,
  message,
  floorOpeningDirections,
  MIN_FLOOR_OPENING,
  type FloorOpeningDirection,
  type Vec,
} from '@urdama/core';
import { planColors } from '../draw-plan';
import { drawSnap, type WallSnap } from '../snap';
import { snapFreePoint, type PointerInfo, type Tool, type ToolContext } from './tool';

/** Screen px: a press and release closer than this is a click, not a drag */
const CLICK = 4;

type State =
  | { readonly kind: 'idle' }
  | { readonly kind: 'dragging'; readonly start: Vec; current: Vec }
  /** A click set the first corner; the next click sets the opposite one. */
  | { readonly kind: 'placed'; readonly start: Vec; current: Vec };

export class FloorOpeningTool implements Tool {
  readonly name = 'floorOpening' as const;
  private state: State = { kind: 'idle' };
  private snapped: WallSnap | null = null;
  /** Waiting for the user to choose up or down */
  private asking = false;

  constructor(private readonly ctx: ToolContext) {}

  pointerDown(p: PointerInfo): void {
    if (this.asking) return;
    const point = this.snap(p);
    // The second click of click-click: it finishes on release, like a drag.
    if (this.state.kind === 'placed') {
      this.state = { kind: 'dragging', start: this.state.start, current: point };
      this.ctx.invalidate();
      return;
    }
    this.state = { kind: 'dragging', start: point, current: point };
    this.ctx.invalidate();
  }

  pointerMove(p: PointerInfo): void {
    if (this.asking) return;
    const point = this.snap(p);
    if (this.state.kind !== 'idle') this.state.current = point;
    this.ctx.invalidate();
  }

  pointerUp(p: PointerInfo): void {
    if (this.state.kind !== 'dragging' || this.asking) return;
    this.state.current = this.snap(p);
    const { start, current } = this.state;
    const a = this.ctx.view.toScreen(start);
    const b = this.ctx.view.toScreen(current);
    if (Math.hypot(b.x - a.x, b.y - a.y) < CLICK) {
      this.state = { kind: 'placed', start, current };
      this.ctx.invalidate();
      return;
    }
    void this.finish(p.screen);
  }

  keyDown(e: KeyboardEvent): boolean {
    if (e.key === 'Escape' && this.state.kind !== 'idle' && !this.asking) {
      this.cancel();
      return true;
    }
    return false;
  }

  cancel(): void {
    this.state = { kind: 'idle' };
    this.ctx.invalidate();
  }

  drawOverlay(ctx: CanvasRenderingContext2D): void {
    if (this.snapped) drawSnap(ctx, this.ctx.view.toScreen(this.snapped.point), this.snapped.kind);
    if (this.state.kind === 'idle') return;
    const a = this.ctx.view.toScreen(this.state.start);
    const b = this.ctx.view.toScreen(this.state.current);
    ctx.save();
    ctx.strokeStyle = planColors().accent;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([6, 4]);
    ctx.strokeRect(
      Math.min(a.x, b.x),
      Math.min(a.y, b.y),
      Math.abs(b.x - a.x),
      Math.abs(b.y - a.y),
    );
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.moveTo(a.x, b.y);
    ctx.lineTo(b.x, a.y);
    ctx.stroke();
    // Its size, as a Room shows it: width × depth.
    const w = Math.abs(this.state.current.x - this.state.start.x);
    const d = Math.abs(this.state.current.y - this.state.start.y);
    if (w > 0 && d > 0) {
      ctx.setLineDash([]);
      ctx.font = '600 12px system-ui, sans-serif';
      ctx.fillStyle = planColors().accent;
      ctx.textAlign = 'left';
      ctx.fillText(
        `${this.ctx.host.format.length(w)} × ${this.ctx.host.format.length(d)}`,
        Math.max(a.x, b.x) + 8,
        Math.max(a.y, b.y) + 16,
      );
    }
    ctx.restore();
  }

  private snap(p: PointerInfo): Vec {
    const s = snapFreePoint(this.ctx, p);
    this.snapped = s.wall;
    return s.point;
  }

  /** Up or down: asked when both Levels exist, then drawn as one command. */
  private async finish(at: Vec): Promise<void> {
    if (this.state.kind === 'idle') return;
    const { start, current } = this.state;
    const level = this.ctx.host.level();
    // Too small is said at once, before asking which way it goes.
    if (!bigEnough(start, current)) {
      this.state = { kind: 'idle' };
      this.ctx.host.refused(
        message('commands.floorOpening.tooSmall', { min: MIN_FLOOR_OPENING }),
        at,
      );
      this.ctx.invalidate();
      return;
    }
    const directions = floorOpeningDirections(this.ctx.host.store.committedModel(), level);
    let direction: FloorOpeningDirection | null = directions[0] ?? 'up';
    if (directions.length > 1 && this.ctx.host.chooseFloorOpeningDirection) {
      this.asking = true;
      try {
        direction = await this.ctx.host.chooseFloorOpeningDirection(at);
      } finally {
        this.asking = false;
      }
    }
    this.state = { kind: 'idle' };
    if (direction) {
      const result = this.ctx.host.store.run(drawFloorOpening, {
        level,
        from: start,
        to: current,
        direction,
      });
      if (!result.ok) this.ctx.host.refused(result.reason, at);
    }
    this.ctx.invalidate();
  }
}
