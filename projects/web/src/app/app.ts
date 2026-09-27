import {
  ChangeDetectionStrategy,
  Component,
  HostListener,
  computed,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import type { ToolName } from '@lakudemis/editor2d';
import type { MenuItem } from '@openng/optimus-ui/api';
import { ButtonModule } from '@openng/optimus-ui/button';
import { Optimus } from '@openng/optimus-ui/config';
import { MenubarModule } from '@openng/optimus-ui/menubar';
import { SplitterModule } from '@openng/optimus-ui/splitter';
import { TabsModule } from '@openng/optimus-ui/tabs';
import { TooltipModule } from '@openng/optimus-ui/tooltip';
import { en } from 'primelocale/js/en.js';
import { nl } from 'primelocale/js/nl.js';
import { ChangeSummaryComponent } from './editor/change-summary.component';
import { ContextMenuComponent } from './editor/context-menu.component';
import { ContextMenuService } from './editor/context-menu.service';
import { EditorActionsService } from './editor/editor-actions.service';
import { LevelTabsComponent } from './editor/level-tabs.component';
import { PlanEditorComponent } from './editor/plan-editor.component';
import { PropertiesPanelComponent } from './editor/properties-panel.component';
import { SelectionService } from './editor/selection.service';
import { View3dComponent } from './editor/view3d.component';
import { LANGUAGES, LanguageService } from './language';
import { MessagesService } from './messages.service';
import { FileService, type FileResult } from './project/file.service';
import { NewProjectDialogComponent } from './project/new-project-dialog.component';
import { ProjectService } from './project/project.service';
import { QuantitiesPanelComponent } from './quantities/quantities-panel.component';
import { IconComponent } from './shell/icon.component';
import { PlanToolbarComponent, TOOLS } from './shell/plan-toolbar.component';
import { THEME_CHOICES, ThemeService } from './shell/theme.service';

type BottomTab = 'quantities' | 'warnings';

/** Screen px per mm at 96 dpi: the drawing scale is 1 : (this / zoom). */
const PX_PER_MM = 96 / 25.4;

/**
 * The workspace (ticket 09, layout A "Workbench", ADR 0008): a menubar with undo/redo and the
 * theme; a left icon bar with the Building panel; the Plan (and 3D beside it) in the centre with
 * its floating tool bar; the properties panel on the right; Quantities and Warnings in a
 * collapsible bottom panel; a status bar with the hint, warnings, Level, units and scale.
 */
@Component({
  selector: 'lk-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    NgTemplateOutlet,
    TranslatePipe,
    ButtonModule,
    MenubarModule,
    SplitterModule,
    TabsModule,
    TooltipModule,
    ChangeSummaryComponent,
    ContextMenuComponent,
    IconComponent,
    LevelTabsComponent,
    NewProjectDialogComponent,
    PlanEditorComponent,
    PlanToolbarComponent,
    PropertiesPanelComponent,
    QuantitiesPanelComponent,
    View3dComponent,
  ],
  template: `
    <div class="wb">
      <p-menubar class="top" [model]="menus()" breakpoint="560px">
        <ng-template #start><strong class="brand">Lakudemis</strong></ng-template>
        <ng-template #item let-item let-root="root">
          <a class="mi" [class.root]="root">
            @if (!root) {
              <span class="check">
                @if (item.state?.checked) {
                  <lk-icon name="check" />
                }
              </span>
            }
            <span class="mi-label">{{ item.label }}</span>
            @if (item.shortcut) {
              <kbd>{{ item.shortcut }}</kbd>
            }
            @if (item.items && !root) {
              <lk-icon name="chevron-right" />
            }
            @if (item.items && root) {
              <lk-icon name="chevron-down" class="down" />
            }
          </a>
        </ng-template>
        <ng-template #end>
          <div class="top-end">
            <p-button
              size="small"
              [text]="true"
              [disabled]="!store.canUndo()"
              [ariaLabel]="'history.undo' | translate"
              [pTooltip]="undoHint()"
              tooltipPosition="bottom"
              (onClick)="undo()"
            >
              <lk-icon name="undo-2" />
            </p-button>
            <p-button
              size="small"
              [text]="true"
              [disabled]="!store.canRedo()"
              [ariaLabel]="'history.redo' | translate"
              [pTooltip]="redoHint()"
              tooltipPosition="bottom"
              (onClick)="redo()"
            >
              <lk-icon name="redo-2" />
            </p-button>
            <span class="project" [title]="project.fileName() ?? ''">
              {{ project.name() }}
              @if (project.unsaved()) {
                <span class="unsaved" [pTooltip]="'project.unsaved' | translate">●</span>
              }
            </span>
            <p-button
              size="small"
              [text]="true"
              [ariaLabel]="themeHint()"
              [pTooltip]="themeHint()"
              tooltipPosition="left"
              (onClick)="theme.next()"
            >
              <lk-icon
                [name]="theme.choice() === 'system' ? 'sun-moon' : theme.dark() ? 'moon' : 'sun'"
              />
            </p-button>
          </div>
        </ng-template>
      </p-menubar>

      <nav class="icons" [attr.aria-label]="'shell.panels' | translate">
        <button
          type="button"
          [class.on]="sideOpen()"
          [attr.aria-pressed]="sideOpen()"
          [attr.aria-label]="'shell.building' | translate"
          [pTooltip]="'shell.building' | translate"
          tooltipPosition="right"
          (click)="sideOpen.set(!sideOpen())"
        >
          <lk-icon name="building-2" />
        </button>
        <span class="spacer"></span>
        <button
          type="button"
          [class.on]="show3d()"
          [attr.aria-pressed]="show3d()"
          [attr.aria-label]="'view3d.toggle' | translate"
          [pTooltip]="'view3d.toggle' | translate"
          tooltipPosition="right"
          (click)="show3d.set(!show3d())"
        >
          <lk-icon name="box" />
        </button>
        <button
          type="button"
          [class.on]="bottomOpen() && bottomTab() === 'quantities'"
          [attr.aria-label]="'quantities.title' | translate"
          [pTooltip]="('quantities.title' | translate) + ' (Q)'"
          tooltipPosition="right"
          (click)="showBottom('quantities')"
        >
          <lk-icon name="sheet" />
        </button>
        <button
          type="button"
          [class.on]="bottomOpen() && bottomTab() === 'warnings'"
          [attr.aria-label]="'panel.warnings' | translate"
          [pTooltip]="'panel.warnings' | translate"
          tooltipPosition="right"
          (click)="showBottom('warnings')"
        >
          <lk-icon name="triangle-alert" />
        </button>
      </nav>

      @if (sideOpen()) {
        <aside class="side" [attr.aria-label]="'shell.building' | translate">
          <h2>{{ 'shell.building' | translate }}</h2>
          <lk-level-tabs class="levels" />
        </aside>
      }

      <main class="centre">
        @if (show3d()) {
          <p-splitter styleClass="fill" [panelSizes]="[55, 45]" [minSizes]="[20, 20]">
            <ng-template #panel>
              <ng-container [ngTemplateOutlet]="plan" />
            </ng-template>
            <ng-template #panel>
              <section class="view">
                <header>3D</header>
                <div class="body">
                  <!-- three.js loads only when the 3D view is first shown. -->
                  @defer {
                    <lk-view3d />
                  }
                </div>
              </section>
            </ng-template>
          </p-splitter>
        } @else {
          <ng-container [ngTemplateOutlet]="plan" />
        }
      </main>

      <ng-template #plan>
        <section class="view">
          <header>{{ 'shell.plan' | translate }} · {{ levelName() }}</header>
          <div class="body">
            <div
              class="stage"
              (pointerdown)="messages.clear()"
              (contextmenu)="contextMenu().openAt($event)"
            >
              <lk-plan-editor [label]="'app.planLabel' | translate" />
              <lk-plan-toolbar
                class="toolbar"
                [tool]="editor()?.tool() ?? null"
                (choose)="selectTool($event)"
              />
              @if (messages.current(); as shown) {
                @if (shown.at) {
                  <div
                    class="note"
                    [style.left.px]="shown.at.x + 14"
                    [style.top.px]="shown.at.y + 14"
                  >
                    {{ shown.message.key | translate: shown.message.params }}
                  </div>
                }
              }
            </div>
          </div>
        </section>
      </ng-template>

      <aside class="props" [attr.aria-label]="'panel.label' | translate">
        <lk-properties-panel />
      </aside>

      @if (bottomOpen()) {
        <section class="bottom">
          <div class="bottom-head">
            <p-tabs [value]="bottomTab()" (valueChange)="bottomTab.set($any($event))">
              <p-tablist>
                <p-tab value="quantities">
                  <lk-icon name="sheet" /> {{ 'quantities.title' | translate }}
                </p-tab>
                <p-tab value="warnings">
                  <lk-icon name="triangle-alert" /> {{ 'panel.warnings' | translate }} ({{
                    warnings().length
                  }})
                </p-tab>
              </p-tablist>
            </p-tabs>
            <span class="spacer"></span>
            <p-button
              size="small"
              [text]="true"
              [ariaLabel]="'shell.hideBottom' | translate"
              [pTooltip]="'shell.hideBottom' | translate"
              tooltipPosition="left"
              (onClick)="bottomOpen.set(false)"
            >
              <lk-icon name="x" />
            </p-button>
          </div>
          <div class="bottom-body">
            @if (bottomTab() === 'quantities') {
              <lk-quantities-panel />
            } @else {
              <ul class="warnings">
                @for (w of warnings(); track $index) {
                  <li>{{ w.key | translate: w.params }}</li>
                } @empty {
                  <li class="none">{{ 'shell.noWarnings' | translate }}</li>
                }
              </ul>
            }
          </div>
        </section>
      }

      <footer class="status" role="status" aria-live="polite">
        <span class="msg">
          @if (messages.current(); as shown) {
            <span [class.refused]="shown.kind === 'refused'">{{
              shown.message.key | translate: shown.message.params
            }}</span>
          } @else if (hasChange()) {
            <lk-change-summary />
          } @else {
            {{ 'app.hints.' + (editor()?.tool() ?? 'room') | translate }}
          }
        </span>
        <button
          type="button"
          class="chip"
          (click)="showBottom('warnings')"
          [attr.aria-label]="'panel.warnings' | translate"
        >
          <lk-icon name="triangle-alert" /> {{ warnings().length }}
        </button>
        <span>{{ levelName() }}</span>
        <span>{{ 'shell.units' | translate }}</span>
        @if (drawingScale(); as s) {
          <span [title]="'shell.scale' | translate">1:{{ s }}</span>
        }
      </footer>
    </div>
    <lk-context-menu />
    <lk-new-project-dialog />
  `,
  styles: `
    :host {
      display: block;
      height: 100vh;
    }
    .wb {
      display: grid;
      grid-template:
        'top top top top' auto
        'icons side centre props' minmax(0, 1fr)
        'icons side bottom props' auto
        'status status status status' auto / 44px auto minmax(0, 1fr) 300px;
      height: 100vh;
      background: var(--bg);
      color: var(--ink);
    }
    .top {
      grid-area: top;
    }
    :host ::ng-deep .top .p-menubar {
      border-radius: 0;
      border-width: 0 0 1px;
      padding: 2px 10px;
      background: var(--panel);
    }
    .brand {
      margin-right: 12px;
      font-size: 14px;
    }
    .mi {
      display: flex;
      align-items: center;
      gap: 8px;
      min-width: 180px;
      padding: 6px 10px;
      color: var(--ink);
      cursor: pointer;
    }
    .mi.root {
      min-width: 0;
      gap: 4px;
    }
    .mi-label {
      flex: 1;
    }
    .check {
      width: 14px;
      display: inline-flex;
    }
    .mi lk-icon {
      font-size: 14px;
      color: var(--muted);
    }
    .mi .down {
      font-size: 12px;
    }
    .mi kbd {
      font: 11px var(--sans);
      color: var(--muted);
    }
    .top-end {
      display: flex;
      align-items: center;
      gap: 2px;
    }
    .project {
      margin: 0 10px;
      font-weight: 600;
      white-space: nowrap;
      max-width: 260px;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .unsaved {
      color: var(--warn);
    }
    .spacer {
      flex: 1;
    }
    .icons {
      grid-area: icons;
      grid-row: 2 / 4;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 4px;
      padding: 6px 0;
      border-right: 1px solid var(--line);
      background: var(--panel);
    }
    .icons button {
      width: 34px;
      height: 34px;
      border: 0;
      border-radius: 8px;
      background: transparent;
      color: var(--muted);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .icons button lk-icon {
      font-size: 18px;
    }
    .icons button:hover {
      color: var(--ink);
      background: var(--hover);
    }
    .icons button.on {
      color: var(--accent);
      background: var(--accent-soft);
    }
    .side {
      grid-area: side;
      grid-row: 2 / 4;
      width: 230px;
      overflow: auto;
      border-right: 1px solid var(--line);
      background: var(--panel);
    }
    .side h2 {
      margin: 10px 12px 6px;
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      color: var(--muted);
    }
    .levels {
      display: block;
      padding: 0 8px 8px;
    }
    .centre {
      grid-area: centre;
      display: flex;
      padding: 4px;
      min-width: 0;
      min-height: 0;
    }
    .centre > *,
    :host ::ng-deep .fill {
      flex: 1;
      min-width: 0;
      height: 100%;
    }
    :host ::ng-deep .p-splitter {
      border: 0;
      background: transparent;
    }
    :host ::ng-deep .p-splitterpanel {
      display: flex;
      min-width: 0;
      min-height: 0;
    }
    .view {
      flex: 1;
      display: flex;
      flex-direction: column;
      min-width: 0;
      min-height: 0;
      border: 1px solid var(--line);
      border-radius: 6px;
      overflow: hidden;
      background: var(--panel);
    }
    .view > header {
      padding: 4px 10px;
      border-bottom: 1px solid var(--line);
      font-size: 12px;
      font-weight: 600;
    }
    .body {
      flex: 1;
      position: relative;
      min-height: 0;
    }
    .body > *,
    .stage {
      position: absolute;
      inset: 0;
    }
    .stage {
      overflow: hidden;
    }
    .toolbar {
      position: absolute;
      left: 50%;
      bottom: 14px;
      transform: translateX(-50%);
    }
    .note {
      position: absolute;
      max-width: 320px;
      padding: 6px 10px;
      border-radius: 6px;
      background: #fff7ed;
      border: 1px solid #fdba74;
      color: #9a3412;
      font-size: 13px;
      pointer-events: none;
    }
    .props {
      grid-area: props;
      grid-row: 2 / 4;
      overflow: auto;
      border-left: 1px solid var(--line);
      background: var(--panel);
    }
    .bottom {
      grid-area: bottom;
      height: 280px;
      display: flex;
      flex-direction: column;
      border-top: 1px solid var(--line);
      background: var(--panel);
    }
    .bottom-head {
      display: flex;
      align-items: center;
      padding-right: 6px;
    }
    .bottom-head p-tabs {
      min-width: 0;
    }
    .bottom-body {
      flex: 1;
      min-height: 0;
      overflow: auto;
    }
    .warnings {
      margin: 10px 16px;
      padding-left: 18px;
      color: var(--warn);
    }
    .warnings .none {
      list-style: none;
      color: var(--muted);
    }
    .status {
      grid-area: status;
      display: flex;
      align-items: center;
      gap: 16px;
      min-height: 24px;
      padding: 0 12px;
      background: var(--accent);
      color: var(--accent-ink);
      font-size: 12px;
    }
    .status .msg {
      flex: 1;
      min-width: 0;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .status .refused {
      font-weight: 600;
    }
    .chip {
      display: flex;
      align-items: center;
      gap: 4px;
      border: 0;
      background: transparent;
      color: inherit;
      font: inherit;
      cursor: pointer;
    }
    .chip lk-icon {
      font-size: 13px;
    }
  `,
})
export class App {
  protected readonly language = inject(LanguageService);
  protected readonly messages = inject(MessagesService);
  protected readonly project = inject(ProjectService);
  protected readonly theme = inject(ThemeService);
  private readonly files = inject(FileService);
  private readonly translate = inject(TranslateService);
  private readonly optimus = inject(Optimus);
  private readonly selection = inject(SelectionService);
  private readonly actions = inject(EditorActionsService);
  private readonly contextMenus = inject(ContextMenuService);
  protected readonly editor = viewChild(PlanEditorComponent);
  protected readonly contextMenu = viewChild.required(ContextMenuComponent);
  private readonly newDialog = viewChild.required(NewProjectDialogComponent);
  protected readonly store = this.project.store;

  protected readonly sideOpen = signal(true);
  protected readonly show3d = signal(false);
  protected readonly bottomOpen = signal(false);
  protected readonly bottomTab = signal<BottomTab>('quantities');

  protected readonly hasChange = computed(() => (this.store.lastChange()?.rooms.length ?? 0) > 0);
  protected readonly warnings = computed(() =>
    this.store.values.level(this.project.level()).warnings(),
  );
  protected readonly levelName = computed(
    () => this.store.model().levels[this.project.level()]?.name ?? '',
  );
  protected readonly drawingScale = computed(() => {
    const scale = this.editor()?.scale() ?? 0;
    return scale > 0 ? Math.round(PX_PER_MM / scale) : null;
  });

  /** Texts built in code (menus, tooltips) re-read when a language's texts have loaded. */
  private readonly t = (key: string, params?: object): string => {
    this.language.loaded();
    return this.translate.instant(key, params);
  };
  protected readonly undoHint = computed(() => this.historyHint('undo'));
  protected readonly redoHint = computed(() => this.historyHint('redo'));
  protected readonly themeHint = computed(
    () => `${this.t('shell.theme.label')}: ${this.t('shell.theme.' + this.theme.choice())}`,
  );

  protected readonly menus = computed<MenuItem[]>(() => [
    {
      label: this.t('shell.menu.file'),
      items: [
        { label: this.t('project.new.action'), command: () => this.newDialog().open() },
        { label: this.t('project.open'), shortcut: 'Ctrl+O', command: () => void this.open() },
        { label: this.t('project.save'), shortcut: 'Ctrl+S', command: () => void this.save() },
        {
          label: this.t('project.saveAs'),
          shortcut: 'Ctrl+Shift+S',
          command: () => void this.saveAs(),
        },
      ],
    },
    {
      label: this.t('shell.menu.edit'),
      items: [
        {
          label: this.t('history.undo'),
          shortcut: 'Ctrl+Z',
          disabled: !this.store.canUndo(),
          command: () => this.undo(),
        },
        {
          label: this.t('history.redo'),
          shortcut: 'Ctrl+Y',
          disabled: !this.store.canRedo(),
          command: () => this.redo(),
        },
        { separator: true },
        {
          label: this.t('contextMenu.mergeRooms'),
          shortcut: 'M',
          disabled: this.selection.rooms().length !== 2,
          command: () => this.actions.merge(),
        },
        {
          label: this.t('contextMenu.delete'),
          shortcut: 'Del',
          disabled: this.selection.current().length === 0,
          command: () => this.actions.deleteSelection(),
        },
      ],
    },
    {
      label: this.t('shell.menu.view'),
      items: [
        { label: this.t('shell.fit'), shortcut: 'F', command: () => this.editor()?.fit() },
        {
          label: this.t('view3d.toggle'),
          state: { checked: this.show3d() },
          command: () => this.show3d.set(!this.show3d()),
        },
        {
          label: this.t('quantities.title'),
          shortcut: 'Q',
          command: () => this.showBottom('quantities'),
        },
        { label: this.t('panel.warnings'), command: () => this.showBottom('warnings') },
        { separator: true },
        {
          label: this.t('shell.theme.label'),
          items: THEME_CHOICES.map((choice) => ({
            label: this.t('shell.theme.' + choice),
            state: { checked: this.theme.choice() === choice },
            command: () => this.theme.choice.set(choice),
          })),
        },
        {
          label: this.t('app.language'),
          items: LANGUAGES.map((l) => ({
            label: this.t('app.languages.' + l),
            state: { checked: this.language.current() === l },
            command: () => this.language.current.set(l),
          })),
        },
      ],
    },
  ]);

  constructor() {
    effect(() => {
      document.title = `${this.project.unsaved() ? '● ' : ''}${this.project.name()} — Lakudemis`;
    });
    // Optimus's own texts (aria labels, empty messages, …) follow the app's language.
    effect(() => this.optimus.setTranslation(this.language.current() === 'nl' ? nl : en));
  }

  private historyHint(which: 'undo' | 'redo'): string {
    const label = which === 'undo' ? this.store.undoLabel() : this.store.redoLabel();
    const shortcut = which === 'undo' ? 'Ctrl+Z' : 'Ctrl+Y';
    const action = this.t('history.' + which);
    return label ? `${action}: ${this.t(label.key, label.params)} (${shortcut})` : action;
  }

  protected showBottom(tab: BottomTab): void {
    if (this.bottomOpen() && this.bottomTab() === tab) this.bottomOpen.set(false);
    else {
      this.bottomTab.set(tab);
      this.bottomOpen.set(true);
    }
  }

  protected selectTool(name: ToolName): void {
    this.messages.clear();
    this.editor()?.setTool(name);
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

  /** Keys 1–9 switch Level. */
  private chooseLevel(n: number): boolean {
    const level = this.project.levels()[n - 1];
    if (!level) return false;
    if (level.id !== this.project.level()) {
      this.selection.clear();
      this.project.selectLevel(level.id);
    }
    return true;
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
    // Menus and dialogs have the keyboard while they are open.
    if (target?.closest('dialog, [role="dialog"], [role="menu"], [role="menubar"]')) return;
    if (this.contextMenus.menu()) return;
    const editor = this.editor();
    if (!editor || e.altKey) return;
    // The active tool gets the key first (typed values, S, Esc, …).
    if (editor.keyDown(e)) {
      e.preventDefault();
      return;
    }
    if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      this.actions.deleteSelection();
      return;
    }
    if (e.key === 'Escape') {
      this.selectTool('select');
      return;
    }
    if (/^[1-9]$/.test(e.key) && this.chooseLevel(Number(e.key))) {
      e.preventDefault();
      editor.cancel();
      return;
    }
    if (e.key === 'q' || e.key === 'Q') {
      e.preventDefault();
      this.showBottom('quantities');
      return;
    }
    if (e.key === 'm' || e.key === 'M') {
      e.preventDefault();
      this.actions.merge();
      return;
    }
    const tool = TOOLS.find((t) => t.key.toLowerCase() === e.key.toLowerCase());
    if (tool) {
      e.preventDefault();
      this.selectTool(tool.name);
    } else if (e.key === 'f' || e.key === 'F') {
      e.preventDefault();
      // F / Shift+F flip a selected door (hinge side / swing); otherwise F fits the plan.
      if (!this.actions.flipOpening(e.shiftKey ? 'swing' : 'hinge')) editor.fit();
    }
  }

  @HostListener('window:keyup', ['$event'])
  protected onKeyUp(e: KeyboardEvent): void {
    this.editor()?.keyUp(e);
  }
}
