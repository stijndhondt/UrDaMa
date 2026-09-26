import {
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  effect,
  inject,
  input,
  isDevMode,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { PlanEditor, type EditorHost, type ToolName } from '@lakudemis/editor2d';
import { FormatService } from '../format.service';
import { LanguageService } from '../language';
import { MessagesService } from '../messages.service';
import { ProjectService } from '../project/project.service';
import { SelectionService } from './selection.service';

/** Hosts the Canvas2D plan editor for the current Level. */
@Component({
  selector: 'lk-plan-editor',
  template: `<canvas #canvas class="plan" tabindex="0" [attr.aria-label]="label()"></canvas>`,
  styles: `
    :host {
      position: absolute;
      inset: 0;
    }
    .plan {
      display: block;
      width: 100%;
      height: 100%;
      outline: none;
      touch-action: none;
    }
  `,
})
export class PlanEditorComponent {
  readonly label = input('');
  readonly tool = signal<ToolName | null>(null);

  private readonly canvas = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');
  private readonly project = inject(ProjectService);
  private readonly translate = inject(TranslateService);
  private readonly format = inject(FormatService);
  private readonly language = inject(LanguageService);
  private readonly messages = inject(MessagesService);
  private readonly selection = inject(SelectionService);
  private editor: PlanEditor | null = null;

  constructor() {
    afterNextRender(() => {
      const host: EditorHost = {
        store: this.project.store,
        level: () => this.project.level(),
        text: (key, params) => this.translate.instant(key, params),
        format: { length: this.format.length, area: this.format.area },
        nextRoomName: (offset) => this.project.nextRoomName(offset),
        selection: () => this.selection.current(),
        select: (selection) => this.selection.current.set(selection),
        refused: (reason, at) => this.messages.refused(reason, at),
      };
      this.editor = new PlanEditor(this.canvas().nativeElement, host);
      // Development only: lets end-to-end checks convert between mm and screen positions.
      if (isDevMode()) {
        const debug = (globalThis as unknown as Record<string, object | undefined>)['__lakudemis'];
        if (debug) Object.assign(debug, { editor: this.editor });
      }
      this.tool.set(this.editor.toolName);
    });
    // A different project: abandon what the tool was doing and show the whole plan.
    effect(() => {
      this.project.generation();
      untracked(() => {
        this.editor?.cancel();
        this.editor?.fit();
      });
    });
    // Highlight the Rooms the last edit changed.
    effect(() => {
      const change = this.project.store.lastChange();
      const rooms = new Set(
        change?.rooms.filter((r) => r.after !== undefined).map((r) => r.room) ?? [],
      );
      untracked(() => this.editor?.setHighlight(rooms));
    });
    // Redraw whenever the model, the Level, the selection or the language changes.
    effect(() => {
      this.selection.current();
      this.project.store.model();
      this.project.level();
      this.language.current();
      this.editor?.invalidate();
    });
    inject(DestroyRef).onDestroy(() => this.editor?.destroy());
  }

  setTool(name: ToolName): void {
    this.editor?.setTool(name);
    this.tool.set(this.editor?.toolName ?? null);
  }

  cancel(): void {
    this.editor?.cancel();
  }

  fit(): void {
    this.editor?.fit();
  }

  keyDown(e: KeyboardEvent): boolean {
    return this.editor?.handleKeyDown(e) ?? false;
  }

  keyUp(e: KeyboardEvent): void {
    this.editor?.handleKeyUp(e);
  }
}
