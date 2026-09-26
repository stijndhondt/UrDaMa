/**
 * The Select tool (V, Esc): select, move and delete (Slice 1 spec).
 * Clicking a Wall's body selects the Wall; clicking inside a Room selects the Room. Dragging a
 * Wall moves it along its normal (connected Walls follow, Seed points are carried along), live
 * while dragging; release commits one undo step, Esc cancels. Rooms themselves are not dragged.
 */
import {
  distanceToSegment,
  insideArea,
  insideRing,
  levelWallOutlines,
  moveWall,
  wallNormal,
  type Vec,
  type WallId,
} from '@lakudemis/core';
import { drawSelected, openingOutline } from '../draw-plan';
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
    const hit = this.hitTest(p.model, p);
    const current = this.ctx.host.selection();
    if (p.shift && hit) {
      // Shift+click adds to (or removes from) the selection, e.g. two Rooms to merge.
      const has = current.some((s) => s.id === hit.id);
      this.ctx.host.select(has ? current.filter((s) => s.id !== hit.id) : [...current, hit]);
    } else {
      this.ctx.host.select(hit ? [hit] : []);
      if (hit?.kind === 'wall') this.drag = { wall: hit.id, from: p.model, offset: 0 };
    }
    this.ctx.invalidate();
  }

  pointerMove(p: PointerInfo): void {
    if (!this.drag) {
      const hover = this.hitTest(p.model, p);
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
      if (this.ctx.host.selection().length) {
        this.ctx.host.select([]);
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
    if (this.hover)
      drawSelected(ctx, this.ctx.view, this.ctx.host, this.hover, 'rgba(47,111,222,.45)', 2);
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

  /** A Room separator (near its line), then a Wall's body, then the Room around the point. */
  private hitTest(p: Vec, info: PointerInfo): Selection | null {
    const level = this.ctx.host.level();
    const near = 6 / this.ctx.view.scale;
    for (const s of Object.values(this.ctx.host.store.committedModel().roomSeparators)) {
      if (s.level === level && distanceToSegment(p, s.start, s.end) <= near)
        return { kind: 'separator', id: s.id };
    }
    void info;
    const model = this.ctx.host.store.committedModel();
    const outlines = levelWallOutlines(model, level);
    for (const o of Object.values(model.openings)) {
      const ring = openingOutline(model, outlines, o);
      if (ring && insideRing(p, ring)) return { kind: 'opening', id: o.id };
    }
    for (const [id, outline] of outlines) if (insideRing(p, outline)) return { kind: 'wall', id };
    for (const area of this.ctx.host.store.values.level(level).footprint().areas) {
      if (area.rooms.length && insideArea(p, area.outline, area.islands))
        return { kind: 'room', id: area.rooms[0]! };
    }
    return null;
  }
}
