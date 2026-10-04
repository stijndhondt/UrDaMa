import { Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import type { RotateWallArgs, WallAnchor } from '@urdama/core';
import { readSetting, writeSetting } from '../browser-setting';
import { SelectionService } from './selection.service';

const STORAGE_KEY = 'urdama.turnMode';
const MODES: readonly RotateWallArgs['mode'][] = ['slide', 'wall'];

/**
 * How a Wall turns: the anchor it turns around and what follows, shared by the plan (where the
 * anchors are clicked and dragged) and the properties panel's angle editor. The mode is
 * remembered per browser; the anchor is the centre again for every newly selected Wall.
 */
@Injectable({ providedIn: 'root' })
export class WallTurnService {
  readonly anchor = signal<WallAnchor>('centre');
  readonly mode = signal<RotateWallArgs['mode']>(readSetting(STORAGE_KEY, MODES) ?? 'slide');

  private readonly selection = inject(SelectionService);
  private readonly selected = computed(() => this.selection.wall()?.id);

  constructor() {
    effect(() => {
      this.selected();
      untracked(() => this.anchor.set('centre'));
    });
    effect(() => {
      writeSetting(STORAGE_KEY, this.mode());
    });
  }
}
