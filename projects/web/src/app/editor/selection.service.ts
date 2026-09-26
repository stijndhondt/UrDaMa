import { Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import type {
  Opening,
  OpeningId,
  Room,
  RoomId,
  RoomSeparatorId,
  Wall,
  WallId,
} from '@lakudemis/core';
import type { Selection } from '@lakudemis/editor2d';
import { ProjectService } from '../project/project.service';

/** The selected Walls, Rooms, Room separators and Openings, shared by the plan and the properties panel. */
@Injectable({ providedIn: 'root' })
export class SelectionService {
  private readonly project = inject(ProjectService);
  readonly current = signal<readonly Selection[]>([]);

  /** The selected Wall, when exactly one Wall is selected. */
  readonly wall = computed<Wall | null>(() => {
    const s = this.current();
    return s.length === 1 && s[0]!.kind === 'wall'
      ? (this.project.store.model().walls[s[0]!.id as WallId] ?? null)
      : null;
  });
  /** The selected Room, when exactly one Room is selected. */
  readonly room = computed<Room | null>(() => {
    const s = this.current();
    return s.length === 1 && s[0]!.kind === 'room'
      ? (this.project.store.model().rooms[s[0]!.id as RoomId] ?? null)
      : null;
  });
  /** The selected Opening, when exactly one door or window is selected. */
  readonly opening = computed<Opening | null>(() => {
    const s = this.current();
    return s.length === 1 && s[0]!.kind === 'opening'
      ? (this.project.store.model().openings[s[0]!.id as OpeningId] ?? null)
      : null;
  });
  /** All selected Rooms (two of them can be merged). */
  readonly rooms = computed<readonly Room[]>(() =>
    this.current()
      .filter((s) => s.kind === 'room')
      .flatMap((s) => this.project.store.model().rooms[s.id as RoomId] ?? []),
  );

  constructor() {
    // Deleted elements (or another project) can't stay selected.
    effect(() => {
      const s = this.current();
      const model = this.project.store.committedModel();
      const exists = (x: Selection) =>
        x.kind === 'wall'
          ? !!model.walls[x.id as WallId]
          : x.kind === 'room'
            ? !!model.rooms[x.id as RoomId]
            : x.kind === 'opening'
              ? !!model.openings[x.id as OpeningId]
              : !!model.roomSeparators[x.id as RoomSeparatorId];
      if (s.some((x) => !exists(x))) untracked(() => this.current.set(s.filter(exists)));
    });
  }

  clear(): void {
    this.current.set([]);
  }
}
