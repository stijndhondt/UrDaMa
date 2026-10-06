import { Injectable, inject, signal } from '@angular/core';
import type { OpeningFamilyId, OpeningId, OpeningTypeId } from '@urdama/core';
import { ProjectService } from '../project/project.service';

/**
 * The Opening types dialog: which family's types it shows, null when it is closed. Opened from the
 * properties panel's "Types…" and by double-clicking a placed Opening on the plan.
 */
@Injectable({ providedIn: 'root' })
export class OpeningTypesService {
  private readonly project = inject(ProjectService);
  readonly family = signal<OpeningFamilyId | null>(null);

  /** The types of an Opening type's family. */
  openForType(type: OpeningTypeId): void {
    const family = this.project.store.model().openingTypes[type]?.family;
    if (family) this.family.set(family);
  }

  /** The types of a placed Opening's family. */
  openFor(opening: OpeningId): void {
    const type = this.project.store.model().openings[opening]?.type;
    if (type) this.openForType(type);
  }
}
