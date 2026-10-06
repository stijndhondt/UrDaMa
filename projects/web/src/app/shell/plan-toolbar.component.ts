import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';
import {
  BUILT_IN_FAMILIES,
  hasSill,
  presetSize,
  typeSill,
  type OpeningKind,
  type OpeningTypeId,
} from '@urdama/core';
import type { ToolName } from '@urdama/editor2d';
import { ButtonModule } from '@openng/optimus-ui/button';
import type { MenuItem } from '@openng/optimus-ui/api';
import { SplitButtonModule } from '@openng/optimus-ui/splitbutton';
import { SelectButtonModule } from '@openng/optimus-ui/selectbutton';
import { ToggleButtonModule } from '@openng/optimus-ui/togglebutton';
import { TooltipModule } from '@openng/optimus-ui/tooltip';
import { FormatService } from '../format.service';
import { LanguageService } from '../language';
import { ProjectService } from '../project/project.service';
import { SnapService } from '../editor/snap.service';
import { OPENING_ICONS } from './opening-icons';
import { IconComponent } from './icon.component';
import type { IconName } from './icons.generated';

export interface ToolButton {
  readonly name: ToolName;
  /** Its shortcut ('' when it has none) */
  readonly key: string;
  readonly icon: IconName;
}

/** The drawing tools in groups (select | draw | openings), with their shortcuts, the same in every language. */
export const TOOL_GROUPS: readonly (readonly ToolButton[])[] = [
  [{ name: 'select', key: 'V', icon: 'mouse-pointer-2' }],
  [
    { name: 'room', key: 'R', icon: 'square' },
    { name: 'wall', key: 'W', icon: 'brick-wall' },
    { name: 'separator', key: 'E', icon: 'square-dashed' },
  ],
  [{ name: 'floorOpening', key: '', icon: 'door-stairwell' }],
];

/** The Opening tools: each a button with a drop-down of its kind's Opening types (ticket 17). */
export const OPENING_TOOLS: readonly (ToolButton & { readonly name: OpeningKind })[] = [
  { name: 'door', key: 'D', icon: OPENING_ICONS.door },
  { name: 'window', key: 'N', icon: OPENING_ICONS.window },
  { name: 'wallOpening', key: '', icon: OPENING_ICONS.wallOpening },
  { name: 'garageDoor', key: '', icon: OPENING_ICONS.garageDoor },
];

export const TOOLS: readonly ToolButton[] = [...TOOL_GROUPS.flat(), ...OPENING_TOOLS];

/** The floating tool bar at the bottom of the Plan panel (ticket 09). */
@Component({
  selector: 'lk-plan-toolbar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    TranslatePipe,
    ButtonModule,
    SplitButtonModule,
    SelectButtonModule,
    ToggleButtonModule,
    TooltipModule,
    IconComponent,
  ],
  template: `
    <div class="bar" role="toolbar" [attr.aria-label]="'app.tools' | translate">
      @for (group of groupChoices(); track $index; let first = $first; let last = $last) {
        @if (!first) {
          <span class="sep"></span>
        }
        <!-- The Opening tools, before the last group: each one a button and a list of its sizes. -->
        @if (last) {
          @for (o of openingChoices(); track o.name) {
            <p-splitbutton
              class="opening"
              size="small"
              severity="secondary"
              appendTo="body"
              [text]="tool() !== o.name"
              [model]="o.types"
              [expandAriaLabel]="'shell.openingTypes' | translate"
              (onClick)="choose.emit(o.name)"
            >
              <ng-template #content>
                <lk-icon
                  [name]="o.icon"
                  [pTooltip]="openingTip"
                  tooltipPosition="top"
                  [tooltipOptions]="{ showDelay: 300 }"
                />
                <ng-template #openingTip>
                  <div class="tip">
                    <b>{{ 'tools.' + o.name + '.name' | translate }}</b>
                    @if (o.key) {
                      <kbd>{{ o.key }}</kbd>
                    }
                    <div>{{ o.size }}</div>
                  </div>
                </ng-template>
              </ng-template>
              <ng-template #dropdownicon
                ><lk-icon class="chevron" name="chevron-down"
              /></ng-template>
            </p-splitbutton>
          }
          <span class="sep"></span>
        }
        <!-- One choice per group: the tool in use is the chosen one of its group. -->
        <p-selectbutton
          size="small"
          [options]="group"
          optionLabel="label"
          optionValue="name"
          [allowEmpty]="false"
          [ngModel]="tool()"
          (ngModelChange)="$event && choose.emit($event)"
          [ariaLabel]="'app.tools' | translate"
        >
          <ng-template #item let-t>
            <lk-icon
              [name]="t.icon"
              [pTooltip]="tip"
              tooltipPosition="top"
              [tooltipOptions]="{ showDelay: 300 }"
            />
            <ng-template #tip>
              <div class="tip">
                <b>{{ 'tools.' + t.name + '.name' | translate }}</b>
                @if (t.key) {
                  <kbd>{{ t.key }}</kbd>
                }
                <div>{{ 'tools.' + t.name + '.hint' | translate }}</div>
              </div>
            </ng-template>
          </ng-template>
        </p-selectbutton>
      }
      <span class="sep"></span>
      <p-togglebutton
        class="snap"
        [ngModel]="snap.on()"
        (onChange)="snap.on.set($event.checked)"
        [ariaLabel]="'shell.snap' | translate"
        [pTooltip]="snapTip"
        tooltipPosition="top"
      >
        <ng-template #content><lk-icon name="magnet" /></ng-template>
      </p-togglebutton>
      <ng-template #snapTip>
        <div class="tip">
          <b>{{ 'shell.snap' | translate }}</b>
          <div>{{ 'shell.snapHint' | translate }}</div>
        </div>
      </ng-template>
    </div>
  `,
  styles: `
    :host {
      max-width: calc(100% - 16px);
    }
    /* In a narrow Plan panel the bar scrolls sideways instead of being cut off. */
    .bar {
      display: flex;
      align-items: center;
      gap: 2px;
      max-width: 100%;
      overflow-x: auto;
      scrollbar-width: thin;
      padding: 4px;
      border-radius: 12px;
      background: var(--panel);
      box-shadow:
        0 6px 20px rgba(0, 0, 0, 0.18),
        0 0 0 1px var(--line);
    }
    /* Compact tool buttons: Optimus's small toggle size, with less padding round the icon. */
    p-selectbutton {
      flex-shrink: 0;
      --p-togglebutton-sm-padding: 0.25rem;
      --p-togglebutton-content-sm-padding: 0.3rem 0.45rem;
    }
    lk-icon {
      font-size: 17px;
    }
    /* The snap toggle: an Optimus toggle sized like the tool buttons, without its own background
       until it is on. */
    .snap {
      flex-shrink: 0;
      width: 34px;
      height: 34px;
      --p-togglebutton-padding: 0;
      --p-togglebutton-content-padding: 0;
      --p-togglebutton-background: transparent;
      --p-togglebutton-border-color: transparent;
    }
    /* An Opening tool: its icon button and its size list's arrow, as compact as the tool buttons. */
    .opening {
      flex-shrink: 0;
      --p-button-sm-padding-x: 0.45rem;
      --p-button-sm-padding-y: 0.3rem;
    }
    .opening .chevron {
      font-size: 12px;
    }
    .sep {
      width: 1px;
      height: 22px;
      margin: 0 4px;
      background: var(--line);
    }
    .tip {
      max-width: 260px;
      font-size: 12px;
      line-height: 1.4;
    }
    .tip kbd {
      opacity: 0.7;
    }
  `,
})
export class PlanToolbarComponent {
  readonly tool = input<ToolName | null>(null);
  readonly choose = output<ToolName>();
  /** The Opening type each Opening tool places (absent or null: its kind's Preset size) */
  readonly types = input<Partial<Record<OpeningKind, OpeningTypeId | null>>>({});
  /** An Opening type chosen in the type list next to the tools (ticket 17) */
  readonly placeType = output<{ kind: OpeningKind; type: OpeningTypeId }>();
  /** The tool groups as choices, named in the user's language with their shortcut. */
  protected readonly groupChoices = computed(() =>
    TOOL_GROUPS.map((group) =>
      group.map((t) => ({
        ...t,
        label: this.language.text('tools.' + t.name + '.name') + (t.key ? ` (${t.key})` : ''),
      })),
    ),
  );

  private readonly project = inject(ProjectService);
  protected readonly snap = inject(SnapService);
  private readonly language = inject(LanguageService);
  private readonly format = inject(FormatService);
  /**
   * The Opening tools with their kind's Opening types, by size ("0,930 × 2,115 m", or a type's
   * name). The one the tool places is marked: the chosen one, else its kind's Preset size.
   */
  protected readonly openingChoices = computed(() => {
    const model = this.project.store.model();
    const chosen = this.types();
    return OPENING_TOOLS.map((t) => {
      const kind = t.name;
      const types = Object.values(model.openingTypes)
        .filter((x) => model.openingFamilies[x.family]?.kind === kind)
        .sort((a, b) => a.width - b.width || a.height - b.height);
      const preset = presetSize(model.project.presets, kind);
      const current =
        chosen[kind] ??
        types.find(
          (x) =>
            x.family === BUILT_IN_FAMILIES[kind] &&
            x.width === preset.width &&
            x.height === preset.height,
        )?.id;
      // A window's size comes with the sill height it is placed at.
      const label = (x: (typeof types)[number]) => {
        const sized = this.format.openingSize(x.width, x.height);
        const size = hasSill(kind)
          ? `${sized} · ${this.language.text('shell.sillAt', { sill: this.format.length(typeSill(model, x)) })}`
          : sized;
        return x.name ? `${x.name} · ${size}` : size;
      };
      const placed = types.find((x) => x.id === current);
      return {
        ...t,
        size: placed ? label(placed) : '',
        types: types.map((x): MenuItem => ({
          label: label(x),
          styleClass: x.id === current ? 'current' : undefined,
          command: () => this.placeType.emit({ kind, type: x.id }),
        })),
      };
    });
  });
}
