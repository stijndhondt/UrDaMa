/**
 * The Select tool (V, Esc): select, move and delete (Slice 1 spec).
 * Clicking a Wall's body selects the Wall; clicking inside a Room selects the Room. Dragging a
 * Wall moves it along its normal (connected Walls follow, Seed points are carried along), live
 * while dragging; release commits one undo step, Esc cancels. Rooms themselves are not dragged.
 */
import { moveWall, wallNormal, type Vec, type WallId } from '@lakudemis/core';
import { drawSelected, planColors } from '../draw-plan';
import { elementAt, lengthLabelAt } from '../hit-test';
import type { Selection } from '../host';
import { roundToStep, type PointerInfo, type Tool, type ToolContext } from './tool';

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
    // A Wall's length label selects that Wall (a double click on it edits the length, ticket 23).
    const label = p.shift ? null : lengthLabelAt(this.ctx.host, this.ctx.view, p.screen);
    if (label) {
      this.ctx.host.select([{ kind: 'wall', id: label.wall }]);
      this.ctx.invalidate();
      return;
    }
    const hit = this.hitTest(p.model);
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
    const offset = roundToStep(this.ctx, p, raw);
    if (offset === this.drag.offset) return;
    this.drag.offset = offset;
    // Back at the start, or at a refused position: the Wall shows where it was, and the drag goes
    // on previewing, so the panels that hold still during a drag don't rebuild (ticket 33).
    if (offset === 0) this.ctx.host.store.holdPreview();
    else if (!this.ctx.host.store.preview(moveWall, { wall: this.drag.wall, offset }).ok)
      this.ctx.host.store.holdPreview();
    this.ctx.invalidate();
  }

  pointerUp(p: PointerInfo): void {
    if (!this.drag) return;
    const { wall, offset } = this.drag;
    this.drag = null;
    this.ctx.host.store.cancelPreview();
    if (offset === 0) return;
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
    if (this.hover) {
      ctx.save();
      ctx.globalAlpha = 0.45;
      drawSelected(ctx, this.ctx.view, this.ctx.host, this.hover, planColors().accent, 2);
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
        ctx.fillStyle = planColors().accent;
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

  private hitTest(p: Vec): Selection | null {
    return elementAt(this.ctx.host, this.ctx.view, p);
  }
}
