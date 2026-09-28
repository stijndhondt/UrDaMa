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
import { TranslatePipe } from '@ngx-translate/core';
import type { OpeningKind, OpeningTypeId } from '@lakudemis/core';
import type { ToolName } from '@lakudemis/editor2d';
import type { MenuItem } from '@openng/optimus-ui/api';
import { Menu, MenuModule } from '@openng/optimus-ui/menu';
import { TooltipModule } from '@openng/optimus-ui/tooltip';
import { FormatService } from '../format.service';
import { LanguageService } from '../language';
import { ProjectService } from '../project/project.service';
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
  imports: [TranslatePipe, MenuModule, TooltipModule, IconComponent],
  template: `
    <div class="bar" role="toolbar" [attr.aria-label]="'app.tools' | translate">
      @for (group of groups; track $index; let first = $first) {
        @if (!first) {
          <span class="sep"></span>
        }
        @for (t of group; track t.name) {
          <button
            type="button"
            [class.on]="tool() === t.name"
            [attr.aria-pressed]="tool() === t.name"
            [attr.aria-label]="
              ('tools.' + t.name + '.name' | translate) + (t.key ? ' (' + t.key + ')' : '')
            "
            [pTooltip]="tip"
            tooltipPosition="top"
            [tooltipOptions]="{ showDelay: 300 }"
            (click)="choose.emit(t.name)"
          >
            <lk-icon [name]="t.icon" />
            <ng-template #tip>
              <div class="tip">
                <b>{{ 'tools.' + t.name + '.name' | translate }}</b>
                @if (t.key) {
                  <kbd>{{ t.key }}</kbd>
                }
                <div>{{ 'tools.' + t.name + '.hint' | translate }}</div>
              </div>
            </ng-template>
          </button>
        }
      }
      <button
        type="button"
        class="flyout"
        [attr.aria-label]="'shell.openingTypes' | translate"
        [pTooltip]="'shell.openingTypes' | translate"
        tooltipPosition="top"
        (click)="openTypes($event)"
      >
        <lk-icon name="chevron-down" />
      </button>
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
    button {
      flex-shrink: 0;
      width: 36px;
      height: 36px;
      border: 0;
      border-radius: 8px;
      background: transparent;
      color: var(--ink);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    button lk-icon {
      font-size: 18px;
    }
    button:hover:not(.on) {
      background: var(--hover);
    }
    button.on {
      background: var(--accent);
      color: var(--accent-ink);
    }
    .flyout {
      width: 22px !important;
    }
    .flyout lk-icon {
      font-size: 14px !important;
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
  protected readonly groups = TOOL_GROUPS;

  private readonly project = inject(ProjectService);
  private readonly language = inject(LanguageService);
  private readonly format = inject(FormatService);
  private readonly types = viewChild.required<Menu>('types');
  private readonly opened = signal(0);

  /** Every Opening type, by kind: "Door 0,93 × 2,12 m". */
  protected readonly typeItems = computed<MenuItem[]>(() => {
    this.opened();
    const model = this.project.store.model();
    const order: OpeningKind[] = ['door', 'window', 'wallOpening', 'garageDoor'];
    return Object.values(model.openingTypes)
      .flatMap((t) => {
        const kind = model.openingFamilies[t.family]?.kind;
        return kind ? [{ t, kind }] : [];
      })
      .sort(
        (a, b) =>
          order.indexOf(a.kind) - order.indexOf(b.kind) ||
          a.t.width - b.t.width ||
          a.t.height - b.t.height,
      )
      .map(({ t, kind }) => {
        const size =
          t.name ??
          `${this.format.decimal(t.width / 1000)} × ${this.format.decimal(t.height / 1000)} m`;
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
