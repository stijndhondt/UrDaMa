import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { ButtonModule } from '@openng/optimus-ui/button';
import { IconComponent } from '../shell/icon.component';
import { PanelSectionsService } from './panel-sections.service';

/**
 * A section of the properties panel (user story 32, ticket 29): its heading folds and unfolds it.
 * Sections with the same `key` (such as "Sizes" for a Wall and for a Floor opening) fold together.
 */
@Component({
  selector: 'lk-panel-section',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ButtonModule, IconComponent],
  template: `
    <section>
      <h3>
        <button
          pButton
          type="button"
          severity="secondary"
          [text]="true"
          class="heading"
          [attr.aria-expanded]="open()"
          (click)="sections.toggle(key())"
        >
          <lk-icon [name]="open() ? 'chevron-down' : 'chevron-right'" />
          {{ heading() }}
        </button>
      </h3>
      @if (open()) {
        <ng-content />
      }
    </section>
  `,
  styles: `
    section {
      padding: 2px 0 6px;
      border-top: 1px solid var(--line);
    }
    h3 {
      margin: 0;
    }
    .heading {
      width: 100%;
      justify-content: flex-start;
      gap: 4px;
      padding: 6px 14px 4px 8px;
      border-radius: 0;
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      text-align: left;
      color: var(--muted);
    }
    .heading lk-icon {
      font-size: 12px;
    }
  `,
})
export class PanelSectionComponent {
  /** Which section this is, for remembering it folded; the heading's translation key will do. */
  readonly key = input.required<string>();
  readonly heading = input.required<string>();

  protected readonly sections = inject(PanelSectionsService);
  protected readonly open = computed(() => !this.sections.isFolded(this.key()));
}
