/**
 * The Floor opening tool: a hole for a stair or a lift through the Slab between two Levels
 * (CONTEXT.md Floor opening). Drag a rectangle; or click its corners one by one for any shape (an
 * L, a turned rectangle), and close it on its first corner, with Enter (Backspace takes back the
 * last corner). Corners snap like a Room's. Then it asks which way it goes, up or down, when both
 * Levels exist; with only one neighbouring Level it goes there, and with none it is refused (the
 * user adds the Level first).
 */
import {
  bigEnough,
  crossesItself,
  drawFloorOpening,
  floorOpeningDirections,
  message,
  MIN_FLOOR_OPENING,
  type FloorOpeningDirection,
  type Vec,
} from '@urdama/core';
import { planColors } from '../draw-plan';
import { drawSnap, type WallSnap } from '../snap';
import { snapFreePoint, type PointerInfo, type Tool, type ToolContext } from './tool';

/** Screen px: a press and release closer than this is a click, not a drag */
const CLICK = 4;
/** Screen px: a click this close to the first corner closes the outline */
const CLOSE = 8;

type State =
  | { readonly kind: 'idle' }
  /** The first press, not yet released: a drag draws a rectangle */
  | { readonly kind: 'dragging'; readonly start: Vec; current: Vec }
  /** Corners placed by clicks; `closing` when the press is on the first one */
  | { readonly kind: 'corners'; readonly points: Vec[]; current: Vec; closing: boolean };

const rectangle = (a: Vec, b: Vec): Vec[] => [a, { x: b.x, y: a.y }, b, { x: a.x, y: b.y }];

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
    if (this.state.kind === 'corners') {
      // On the first corner it closes (on release); elsewhere it is the next corner.
      if (this.state.points.length >= 3 && this.near(p.screen, this.state.points[0]!)) {
        this.state.closing = true;
      } else {
        this.state.points.push(point);
      }
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
    if (this.asking) return;
    if (this.state.kind === 'corners') {
      if (this.state.closing) void this.finish([...this.state.points], p.screen);
      return;
    }
    if (this.state.kind !== 'dragging') return;
    this.state.current = this.snap(p);
    const { start, current } = this.state;
    if (this.near(p.screen, start, CLICK)) {
      this.state = { kind: 'corners', points: [start], current, closing: false };
      this.ctx.invalidate();
      return;
    }
    void this.finish(rectangle(start, current), p.screen);
  }

  keyDown(e: KeyboardEvent, last: PointerInfo | null): boolean {
    if (this.asking) return false;
    if (e.key === 'Escape' && this.state.kind !== 'idle') {
      this.cancel();
      return true;
    }
    if (this.state.kind !== 'corners') return false;
    if (e.key === 'Enter' && this.state.points.length >= 3) {
      const at = last?.screen ?? this.ctx.view.toScreen(this.state.current);
      void this.finish([...this.state.points], at);
      return true;
    }
    if (e.key === 'Backspace') {
      this.state.points.pop();
      if (!this.state.points.length) this.state = { kind: 'idle' };
      this.ctx.invalidate();
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
    const outline =
      this.state.kind === 'dragging'
        ? rectangle(this.state.start, this.state.current)
        : [...this.state.points, this.state.current];
    const points = outline.map((p) => this.ctx.view.toScreen(p));
    ctx.save();
    ctx.strokeStyle = planColors().accent;
    ctx.fillStyle = planColors().accent;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    points.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
    ctx.closePath();
    ctx.stroke();
    if (this.state.kind === 'corners') {
      // The first corner: click it to close the outline.
      const first = points[0]!;
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.arc(first.x, first.y, 5, 0, Math.PI * 2);
      ctx.stroke();
    } else {
      // A rectangle's size, as a Room shows it: width × depth.
      const w = Math.abs(this.state.current.x - this.state.start.x);
      const d = Math.abs(this.state.current.y - this.state.start.y);
      if (w > 0 && d > 0) {
        const corner = points[2]!;
        ctx.font = '600 12px system-ui, sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(
          `${this.ctx.host.format.length(w)} × ${this.ctx.host.format.length(d)}`,
          Math.max(points[0]!.x, corner.x) + 8,
          Math.max(points[0]!.y, corner.y) + 16,
        );
      }
    }
    ctx.restore();
  }

  private snap(p: PointerInfo): Vec {
    const s = snapFreePoint(this.ctx, p);
    this.snapped = s.wall;
    return s.point;
  }

  private near(screen: Vec, point: Vec, px = CLOSE): boolean {
    const s = this.ctx.view.toScreen(point);
    return Math.hypot(s.x - screen.x, s.y - screen.y) < px;
  }

  /** Up or down: asked when both Levels exist, then drawn as one command. */
  private async finish(outline: Vec[], at: Vec): Promise<void> {
    this.state = { kind: 'idle' };
    const level = this.ctx.host.level();
    // What is wrong with the outline is said at once, before asking which way it goes.
    const problem = crossesItself(outline)
      ? message('commands.floorOpening.crossesItself')
      : bigEnough(outline)
        ? null
        : message('commands.floorOpening.tooSmall', { min: MIN_FLOOR_OPENING });
    if (problem) {
      this.ctx.host.refused(problem, at);
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
    if (direction) {
      const result = this.ctx.host.store.run(drawFloorOpening, { level, outline, direction });
      if (!result.ok) this.ctx.host.refused(result.reason, at);
    }
    this.ctx.invalidate();
  }
}
