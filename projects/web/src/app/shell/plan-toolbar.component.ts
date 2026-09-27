import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import type { ToolName } from '@lakudemis/editor2d';
import { TooltipModule } from '@openng/optimus-ui/tooltip';
import { IconComponent } from './icon.component';
import type { IconName } from './icons.generated';

export interface ToolButton {
  readonly name: ToolName;
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
    { name: 'door', key: 'D', icon: 'door-open' },
    { name: 'window', key: 'N', icon: 'app-window' },
  ],
];

export const TOOLS: readonly ToolButton[] = TOOL_GROUPS.flat();

/** The floating tool bar at the bottom of the Plan panel (ticket 09). */
@Component({
  selector: 'lk-plan-toolbar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe, TooltipModule, IconComponent],
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
            [attr.aria-label]="('tools.' + t.name + '.name' | translate) + ' (' + t.key + ')'"
            [pTooltip]="tip"
            tooltipPosition="top"
            [tooltipOptions]="{ showDelay: 300 }"
            (click)="choose.emit(t.name)"
          >
            <lk-icon [name]="t.icon" />
            <ng-template #tip>
              <div class="tip">
                <b>{{ 'tools.' + t.name + '.name' | translate }}</b> <kbd>{{ t.key }}</kbd>
                <div>{{ 'tools.' + t.name + '.hint' | translate }}</div>
              </div>
            </ng-template>
          </button>
        }
      }
    </div>
  `,
  styles: `
    .bar {
      display: flex;
      align-items: center;
      gap: 2px;
      padding: 4px;
      border-radius: 12px;
      background: var(--panel);
      box-shadow:
        0 6px 20px rgba(0, 0, 0, 0.18),
        0 0 0 1px var(--line);
    }
    button {
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
  protected readonly groups = TOOL_GROUPS;
}
