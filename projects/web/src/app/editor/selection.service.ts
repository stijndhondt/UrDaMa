import { Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import {
  resolveOpening,
  type FacadeSide,
  type FloorOpening,
  type ResolvedOpening,
  type Room,
  type Wall,
} from '@urdama/core';
import type { Selection } from '@urdama/editor2d';
import { ProjectService } from '../project/project.service';

/** A Façade, Façade part or one Level of it, picked in the Quantities (ticket 15). */
export interface FacadePick {
  readonly side: FacadeSide;
  /** Its Wall faces, as wallFaceKey writes them */
  readonly faces: ReadonlySet<string>;
}

/** The selected Walls, Rooms, Room separators and Openings, shared by the plan and the properties panel. */
@Injectable({ providedIn: 'root' })
export class SelectionService {
  private readonly project = inject(ProjectService);
  readonly current = signal<readonly Selection[]>([]);

  /** The last Façade picked, and the selection it made. */
  private readonly picked = signal<{
    readonly facade: FacadePick;
    readonly selection: readonly Selection[];
  } | null>(null);
  /** The picked Façade, for as long as the selection it made stands (the same array). */
  readonly facade = computed<FacadePick | null>(() => {
    const p = this.picked();
    return p && p.selection === this.current() ? p.facade : null;
  });

  /** Selects a Façade's Walls and remembers its faces, to highlight in its Elevation. */
  selectFacade(facade: FacadePick, walls: readonly Selection[]): void {
    this.current.set(walls);
    this.picked.set({ facade, selection: walls });
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
  /** The selected Floor opening, when exactly one is selected. */
  readonly floorOpening = computed<FloorOpening | null>(() => {
    const s = this.single();
    return s?.kind === 'floorOpening'
      ? (this.project.store.model().floorOpenings[s.id] ?? null)
      : null;
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
          case 'floorOpening':
            return !!model.floorOpenings[x.id];
        }
      };
      if (s.some((x) => !exists(x))) untracked(() => this.current.set(s.filter(exists)));
    });
  }

  clear(): void {
    this.current.set([]);
  }
}
