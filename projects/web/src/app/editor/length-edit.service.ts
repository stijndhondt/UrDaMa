import { Injectable, signal } from '@angular/core';
import type { Vec, WallId } from '@urdama/core';

/** The length editor open on the plan (ticket 23): which Wall, where, and the face length shown. */
export interface PlanLengthEdit {
  readonly wall: WallId;
  /** Canvas px, at the double-clicked label */
  readonly at: Vec;
  /** mm, the length of the face whose label was double-clicked */
  readonly faceLength: number;
}

@Injectable({ providedIn: 'root' })
export class LengthEditService {
  readonly open = signal<PlanLengthEdit | null>(null);
}
