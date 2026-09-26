import type { LevelId, Message, ProjectStore } from '@lakudemis/core';

/** The selected element: a Wall or a Room (Slice 1 spec, "Select / move / delete"). */
export interface Selection {
  readonly kind: 'wall' | 'room' | 'separator';
  readonly id: string;
}

/** What the editor needs from the app around it. */
export interface EditorHost {
  readonly store: ProjectStore;
  /** The Level being edited. */
  readonly level: () => LevelId;
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
  /** A command was refused: show its reason near the cursor and in the message bar. */
  readonly refused: (reason: Message, at: { x: number; y: number }) => void;
}
