import { Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import {
  resolveOpening,
  type FacadeSide,
  type ResolvedOpening,
  type Room,
  type Wall,
} from '@lakudemis/core';
import type { Selection } from '@lakudemis/editor2d';
import { ProjectService } from '../project/project.service';

/** The selected Walls, Rooms, Room separators and Openings, shared by the plan and the properties panel. */
@Injectable({ providedIn: 'root' })
export class SelectionService {
  private readonly project = inject(ProjectService);
  readonly current = signal<readonly Selection[]>([]);

  /** A Façade or Façade part picked in the Quantities (ticket 15): its side and Wall faces. */
  private readonly picked = signal<{
    readonly side: FacadeSide;
    readonly faces: ReadonlySet<string>;
    readonly with: readonly Selection[];
  } | null>(null);
  /** The picked Façade, while its Walls are still what is selected. */
  readonly facade = computed(() => {
    const p = this.picked();
    return p && p.with === this.current() ? p : null;
  });

  /** Selects a Façade's Walls and remembers its faces, to highlight in its Elevation. */
  selectFacade(side: FacadeSide, faces: ReadonlySet<string>, walls: readonly Selection[]): void {
    this.current.set(walls);
    this.picked.set({ side, faces, with: walls });
  }

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
  /** The selected Opening with its type's kind and sizes, when exactly one is selected. */
  readonly opening = computed<ResolvedOpening | null>(() => {
    const s = this.single();
    const model = this.project.store.model();
    const o = s?.kind === 'opening' ? model.openings[s.id] : undefined;
    return o ? resolveOpening(model, o) : null;
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
