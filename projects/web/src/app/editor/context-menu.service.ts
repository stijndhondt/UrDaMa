import { Injectable, signal } from '@angular/core';
import type { Vec } from '@lakudemis/core';
import type { PlanTarget } from '@lakudemis/editor2d';

/** The open right-click menu: where it is (in the plan's coordinates) and what it acts on. */
@Injectable({ providedIn: 'root' })
export class ContextMenuService {
  readonly menu = signal<{ at: Vec; target: PlanTarget } | null>(null);

  open(at: Vec, target: PlanTarget): void {
    this.menu.set({ at, target });
  }

  close(): void {
    this.menu.set(null);
  }
}
