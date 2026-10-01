import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { ButtonModule } from '@openng/optimus-ui/button';
import { TooltipModule } from '@openng/optimus-ui/tooltip';
import { IconComponent } from './icon.component';
import type { PanelId } from './layout-grid';
import { LayoutService } from './layout.service';

/**
 * A view panel's header (ticket 11): its title, anything the panel adds (an Elevation's side),
 * and Maximise / Restore when the layout has more than one panel.
 */
@Component({
  selector: 'lk-panel-header',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe, ButtonModule, TooltipModule, IconComponent],
  template: `
    <span class="title">{{ title() }}</span>
    <ng-content />
    <span class="spacer"></span>
    @if (canMaximize()) {
      <button
        pButton
        type="button"
        size="small"
        severity="secondary"
        [text]="true"
        [rounded]="true"
        [attr.aria-label]="(maximized() ? 'layout.restore' : 'layout.maximize') | translate"
        [pTooltip]="(maximized() ? 'layout.restore' : 'layout.maximize') | translate"
        tooltipPosition="left"
        (click)="layout.toggleMaximized(panel())"
      >
        <lk-icon [name]="maximized() ? 'minimize-2' : 'maximize-2'" />
      </button>
    }
  `,
  styles: `
    :host {
      display: flex;
      align-items: center;
      gap: 6px;
      min-height: 28px;
      padding: 0 4px 0 10px;
      border-bottom: 1px solid var(--line);
      font-size: 12px;
      font-weight: 600;
    }
    .title {
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .spacer {
      flex: 1;
    }
    button {
      width: 26px;
      height: 26px;
      padding: 0;
    }
    lk-icon {
      font-size: 14px;
    }
  `,
})
export class PanelHeaderComponent {
  readonly title = input.required<string>();
  readonly panel = input.required<PanelId>();
  protected readonly layout = inject(LayoutService);
  protected readonly maximized = computed(() => this.layout.maximized() === this.panel());
  /** Only when there is something to maximise from, or something to restore. */
  protected readonly canMaximize = computed(
    () => this.maximized() || this.layout.grid().panels.length > 1,
  );
}
