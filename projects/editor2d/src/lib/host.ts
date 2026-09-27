import type {
  LevelId,
  Message,
  OpeningId,
  ProjectStore,
  RoomId,
  RoomSeparatorId,
  Vec,
  WallId,
} from '@lakudemis/core';
import type { PlanTarget } from './hit-test';

/** A selected element (Slice 1 spec, "Select / move / delete"): its kind, with the matching ID type. */
export type Selection =
  | { readonly kind: 'wall'; readonly id: WallId }
  | { readonly kind: 'room'; readonly id: RoomId }
  | { readonly kind: 'separator'; readonly id: RoomSeparatorId }
  | { readonly kind: 'opening'; readonly id: OpeningId };

/** What the editor needs from the app around it. */
export interface EditorHost {
  readonly store: ProjectStore;
  /** The Level being edited. */
  readonly level: () => LevelId;
  /** The Level below the edited one, shown faded as a tracing aid (null for the lowest). */
  readonly levelBelow?: () => LevelId | null;
  /** Translated text for a key (ngx-translate in the web app). */
  readonly text: (key: string, params?: Readonly<Record<string, string | number>>) => string;
  /** Locale-aware formatting (m with 2 decimals, m² with 2 decimals, …). */
  readonly format: {
    readonly length: (mm: number) => string;
    readonly area: (mm2: number) => string;
  };
  /** The name for a new Room, e.g. "Room 3"; `offset` gives the 2nd, 3rd, … name when several are made at once. */
  readonly nextRoomName: (offset?: number) => string;
  /** The current selection, and a way to change it. */
  readonly selection: () => readonly Selection[];
  readonly select: (selection: readonly Selection[]) => void;
  /**
   * A right-click on the plan: what is under it (already selected), at a position in the canvas.
   * The app shows its context menu there.
   */
  readonly contextMenu?: (at: Vec, target: PlanTarget) => void;
  /** A command was refused: show its reason near the cursor and in the message bar. */
  readonly refused: (reason: Message, at: { x: number; y: number }) => void;
}
