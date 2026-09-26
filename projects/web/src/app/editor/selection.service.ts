import { Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import type { Room, RoomId, Wall, WallId } from '@lakudemis/core';
import type { Selection } from '@lakudemis/editor2d';
import { ProjectService } from '../project/project.service';

/** The selected Wall or Room, shared by the plan and the properties panel. */
@Injectable({ providedIn: 'root' })
export class SelectionService {
  private readonly project = inject(ProjectService);
  readonly current = signal<Selection | null>(null);

  readonly wall = computed<Wall | null>(() => {
    const s = this.current();
    return s?.kind === 'wall' ? (this.project.store.model().walls[s.id as WallId] ?? null) : null;
  });
  readonly room = computed<Room | null>(() => {
    const s = this.current();
    return s?.kind === 'room' ? (this.project.store.model().rooms[s.id as RoomId] ?? null) : null;
  });

  constructor() {
    // A deleted element (or another project) can't stay selected.
    effect(() => {
      const s = this.current();
      const model = this.project.store.committedModel();
      if (!s) return;
      const exists =
        s.kind === 'wall' ? !!model.walls[s.id as WallId] : !!model.rooms[s.id as RoomId];
      if (!exists) untracked(() => this.current.set(null));
    });
  }
}
