import { Injectable, effect, signal } from '@angular/core';
import type { SetWallLengthArgs } from '@lakudemis/core';
import { readSetting, writeSetting } from '../browser-setting';

const STORAGE_KEY = 'lakudemis.lengthMode';
const MODES: readonly SetWallLengthArgs['mode'][] = ['room', 'wall'];

/**
 * What moves when a Wall's length is typed (tickets 01, 23): Move Room the first time, then the
 * last choice, shared by the properties panel and the plan's length editor, remembered per browser.
 */
@Injectable({ providedIn: 'root' })
export class LengthChoiceService {
  readonly mode = signal<SetWallLengthArgs['mode']>(readSetting(STORAGE_KEY, MODES) ?? 'room');

  constructor() {
    effect(() => {
      writeSetting(STORAGE_KEY, this.mode());
    });
  }
}
