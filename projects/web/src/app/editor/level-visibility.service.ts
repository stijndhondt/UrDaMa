import { Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import type { LevelId } from '@lakudemis/core';
import { readList, writeSetting } from '../browser-setting';
import { ProjectService } from '../project/project.service';

/**
 * Which Levels are hidden (ticket 10): in the plan (the faded Level below) and in 3D. A view
 * setting, remembered per browser and per project, never written to the project file. The
 * Level being drawn on is always shown (its choice is kept for when another Level is drawn on).
 */
@Injectable({ providedIn: 'root' })
export class LevelVisibilityService {
  private readonly project = inject(ProjectService);
  private readonly stored = signal<ReadonlySet<string>>(new Set());
  private readonly key = computed(
    () => `lakudemis.hiddenLevels.${this.project.store.committedModel().project.id}`,
  );

  /**
   * The hidden Levels that exist, never the one being drawn on. From the committed model (a drag
   * never adds or removes a Level), and the same set while it doesn't change: every view redraws
   * when it changes, which on every pointer move of a drag cost the 3D view 11 ms (ticket 33).
   */
  readonly hidden = computed<ReadonlySet<LevelId>>(
    () => {
      const levels = this.project.store.committedModel().levels;
      const current = this.project.level();
      return new Set([...this.stored()].filter((id) => id !== current && levels[id]) as LevelId[]);
    },
    { equal: (a, b) => a.size === b.size && [...a].every((id) => b.has(id)) },
  );

  constructor() {
    // Another project: its own remembered choice.
    effect(() => {
      const key = this.key();
      untracked(() => this.stored.set(new Set(readList(key))));
    });
  }

  isHidden(level: LevelId): boolean {
    return this.hidden().has(level);
  }

  toggle(level: LevelId): void {
    const next = new Set(this.stored());
    if (next.has(level)) next.delete(level);
    else next.add(level);
    this.stored.set(next);
    writeSetting(this.key(), JSON.stringify([...next]));
  }
}
