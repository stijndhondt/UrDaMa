import { Injectable, computed, effect, inject, isDevMode, signal, untracked } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import {
  ProjectStore,
  createProject,
  parseProject,
  randomIds,
  serializeProject,
  type LevelId,
  type Model,
  type NewProjectOptions,
} from '@lakudemis/core';
import { readWorkingCopy, writeWorkingCopy } from './working-copy';

const AUTOSAVE_DELAY_MS = 300;

/**
 * Holds the open project: its store (commands in, Derived values out), the Level being edited,
 * and its link to the project file. Every committed change is saved to the working copy.
 */
@Injectable({ providedIn: 'root' })
export class ProjectService {
  private readonly translate = inject(TranslateService);
  private readonly ids = randomIds();

  readonly store = new ProjectStore(this.newModel({}), this.ids);
  private readonly selectedLevel = signal<LevelId | null>(null);

  /** Text last saved to the project file; null when never saved. */
  private readonly savedText = signal<string | null>(null);
  readonly fileName = signal<string | null>(null);
  fileHandle: FileSystemFileHandle | null = null;
  /** Set once the working copy has been restored (or found empty). */
  readonly ready = signal(false);
  /** Increases whenever a different project is loaded (new, opened, restored). */
  readonly generation = signal(0);

  /** The project as its file would be written now. */
  readonly text = computed(() => serializeProject(this.store.committedModel()));
  /** Changes not yet saved to the project file. */
  readonly unsaved = computed(() => this.text() !== this.savedText());
  readonly name = computed(() => this.store.committedModel().project.name);

  /** The Levels, lowest first. */
  readonly levels = computed(() =>
    Object.values(this.store.model().levels).sort((a, b) => a.order - b.order),
  );
  /** The Level below the edited one (shown faded), or null. */
  readonly levelBelow = computed<LevelId | null>(() => {
    const levels = this.levels();
    const i = levels.findIndex((l) => l.id === this.level());
    return i > 0 ? levels[i - 1]!.id : null;
  });

  /** The Level being edited: the chosen one, or the lowest. */
  readonly level = computed<LevelId>(() => {
    const levels = Object.values(this.store.model().levels).sort((a, b) => a.order - b.order);
    const chosen = this.selectedLevel();
    return chosen && levels.some((l) => l.id === chosen) ? chosen : levels[0]!.id;
  });

  private autosaveTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    // A brand-new project counts as saved until it is changed.
    this.savedText.set(this.text());
    effect(() => {
      const text = this.text();
      if (!this.ready()) return;
      untracked(() => this.scheduleAutosave(text));
    });
    // Development only: lets the browser console (and end-to-end checks) inspect the model.
    if (isDevMode())
      (globalThis as Record<string, unknown>)['__lakudemis'] = { store: this.store, project: this };
  }

  /** Restores the working copy from the browser, if there is one. Called before the app starts. */
  async restore(): Promise<void> {
    const copy = await readWorkingCopy();
    if (copy) {
      const parsed = parseProject(copy.text);
      if (parsed.ok) {
        this.store.replace(parsed.model);
        this.generation.update((g) => g + 1);
        this.savedText.set(copy.savedText);
        this.fileName.set(copy.fileName);
        this.fileHandle = copy.fileHandle;
      }
    } else {
      // Nothing to restore: a fresh project, now that the default names can be translated.
      this.newProject({});
    }
    this.ready.set(true);
  }

  /** Replaces the open project (a new one, or one opened from a file). */
  load(
    model: Model,
    file: { name: string | null; handle: FileSystemFileHandle | null; saved: boolean },
  ): void {
    this.store.replace(model);
    this.generation.update((g) => g + 1);
    this.selectedLevel.set(null);
    this.fileName.set(file.name);
    this.fileHandle = file.handle;
    this.savedText.set(file.saved ? serializeProject(model) : null);
  }

  /** Starts a new project; it counts as saved until changed. */
  newProject(options: Partial<NewProjectOptions>): void {
    const model = this.newModel(options);
    this.load(model, { name: null, handle: null, saved: false });
    this.savedText.set(serializeProject(model));
  }

  /** Records that the current text was written to the project file. */
  markSaved(name: string, handle: FileSystemFileHandle | null, text: string): void {
    this.fileName.set(name);
    this.fileHandle = handle;
    this.savedText.set(text);
    this.flushAutosave();
  }

  selectLevel(id: LevelId): void {
    this.selectedLevel.set(id);
  }

  /** The default name for the next Room, e.g. "Room 3" / "Ruimte 3": the first number not in use. */
  nextRoomName(offset = 0): string {
    const used = new Set(Object.values(this.store.committedModel().rooms).map((r) => r.name));
    let skip = offset;
    for (let n = used.size + 1; ; n++) {
      const name: string = this.translate.instant('rooms.defaultName', { n });
      if (used.has(name)) continue;
      if (skip-- === 0) return name;
    }
  }

  private newModel(options: Partial<NewProjectOptions>): Model {
    return createProject(
      {
        name: options.name?.trim() || this.translate.instant('project.untitled'),
        levelName: this.translate.instant('levels.groundFloor'),
        wallThickness: options.wallThickness,
        roomHeight: options.roomHeight,
      },
      this.ids,
    );
  }

  private scheduleAutosave(text: string): void {
    if (this.autosaveTimer) clearTimeout(this.autosaveTimer);
    this.autosaveTimer = setTimeout(() => {
      this.autosaveTimer = null;
      void writeWorkingCopy({
        text,
        savedText: this.savedText(),
        fileName: this.fileName(),
        fileHandle: this.fileHandle,
      });
    }, AUTOSAVE_DELAY_MS);
  }

  private flushAutosave(): void {
    if (this.autosaveTimer) clearTimeout(this.autosaveTimer);
    this.autosaveTimer = null;
    void writeWorkingCopy({
      text: this.text(),
      savedText: this.savedText(),
      fileName: this.fileName(),
      fileHandle: this.fileHandle,
    });
  }
}
