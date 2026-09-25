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
  viewChild,
} from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { PlanEditor, type EditorHost, type ToolName } from '@lakudemis/editor2d';
import { FormatService } from '../format.service';
import { LanguageService } from '../language';
import { MessagesService } from '../messages.service';
import { ProjectService } from '../project/project.service';

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
  private editor: PlanEditor | null = null;

  constructor() {
    afterNextRender(() => {
      const host: EditorHost = {
        store: this.project.store,
        level: () => this.project.level(),
        text: (key, params) => this.translate.instant(key, params),
        format: { length: this.format.length, area: this.format.area },
        nextRoomName: () => this.project.nextRoomName(),
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
    // Redraw whenever the model, the Level or the language changes.
    effect(() => {
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
