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
import type { OpeningKind, OpeningTypeId } from '@lakudemis/core';
import {
  DEFAULT_PLAN_COLORS,
  PlanEditor,
  type EditorHost,
  type PlanColors,
  type ToolName,
} from '@lakudemis/editor2d';
import { FormatService } from '../format.service';
import { LanguageService } from '../language';
import { MessagesService } from '../messages.service';
import { ProjectService } from '../project/project.service';
import { SelectionService } from './selection.service';
import { ThemeService } from '../shell/theme.service';
import { ContextMenuService } from './context-menu.service';
import { LengthEditService } from './length-edit.service';
import { LevelVisibilityService } from './level-visibility.service';

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
  /** Screen px per mm on the plan (0 until the first draw). */
  readonly scale = signal(0);

  private readonly canvas = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');
  private readonly project = inject(ProjectService);
  private readonly translate = inject(TranslateService);
  private readonly format = inject(FormatService);
  private readonly language = inject(LanguageService);
  private readonly messages = inject(MessagesService);
  private readonly selection = inject(SelectionService);
  private readonly contextMenus = inject(ContextMenuService);
  private readonly lengthEdits = inject(LengthEditService);
  private readonly visibility = inject(LevelVisibilityService);
  private readonly theme = inject(ThemeService);
  /** The plan's colours, read from the theme's CSS variables once per theme. */
  private colorCache: { dark: boolean; colors: PlanColors } | null = null;
  private editor: PlanEditor | null = null;

  constructor() {
    afterNextRender(() => {
      const host: EditorHost = {
        store: this.project.store,
        level: () => this.project.level(),
        // The faded Level below is left out when it is hidden (ticket 10).
        levelBelow: () => {
          const below = this.project.levelBelow();
          return below && !this.visibility.isHidden(below) ? below : null;
        },
        text: (key, params) => this.translate.instant(key, params),
        format: { length: this.format.length, area: this.format.area },
        nextRoomName: (offset) => this.project.nextRoomName(offset),
        selection: () => this.selection.current(),
        select: (selection) => this.selection.current.set(selection),
        refused: (reason, at) => this.messages.refused(reason, at),
        contextMenu: (at, target) => this.contextMenus.open(at, target),
        zoomChanged: (scale) => this.scale.set(scale),
        editLength: (wall, at, faceLength) => this.lengthEdits.open.set({ wall, at, faceLength }),
        colors: () => this.planColors(),
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
    // Redraw whenever the model, the Level, the selection, the language or the theme changes.
    effect(() => {
      this.theme.dark();
      this.selection.current();
      this.project.store.model();
      this.project.level();
      this.visibility.hidden();
      this.language.current();
      this.editor?.invalidate();
    });
    inject(DestroyRef).onDestroy(() => this.editor?.destroy());
  }

  /**
   * The plan's colours from the app's theme (styles.css, --plan-* and friends), read when first
   * drawn in a theme: a canvas needs the colours themselves, not CSS variables.
   */
  private planColors(): PlanColors {
    const dark = this.theme.dark();
    if (this.colorCache?.dark === dark) return this.colorCache.colors;
    const style = getComputedStyle(document.documentElement);
    const read = (name: string, fallback: string) =>
      style.getPropertyValue(name).trim() || fallback;
    const d = DEFAULT_PLAN_COLORS;
    const colors: PlanColors = {
      paper: read('--paper', d.paper),
      gridMinor: read('--plan-grid-minor', d.gridMinor),
      gridMajor: read('--plan-grid-major', d.gridMajor),
      area: read('--plan-area', d.area),
      areaChanged: read('--accent-soft', d.areaChanged),
      hatch: read('--plan-hatch', d.hatch),
      wallFill: read('--plan-wall-fill', d.wallFill),
      wallStroke: read('--plan-wall-stroke', d.wallStroke),
      separator: read('--plan-separator', d.separator),
      levelBelow: d.levelBelow,
      levelBelowStroke: d.levelBelowStroke,
      label: read('--ink', d.label),
      muted: read('--muted', d.muted),
      ok: read('--ok', d.ok),
      warn: read('--warn', d.warn),
      bad: read('--bad', d.bad),
      accent: read('--accent', d.accent),
      onAccent: read('--accent-ink', d.onAccent),
    };
    this.colorCache = { dark, colors };
    return colors;
  }

  /** A tool chosen by its button or key (an Opening tool places its kind's default size). */
  setTool(name: ToolName): void {
    this.editor?.chooseTool(name);
    this.tool.set(this.editor?.toolName ?? null);
  }

  /** The Opening type flyout: place this type with its kind's tool. */
  placeOpeningType(kind: OpeningKind, type: OpeningTypeId): void {
    this.editor?.placeOpeningType(kind, type);
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
