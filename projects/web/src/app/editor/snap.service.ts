import { Injectable, effect, signal } from '@angular/core';
import { readSetting, writeSetting } from '../browser-setting';

const KEY = 'lakudemis.snap';

/**
 * The snap toggle (ticket 26): all snapping while drawing (Wall corners and faces, alignment
 * guides, drag increments) on or off, on by default and remembered per browser. Holding Alt
 * inverts it for one point.
 */
@Injectable({ providedIn: 'root' })
export class SnapService {
  readonly on = signal(readSetting(KEY, ['on', 'off'] as const) !== 'off');

  constructor() {
    effect(() => writeSetting(KEY, this.on() ? 'on' : 'off'));
  }

  toggle(): void {
    this.on.set(!this.on());
  }
}
