import { Injectable, computed, inject, isDevMode, signal } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { ProjectStore, createProject, randomIds, type LevelId, type Model } from '@lakudemis/core';

/** Holds the open project: its store (commands in, Derived values out) and the Level being edited. */
@Injectable({ providedIn: 'root' })
export class ProjectService {
  private readonly translate = inject(TranslateService);
  private readonly ids = randomIds();

  readonly store = new ProjectStore(this.newModel(), this.ids);
  private readonly selectedLevel = signal<LevelId | null>(null);

  /** The Level being edited: the chosen one, or the lowest. */
  readonly level = computed<LevelId>(() => {
    const levels = Object.values(this.store.model().levels).sort((a, b) => a.order - b.order);
    const chosen = this.selectedLevel();
    return chosen && levels.some((l) => l.id === chosen) ? chosen : levels[0]!.id;
  });

  constructor() {
    // Development only: lets the browser console (and end-to-end checks) inspect the model.
    if (isDevMode())
      (globalThis as Record<string, unknown>)['__lakudemis'] = { store: this.store, project: this };
  }

  selectLevel(id: LevelId): void {
    this.selectedLevel.set(id);
  }

  /** The default name for the next Room, e.g. "Room 3" / "Ruimte 3". */
  nextRoomName(): string {
    const n = Object.keys(this.store.committedModel().rooms).length + 1;
    return this.translate.instant('rooms.defaultName', { n });
  }

  private newModel(): Model {
    return createProject(
      {
        name: this.translate.instant('project.untitled'),
        levelName: this.translate.instant('levels.groundFloor'),
      },
      this.ids,
    );
  }
}
