import type {
  LevelId,
  Message,
  OpeningId,
  ProjectStore,
  RotateWallArgs,
  RoomId,
  RoomSeparatorId,
  Vec,
  WallAnchor,
  WallId,
} from '@urdama/core';
import type { PlanColors } from './draw-plan';
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
  /**
   * A double click on a Wall's length label (ticket 23): the app opens its length editor at that
   * point (canvas px). `faceLength` is the length the label shows (mm).
   */
  readonly editLength?: (wall: WallId, at: Vec, faceLength: number) => void;
  /**
   * The anchor a selected Wall turns around, shared with the app's angle editor; its centre when
   * absent. Clicking one of the Wall's anchors on the plan chooses it.
   */
  readonly wallAnchor?: () => WallAnchor;
  readonly setWallAnchor?: (anchor: WallAnchor) => void;
  /** What follows when a Wall turns (see RotateWall); its ends slide when absent. */
  readonly turnMode?: () => RotateWallArgs['mode'];
  /** The colours to draw with (the app's theme); the light defaults when absent. */
  readonly colors?: () => PlanColors;
  /** Whether snapping is on (ticket 26: the snap toggle); on when absent. Alt inverts it. */
  readonly snapping?: () => boolean;
  /** The plan's zoom changed (screen px per mm), e.g. for a drawing scale in a status bar. */
  readonly zoomChanged?: (scale: number) => void;
  /** A command was refused: show its reason near the cursor and in the message bar. */
  readonly refused: (reason: Message, at: { x: number; y: number }) => void;
}
