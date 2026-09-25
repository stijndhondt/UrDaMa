import type { LevelId, Message, ProjectStore } from '@lakudemis/core';

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
  /** The name for the next new Room, e.g. "Room 3". */
  readonly nextRoomName: () => string;
  /** A command was refused: show its reason near the cursor and in the message bar. */
  readonly refused: (reason: Message, at: { x: number; y: number }) => void;
}
