import { Injectable, signal } from '@angular/core';
import { readList, writeJson } from '../browser-setting';

const KEY = 'urdama.panel.collapsed';

/** Which properties panel sections are folded, remembered per browser (ticket 29). */
@Injectable({ providedIn: 'root' })
export class PanelSectionsService {
  private readonly folded = signal<ReadonlySet<string>>(new Set(readList(KEY)));

  isFolded(key: string): boolean {
    return this.folded().has(key);
  }

  toggle(key: string): void {
    const next = new Set(this.folded());
    if (!next.delete(key)) next.add(key);
    this.folded.set(next);
    writeJson(KEY, [...next].sort());
  }
}
