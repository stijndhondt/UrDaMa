import { Injectable, signal } from '@angular/core';
import type { FloorOpeningDirection, Vec } from '@urdama/core';

/** The question after a Floor opening is drawn: up or down (where, and who waits for it). */
interface Pending {
  /** Canvas px */
  readonly at: Vec;
  readonly answer: (direction: FloorOpeningDirection | null) => void;
}

@Injectable({ providedIn: 'root' })
export class FloorOpeningChoiceService {
  readonly pending = signal<Pending | null>(null);

  /** Asks near a point on the plan; null when the user cancels (Esc, or a click elsewhere). */
  ask(at: Vec): Promise<FloorOpeningDirection | null> {
    this.answer(null);
    return new Promise((resolve) => this.pending.set({ at, answer: resolve }));
  }

  answer(direction: FloorOpeningDirection | null): void {
    const p = this.pending();
    this.pending.set(null);
    p?.answer(direction);
  }
}
