import { Injectable, effect, signal } from '@angular/core';
import type { SetWallLengthArgs } from '@lakudemis/core';

const STORAGE_KEY = 'lakudemis.lengthMode';

/**
 * What moves when a Wall's length is typed (tickets 01, 23): Move Room the first time, then the
 * last choice, shared by the properties panel and the plan's length editor, remembered per browser.
 */
@Injectable({ providedIn: 'root' })
export class LengthChoiceService {
  readonly mode = signal<SetWallLengthArgs['mode']>(readStored());

  constructor() {
    effect(() => {
      try {
        localStorage.setItem(STORAGE_KEY, this.mode());
      } catch {
        // storage unavailable: the choice lasts for this session only
      }
    });
  }
}

function readStored(): SetWallLengthArgs['mode'] {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'wall' ? 'wall' : 'room';
  } catch {
    return 'room';
  }
}
