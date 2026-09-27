/**
 * The Select tool (V, Esc): select, move and delete (Slice 1 spec).
 * Clicking a Wall's body selects the Wall; clicking inside a Room selects the Room. Dragging a
 * Wall moves it along its normal (connected Walls follow, Seed points are carried along), live
 * while dragging; release commits one undo step, Esc cancels. Rooms themselves are not dragged.
 */
import {
  moveWall,
  setWallLength,
  wallLength,
  wallNormal,
  type Vec,
  type WallId,
} from '@lakudemis/core';
import { drawSelected, faceLabelAt, faceLabels } from '../draw-plan';
import { elementAt } from '../hit-test';
import { parseLength } from '../units';
import { growOptions } from '../wall-length';
import type { Selection } from '../host';

/** Face labels are only drawn where they are visible; clicks can only land on those. */
const EVERYWHERE = { min: { x: -Infinity, y: -Infinity }, max: { x: Infinity, y: Infinity } };
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
    if (!p.shift && this.editLength(p)) return;
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

  /**
   * Clicking a face length label opens a small editor next to it: the face's length, which way
   * the Wall grows and what moves (as in the properties panel). Enter applies it.
   */
  private editLength(p: PointerInfo): boolean {
    const host = this.ctx.host;
    const values = host.store.values.level(host.level());
    const walls = values.slice().walls;
    const label = faceLabelAt(
      faceLabels(walls, values.outlines(), this.ctx.view, EVERYWHERE),
      p.screen,
    );
    if (!label) return false;
    const wall = host.store.committedModel().walls[label.wall];
    if (!wall) return false;
    host.select([{ kind: 'wall', id: wall.id }]);
    const grow = growOptions(wall);
    this.ctx.typed.open(
      [
        {
          label: host.text('panel.wall.length'),
          value: host.format.length(label.length).replace(/\s*m$/, ''),
        },
        {
          label: host.text('panel.wall.grows'),
          value: '2',
          options: grow.map((o, i) => ({
            value: String(i),
            label: host.text('panel.wall.grow.' + o.label),
          })),
        },
        {
          label: host.text('panel.wall.lengthMode'),
          value: 'room',
          options: [
            { value: 'room', label: host.text('panel.wall.modes.room') },
            { value: 'wall', label: host.text('panel.wall.modes.wall') },
          ],
        },
      ],
      p.screen,
      {
        change: () => undefined,
        cancel: () => this.ctx.invalidate(),
        commit: ([typed, side, mode]) => {
          const face = parseLength(typed ?? '');
          const choice = grow[Number(side)];
          if (face === null || !choice) return;
          // The typed length is the face's; the Baseline changes by the same amount.
          const length = wallLength(wall) + (face - label.length);
          const result = host.store.run(setWallLength, {
            wall: wall.id,
            length,
            end: choice.end,
            mode: mode === 'wall' ? 'wall' : 'room',
          });
          if (!result.ok) host.refused(result.reason, p.screen);
          this.ctx.invalidate();
        },
      },
    );
    this.ctx.invalidate();
    return true;
  }

  private hitTest(p: Vec): Selection | null {
    return elementAt(this.ctx.host, this.ctx.view, p);
  }
}
