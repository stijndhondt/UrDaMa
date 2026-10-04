import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';
import { OPENING_KINDS, type OpeningKind, type OpeningTypeId } from '@urdama/core';
import type { ToolName } from '@urdama/editor2d';
import type { MenuItem } from '@openng/optimus-ui/api';
import { ButtonModule } from '@openng/optimus-ui/button';
import { Menu, MenuModule } from '@openng/optimus-ui/menu';
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
  [
    { name: 'door', key: 'D', icon: OPENING_ICONS.door },
    { name: 'window', key: 'N', icon: OPENING_ICONS.window },
    { name: 'wallOpening', key: '', icon: OPENING_ICONS.wallOpening },
    { name: 'garageDoor', key: '', icon: OPENING_ICONS.garageDoor },
  ],
];

export const TOOLS: readonly ToolButton[] = TOOL_GROUPS.flat();

/** The floating tool bar at the bottom of the Plan panel (ticket 09). */
@Component({
  selector: 'lk-plan-toolbar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    TranslatePipe,
    ButtonModule,
    MenuModule,
    SelectButtonModule,
    ToggleButtonModule,
    TooltipModule,
    IconComponent,
  ],
  template: `
    <div class="bar" role="toolbar" [attr.aria-label]="'app.tools' | translate">
      @for (group of groupChoices(); track $index; let first = $first) {
        @if (!first) {
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
      <button
        pButton
        type="button"
        severity="secondary"
        [text]="true"
        class="flyout"
        [attr.aria-label]="'shell.openingTypes' | translate"
        [pTooltip]="'shell.openingTypes' | translate"
        tooltipPosition="top"
        (click)="openTypes($event)"
      >
        <lk-icon name="chevron-down" />
      </button>
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
    <p-menu #types [model]="typeItems()" [popup]="true" appendTo="body">
      <ng-template #item let-item>
        <a class="type">
          @if (item.state?.icon) {
            <lk-icon [name]="item.state.icon" />
          }
          <span>{{ item.label }}</span>
        </a>
      </ng-template>
    </p-menu>
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
    .flyout {
      flex-shrink: 0;
      width: 24px;
      height: 36px;
      padding: 0;
    }
    .flyout lk-icon {
      font-size: 14px;
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
    .type {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 6px 12px;
      cursor: pointer;
    }
    .type lk-icon {
      font-size: 15px;
      color: var(--muted);
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
  /** An Opening type chosen in the flyout (ticket 17) */
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
  private readonly types = viewChild.required<Menu>('types');
  private readonly opened = signal(0);

  /** Every Opening type, by kind: "Door 0,93 × 2,12 m". */
  protected readonly typeItems = computed<MenuItem[]>(() => {
    this.opened();
    const model = this.project.store.model();
    return Object.values(model.openingTypes)
      .flatMap((t) => {
        const kind = model.openingFamilies[t.family]?.kind;
        return kind ? [{ t, kind }] : [];
      })
      .sort(
        (a, b) =>
          OPENING_KINDS.indexOf(a.kind) - OPENING_KINDS.indexOf(b.kind) ||
          a.t.width - b.t.width ||
          a.t.height - b.t.height,
      )
      .map(({ t, kind }) => {
        const size = t.name ?? this.format.openingSize(t.width, t.height);
        return {
          label: `${this.language.text('panel.opening.' + kind)} ${size}`,
          state: { icon: OPENING_ICONS[kind] },
          command: () => this.placeType.emit({ kind, type: t.id }),
        };
      });
  });

  protected openTypes(e: Event): void {
    this.opened.update((n) => n + 1);
    this.types().toggle(e);
  }
}
