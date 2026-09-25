import { Component, HostListener, inject, viewChild } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import type { ToolName } from '@lakudemis/editor2d';
import { PlanEditorComponent } from './editor/plan-editor.component';
import { LANGUAGES, LanguageService } from './language';
import { MessagesService } from './messages.service';

interface ToolButton {
  readonly name: ToolName;
  readonly key: string;
}

/** Tools available so far, with their keyboard shortcuts (the same in every language). */
const TOOLS: readonly ToolButton[] = [{ name: 'room', key: 'R' }];

@Component({
  selector: 'lk-root',
  imports: [TranslatePipe, PlanEditorComponent],
  template: `
    <header class="bar">
      <h1 class="brand">Lakudemis</h1>
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
    <main class="stage" (pointerdown)="messages.clear()">
      <lk-plan-editor [label]="'app.planLabel' | translate" />
      @if (messages.current(); as shown) {
        @if (shown.at) {
          <div class="note" [style.left.px]="shown.at.x + 14" [style.top.px]="shown.at.y + 14">
            {{ shown.message.key | translate: shown.message.params }}
          </div>
        }
      }
    </main>
    <footer class="status" role="status" aria-live="polite">
      @if (messages.current(); as shown) {
        <span [class.refused]="shown.kind === 'refused'">{{
          shown.message.key | translate: shown.message.params
        }}</span>
      } @else {
        <span class="hint">{{ 'app.hint' | translate }}</span>
      }
    </footer>
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
    }
    .brand {
      font-size: 16px;
      margin: 0 8px 0 0;
    }
    .tools {
      display: flex;
      gap: 4px;
    }
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
    .spacer {
      flex: 1;
    }
    .lang {
      display: flex;
      align-items: center;
      gap: 6px;
      color: var(--muted);
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
  protected readonly languages = LANGUAGES;
  protected readonly tools = TOOLS;
  protected readonly editor = viewChild(PlanEditorComponent);

  protected selectTool(name: ToolName): void {
    this.messages.clear();
    this.editor()?.setTool(name);
  }

  @HostListener('window:keydown', ['$event'])
  protected onKeyDown(e: KeyboardEvent): void {
    const target = e.target as HTMLElement | null;
    if (
      target &&
      (target.isContentEditable || ['INPUT', 'SELECT', 'TEXTAREA'].includes(target.tagName))
    )
      return;
    const editor = this.editor();
    if (!editor) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    // The active tool gets the key first (typed values, S, Esc, …).
    if (editor.keyDown(e)) {
      e.preventDefault();
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
