/**
 * The Opening tools (Slice 1 spec; ticket 17): door (D), window (N), wall opening and garage
 * door, each placing its kind's default size or an Opening type chosen in the tool bar's flyout. Hover a Wall: the Opening slides along it,
 * showing its distance to both inside corners, as measured with a tape. Click places it; or type
 * the distance (from the first corner), width and height (and sill), Tab between fields, Enter.
 * F / Shift+F flip a door's hinge side / swing direction.
 */
import {
  addOpening,
  insideRing,
  levelWallOutlines,
  wallFrame,
  presetSize,
  type AddOpeningArgs,
  type OpeningKind,
  type OpeningTypeId,
  type Vec,
  type Wall,
  type WallId,
  type WallOutline,
} from '@urdama/core';
import { distanceToSegment, hasSill } from '@urdama/core';
import { parseLength } from '../units';
import { roundToStep, type PointerInfo, type Tool, type ToolContext } from './tool';
import { drawOpeningDistances, insideCorners, nearerFace, slideOffset } from '../opening-slide';

interface Hover {
  readonly wall: WallId;
  /** mm along the Baseline to the near edge */
  readonly offset: number;
  /** Which face the pointer is on: distances are measured along it. */
  readonly face: 'lo' | 'hi';
  /** mm along the Baseline: where the pointer is (picks the stretch of face between corners) */
  readonly at: number;
}

export class OpeningTool implements Tool {
  readonly name: OpeningKind;
  private hover: Hover | null = null;
  /** The Opening type chosen in the flyout; null places the kind's default size */
  private type: OpeningTypeId | null = null;
  private hinge: 'start' | 'end' = 'start';
  private swing: 'left' | 'right' = 'right';
  private typed: {
    distance: number | null;
    width: number | null;
    height: number | null;
    sill: number | null;
  } = {
    distance: null,
    width: null,
    height: null,
    sill: null,
  };

  constructor(
    private readonly ctx: ToolContext,
    private readonly kind: OpeningKind,
  ) {
    this.name = kind;
  }

  /** The Opening type it places; null places the kind's default size. */
  get chosenType(): OpeningTypeId | null {
    return this.type;
  }

  /** Place this Opening type (from the tool bar's type list), or the kind's default size (null). */
  setType(type: OpeningTypeId | null): void {
    this.type = type;
    this.preview();
  }

  pointerDown(p: PointerInfo): void {
    this.update(p);
    this.commit(p.screen);
  }

  pointerMove(p: PointerInfo): void {
    if (this.ctx.typed.isOpen) return;
    this.update(p);
  }

  pointerUp(): void {
    // placed on press
  }

  keyDown(e: KeyboardEvent, last: PointerInfo | null): boolean {
    if ((e.key === 'f' || e.key === 'F') && this.kind === 'door') {
      if (e.shiftKey) this.swing = this.swing === 'left' ? 'right' : 'left';
      else this.hinge = this.hinge === 'start' ? 'end' : 'start';
      this.preview();
      return true;
    }
    if (e.key === 'Escape' && (this.hover || this.ctx.typed.isOpen)) {
      this.cancel();
      return true;
    }
    if (this.hover && /^[0-9.,]$/.test(e.key) && !this.ctx.typed.isOpen) {
      const t = (k: string) => this.ctx.host.text(k);
      const fields = [
        { label: t('editor.opening.distance') },
        { label: t('editor.opening.width'), value: String(this.size().width) },
        { label: t('editor.opening.height'), value: String(this.size().height) },
        ...(this.hasSill
          ? [{ label: t('editor.opening.sill'), value: String(this.size().sill) }]
          : []),
      ];
      const read = (values: readonly string[]) => {
        this.typed = {
          distance: parseLength(values[0] ?? ''),
          width: parseLength(values[1] ?? ''),
          height: parseLength(values[2] ?? ''),
          sill: this.hasSill ? parseLength(values[3] ?? '', { orZero: true }) : 0,
        };
      };
      this.ctx.typed.open(
        fields,
        last?.screen ?? { x: 100, y: 100 },
        {
          change: (values) => {
            read(values);
            this.preview();
          },
          commit: (values) => {
            read(values);
            this.commit(last?.screen ?? { x: 100, y: 100 });
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
    this.hover = null;
    this.typed = { distance: null, width: null, height: null, sill: null };
    this.ctx.typed.close();
    this.ctx.host.store.cancelPreview();
    this.ctx.invalidate();
  }

  drawOverlay(ctx: CanvasRenderingContext2D): void {
    const args = this.args();
    if (!args || !this.hover) return;
    const model = this.ctx.host.store.committedModel();
    const level = this.ctx.host.level();
    const wall = model.walls[args.wall];
    const outline = levelWallOutlines(model, level).get(args.wall);
    if (!wall || !outline) return;
    const corners = insideCorners(model, level, wall, outline, this.hover.face, this.hover.at);
    drawOpeningDistances(
      ctx,
      this.ctx.view,
      this.ctx.host.format,
      corners,
      wall,
      outline,
      this.hover.face,
      args.offset,
      args.width ?? 0,
    );
  }

  private get hasSill(): boolean {
    return hasSill(this.kind);
  }

  private size(): { width: number; height: number; sill: number } {
    const model = this.ctx.host.store.committedModel();
    const preset = presetSize(model.project.presets, this.kind);
    const type = this.type ? model.openingTypes[this.type] : undefined;
    return {
      width: this.typed.width ?? type?.width ?? preset.width,
      height: this.typed.height ?? type?.height ?? preset.height,
      sill: this.typed.sill ?? type?.sill ?? preset.sill,
    };
  }

  private update(p: PointerInfo): void {
    const model = this.ctx.host.store.committedModel();
    const outlines = levelWallOutlines(model, this.ctx.host.level());
    const radius = 12 / this.ctx.view.scale;
    let best: { wall: Wall; outline: WallOutline; d: number } | null = null;
    for (const [id, outline] of outlines) {
      const wall = model.walls[id];
      if (!wall) continue;
      const inside = insideRing(p.model, outline);
      const d = inside
        ? 0
        : Math.min(
            ...[0, 1, 2, 3].map((i) =>
              distanceToSegment(p.model, outline[i]!, outline[(i + 1) % 4]!),
            ),
          );
      if (d <= radius && (!best || d < best.d)) best = { wall, outline, d };
    }
    if (!best) {
      if (this.hover) {
        this.hover = null;
        this.ctx.host.store.cancelPreview();
        this.ctx.invalidate();
      }
      return;
    }
    const { wall } = best;
    const t = wallFrame(wall).along(p.model);
    const face = nearerFace(wall, best.outline, p.model);
    const { width } = this.size();
    // Snap the distance from the inside corner, and stay where the Wall is full thickness.
    const offset = slideOffset(
      model,
      this.ctx.host.level(),
      wall,
      best.outline,
      face,
      t,
      t - width / 2,
      width,
      (mm) => roundToStep(this.ctx, p, mm),
    );
    this.hover = { wall: wall.id, offset, face, at: t };
    this.preview();
  }

  private args(): AddOpeningArgs | null {
    if (!this.hover) return null;
    const size = this.size();
    let offset = this.hover.offset;
    if (this.typed.distance !== null) {
      const wall = this.ctx.host.store.committedModel().walls[this.hover.wall];
      const outline = levelWallOutlines(
        this.ctx.host.store.committedModel(),
        this.ctx.host.level(),
      ).get(this.hover.wall);
      if (wall && outline)
        offset =
          insideCorners(
            this.ctx.host.store.committedModel(),
            this.ctx.host.level(),
            wall,
            outline,
            this.hover.face,
            this.hover.at,
          ).first + this.typed.distance;
    }
    return {
      wall: this.hover.wall,
      kind: this.kind,
      ...(this.type ? { type: this.type } : {}),
      offset,
      width: size.width,
      height: size.height,
      sill: size.sill,
      hinge: this.hinge,
      swing: this.swing,
    };
  }

  private preview(): void {
    const args = this.args();
    if (!args) return;
    if (!this.ctx.host.store.preview(addOpening, args).ok) this.ctx.host.store.cancelPreview();
    this.ctx.invalidate();
  }

  private commit(at: Vec): void {
    const args = this.args();
    this.ctx.host.store.cancelPreview();
    this.ctx.typed.close();
    this.typed = { distance: null, width: null, height: null, sill: null };
    if (!args) return;
    const result = this.ctx.host.store.run(addOpening, args);
    if (!result.ok) this.ctx.host.refused(result.reason, at);
    this.ctx.invalidate();
  }
}
