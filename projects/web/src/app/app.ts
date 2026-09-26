import { Component, HostListener, computed, effect, inject, viewChild } from '@angular/core';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import type { ToolName } from '@lakudemis/editor2d';
import { deleteElements, type RoomId, type WallId } from '@lakudemis/core';
import { ChangeSummaryComponent } from './editor/change-summary.component';
import { PropertiesPanelComponent } from './editor/properties-panel.component';
import { SelectionService } from './editor/selection.service';
import { PlanEditorComponent } from './editor/plan-editor.component';
import { LANGUAGES, LanguageService } from './language';
import { MessagesService } from './messages.service';
import { FileService, type FileResult } from './project/file.service';
import { NewProjectDialogComponent } from './project/new-project-dialog.component';
import { ProjectService } from './project/project.service';

interface ToolButton {
  readonly name: ToolName;
  readonly key: string;
}

/** Tools available so far, with their keyboard shortcuts (the same in every language). */
const TOOLS: readonly ToolButton[] = [
  { name: 'select', key: 'V' },
  { name: 'room', key: 'R' },
  { name: 'wall', key: 'W' },
];

@Component({
  selector: 'lk-root',
  imports: [
    TranslatePipe,
    PlanEditorComponent,
    NewProjectDialogComponent,
    ChangeSummaryComponent,
    PropertiesPanelComponent,
  ],
  template: `
    <header class="bar">
      <h1 class="brand">Lakudemis</h1>
      <div class="project" [title]="project.fileName() ?? ''">
        <span class="name">{{ project.name() }}</span>
        @if (project.unsaved()) {
          <span class="unsaved" [title]="'project.unsaved' | translate"
            >● {{ 'project.unsaved' | translate }}</span
          >
        }
      </div>
      <nav class="menu" [attr.aria-label]="'project.menu' | translate">
        <button type="button" (click)="newDialog().open()">
          {{ 'project.new.action' | translate }}
        </button>
        <button type="button" (click)="open()" [title]="'Ctrl+O'">
          {{ 'project.open' | translate }}
        </button>
        <button type="button" (click)="save()" [title]="'Ctrl+S'">
          {{ 'project.save' | translate }}
        </button>
        <button type="button" (click)="saveAs()" [title]="'Ctrl+Shift+S'">
          {{ 'project.saveAs' | translate }}
        </button>
      </nav>
      <nav class="menu" [attr.aria-label]="'history.menu' | translate">
        <button
          type="button"
          [disabled]="!store.canUndo()"
          (click)="undo()"
          [title]="
            store.undoLabel()
              ? ('history.undo' | translate) +
                ': ' +
                (store.undoLabel()!.key | translate: store.undoLabel()!.params) +
                ' (Ctrl+Z)'
              : ('history.undo' | translate)
          "
        >
          ↶ {{ 'history.undo' | translate }}
        </button>
        <button
          type="button"
          [disabled]="!store.canRedo()"
          (click)="redo()"
          [title]="
            store.redoLabel()
              ? ('history.redo' | translate) +
                ': ' +
                (store.redoLabel()!.key | translate: store.redoLabel()!.params) +
                ' (Ctrl+Y)'
              : ('history.redo' | translate)
          "
        >
          ↷ {{ 'history.redo' | translate }}
        </button>
      </nav>
      <nav class="tools" [attr.aria-label]="'app.tools' | translate">
        @for (t of tools; track t.name) {
          <button
            type="button"
            [class.on]="editor()?.tool() === t.name"
            [attr.aria-pressed]="editor()?.tool() === t.name"
            [title]="('tools.' + t.name + '.hint' | translate) + ' (' + t.key + ')'"
            (click)="selectTool(t.name)"
          >
            {{ 'tools.' + t.name + '.name' | translate }} <kbd>{{ t.key }}</kbd>
          </button>
        }
      </nav>
      <span class="spacer"></span>
      <label class="lang">
        {{ 'app.language' | translate }}
        <select
          [value]="language.current()"
          (change)="language.current.set($any($event.target).value)"
        >
          @for (l of languages; track l) {
            <option [value]="l">{{ 'app.languages.' + l | translate }}</option>
          }
        </select>
      </label>
    </header>
    <main class="work">
      <div class="stage" (pointerdown)="messages.clear()">
        <lk-plan-editor [label]="'app.planLabel' | translate" />
        @if (messages.current(); as shown) {
          @if (shown.at) {
            <div class="note" [style.left.px]="shown.at.x + 14" [style.top.px]="shown.at.y + 14">
              {{ shown.message.key | translate: shown.message.params }}
            </div>
          }
        }
      </div>
      <aside class="panel" [attr.aria-label]="'panel.label' | translate">
        <lk-properties-panel />
      </aside>
    </main>
    <footer class="status" role="status" aria-live="polite">
      @if (messages.current(); as shown) {
        <span [class.refused]="shown.kind === 'refused'">{{
          shown.message.key | translate: shown.message.params
        }}</span>
      } @else if (hasChange()) {
        <lk-change-summary />
      } @else {
        <span class="hint">{{ 'app.hints.' + (editor()?.tool() ?? 'room') | translate }}</span>
      }
    </footer>
    <lk-new-project-dialog />
  `,
  styles: `
    :host {
      display: grid;
      grid-template-rows: auto 1fr auto;
      height: 100vh;
    }
    .bar {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 6px 12px;
      border-bottom: 1px solid var(--line);
      background: var(--panel);
      flex-wrap: wrap;
    }
    .brand {
      font-size: 16px;
      margin: 0;
    }
    .project {
      display: flex;
      align-items: baseline;
      gap: 8px;
      min-width: 0;
    }
    .project .name {
      font-weight: 600;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 240px;
    }
    .unsaved {
      color: var(--warn);
      font-size: 12px;
      white-space: nowrap;
    }
    .menu,
    .tools {
      display: flex;
      gap: 4px;
    }
    .menu button,
    .tools button {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 4px 10px;
      border: 1px solid var(--line);
      border-radius: 6px;
      background: var(--panel);
      cursor: pointer;
    }
    .tools button.on {
      background: var(--ink);
      color: #fff;
      border-color: var(--ink);
    }
    kbd {
      font:
        11px ui-monospace,
        Consolas,
        monospace;
      opacity: 0.7;
    }
    .menu button:disabled {
      opacity: 0.45;
      cursor: default;
    }
    .spacer {
      flex: 1;
    }
    .lang {
      display: flex;
      align-items: center;
      gap: 6px;
      color: var(--muted);
    }
    .work {
      display: grid;
      grid-template-columns: 1fr 260px;
      min-height: 0;
    }
    .panel {
      border-left: 1px solid var(--line);
      background: var(--panel);
      overflow: auto;
    }
    .stage {
      position: relative;
      overflow: hidden;
    }
    .note {
      position: absolute;
      max-width: 320px;
      padding: 6px 10px;
      border-radius: 6px;
      background: #fff7ed;
      border: 1px solid #fdba74;
      color: var(--warn);
      font-size: 13px;
      pointer-events: none;
    }
    .status {
      padding: 4px 12px;
      border-top: 1px solid var(--line);
      background: var(--panel);
      font-size: 13px;
      min-height: 26px;
    }
    .status .hint {
      color: var(--muted);
    }
    .status .refused {
      color: var(--warn);
    }
  `,
})
export class App {
  protected readonly language = inject(LanguageService);
  protected readonly messages = inject(MessagesService);
  protected readonly project = inject(ProjectService);
  private readonly files = inject(FileService);
  private readonly translate = inject(TranslateService);
  protected readonly languages = LANGUAGES;
  protected readonly tools = TOOLS;
  protected readonly editor = viewChild(PlanEditorComponent);
  protected readonly newDialog = viewChild.required(NewProjectDialogComponent);
  protected readonly store = this.project.store;
  private readonly selection = inject(SelectionService);
  protected readonly hasChange = computed(() => (this.store.lastChange()?.rooms.length ?? 0) > 0);

  constructor() {
    effect(() => {
      document.title = `${this.project.unsaved() ? '● ' : ''}${this.project.name()} — Lakudemis`;
    });
  }

  protected selectTool(name: ToolName): void {
    this.messages.clear();
    this.editor()?.setTool(name);
  }

  protected deleteSelection(): void {
    const s = this.selection.current();
    if (!s) return;
    const result = this.store.run(deleteElements, {
      walls: s.kind === 'wall' ? [s.id as WallId] : [],
      rooms: s.kind === 'room' ? [s.id as RoomId] : [],
    });
    if (!result.ok) this.messages.refused(result.reason);
    else this.selection.current.set(null);
  }

  protected undo(): void {
    this.editor()?.cancel();
    this.messages.clear();
    this.store.undo();
  }

  protected redo(): void {
    this.editor()?.cancel();
    this.messages.clear();
    this.store.redo();
  }

  protected async save(): Promise<void> {
    this.report(await this.files.save(), 'file.saved');
  }

  protected async saveAs(): Promise<void> {
    this.report(await this.files.saveAs(), 'file.saved');
  }

  protected async open(): Promise<void> {
    this.editor()?.cancel();
    this.report(await this.files.open(), 'file.opened');
  }

  private report(result: FileResult, done: string): void {
    if (result.ok) this.messages.info({ key: done, params: { name: result.name } });
    else if (result.reason) this.messages.refused(result.reason);
  }

  @HostListener('window:keydown', ['$event'])
  protected onKeyDown(e: KeyboardEvent): void {
    if ((e.ctrlKey || e.metaKey) && !e.altKey) {
      const key = e.key.toLowerCase();
      if (key === 's') {
        e.preventDefault();
        void (e.shiftKey ? this.saveAs() : this.save());
      } else if (key === 'o') {
        e.preventDefault();
        void this.open();
      } else if (key === 'z' && !e.shiftKey) {
        e.preventDefault();
        this.undo();
      } else if (key === 'y' || (key === 'z' && e.shiftKey)) {
        e.preventDefault();
        this.redo();
      }
      return;
    }
    const target = e.target instanceof HTMLElement ? e.target : null;
    if (
      target &&
      (target.isContentEditable || ['INPUT', 'SELECT', 'TEXTAREA'].includes(target.tagName))
    )
      return;
    if (target?.closest('dialog')) return;
    const editor = this.editor();
    if (!editor || e.altKey) return;
    // The active tool gets the key first (typed values, S, Esc, …).
    if (editor.keyDown(e)) {
      e.preventDefault();
      return;
    }
    if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      this.deleteSelection();
      return;
    }
    if (e.key === 'Escape') {
      this.selectTool('select');
      return;
    }
    const tool = TOOLS.find((t) => t.key.toLowerCase() === e.key.toLowerCase());
    if (tool) {
      e.preventDefault();
      this.selectTool(tool.name);
    } else if (e.key === 'f' || e.key === 'F') {
      e.preventDefault();
      editor.fit();
    }
  }

  @HostListener('window:keyup', ['$event'])
  protected onKeyUp(e: KeyboardEvent): void {
    this.editor()?.keyUp(e);
  }
}
