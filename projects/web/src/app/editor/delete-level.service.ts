import { Injectable, signal } from '@angular/core';
import type { LevelId } from '@urdama/core';

/** The Level a "Delete Level" asks about (ticket 32); the Building and properties panels ask. */
@Injectable({ providedIn: 'root' })
export class DeleteLevelService {
  readonly asking = signal<LevelId | null>(null);
}
