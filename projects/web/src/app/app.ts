import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  computed,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import type { ToolName } from '@urdama/editor2d';
import type { MenuItem } from '@openng/optimus-ui/api';
import { ButtonModule } from '@openng/optimus-ui/button';
import { Optimus } from '@openng/optimus-ui/config';
import { MenubarModule } from '@openng/optimus-ui/menubar';
import { SelectModule } from '@openng/optimus-ui/select';
import { SelectButtonModule } from '@openng/optimus-ui/selectbutton';
import { TabsModule } from '@openng/optimus-ui/tabs';
import { ToggleButtonModule } from '@openng/optimus-ui/togglebutton';
import { TooltipModule } from '@openng/optimus-ui/tooltip';
import { en } from 'primelocale/js/en.js';
import { nl } from 'primelocale/js/nl.js';
import { ChangeSummaryComponent } from './editor/change-summary.component';
import { ContextMenuComponent } from './editor/context-menu.component';
import { DeleteLevelDialogComponent } from './editor/delete-level-dialog.component';
import { FloorOpeningChoiceComponent } from './editor/floor-opening-choice.component';
import { FloorOpeningChoiceService } from './editor/floor-opening-choice.service';
import { ContextMenuService } from './editor/context-menu.service';
import { EditorActionsService } from './editor/editor-actions.service';
import { LengthEditService } from './editor/length-edit.service';
import { LengthEditorComponent } from './editor/length-editor.component';
import { BuildingPanelComponent } from './editor/building-panel.component';
import { LibraryPanelComponent } from './editor/library-panel.component';
import { PlanEditorComponent } from './editor/plan-editor.component';
import { PropertiesPanelComponent } from './editor/properties-panel.component';
import { SelectionService } from './editor/selection.service';
import { SnapService } from './editor/snap.service';
import { View3dComponent } from './editor/view3d.component';
import { LANGUAGES, LanguageService } from './language';
import { MessagesService } from './messages.service';
import { FileService, type FileResult } from './project/file.service';
import { NewProjectDialogComponent } from './project/new-project-dialog.component';
import { ProjectService } from './project/project.service';
import { QuantitiesPanelComponent } from './quantities/quantities-panel.component';
import { ElevationComponent } from './editor/elevation.component';
import { FamilyEditorComponent } from './editor/family-editor.component';
import { FamilyEditService } from './editor/family-edit.service';
import { IconComponent } from './shell/icon.component';
import type { IconName } from './shell/icons.generated';
import {
  LAYOUT_IDS,
  type ElevationPanelId,
  type LayoutId,
  type PanelId,
} from './shell/layout-grid';
import { ELEVATION_SIDES, LayoutService } from './shell/layout.service';
import { PanelHeaderComponent } from './shell/panel-header.component';
import { PlanToolbarComponent, TOOLS } from './shell/plan-toolbar.component';
import { THEME_CHOICES, ThemeService } from './shell/theme.service';

type Page = 'drawing' | 'quantities';

const LAYOUT_ICONS: Record<LayoutId, IconName> = {
  plan: 'square',
  planElevation: 'columns-2',
  plan3d: 'box',
  planElevation3d: 'layout-panel-left',
  grid: 'grid-2x2',
};

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
    TranslatePipe,
    ButtonModule,
    MenubarModule,
    TabsModule,
    ToggleButtonModule,
    TooltipModule,
    ChangeSummaryComponent,
    ContextMenuComponent,
    DeleteLevelDialogComponent,
    FloorOpeningChoiceComponent,
    ElevationComponent,
    FamilyEditorComponent,
    FormsModule,
    IconComponent,
    PanelHeaderComponent,
    SelectButtonModule,
    SelectModule,
    LengthEditorComponent,
    BuildingPanelComponent,
    LibraryPanelComponent,
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
        <ng-template #start><strong class="brand">Urdama</strong></ng-template>
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
            <p-selectbutton
              size="small"
              [options]="layoutOptions()"
              optionValue="value"
              [allowEmpty]="false"
              optionDisabled="disabled"
              [ngModel]="layout.shown()"
              (ngModelChange)="layout.choose($event)"
              [ariaLabel]="'layout.label' | translate"
            >
              <ng-template #item let-o>
                <lk-icon [name]="o.icon" [pTooltip]="o.hint" tooltipPosition="bottom" />
              </ng-template>
            </p-selectbutton>
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
        <p-togglebutton
          [ngModel]="side() === 'building'"
          (onChange)="toggleSide('building')"
          [ariaLabel]="'shell.building' | translate"
          [pTooltip]="'shell.building' | translate"
          tooltipPosition="right"
        >
          <ng-template #content><lk-icon name="building-2" /></ng-template>
        </p-togglebutton>
        <p-togglebutton
          [ngModel]="side() === 'library'"
          (onChange)="toggleSide('library')"
          [ariaLabel]="'library.title' | translate"
          [pTooltip]="'library.title' | translate"
          tooltipPosition="right"
        >
          <ng-template #content><lk-icon name="library-big" /></ng-template>
        </p-togglebutton>
        <span class="spacer"></span>
        <p-togglebutton
          [ngModel]="shows('view3d')"
          (onChange)="toggle3d()"
          [ariaLabel]="'view3d.toggle' | translate"
          [pTooltip]="'view3d.toggle' | translate"
          tooltipPosition="right"
        >
          <ng-template #content><lk-icon name="box" /></ng-template>
        </p-togglebutton>
        <p-togglebutton
          [ngModel]="page() === 'quantities'"
          (onChange)="toggleQuantities()"
          [ariaLabel]="'quantities.title' | translate"
          [pTooltip]="('quantities.title' | translate) + ' (Q)'"
          tooltipPosition="right"
        >
          <ng-template #content><lk-icon name="sheet" /></ng-template>
        </p-togglebutton>
        <p-togglebutton
          [ngModel]="bottomOpen()"
          (onChange)="toggleWarnings()"
          [ariaLabel]="'panel.warnings' | translate"
          [pTooltip]="'panel.warnings' | translate"
          tooltipPosition="right"
        >
          <ng-template #content><lk-icon name="triangle-alert" /></ng-template>
        </p-togglebutton>
      </nav>

      @if (side() === 'building') {
        <aside class="side" [attr.aria-label]="'shell.building' | translate">
          <h2>{{ 'shell.building' | translate }}</h2>
          <lk-building-panel />
        </aside>
      } @else if (side() === 'library') {
        <aside class="side" [attr.aria-label]="'library.title' | translate">
          <h2>{{ 'library.title' | translate }}</h2>
          <lk-library-panel />
        </aside>
      }

      <!-- The centre shows the drawing or the Quantities, each at full size. -->
      <p-tabs class="pages" [value]="page()" (valueChange)="page.set($any($event))">
        <p-tablist>
          <p-tab value="drawing">
            <lk-icon name="pencil-ruler" /> {{ 'shell.drawing' | translate }}
          </p-tab>
          <p-tab value="quantities">
            <lk-icon name="sheet" /> {{ 'quantities.title' | translate }}
          </p-tab>
        </p-tablist>
      </p-tabs>

      <main
        #centre
        class="centre"
        [style.grid-template-areas]="layout.grid().areas"
        [style.grid-template-columns]="layout.grid().columns"
        [style.grid-template-rows]="layout.grid().rows"
      >
        <!-- The plan stays mounted in every layout, so its tool and view are kept. -->
        <section class="view" style="grid-area: plan" [class.gone]="!shows('plan')">
          <lk-panel-header
            panel="plan"
            [title]="('shell.plan' | translate) + ' · ' + levelName()"
          />
          <div class="body">
            <div
              #stage
              class="stage"
              (pointerdown)="messages.clear(); lengthEdits.open.set(null)"
              (contextmenu)="contextMenu().openAt($event)"
            >
              <lk-plan-editor [label]="'app.planLabel' | translate" />
              <lk-plan-toolbar
                class="toolbar"
                [tool]="editor()?.tool() ?? null"
                [types]="editor()?.openingTypes() ?? {}"
                (choose)="selectTool($event)"
                (placeType)="editor()?.placeOpeningType($event.kind, $event.type)"
              />
              @if (planLengthEdit(); as edit) {
                <lk-length-editor
                  class="plan-length"
                  [style.left]="'min(' + (edit.edit.at.x + 12) + 'px, calc(100% - 288px))'"
                  [style.top]="edit.above ? null : edit.edit.at.y + 12 + 'px'"
                  [style.bottom]="
                    edit.above ? 'calc(100% - ' + (edit.edit.at.y - 12) + 'px)' : null
                  "
                  [wall]="edit.wall"
                  [faceLength]="edit.edit.faceLength"
                  (pointerdown)="$event.stopPropagation()"
                  (closed)="closeLengthEdit()"
                />
              }
              @if (floorChoice.pending(); as asked) {
                <lk-floor-opening-choice
                  class="plan-choice"
                  [style.left]="'min(' + (asked.at.x + 12) + 'px, calc(100% - 288px))'"
                  [style.top]="'min(' + (asked.at.y + 12) + 'px, calc(100% - 120px))'"
                  (pointerdown)="$event.stopPropagation()"
                />
              }
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
        @for (e of elevationPanels(); track e) {
          <section class="view" [style.grid-area]="e">
            <lk-panel-header [panel]="e" [title]="'layout.panels.elevation' | translate">
              <p-select
                size="small"
                appendTo="body"
                [options]="sideOptions()"
                optionLabel="label"
                optionValue="value"
                [ngModel]="layout.sides()[e]"
                (ngModelChange)="layout.setSide(e, $event)"
                [ariaLabel]="'layout.side' | translate"
              />
            </lk-panel-header>
            <div class="body">
              <lk-elevation [side]="layout.sides()[e]" />
            </div>
          </section>
        }
        @if (shows('view3d')) {
          <section class="view" style="grid-area: view3d">
            <lk-panel-header panel="view3d" title="3D" />
            <div class="body">
              <!-- three.js loads only when the 3D view is first shown. -->
              @defer (on immediate) {
                <lk-view3d />
              }
            </div>
          </section>
        }
        @for (d of layout.grid().dividers; track d.area) {
          <div
            class="divider"
            [class.row]="d.axis === 'row'"
            [style.grid-area]="d.area"
            role="separator"
            [attr.aria-orientation]="d.axis === 'col' ? 'vertical' : 'horizontal'"
            [attr.aria-label]="'shell.divider' | translate"
            (pointerdown)="startDivider($event, d.axis)"
          ></div>
        }
        <!-- The family editor lies over the panels: leaving it finds them as they were. -->
        @if (familyEdit.editing()) {
          <lk-family-editor class="family-editor" />
        }
      </main>

      <!-- Over the drawing, which stays mounted at its size: its tool and view are kept. -->
      @if (page() === 'quantities') {
        <section class="quantities-page" [attr.aria-label]="'quantities.title' | translate">
          <!-- Loaded on first use: its tree table is a large part of the UI library (ADR 0008
               budget). "on immediate": a plain @defer waits for idle, which a background tab never is. -->
          @defer (on immediate) {
            <lk-quantities-panel />
          }
        </section>
      }

      <aside class="props" [attr.aria-label]="'panel.label' | translate">
        <lk-properties-panel />
      </aside>

      @if (bottomOpen()) {
        <section class="bottom">
          <div class="bottom-head">
            <h2>
              <lk-icon name="triangle-alert" /> {{ 'panel.warnings' | translate }} ({{
                warnings().length
              }})
            </h2>
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
            <ul class="warnings">
              @for (w of warnings(); track $index) {
                <li>{{ w.key | translate: w.params }}</li>
              } @empty {
                <li class="none">{{ 'shell.noWarnings' | translate }}</li>
              }
            </ul>
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
        <p-button
          class="chip"
          size="small"
          severity="secondary"
          [text]="true"
          [ariaLabel]="'panel.warnings' | translate"
          (onClick)="toggleWarnings()"
        >
          <lk-icon name="triangle-alert" /> {{ warnings().length }}
        </p-button>
        <span>{{ levelName() }}</span>
        <span>{{ 'shell.units' | translate }}</span>
        @if (drawingScale(); as s) {
          <span [title]="'shell.scale' | translate">1:{{ s }}</span>
        }
      </footer>
    </div>
    <lk-context-menu />
    <lk-new-project-dialog />
    <lk-delete-level-dialog />
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
        'icons side pages props' auto
        'icons side centre props' minmax(0, 1fr)
        'icons side bottom props' auto
        'status status status status' auto / 44px auto minmax(0, 1fr) 300px;
      height: 100vh;
      background: var(--bg);
      color: var(--ink);
    }
    /* Its menus open over everything below the bar, the Quantities page included. */
    .top {
      position: relative;
      z-index: 10;
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
      grid-row: 2 / 5;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 4px;
      padding: 6px 0;
      border-right: 1px solid var(--line);
      background: var(--panel);
    }
    /* Square icon toggles that fit the 44 px bar: Optimus's toggle with no padding, and no
       background until it is on (its checked look stays Optimus's). */
    .icons p-togglebutton {
      width: 34px;
      height: 34px;
      --p-togglebutton-padding: 0;
      --p-togglebutton-content-padding: 0;
      --p-togglebutton-background: transparent;
      --p-togglebutton-border-color: transparent;
      --p-togglebutton-hover-background: var(--hover);
    }
    .icons lk-icon {
      font-size: 18px;
    }
    .side {
      grid-area: side;
      grid-row: 2 / 5;
      width: 250px;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      border-right: 1px solid var(--line);
      background: var(--panel);
    }
    /* The panel scrolls below the heading; the Building panel keeps its own buttons in view. */
    .side > :last-child {
      flex: 1;
      min-height: 0;
    }
    .side > lk-library-panel {
      overflow: auto;
    }
    .side h2 {
      margin: 10px 12px 6px;
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      color: var(--muted);
    }
    .centre {
      position: relative;
      /* Keeps the layers inside the drawing (family editor, plan overlays) to itself. */
      isolation: isolate;
      grid-area: centre;
      display: grid;
      padding: 4px;
      min-width: 0;
      min-height: 0;
    }
    .pages {
      grid-area: pages;
      min-width: 0;
      border-bottom: 1px solid var(--line);
    }
    .pages lk-icon {
      font-size: 14px;
    }
    /* The same grid cell as the drawing, over it. */
    .quantities-page {
      grid-area: centre;
      z-index: 1;
      min-width: 0;
      min-height: 0;
      overflow: auto;
      background: var(--panel);
    }
    .family-editor {
      position: absolute;
      inset: 0;
      z-index: 5;
    }
    .divider {
      cursor: col-resize;
      touch-action: none;
      border-radius: 3px;
    }
    .divider.row {
      cursor: row-resize;
    }
    .divider:hover {
      background: var(--accent-soft);
    }
    .view.gone {
      display: none;
    }
    .view p-select {
      width: 130px;
      flex-shrink: 1;
      min-width: 0;
      font-weight: 400;
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
    .plan-length,
    .plan-choice {
      position: absolute;
      z-index: 6;
      width: 280px;
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: 8px;
      overflow: hidden;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
    }
    .note {
      position: absolute;
      max-width: 320px;
      padding: 6px 10px;
      border-radius: 6px;
      background: var(--note-bg);
      border: 1px solid var(--note-line);
      color: var(--note-ink);
      font-size: 13px;
      pointer-events: none;
    }
    .props {
      grid-area: props;
      grid-row: 2 / 5;
      overflow: auto;
      border-left: 1px solid var(--line);
      background: var(--panel);
    }
    .bottom {
      grid-area: bottom;
      height: 180px;
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
    .bottom-head h2 {
      display: flex;
      align-items: center;
      gap: 6px;
      margin: 8px 14px;
      font-size: 13px;
      font-weight: 600;
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
    /* On the coloured status bar the text button takes the bar's text colour. */
    .chip {
      --p-button-text-secondary-color: currentColor;
      --p-button-text-secondary-hover-background: rgba(255, 255, 255, 0.15);
      --p-button-text-secondary-active-background: rgba(255, 255, 255, 0.25);
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
  private readonly snap = inject(SnapService);
  private readonly actions = inject(EditorActionsService);
  private readonly contextMenus = inject(ContextMenuService);
  protected readonly editor = viewChild(PlanEditorComponent);
  protected readonly contextMenu = viewChild.required(ContextMenuComponent);
  private readonly newDialog = viewChild.required(NewProjectDialogComponent);
  private readonly centre = viewChild<ElementRef<HTMLElement>>('centre');
  private readonly stage = viewChild<ElementRef<HTMLElement>>('stage');
  protected readonly store = this.project.store;
  protected readonly lengthEdits = inject(LengthEditService);
  protected readonly floorChoice = inject(FloorOpeningChoiceService);
  /**
   * The length editor on the plan, with its Wall (closed when the Wall is gone). Below its label
   * in the plan's upper half, above it in the lower half: it grows away from the edge, so a reason
   * shown under the field (ticket 28) is never cut off.
   */
  protected readonly planLengthEdit = computed(() => {
    const edit = this.lengthEdits.open();
    const wall = edit && this.store.model().walls[edit.wall];
    const height = this.stage()?.nativeElement.clientHeight ?? 0;
    return edit && wall ? { edit, wall, above: edit.at.y > height / 2 } : null;
  });

  /** The left panel shown, if any: the Building panel or the Library panel (ticket 21). */
  protected readonly side = signal<'building' | 'library' | null>('building');

  protected toggleSide(panel: 'building' | 'library'): void {
    this.side.set(this.side() === panel ? null : panel);
  }
  protected readonly layout = inject(LayoutService);
  protected readonly familyEdit = inject(FamilyEditService);
  protected readonly elevationPanels = computed(() =>
    this.layout
      .grid()
      .panels.filter((p): p is ElevationPanelId => p === 'elevationA' || p === 'elevationB'),
  );
  protected readonly sideOptions = computed(() =>
    ELEVATION_SIDES.map((value) => ({ value, label: this.t('layout.sides.' + value) })),
  );
  protected readonly layoutOptions = computed(() =>
    LAYOUT_IDS.map((value) => {
      const label = this.t('layout.presets.' + value);
      const disabled = !this.layout.fits(value);
      return {
        value,
        icon: LAYOUT_ICONS[value],
        label,
        disabled,
        hint: disabled ? `${label}: ${this.t('layout.tooSmall')}` : label,
      };
    }),
  );
  /** What the centre shows: the drawing (plan and views) or the Quantities, each at full size. */
  protected readonly page = signal<Page>('drawing');
  /** The Warnings panel under the centre */
  protected readonly bottomOpen = signal(false);

  protected readonly hasChange = computed(() => (this.store.lastChange()?.rooms.length ?? 0) > 0);
  protected readonly warnings = computed(() =>
    this.store.values.level(this.project.level()).warnings(),
  );
  protected readonly levelName = this.project.levelName;
  protected readonly drawingScale = computed(() => {
    const scale = this.editor()?.scale() ?? 0;
    return scale > 0 ? Math.round(PX_PER_MM / scale) : null;
  });

  /** Texts built in code (menus, tooltips), read again when a language's texts have loaded. */
  private readonly t = (key: string, params?: object): string => this.language.text(key, params);
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
          label: this.t('layout.label'),
          items: LAYOUT_IDS.map((l) => ({
            label: this.t('layout.presets.' + l),
            state: { checked: this.layout.shown() === l },
            disabled: !this.layout.fits(l),
            command: () => this.layout.choose(l),
          })),
        },
        {
          label: this.t('quantities.title'),
          shortcut: 'Q',
          command: () => this.toggleQuantities(),
        },
        { label: this.t('panel.warnings'), command: () => this.toggleWarnings() },
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
      document.title = `${this.project.unsaved() ? '● ' : ''}${this.project.name()} — Urdama`;
    });
    // Optimus's own texts (aria labels, empty messages, …) follow the app's language.
    effect(() => this.optimus.setTranslation(this.language.current() === 'nl' ? nl : en));
    // The centre's size decides which layouts fit (a small screen gets no 2 × 2 of tiny panels).
    effect((onCleanup) => {
      const centre = this.centre()?.nativeElement;
      // Unmeasured (no ResizeObserver, as in unit tests): the chosen layout shows.
      if (!centre || typeof ResizeObserver === 'undefined') return;
      const observer = new ResizeObserver(([entry]) => {
        const { width, height } = entry!.contentRect;
        this.layout.centre.set({ width, height });
      });
      observer.observe(centre);
      onCleanup(() => observer.disconnect());
    });
  }

  private historyHint(which: 'undo' | 'redo'): string {
    const label = which === 'undo' ? this.store.undoLabel() : this.store.redoLabel();
    const shortcut = which === 'undo' ? 'Ctrl+Z' : 'Ctrl+Y';
    const action = this.t('history.' + which);
    return label ? `${action}: ${this.t(label.key, label.params)} (${shortcut})` : action;
  }

  protected shows(panel: PanelId): boolean {
    return this.layout.grid().panels.includes(panel);
  }

  /** The icon bar's 3D button: Plan + 3D, or back to Plan only. */
  protected toggle3d(): void {
    if (this.shows('view3d')) this.layout.choose('plan');
    else this.layout.show3d();
  }

  /** Dragging a divider: its share of the centre follows the pointer. */
  protected startDivider(e: PointerEvent, axis: 'col' | 'row'): void {
    const divider = e.target as HTMLElement;
    const centre = divider.parentElement!.getBoundingClientRect();
    try {
      divider.setPointerCapture(e.pointerId);
    } catch {
      // not a live pointer (synthetic events): dragging still works while over the divider
    }
    const move = (m: PointerEvent) =>
      this.layout.setSplit(
        axis,
        axis === 'col'
          ? ((m.clientX - centre.left) / centre.width) * 100
          : ((m.clientY - centre.top) / centre.height) * 100,
      );
    const up = () => {
      divider.removeEventListener('pointermove', move);
      divider.removeEventListener('pointerup', up);
    };
    divider.addEventListener('pointermove', move);
    divider.addEventListener('pointerup', up);
  }

  /** The plan's length editor closes; the keyboard goes back to the plan. */
  protected closeLengthEdit(): void {
    this.lengthEdits.open.set(null);
    document
      .querySelector<HTMLCanvasElement>('lk-plan-editor canvas')
      ?.focus({ preventScroll: true });
  }

  protected toggleQuantities(): void {
    this.page.set(this.page() === 'quantities' ? 'drawing' : 'quantities');
  }

  protected toggleWarnings(): void {
    this.bottomOpen.set(!this.bottomOpen());
  }

  protected selectTool(name: ToolName): void {
    // A drawing tool brings the drawing back.
    this.page.set('drawing');
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
    // The up/down question of a Floor opening: Esc cancels it, wherever the focus is.
    if (e.key === 'Escape' && this.floorChoice.pending()) {
      e.preventDefault();
      this.floorChoice.answer(null);
      return;
    }
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
      this.toggleQuantities();
      return;
    }
    if (e.key === 'm' || e.key === 'M') {
      e.preventDefault();
      this.actions.merge();
      return;
    }
    if (e.key === 'g' || e.key === 'G') {
      e.preventDefault();
      this.snap.toggle();
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
