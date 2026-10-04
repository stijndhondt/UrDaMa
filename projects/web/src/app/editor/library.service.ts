import { Injectable, effect, inject, signal } from '@angular/core';
import {
  importOpeningFamily,
  libraryFamily,
  type LibraryFamily,
  type OpeningFamilyId,
  type OpeningKind,
  type OpeningTypeId,
} from '@urdama/core';
import { readJson, writeJson } from '../browser-setting';
import { LanguageService } from '../language';
import { MessagesService } from '../messages.service';
import { ProjectService } from '../project/project.service';

const KEY = 'urdama.library';

/** An Opening type on its way from the Library panel to a Wall. */
export interface DraggedType {
  readonly kind: OpeningKind;
  readonly type: OpeningTypeId;
}

/** A library family as stored: the shape is checked again when it is imported. */
const isLibraryFamily = (v: unknown): v is LibraryFamily =>
  typeof v === 'object' &&
  v !== null &&
  typeof (v as LibraryFamily).id === 'string' &&
  typeof (v as LibraryFamily).kind === 'string' &&
  Array.isArray((v as LibraryFamily).types);

/**
 * The personal Opening library (ticket 21): families with their types, in this browser's storage,
 * apart from the working copy, so every project on this browser sees them. A family is saved
 * from the project and imported as a copy, so a project never depends on the library.
 */
@Injectable({ providedIn: 'root' })
export class LibraryService {
  private readonly project = inject(ProjectService);
  private readonly messages = inject(MessagesService);
  private readonly language = inject(LanguageService);

  readonly families = signal<readonly LibraryFamily[]>(this.read());

  private readonly dragged = signal<DraggedType | null>(null);
  /** The Opening type being dragged from the Library panel onto the plan, if any. */
  readonly dragging = this.dragged.asReadonly();

  constructor() {
    effect(() => writeJson(KEY, this.families()));
    // Another tab changed the library: show it here too.
    window.addEventListener('storage', (e) => {
      if (e.key === KEY) this.families.set(this.read());
    });
  }

  /**
   * A project family and its types into the library. An entry of the same kind and name is
   * replaced (saved again), not doubled.
   */
  save(family: OpeningFamilyId): void {
    const entry = libraryFamily(this.project.store.model(), family, crypto.randomUUID());
    if (!entry) return;
    // An unnamed family (a built-in one) is kept under its kind's name, as the panel shows it.
    const named = { ...entry, name: entry.name ?? this.kindName(entry.kind) };
    const same = (f: LibraryFamily) => f.kind === named.kind && f.name === named.name;
    const old = this.families().find(same);
    this.families.set(
      old
        ? this.families().map((f) => (f === old ? { ...named, id: old.id } : f))
        : [...this.families(), named],
    );
  }

  startDrag(type: DraggedType): void {
    this.dragged.set(type);
  }

  endDrag(): void {
    this.dragged.set(null);
  }

  remove(id: string): void {
    this.families.set(this.families().filter((f) => f.id !== id));
  }

  /** A library family into the project (a copy with new IDs), as one undo step. */
  import(id: string): void {
    const family = this.families().find((f) => f.id === id);
    if (!family) return;
    const shownNames = Object.values(this.project.store.model().openingFamilies)
      .filter((f) => !f.name)
      .map((f) => this.kindName(f.kind));
    const result = this.project.store.run(importOpeningFamily, { family, shownNames });
    if (!result.ok) this.messages.refused(result.reason);
  }

  private kindName(kind: OpeningKind): string {
    return this.language.text('panel.opening.' + kind);
  }

  private read(): LibraryFamily[] {
    const v = readJson(KEY);
    return Array.isArray(v) ? v.filter(isLibraryFamily) : [];
  }
}
