import { levelWallOutlines, type WallOutline } from '@urdama/core';
import {
  alignOrRound,
  increment,
  snapToWalls,
  SNAP_RADIUS_PX,
  type AlignGuide,
  type WallSnap,
} from '../snap';
import type { OpeningKind, Vec } from '@urdama/core';
import type { EditorHost } from '../host';
import type { TypedInput } from '../typed-input';
import type { View } from '../view';

export type ToolName = 'select' | 'room' | 'wall' | 'separator' | OpeningKind;

export interface PointerInfo {
  /** Plan position in mm */
  readonly model: Vec;
  /** Canvas position in CSS px */
  readonly screen: Vec;
  readonly shift: boolean;
  readonly ctrl: boolean;
  readonly alt: boolean;
}

/** What a tool can use from the editor. */
export interface ToolContext {
  readonly host: EditorHost;
  readonly view: View;
  readonly typed: TypedInput;
  /** Asks for a redraw on the next frame. */
  invalidate(): void;
}

export interface Tool {
  readonly name: ToolName;
  pointerDown(p: PointerInfo): void;
  pointerMove(p: PointerInfo): void;
  pointerUp(p: PointerInfo): void;
  /** Returns true when the key was used. */
  keyDown(e: KeyboardEvent, last: PointerInfo | null): boolean;
  /** Abandons whatever is in progress (Esc, tool switch, Level switch). */
  cancel(): void;
  /** Draws the tool's own feedback on top of the plan. */
  drawOverlay(ctx: CanvasRenderingContext2D): void;
}

/** Whether this pointer snaps: the snap toggle (ticket 26), inverted while Alt is held. */
export function snapping(ctx: ToolContext, p: { readonly alt: boolean }): boolean {
  return (ctx.host.snapping?.() ?? true) !== p.alt;
}

/** The committed Wall outlines of the current Level: tools snap to these, never to a preview. */
export function levelOutlines(ctx: ToolContext): WallOutline[] {
  return [...levelWallOutlines(ctx.host.store.committedModel(), ctx.host.level()).values()];
}

/** The snap radius in plan mm: 12 px on screen at the current zoom. */
export const snapRadius = (ctx: ToolContext): number => SNAP_RADIUS_PX / ctx.view.scale;

/**
 * The tools' snapping step for a point (ticket 26): Wall corners and faces first, then alignment
 * guides, then the drag increment; with snapping off (or Alt inverting it) the point is where the
 * pointer is.
 */
export function snapFreePoint(
  ctx: ToolContext,
  p: PointerInfo,
): { readonly point: Vec; readonly wall: WallSnap | null; readonly guides: readonly AlignGuide[] } {
  if (!snapping(ctx, p)) return { point: p.model, wall: null, guides: [] };
  const outlines = levelOutlines(ctx);
  const wall = snapToWalls(p.model, outlines, snapRadius(ctx), increment(p), wallEnds(ctx));
  if (wall) return { point: wall.point, wall, guides: [] };
  return { ...alignOrRound(p.model, outlines, snapRadius(ctx), increment(p)), wall: null };
}

/** Rounds a distance to the drag increment, or leaves it as it is with snapping off. */
export function roundToStep(ctx: ToolContext, p: PointerInfo, value: number): number {
  if (!snapping(ctx, p)) return value;
  const step = increment(p);
  return Math.round(value / step) * step;
}

/** The Wall ends on the current Level (committed): along faces, snapping aligns with them. */
export function wallEnds(ctx: ToolContext): Vec[] {
  const level = ctx.host.level();
  return Object.values(ctx.host.store.committedModel().walls)
    .filter((w) => w.level === level)
    .flatMap((w) => [w.start, w.end]);
}
