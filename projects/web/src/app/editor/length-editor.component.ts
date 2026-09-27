import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  afterNextRender,
  computed,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { setWallLength, wallLength, type SetWallLengthArgs, type Wall } from '@lakudemis/core';
import { growOptions, parseLength, type GrowOption } from '@lakudemis/editor2d';
import { InputTextModule } from '@openng/optimus-ui/inputtext';
import { TooltipModule } from '@openng/optimus-ui/tooltip';
import { FormatService } from '../format.service';
import { MessagesService } from '../messages.service';
import { ProjectService } from '../project/project.service';
import { IconComponent } from '../shell/icon.component';
import type { IconName } from '../shell/icons.generated';
import { LengthChoiceService } from './length-choice.service';

const GROW_ICONS: Record<GrowOption['label'], IconName> = {
  left: 'arrow-left-to-line',
  right: 'arrow-right-to-line',
  up: 'arrow-up-to-line',
  down: 'arrow-down-to-line',
  start: 'arrow-down-left',
  end: 'arrow-up-right',
  both: 'move-horizontal',
};

/**
 * Typing a Wall's length (tickets 01, 23): the length, which way the Wall grows and what moves,
 * as icon toggles with tooltips. Enter applies it as one command and one undo step; Esc closes
 * without a change. The mode is the last one used (LengthChoiceService).
 */
@Component({
  selector: 'lk-length-editor',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe, InputTextModule, TooltipModule, IconComponent],
  template: `
    <div class="editor" tabindex="-1" (keydown.escape)="close($event)">
      <label class="line">
        <span class="label">{{ 'panel.wall.length' | translate }}</span>
        <input
          #field
          pInputText
          pSize="small"
          [value]="shown()"
          [attr.aria-label]="'panel.wall.length' | translate"
          (keydown.enter)="apply(field.value)"
        />
        <span class="unit">m</span>
      </label>
      <div class="toggles">
        <div class="group" role="group" [attr.aria-label]="'panel.wall.grows' | translate">
          @for (o of grows(); track $index) {
            <button
              type="button"
              [class.on]="growIndex() === $index"
              [attr.aria-pressed]="growIndex() === $index"
              [attr.aria-label]="'panel.wall.grow.' + o.label | translate"
              [pTooltip]="
                ('panel.wall.grows' | translate) + ': ' + ('panel.wall.grow.' + o.label | translate)
              "
              tooltipPosition="bottom"
              (click)="growIndex.set($index)"
            >
              <lk-icon [name]="growIcon(o)" />
            </button>
          }
        </div>
        <div class="group" role="group" [attr.aria-label]="'panel.wall.lengthMode' | translate">
          @for (m of modes; track m.value) {
            <button
              type="button"
              [class.on]="choice.mode() === m.value"
              [attr.aria-pressed]="choice.mode() === m.value"
              [attr.aria-label]="'panel.wall.modes.' + m.value | translate"
              [pTooltip]="'panel.wall.modes.' + m.value | translate"
              tooltipPosition="bottom"
              (click)="choice.mode.set(m.value)"
            >
              <lk-icon [name]="m.icon" />
            </button>
          }
        </div>
      </div>
      <div class="keys">
        <span>{{ 'panel.lengthKeys' | translate }}</span>
        <button type="button" class="ok" (click)="apply(field.value)">
          <lk-icon name="check" /> {{ 'common.apply' | translate }}
        </button>
      </div>
    </div>
  `,
  styles: `
    .editor {
      display: flex;
      flex-direction: column;
      gap: 6px;
      padding: 6px 14px 8px;
      background: var(--accent-soft);
    }
    .line {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .label {
      flex: 1;
    }
    input {
      width: 110px;
      font-family: var(--mono);
      text-align: right;
    }
    .unit {
      min-width: 22px;
      font-size: 11px;
      color: var(--muted);
    }
    .toggles {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
    }
    .group {
      display: flex;
      gap: 2px;
      padding: 2px;
      border-radius: 6px;
      background: var(--inset);
    }
    .group button {
      width: 32px;
      height: 26px;
      border: 0;
      border-radius: 4px;
      background: transparent;
      color: var(--muted);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .group button.on {
      background: var(--panel);
      color: var(--accent);
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.12);
    }
    .keys {
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-size: 11px;
      color: var(--muted);
    }
    .ok {
      display: flex;
      align-items: center;
      gap: 4px;
      height: 22px;
      padding: 0 8px;
      border: 0;
      border-radius: 4px;
      background: var(--accent);
      color: var(--accent-ink);
      font-size: 11px;
      cursor: pointer;
    }
    .ok lk-icon {
      font-size: 12px;
    }
  `,
})
export class LengthEditorComponent {
  readonly wall = input.required<Wall>();
  /** Where a refusal is shown (canvas px), when the editor sits on the plan. */
  readonly at = input<{ x: number; y: number } | null>(null);
  readonly closed = output<void>();

  private readonly project = inject(ProjectService);
  private readonly messages = inject(MessagesService);
  private readonly format = inject(FormatService);
  protected readonly choice = inject(LengthChoiceService);
  private readonly field = viewChild.required<ElementRef<HTMLInputElement>>('field');

  protected readonly grows = computed(() => growOptions(this.wall()));
  /** Grows towards the end of the plan's axis (right / down) unless chosen otherwise. */
  protected readonly growIndex = signal(2);
  /** The length as the user types it back: m with 2 decimals in their language ("3,30"). */
  protected readonly shown = computed(() => this.format.decimal(wallLength(this.wall()) / 1000));
  protected readonly modes: readonly { value: SetWallLengthArgs['mode']; icon: IconName }[] = [
    { value: 'room', icon: 'panel-right' },
    { value: 'wall', icon: 'slash' },
  ];

  constructor() {
    afterNextRender(() => {
      this.field().nativeElement.focus();
      this.field().nativeElement.select();
    });
  }

  protected growIcon(o: GrowOption): IconName {
    return o.label === 'both' && Math.abs(this.wall().end.x - this.wall().start.x) < 0.5
      ? 'move-vertical'
      : o.label === 'both' && Math.abs(this.wall().end.y - this.wall().start.y) >= 0.5
        ? 'move-diagonal-2'
        : GROW_ICONS[o.label];
  }

  protected apply(text: string): void {
    const choice = this.grows()[this.growIndex()];
    // The field shows the length rounded: Enter without typing changes nothing.
    if (text.trim() === this.shown() || !choice) {
      this.closed.emit();
      return;
    }
    const length = parseLength(text);
    if (length === null) return;
    const result = this.project.store.run(setWallLength, {
      wall: this.wall().id,
      length,
      end: choice.end,
      mode: this.choice.mode(),
    });
    if (!result.ok) this.messages.refused(result.reason, this.at());
    else this.closed.emit();
  }

  protected close(e: Event): void {
    e.stopPropagation();
    this.closed.emit();
  }
}
