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
import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';
import {
  message,
  setWallLength,
  wallLength,
  type Message,
  type SetWallLengthArgs,
  type Wall,
} from '@urdama/core';
import { growOptions, parseLength, type GrowOption } from '@urdama/editor2d';
import { ButtonModule } from '@openng/optimus-ui/button';
import { InputTextModule } from '@openng/optimus-ui/inputtext';
import { MessageModule } from '@openng/optimus-ui/message';
import { SelectButtonModule } from '@openng/optimus-ui/selectbutton';
import { TooltipModule } from '@openng/optimus-ui/tooltip';
import { FormatService } from '../format.service';
import { LanguageService } from '../language';
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
  imports: [
    FormsModule,
    TranslatePipe,
    ButtonModule,
    InputTextModule,
    MessageModule,
    SelectButtonModule,
    TooltipModule,
    IconComponent,
  ],
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
          [attr.aria-invalid]="reason() ? true : null"
          (input)="reason.set(null)"
          (keydown.enter)="apply(field.value)"
        />
        <span class="unit">mm</span>
      </label>
      @if (reason(); as r) {
        <p-message severity="error" size="small" variant="outlined">{{
          r.key | translate: r.params
        }}</p-message>
      }
      <div class="toggles">
        <p-selectbutton
          size="small"
          [options]="growChoices()"
          optionLabel="label"
          optionValue="value"
          [allowEmpty]="false"
          [ngModel]="growIndex()"
          (ngModelChange)="growIndex.set($event)"
          [ariaLabel]="'panel.wall.grows' | translate"
        >
          <ng-template #item let-o>
            <lk-icon
              [name]="o.icon"
              [pTooltip]="('panel.wall.grows' | translate) + ': ' + o.label"
              tooltipPosition="bottom"
            />
          </ng-template>
        </p-selectbutton>
        <p-selectbutton
          size="small"
          [options]="modeChoices()"
          optionLabel="label"
          optionValue="value"
          [allowEmpty]="false"
          [ngModel]="choice.mode()"
          (ngModelChange)="choice.mode.set($event)"
          [ariaLabel]="'panel.wall.lengthMode' | translate"
        >
          <ng-template #item let-o>
            <lk-icon [name]="o.icon" [pTooltip]="o.label" tooltipPosition="bottom" />
          </ng-template>
        </p-selectbutton>
      </div>
      <div class="keys">
        <span>{{ 'panel.lengthKeys' | translate }}</span>
        <p-button size="small" (onClick)="apply(field.value)">
          <lk-icon name="check" /> {{ 'common.apply' | translate }}
        </p-button>
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
    .keys {
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-size: 11px;
      color: var(--muted);
    }
    lk-icon {
      font-size: 14px;
    }
  `,
})
export class LengthEditorComponent {
  readonly wall = input.required<Wall>();
  /**
   * On the plan: the length (mm) of the face whose label was double-clicked. The editor shows and
   * takes that length; the Baseline changes by the same amount. Without it, the Baseline length.
   */
  readonly faceLength = input<number | null>(null);
  readonly closed = output<void>();

  private readonly project = inject(ProjectService);
  private readonly messages = inject(MessagesService);
  private readonly format = inject(FormatService);
  protected readonly choice = inject(LengthChoiceService);
  private readonly language = inject(LanguageService);
  private readonly field = viewChild.required<ElementRef<HTMLInputElement>>('field');

  /** Why the typed length was not taken, shown under the field until the next keystroke. */
  protected readonly reason = signal<Message | null>(null);
  protected readonly grows = computed(() => growOptions(this.wall()));
  /** Grows towards the end of the plan's axis (right / down) unless chosen otherwise. */
  protected readonly growIndex = signal(2);
  /** The length as the user types it back, in mm ("3300"). */
  private readonly shownMm = computed(() => this.faceLength() ?? wallLength(this.wall()));
  protected readonly shown = computed(() => this.format.mm(this.shownMm()));
  protected readonly modes: readonly { value: SetWallLengthArgs['mode']; icon: IconName }[] = [
    { value: 'room', icon: 'panel-right' },
    { value: 'wall', icon: 'slash' },
  ];

  /** The grow directions and the modes as choices, with their icons and translated names. */
  protected readonly growChoices = computed(() =>
    this.grows().map((o, value) => ({
      value,
      icon: this.growIcon(o),
      label: this.language.text('panel.wall.grow.' + o.label),
    })),
  );
  protected readonly modeChoices = computed(() =>
    this.modes.map((m) => ({
      value: m.value,
      icon: m.icon,
      label: this.language.text('panel.wall.modes.' + m.value),
    })),
  );

  constructor() {
    afterNextRender(() => {
      // Without scrolling: on the plan, a scroll would shift the whole drawing.
      this.field().nativeElement.focus({ preventScroll: true });
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
    this.reason.set(null);
    // The field shows the length rounded: Enter without typing changes nothing.
    if (text.trim() === this.shown() || !choice) {
      this.closed.emit();
      return;
    }
    const typed = parseLength(text);
    if (typed === null) {
      this.refuse(message('panel.wall.notALength'));
      return;
    }
    const result = this.project.store.run(setWallLength, {
      wall: this.wall().id,
      length: wallLength(this.wall()) + (typed - this.shownMm()),
      end: choice.end,
      mode: this.choice.mode(),
    });
    if (!result.ok) this.refuse(result.reason);
    else this.closed.emit();
  }

  /** Next to the editor, and in the status bar as every refusal. */
  private refuse(reason: Message): void {
    this.reason.set(reason);
    this.messages.refused(reason);
  }

  protected close(e: Event): void {
    e.stopPropagation();
    this.closed.emit();
  }
}
