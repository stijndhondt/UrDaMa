/**
 * The Select tool (V, Esc): select, move and delete (Slice 1 spec).
 * Clicking a Wall's body selects the Wall; clicking inside a Room selects the Room. Dragging a
 * Wall moves it along its normal (connected Walls follow, Seed points are carried along), live
 * while dragging; release commits one undo step, Esc cancels. Rooms themselves are not dragged.
 *
 * Dragging a Floor opening moves its whole outline, showing how far it moved across and down.
 * Dragging a door or window slides it along its Wall, showing its distance to both inside corners
 * as the Opening tools do; release commits one undo step.
 *
 * A selected Wall shows its anchors (its four corners and its centre). Clicking one makes it the
 * point the Wall turns around; dragging another one turns the Wall around it, in steps of 1°
 * (Shift 15°, Ctrl 0.1°, Alt free).
 */
import {
  levelWallOutlines,
  moveFloorOpening,
  moveWall,
  resolveOpening,
  rotateWall,
  updateOpening,
  wallFrame,
  type FloorOpeningId,
  type OpeningId,
  WALL_ANCHORS,
  wallAnchors,
  wallAngle,
  wallNormal,
  type Vec,
  type Wall,
  type WallAnchor,
  type WallId,
} from '@urdama/core';
import { drawSelected, planColors } from '../draw-plan';
import { elementAt, lengthLabelAt } from '../hit-test';
import { drawOpeningDistances, insideCorners, nearerFace, slideOffset } from '../opening-slide';
import type { Selection } from '../host';
import { roundToStep, snapping, type PointerInfo, type Tool, type ToolContext } from './tool';

interface Drag {
  readonly wall: WallId;
  readonly from: Vec;
  offset: number;
}

/** Sliding an Opening along its Wall. */
interface Slide {
  readonly opening: OpeningId;
  /** mm along the Baseline: where the pointer was grabbed, and the Opening's offset then */
  readonly from: number;
  readonly start: number;
  /** The face it is measured along (the one nearer the pointer when grabbed) */
  readonly face: 'lo' | 'hi';
  offset: number;
}

/** Moving a Floor opening by dragging it. */
interface Shift {
  readonly floorOpening: FloorOpeningId;
  readonly from: Vec;
  /** mm, how far it has moved so far */
  by: Vec;
}

/** Turning a Wall by dragging one of its anchors around the chosen one. */
interface Turn {
  readonly wall: WallId;
  /** The anchor that was grabbed; a click without dragging makes it the pivot. */
  readonly grabbed: WallAnchor;
  readonly pivot: Vec;
  /** Degrees: the pointer's direction from the pivot when grabbed, and the Wall's angle then */
  readonly from: number;
  readonly base: number;
  /** Degrees, the Wall's new angle; null until the pointer moves */
  angle: number | null;
}

/** Screen px: how close the pointer must be to an anchor to grab it */
const ANCHOR_RADIUS = 7;

export class SelectTool implements Tool {
  readonly name = 'select' as const;
  private hover: Selection | null = null;
  private drag: Drag | null = null;
  private turn: Turn | null = null;
  private slide: Slide | null = null;
  private shift: Shift | null = null;

  constructor(private readonly ctx: ToolContext) {}

  pointerDown(p: PointerInfo): void {
    if (!p.shift && this.grabAnchor(p)) return;
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
      if (hit?.kind === 'opening') this.grabOpening(hit.id, p);
      if (hit?.kind === 'floorOpening')
        this.shift = { floorOpening: hit.id, from: p.model, by: { x: 0, y: 0 } };
    }
    this.ctx.invalidate();
  }

  pointerMove(p: PointerInfo): void {
    if (this.turn) {
      this.turnTo(p);
      return;
    }
    if (this.slide) {
      this.slideTo(p);
      return;
    }
    if (this.shift) {
      this.shiftTo(p);
      return;
    }
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
    if (offset === 0) this.ctx.host.store.cancelPreview();
    else if (!this.ctx.host.store.preview(moveWall, { wall: this.drag.wall, offset }).ok)
      this.ctx.host.store.cancelPreview();
    this.ctx.invalidate();
  }

  pointerUp(p: PointerInfo): void {
    if (this.turn) {
      this.endTurn(p);
      return;
    }
    if (this.slide) {
      this.endSlide(p);
      return;
    }
    if (this.shift) {
      this.endShift(p);
      return;
    }
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
      if (this.drag || this.turn || this.slide || this.shift) {
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
    if (this.drag || this.turn || this.slide || this.shift) this.ctx.host.store.cancelPreview();
    this.drag = null;
    this.turn = null;
    this.slide = null;
    this.shift = null;
    this.ctx.invalidate();
  }

  drawOverlay(ctx: CanvasRenderingContext2D): void {
    this.drawAnchors(ctx);
    this.drawSlide(ctx);
    this.drawShift(ctx);
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

  /** The one selected Wall, as it is drawn now (a turn shows its preview). */
  private selectedWall(): Wall | null {
    const selection = this.ctx.host.selection();
    if (selection.length !== 1 || selection[0]!.kind !== 'wall') return null;
    return this.ctx.host.store.model().walls[selection[0]!.id] ?? null;
  }

  private pivotAnchor(): WallAnchor {
    return this.ctx.host.wallAnchor?.() ?? 'centre';
  }

  /** A press on one of the selected Wall's anchors: starts a turn (or a pivot choice). */
  private grabAnchor(p: PointerInfo): boolean {
    const wall = this.selectedWall();
    if (!wall) return false;
    const anchors = wallAnchors(this.ctx.host.store.model(), wall);
    const grabbed = WALL_ANCHORS.find((a) => {
      const s = this.ctx.view.toScreen(anchors[a]);
      return Math.hypot(s.x - p.screen.x, s.y - p.screen.y) <= ANCHOR_RADIUS;
    });
    if (!grabbed) return false;
    const pivot = anchors[this.pivotAnchor()];
    this.turn = {
      wall: wall.id,
      grabbed,
      pivot,
      from: direction(pivot, p.model),
      base: wallAngle(wall),
      angle: null,
    };
    return true;
  }

  private turnTo(p: PointerInfo): void {
    const turn = this.turn!;
    // Grabbing the pivot itself turns nothing: releasing it keeps it as the pivot.
    if (turn.grabbed === this.pivotAnchor()) return;
    const raw = turn.base + direction(turn.pivot, p.model) - turn.from;
    const step = p.ctrl ? 0.1 : p.shift ? 15 : 1;
    const angle = snapping(this.ctx, p) ? Math.round(raw / step) * step : raw;
    if (angle === turn.angle) return;
    turn.angle = angle;
    const args = { wall: turn.wall, angle, anchor: this.pivotAnchor(), mode: this.turnMode() };
    if (!this.ctx.host.store.preview(rotateWall, args).ok) this.ctx.host.store.cancelPreview();
    this.ctx.invalidate();
  }

  private endTurn(p: PointerInfo): void {
    const turn = this.turn!;
    this.turn = null;
    this.ctx.host.store.cancelPreview();
    if (turn.angle === null) {
      this.ctx.host.setWallAnchor?.(turn.grabbed);
    } else {
      const result = this.ctx.host.store.run(rotateWall, {
        wall: turn.wall,
        angle: turn.angle,
        anchor: this.pivotAnchor(),
        mode: this.turnMode(),
      });
      if (!result.ok && result.reason.key !== 'commands.rotateWall.same')
        this.ctx.host.refused(result.reason, p.screen);
    }
    this.ctx.invalidate();
  }

  private turnMode() {
    return this.ctx.host.turnMode?.() ?? 'slide';
  }

  /** The selected Wall's anchors; the pivot filled, and the angle while turning. */
  private drawAnchors(ctx: CanvasRenderingContext2D): void {
    const wall = this.selectedWall();
    if (!wall) return;
    const anchors = wallAnchors(this.ctx.host.store.model(), wall);
    const pivot = this.pivotAnchor();
    const { accent, paper } = planColors();
    ctx.save();
    ctx.lineWidth = 1.5;
    for (const a of WALL_ANCHORS) {
      const s = this.ctx.view.toScreen(anchors[a]);
      ctx.beginPath();
      ctx.arc(s.x, s.y, a === pivot ? 5 : 4, 0, Math.PI * 2);
      ctx.fillStyle = a === pivot ? accent : paper;
      ctx.strokeStyle = accent;
      ctx.fill();
      ctx.stroke();
    }
    if (this.turn?.angle != null) {
      const s = this.ctx.view.toScreen(anchors[pivot]);
      ctx.font = '600 12px system-ui, sans-serif';
      ctx.fillStyle = accent;
      ctx.textAlign = 'left';
      ctx.fillText(`${formatAngle(wallAngle(wall))}°`, s.x + 12, s.y - 12);
    }
    ctx.restore();
  }

  /** The Opening's Wall, outline and width as committed (a slide previews only the Opening). */
  private openingOnWall(id: OpeningId) {
    const model = this.ctx.host.store.committedModel();
    const o = model.openings[id];
    const resolved = o && resolveOpening(model, o);
    const wall = o && model.walls[o.wall];
    const outline = wall && levelWallOutlines(model, this.ctx.host.level()).get(wall.id);
    return resolved && wall && outline ? { model, opening: resolved, wall, outline } : null;
  }

  private grabOpening(id: OpeningId, p: PointerInfo): void {
    const on = this.openingOnWall(id);
    if (!on) return;
    this.slide = {
      opening: id,
      from: wallFrame(on.wall).along(p.model),
      start: on.opening.offset,
      face: nearerFace(on.wall, on.outline, p.model),
      offset: on.opening.offset,
    };
  }

  private slideTo(p: PointerInfo): void {
    const slide = this.slide!;
    const on = this.openingOnWall(slide.opening);
    if (!on) return;
    const raw = slide.start + wallFrame(on.wall).along(p.model) - slide.from;
    const offset = slideOffset(
      on.model,
      this.ctx.host.level(),
      on.wall,
      on.outline,
      slide.face,
      raw + on.opening.width / 2,
      raw,
      on.opening.width,
      (mm) => roundToStep(this.ctx, p, mm),
    );
    if (offset === slide.offset) return;
    slide.offset = offset;
    if (offset === slide.start) this.ctx.host.store.cancelPreview();
    else if (!this.ctx.host.store.preview(updateOpening, { opening: slide.opening, offset }).ok)
      this.ctx.host.store.cancelPreview();
    this.ctx.invalidate();
  }

  private endSlide(p: PointerInfo): void {
    const { opening, offset, start } = this.slide!;
    this.slide = null;
    this.ctx.host.store.cancelPreview();
    if (offset !== start) {
      const result = this.ctx.host.store.run(updateOpening, { opening, offset });
      if (!result.ok) this.ctx.host.refused(result.reason, p.screen);
    }
    this.ctx.invalidate();
  }

  private shiftTo(p: PointerInfo): void {
    const shift = this.shift!;
    const by = {
      x: roundToStep(this.ctx, p, p.model.x - shift.from.x),
      y: roundToStep(this.ctx, p, p.model.y - shift.from.y),
    };
    if (by.x === shift.by.x && by.y === shift.by.y) return;
    shift.by = by;
    if (by.x === 0 && by.y === 0) this.ctx.host.store.cancelPreview();
    else if (
      !this.ctx.host.store.preview(moveFloorOpening, { floorOpening: shift.floorOpening, by }).ok
    )
      this.ctx.host.store.cancelPreview();
    this.ctx.invalidate();
  }

  private endShift(p: PointerInfo): void {
    const { floorOpening, by } = this.shift!;
    this.shift = null;
    this.ctx.host.store.cancelPreview();
    if (by.x !== 0 || by.y !== 0) {
      const result = this.ctx.host.store.run(moveFloorOpening, { floorOpening, by });
      if (!result.ok) this.ctx.host.refused(result.reason, p.screen);
    }
    this.ctx.invalidate();
  }

  /** While a Floor opening moves: how far, across and down the plan ("→ 1.500 m  ↓ 0.500 m"). */
  private drawShift(ctx: CanvasRenderingContext2D): void {
    if (!this.shift) return;
    const f = this.ctx.host.store.model().floorOpenings[this.shift.floorOpening];
    if (!f) return;
    const { x, y } = this.shift.by;
    const parts = [
      x ? `${x > 0 ? '→' : '←'} ${this.ctx.host.format.length(Math.abs(x))}` : '',
      y ? `${y > 0 ? '↓' : '↑'} ${this.ctx.host.format.length(Math.abs(y))}` : '',
    ].filter(Boolean);
    if (!parts.length) return;
    const top = f.outline.reduce((a, b) => (b.y < a.y || (b.y === a.y && b.x < a.x) ? b : a));
    const s = this.ctx.view.toScreen(top);
    ctx.save();
    ctx.font = '600 12px system-ui, sans-serif';
    ctx.fillStyle = planColors().accent;
    ctx.textAlign = 'left';
    ctx.fillText(parts.join('  '), s.x, s.y - 10);
    ctx.restore();
  }

  /** While an Opening slides: its distances to both inside corners. */
  private drawSlide(ctx: CanvasRenderingContext2D): void {
    if (!this.slide) return;
    const on = this.openingOnWall(this.slide.opening);
    if (!on) return;
    const { face, offset } = this.slide;
    const width = on.opening.width;
    const corners = insideCorners(
      on.model,
      this.ctx.host.level(),
      on.wall,
      on.outline,
      face,
      offset + width / 2,
    );
    drawOpeningDistances(
      ctx,
      this.ctx.view,
      this.ctx.host.format,
      corners,
      on.wall,
      on.outline,
      face,
      offset,
      width,
    );
  }

  private hitTest(p: Vec): Selection | null {
    return elementAt(this.ctx.host, this.ctx.view, p);
  }
}

/** Degrees, anticlockwise on screen: the direction from one plan point to another. */
const direction = (from: Vec, to: Vec): number =>
  (Math.atan2(-(to.y - from.y), to.x - from.x) * 180) / Math.PI;

/** Up to two decimals, without trailing zeros: "92", "88.5". */
const formatAngle = (deg: number): string => String(Math.round(deg * 100) / 100);
