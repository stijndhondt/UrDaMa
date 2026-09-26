/**
 * The Select tool (V, Esc): select, move and delete (Slice 1 spec).
 * Clicking a Wall's body selects the Wall; clicking inside a Room selects the Room. Dragging a
 * Wall moves it along its normal (connected Walls follow, Seed points are carried along), live
 * while dragging; release commits one undo step, Esc cancels. Rooms themselves are not dragged.
 */
import {
  insideArea,
  insideRing,
  levelWallOutlines,
  moveWall,
  wallNormal,
  type Vec,
  type WallId,
} from '@lakudemis/core';
import { tracePolygon } from '../draw-plan';
import type { Selection } from '../host';
import { increment } from '../snap';
import type { PointerInfo, Tool, ToolContext } from './tool';

interface Drag {
  readonly wall: WallId;
  readonly from: Vec;
  offset: number;
}

export class SelectTool implements Tool {
  readonly name = 'select' as const;
  private hover: Selection | null = null;
  private drag: Drag | null = null;

  constructor(private readonly ctx: ToolContext) {}

  pointerDown(p: PointerInfo): void {
    const hit = this.hitTest(p.model);
    this.ctx.host.select(hit);
    if (hit?.kind === 'wall') this.drag = { wall: hit.id as WallId, from: p.model, offset: 0 };
    this.ctx.invalidate();
  }

  pointerMove(p: PointerInfo): void {
    if (!this.drag) {
      const hover = this.hitTest(p.model);
      if (hover?.id !== this.hover?.id) {
        this.hover = hover;
        this.ctx.invalidate();
      }
      return;
    }
    const wall = this.ctx.host.store.committedModel().walls[this.drag.wall];
    if (!wall) return;
    const n = wallNormal(wall);
    const raw = (p.model.x - this.drag.from.x) * n.x + (p.model.y - this.drag.from.y) * n.y;
    const step = increment(p);
    const offset = Math.round(raw / step) * step;
    if (offset === this.drag.offset) return;
    this.drag.offset = offset;
    if (offset === 0) this.ctx.host.store.cancelPreview();
    else if (!this.ctx.host.store.preview(moveWall, { wall: this.drag.wall, offset }).ok)
      this.ctx.host.store.cancelPreview();
    this.ctx.invalidate();
  }

  pointerUp(p: PointerInfo): void {
    if (!this.drag) return;
    const { wall, offset } = this.drag;
    this.drag = null;
    if (offset === 0) return;
    this.ctx.host.store.cancelPreview();
    const result = this.ctx.host.store.run(moveWall, { wall, offset });
    if (!result.ok) this.ctx.host.refused(result.reason, p.screen);
    this.ctx.invalidate();
  }

  keyDown(e: KeyboardEvent): boolean {
    if (e.key === 'Escape') {
      if (this.drag) {
        this.cancel();
        return true;
      }
      if (this.ctx.host.selection()) {
        this.ctx.host.select(null);
        this.ctx.invalidate();
        return true;
      }
    }
    return false;
  }

  cancel(): void {
    if (this.drag) this.ctx.host.store.cancelPreview();
    this.drag = null;
    this.ctx.invalidate();
  }

  drawOverlay(ctx: CanvasRenderingContext2D): void {
    const selected = this.ctx.host.selection();
    for (const [item, color, width] of [
      [this.hover, 'rgba(47,111,222,.45)', 2],
      [selected, '#2f6fde', 3],
    ] as const) {
      if (!item) continue;
      const ring = this.outlineOf(item);
      if (!ring) continue;
      ctx.save();
      ctx.beginPath();
      tracePolygon(ctx, this.ctx.view, ring);
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.stroke();
      ctx.restore();
    }
    if (this.drag && this.drag.offset !== 0) {
      const wall = this.ctx.host.store.model().walls[this.drag.wall];
      if (wall) {
        const s = this.ctx.view.toScreen({
          x: (wall.start.x + wall.end.x) / 2,
          y: (wall.start.y + wall.end.y) / 2,
        });
        ctx.save();
        ctx.font = '600 12px system-ui, sans-serif';
        ctx.fillStyle = '#2f6fde';
        ctx.textAlign = 'left';
        ctx.fillText(
          `${this.drag.offset > 0 ? '+' : '−'}${this.ctx.host.format.length(Math.abs(this.drag.offset))}`,
          s.x + 12,
          s.y - 12,
        );
        ctx.restore();
      }
    }
  }

  /** A Wall's body wins over the Room around it. */
  private hitTest(p: Vec): Selection | null {
    const level = this.ctx.host.level();
    const outlines = levelWallOutlines(this.ctx.host.store.committedModel(), level);
    for (const [id, outline] of outlines) if (insideRing(p, outline)) return { kind: 'wall', id };
    for (const area of this.ctx.host.store.values.level(level).footprint().areas) {
      if (area.rooms.length && insideArea(p, area.outline, area.islands))
        return { kind: 'room', id: area.rooms[0]! };
    }
    return null;
  }

  private outlineOf(item: Selection): readonly Vec[] | null {
    const level = this.ctx.host.level();
    if (item.kind === 'wall')
      return (
        this.ctx.host.store.values
          .level(level)
          .outlines()
          .get(item.id as WallId) ?? null
      );
    const d = this.ctx.host.store.values.room(item.id as never).detection();
    return d && d.status !== 'notEnclosed' ? d.area.outline : null;
  }
}
