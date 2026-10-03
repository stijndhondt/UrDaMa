import { Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import {
  designOf,
  familyTypes,
  updateOpeningFamily,
  type OpeningDesign,
  type OpeningFamilyId,
  type OpeningTypeId,
} from '@lakudemis/core';
import type { FamilyPreview } from '@lakudemis/editor2d';
import { LanguageService } from '../language';
import { MessagesService } from '../messages.service';
import { ProjectService } from '../project/project.service';

/** mm: the Wall the family editor shows its family in, unless the frame is deeper */
const PREVIEW_WALL = 300;

/**
 * The Opening family edit mode (ticket 20): which family is being edited and at which of its
 * types' sizes it is shown. The editor lies over the panels, so leaving it finds the project's
 * views as they were. Every change is one updateOpeningFamily: one undo step for all its types
 * and Openings; a handle drag previews and commits on release.
 */
@Injectable({ providedIn: 'root' })
export class FamilyEditService {
  private readonly project = inject(ProjectService);
  private readonly messages = inject(MessagesService);
  private readonly language = inject(LanguageService);

  readonly editing = signal<{
    readonly family: OpeningFamilyId;
    readonly type: OpeningTypeId | null;
  } | null>(null);

  /** The family being edited, live (a drag in progress shows as it happens). */
  readonly family = computed(() => {
    const e = this.editing();
    return e ? (this.project.store.model().openingFamilies[e.family] ?? null) : null;
  });

  /** Its name, or its kind's ("Window"). */
  readonly name = computed(() => {
    const family = this.family();
    return family ? (family.name ?? this.language.text('panel.opening.' + family.kind)) : '';
  });

  readonly types = computed(() => {
    const e = this.editing();
    return e ? familyTypes(this.project.store.model(), e.family) : [];
  });

  /** What the views show: the family's design at the chosen type's size. */
  readonly preview = computed<FamilyPreview | null>(() => {
    const family = this.family();
    const e = this.editing();
    if (!family || !e) return null;
    const types = this.types();
    const type = types.find((t) => t.id === e.type) ?? types[0];
    const design = designOf(family);
    return {
      design,
      placement: {
        width: type?.width ?? 1000,
        height: type?.height ?? 2100,
        sill: 0,
        hinge: 'start',
        swing: 'right',
      },
      depth: Math.max(PREVIEW_WALL, design.frame?.depth ?? 0),
    };
  });

  constructor() {
    // A project opened (or the family gone): the edit mode ends.
    effect(() => {
      if (this.editing() && !this.family()) untracked(() => this.editing.set(null));
    });
  }

  enter(family: OpeningFamilyId, type: OpeningTypeId | null): void {
    this.editing.set({ family, type });
  }

  leave(): void {
    this.project.store.cancelPreview();
    this.project.store.endDrag();
    this.editing.set(null);
  }

  showType(type: OpeningTypeId): void {
    const e = this.editing();
    if (e) this.editing.set({ ...e, type });
  }

  /** A new design: at once, or as a drag's preview (`done` false) until it is released. */
  change(design: OpeningDesign, done = true): void {
    const family = this.editing()?.family;
    if (!family) return;
    const store = this.project.store;
    if (!done) store.beginDrag();
    const outcome = store.preview(updateOpeningFamily, { family, design });
    if (!outcome.ok) {
      store.cancelPreview();
      store.endDrag();
      this.messages.refused(outcome.reason);
      return;
    }
    if (done) {
      store.commitPreview();
      store.endDrag();
    }
  }

  rename(name: string): void {
    const family = this.editing()?.family;
    if (!family) return;
    const result = this.project.store.run(updateOpeningFamily, { family, name });
    if (!result.ok) this.messages.refused(result.reason);
  }

  cancel(): void {
    this.project.store.cancelPreview();
    this.project.store.endDrag();
  }
}
