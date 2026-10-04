import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  afterNextRender,
  computed,
  inject,
  input,
  output,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';
import {
  rotateWall,
  WALL_ANCHORS,
  wallAngle,
  type RotateWallArgs,
  type Wall,
  type WallAnchor,
} from '@urdama/core';
import { ButtonModule } from '@openng/optimus-ui/button';
import { InputTextModule } from '@openng/optimus-ui/inputtext';
import { SelectButtonModule } from '@openng/optimus-ui/selectbutton';
import { TooltipModule } from '@openng/optimus-ui/tooltip';
import { FormatService } from '../format.service';
import { LanguageService } from '../language';
import { MessagesService } from '../messages.service';
import { ProjectService } from '../project/project.service';
import { IconComponent } from '../shell/icon.component';
import type { IconName } from '../shell/icons.generated';
import { WallTurnService } from './wall-turn.service';

/** Where each anchor sits on the little Wall drawn in its toggle (a 24 × 12 box, start on the left). */
const ANCHOR_DOTS: Record<WallAnchor, { readonly x: number; readonly y: number }> = {
  'start-lo': { x: 2, y: 2 },
  'start-hi': { x: 2, y: 10 },
  centre: { x: 13, y: 6 },
  'end-lo': { x: 24, y: 2 },
  'end-hi': { x: 24, y: 10 },
};

/**
 * Typing a Wall's angle: the angle in degrees (0° horizontal, anticlockwise), the anchor it turns
 * around (also chosen by clicking it on the plan) and what follows. Enter applies it as one
 * command and one undo step; Esc closes without a change.
 */
@Component({
  selector: 'lk-angle-editor',
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
    <div class="editor" tabindex="-1" (keydown.escape)="close($event)">
      <label class="line">
        <span class="label">{{ 'panel.wall.angle' | translate }}</span>
        <input
          #field
          pInputText
          pSize="small"
          [value]="shown()"
          [attr.aria-label]="'panel.wall.angle' | translate"
          (keydown.enter)="apply(field.value)"
        />
        <span class="unit">°</span>
      </label>
      <div class="toggles">
        <p-selectbutton
          size="small"
          [options]="anchorChoices()"
          optionLabel="label"
          optionValue="value"
          [allowEmpty]="false"
          [ngModel]="turn.anchor()"
          (ngModelChange)="turn.anchor.set($event)"
          [ariaLabel]="'panel.wall.anchor' | translate"
        >
          <ng-template #item let-o>
            <svg
              class="anchor"
              viewBox="-1 -1 28 14"
              aria-hidden="true"
              [pTooltip]="('panel.wall.anchor' | translate) + ': ' + o.label"
              tooltipPosition="bottom"
            >
              <rect x="2" y="2" width="22" height="8" />
              <circle [attr.cx]="o.dot.x" [attr.cy]="o.dot.y" r="2.2" />
            </svg>
          </ng-template>
        </p-selectbutton>
        <p-selectbutton
          size="small"
          [options]="modeChoices()"
          optionLabel="label"
          optionValue="value"
          [allowEmpty]="false"
          [ngModel]="turn.mode()"
          (ngModelChange)="turn.mode.set($event)"
          [ariaLabel]="'panel.wall.angleMode' | translate"
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
      flex-wrap: wrap;
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
    .anchor {
      width: 22px;
      height: 12px;
      overflow: visible;
    }
    .anchor rect {
      fill: none;
      stroke: currentColor;
      stroke-width: 1.5;
    }
    .anchor circle {
      fill: currentColor;
    }
  `,
})
export class AngleEditorComponent {
  readonly wall = input.required<Wall>();
  readonly closed = output<void>();

  private readonly project = inject(ProjectService);
  private readonly messages = inject(MessagesService);
  private readonly format = inject(FormatService);
  private readonly language = inject(LanguageService);
  protected readonly turn = inject(WallTurnService);
  private readonly field = viewChild.required<ElementRef<HTMLInputElement>>('field');

  /** The angle as the user types it back, with 2 decimals in their language ("88,50"). */
  protected readonly shown = computed(() => this.format.decimal(wallAngle(this.wall())));
  private readonly modes: readonly { value: RotateWallArgs['mode']; icon: IconName }[] = [
    { value: 'slide', icon: 'move-diagonal-2' },
    { value: 'wall', icon: 'slash' },
  ];

  protected readonly anchorChoices = computed(() =>
    WALL_ANCHORS.map((value) => ({
      value,
      dot: ANCHOR_DOTS[value],
      label: this.language.text('panel.wall.anchors.' + value),
    })),
  );
  protected readonly modeChoices = computed(() =>
    this.modes.map((m) => ({
      value: m.value,
      icon: m.icon,
      label: this.language.text('panel.wall.angleModes.' + m.value),
    })),
  );

  constructor() {
    afterNextRender(() => {
      this.field().nativeElement.focus({ preventScroll: true });
      this.field().nativeElement.select();
    });
  }

  protected apply(text: string): void {
    // The field shows the angle rounded: Enter without typing changes nothing.
    if (text.trim() === this.shown()) {
      this.closed.emit();
      return;
    }
    const angle = Number(text.trim().replace(',', '.').replace(/°$/, ''));
    if (!Number.isFinite(angle)) return;
    const result = this.project.store.run(rotateWall, {
      wall: this.wall().id,
      angle,
      anchor: this.turn.anchor(),
      mode: this.turn.mode(),
    });
    if (!result.ok) this.messages.refused(result.reason);
    else this.closed.emit();
  }

  protected close(e: Event): void {
    e.stopPropagation();
    this.closed.emit();
  }
}
