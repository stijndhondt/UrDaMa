import { Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import type { Opening, Room, Wall } from '@lakudemis/core';
import type { Selection } from '@lakudemis/editor2d';
import { ProjectService } from '../project/project.service';

/** The selected Walls, Rooms, Room separators and Openings, shared by the plan and the properties panel. */
@Injectable({ providedIn: 'root' })
export class SelectionService {
  private readonly project = inject(ProjectService);
  readonly current = signal<readonly Selection[]>([]);

  /** The one selected element, when exactly one is selected. */
  private readonly single = computed<Selection | null>(() => {
    const s = this.current();
    return s.length === 1 ? s[0]! : null;
  });
  /** The selected Wall, when exactly one Wall is selected. */
  readonly wall = computed<Wall | null>(() => {
    const s = this.single();
    return s?.kind === 'wall' ? (this.project.store.model().walls[s.id] ?? null) : null;
  });
  /** The selected Room, when exactly one Room is selected. */
  readonly room = computed<Room | null>(() => {
    const s = this.single();
    return s?.kind === 'room' ? (this.project.store.model().rooms[s.id] ?? null) : null;
  });
  /** The selected Opening, when exactly one door or window is selected. */
  readonly opening = computed<Opening | null>(() => {
    const s = this.single();
    return s?.kind === 'opening' ? (this.project.store.model().openings[s.id] ?? null) : null;
  });
  /** All selected Rooms (two of them can be merged). */
  readonly rooms = computed<readonly Room[]>(() =>
    this.current().flatMap((s) =>
      s.kind === 'room' ? (this.project.store.model().rooms[s.id] ?? []) : [],
    ),
  );

  constructor() {
    // Deleted elements (or another project) can't stay selected.
    effect(() => {
      const s = this.current();
      const model = this.project.store.committedModel();
      const exists = (x: Selection): boolean => {
        switch (x.kind) {
          case 'wall':
            return !!model.walls[x.id];
          case 'room':
            return !!model.rooms[x.id];
          case 'opening':
            return !!model.openings[x.id];
          case 'separator':
            return !!model.roomSeparators[x.id];
        }
      };
      if (s.some((x) => !exists(x))) untracked(() => this.current.set(s.filter(exists)));
    });
  }

  clear(): void {
    this.current.set([]);
  }
}
