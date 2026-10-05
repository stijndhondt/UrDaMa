import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  afterNextRender,
  computed,
  inject,
  Injector,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';
import { ButtonModule } from '@openng/optimus-ui/button';
import { InputTextModule } from '@openng/optimus-ui/inputtext';
import { SelectButtonModule } from '@openng/optimus-ui/selectbutton';
import { TooltipModule } from '@openng/optimus-ui/tooltip';
import { IconComponent } from '../shell/icon.component';

export interface PropChoice {
  readonly value: string;
  readonly label: string;
}

/**
 * One property in the properties panel (ticket 24, design C): read as text; a click edits it in
 * place (Enter or leaving the field commits, Esc cancels). A value that differs from its Preset
 * shows a reset button; a value that follows its Preset is grey. With `choices` the edit is a
 * set of buttons and a pick commits at once.
 */
@Component({
  selector: 'lk-prop',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    TranslatePipe,
    ButtonModule,
    InputTextModule,
    SelectButtonModule,
    TooltipModule,
    IconComponent,
  ],
  template: `
    @if (!editing()) {
      <div class="row">
        <button
          pButton
          type="button"
          severity="secondary"
          [text]="true"
          class="read"
          [disabled]="!editable()"
          [attr.title]="hint() || null"
          (click)="start()"
        >
          <span class="label">{{ label() }}</span>
          <span class="value" [class.preset]="preset()" [class.num]="numeric()">{{ value() }}</span>
          <span class="unit">{{ unit() }}</span>
        </button>
        @if (resetLabel(); as r) {
          <button
            pButton
            type="button"
            size="small"
            severity="secondary"
            [text]="true"
            [rounded]="true"
            class="reset"
            [attr.aria-label]="r"
            [pTooltip]="r"
            tooltipPosition="left"
            (click)="restore.emit()"
          >
            <lk-icon name="rotate-ccw" />
          </button>
        } @else {
          <span class="reset-space"></span>
        }
      </div>
    } @else {
      <div class="edit" tabindex="-1" (keydown.escape)="cancel($event)">
        <div class="line">
          <span class="label">{{ label() }}</span>
          @if (choices(); as options) {
            <p-selectbutton
              size="small"
              [options]="$any(options)"
              optionLabel="label"
              optionValue="value"
              [allowEmpty]="false"
              [ngModel]="choice()"
              (ngModelChange)="pick($event)"
              [attr.aria-label]="label()"
            />
          } @else {
            <input
              #field
              pInputText
              pSize="small"
              [value]="value()"
              [attr.aria-label]="label()"
              (keydown.enter)="done(field.value)"
              (keydown.escape)="cancel($event)"
              (blur)="done(field.value)"
            />
            <span class="unit">{{ unit() }}</span>
          }
        </div>
        <div class="keys">{{ 'panel.editKeys' | translate }}</div>
      </div>
    }
  `,
  styles: `
    :host {
      display: block;
    }
    .row {
      display: flex;
      align-items: center;
      padding-right: 8px;
    }
    /* An Optimus text button laid out as a row: label, value, unit. */
    .read {
      flex: 1;
      min-width: 0;
      min-height: 30px;
      justify-content: flex-start;
      gap: 8px;
      padding: 0 0 0 14px;
      border-radius: 0;
      color: var(--ink);
      font-weight: normal;
      font-size: inherit;
      text-align: left;
    }
    .read:disabled {
      opacity: 1;
    }
    /* A value too long for the row wraps under its label instead of running over it. */
    .read {
      flex-wrap: wrap;
      row-gap: 0;
      white-space: normal;
    }
    .label {
      flex: 1 0 auto;
      max-width: 100%;
      color: var(--muted);
    }
    .value {
      flex: 0 1 auto;
      min-width: 0;
      margin-left: auto;
      text-align: right;
      overflow-wrap: anywhere;
    }
    .value.num {
      font-family: var(--mono);
      font-size: 12px;
    }
    .value.preset {
      color: var(--muted);
    }
    .unit {
      min-width: 22px;
      font-size: 11px;
      color: var(--muted);
    }
    .reset,
    .reset-space {
      width: 22px;
      height: 22px;
      flex-shrink: 0;
    }
    .reset {
      padding: 0;
    }
    .reset lk-icon {
      font-size: 13px;
    }
    .edit {
      padding: 4px 14px 6px;
      background: var(--accent-soft);
    }
    .line {
      display: flex;
      align-items: center;
      gap: 8px;
      min-height: 30px;
    }
    .line .label {
      color: var(--ink);
    }
    input {
      width: 110px;
      font-family: var(--mono);
      text-align: right;
    }
    .keys {
      font-size: 11px;
      color: var(--muted);
      text-align: right;
    }
  `,
})
export class PropRowComponent {
  readonly label = input.required<string>();
  /** The value as shown, formatted; also what the edit field starts with. */
  readonly value = input.required<string>();
  readonly unit = input('');
  readonly editable = input(true);
  /** The value follows its Preset (shown grey). */
  readonly preset = input(false);
  /** Tooltip of the reset button; the button shows only when this is set. */
  readonly resetLabel = input<string | null>(null);
  readonly hint = input('');
  /** Edit with these buttons instead of a text field; `choice` is the current one. */
  readonly choices = input<readonly PropChoice[] | null>(null);
  readonly choice = input<string | null>(null);
  /** A click opens an editor elsewhere (the Wall's length editor) instead of editing here. */
  readonly opens = input(false);

  /** The typed text or the picked choice. */
  readonly commit = output<string>();
  /** The reset button: back to the Preset. */
  readonly restore = output<void>();
  readonly open = output<void>();

  protected readonly editing = signal(false);
  /** Numbers line up in a monospaced font; words stay in the text font. */
  protected readonly numeric = computed(() => /^[-\d]/.test(this.value()));
  private readonly field = viewChild<ElementRef<HTMLInputElement>>('field');
  private readonly injector = inject(Injector);
  private closing = false;

  protected start(): void {
    if (this.opens()) {
      this.open.emit();
      return;
    }
    this.closing = false;
    this.editing.set(true);
    afterNextRender(
      () => {
        const el = this.field()?.nativeElement;
        el?.focus();
        el?.select();
      },
      { injector: this.injector },
    );
  }

  protected done(text: string): void {
    if (this.closing) return;
    this.closing = true;
    this.editing.set(false);
    if (text.trim() !== this.value().trim()) this.commit.emit(text);
  }

  protected cancel(e: Event): void {
    e.stopPropagation();
    this.closing = true;
    this.editing.set(false);
  }

  protected pick(value: string): void {
    this.editing.set(false);
    if (value !== this.choice()) this.commit.emit(value);
  }
}
