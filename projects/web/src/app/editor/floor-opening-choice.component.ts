import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  afterNextRender,
  computed,
  effect,
  inject,
  untracked,
} from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { neighbourLevels } from '@urdama/core';
import { ButtonModule } from '@openng/optimus-ui/button';
import { ProjectService } from '../project/project.service';
import { IconComponent } from '../shell/icon.component';
import { FloorOpeningChoiceService } from './floor-opening-choice.service';

/**
 * Up or down: asked on the plan after a Floor opening is drawn on a Level with a Level above and
 * below it, naming the Level it connects to. Esc, a click elsewhere or another Level cancels it.
 */
@Component({
  selector: 'lk-floor-opening-choice',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe, ButtonModule, IconComponent],
  host: { '(document:pointerdown)': 'outside($event)' },
  template: `
    <div class="choice" tabindex="-1" (keydown.escape)="choice.answer(null)">
      <span class="label">{{ 'editor.floorOpening.which' | translate }}</span>
      <p-button size="small" severity="secondary" (onClick)="choice.answer('up')">
        <lk-icon name="arrow-up" />
        {{ 'editor.floorOpening.up' | translate: { level: levels().above } }}
      </p-button>
      <p-button size="small" severity="secondary" (onClick)="choice.answer('down')">
        <lk-icon name="arrow-down" />
        {{ 'editor.floorOpening.down' | translate: { level: levels().below } }}
      </p-button>
    </div>
  `,
  styles: `
    .choice {
      display: flex;
      flex-direction: column;
      align-items: stretch;
      gap: 6px;
      padding: 8px 10px;
      outline: none;
    }
    .label {
      font-size: 11px;
      color: var(--muted);
    }
    lk-icon {
      font-size: 14px;
    }
  `,
})
export class FloorOpeningChoiceComponent {
  protected readonly choice = inject(FloorOpeningChoiceService);
  private readonly project = inject(ProjectService);

  /** The names of the Levels above and below the one being edited */
  protected readonly levels = computed(() => {
    const model = this.project.store.model();
    const { above, below } = neighbourLevels(model, this.project.level());
    return {
      above: (above && model.levels[above]?.name) ?? '',
      below: (below && model.levels[below]?.name) ?? '',
    };
  });

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  constructor() {
    const host = this.host;
    // Another Level: the question was about the one it was drawn on.
    let first = true;
    effect(() => {
      this.project.level();
      if (first) first = false;
      else untracked(() => this.choice.answer(null));
    });
    // Focused, so Esc reaches it.
    afterNextRender(() =>
      host.nativeElement.querySelector<HTMLElement>('.choice')?.focus({ preventScroll: true }),
    );
  }

  /** A press anywhere outside the question cancels it. */
  protected outside(e: PointerEvent): void {
    if (!this.host.nativeElement.contains(e.target as Node)) this.choice.answer(null);
  }
}
