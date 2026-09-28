import type { OpeningKind, Vec } from '@lakudemis/core';
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

/** The Wall ends on the current Level (committed): along faces, snapping aligns with them. */
export function wallEnds(ctx: ToolContext): Vec[] {
  const level = ctx.host.level();
  return Object.values(ctx.host.store.committedModel().walls)
    .filter((w) => w.level === level)
    .flatMap((w) => [w.start, w.end]);
}
