import { Component, computed, inject } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import type { RoomChange } from '@urdama/core';
import { FormatService } from '../format.service';
import { ProjectService } from '../project/project.service';

/**
 * What the last edit changed (ADR 0003, amended): each affected Room with its old → new
 * Net floor area, e.g. "Keuken 9.96 → 10.09 m²".
 */
@Component({
  selector: 'lk-change-summary',
  imports: [TranslatePipe],
  template: `
    @if (change(); as c) {
      <span class="what">
        @if (c.kind !== 'do') {
          {{ 'changes.' + c.kind | translate }}
        }
        {{ c.label.key | translate: c.label.params }}:
      </span>
      @for (r of c.rooms; track r.room) {
        <span class="room">
          <b>{{ r.name }}</b>
          @if (r.before === undefined) {
            {{ 'changes.new' | translate }} {{ value(r.after) }}
          } @else if (r.after === undefined) {
            {{ 'changes.removed' | translate }}
          } @else {
            {{ value(r.before) }} → {{ value(r.after) }}
          }
        </span>
      }
    }
  `,
  styles: `
    :host {
      display: flex;
      flex-wrap: wrap;
      gap: 4px 14px;
      align-items: baseline;
    }
    .what {
      color: var(--muted);
    }
    .room b {
      font-weight: 600;
      margin-right: 4px;
    }
  `,
})
export class ChangeSummaryComponent {
  private readonly project = inject(ProjectService);
  private readonly format = inject(FormatService);
  protected readonly change = computed(() => {
    const c = this.project.store.lastChange();
    return c && c.rooms.length ? c : null;
  });

  protected value(area: RoomChange['after']): string {
    return area === null || area === undefined ? '—' : this.format.area(area);
  }

  /** Whether there is anything to show. */
  readonly visible = computed(() => this.change() !== null);
}
