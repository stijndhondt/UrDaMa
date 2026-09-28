import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import type { ElevationSide } from './layout.service';

/** Stands in for an Elevation panel's drawing until ticket 14 draws it. */
@Component({
  selector: 'lk-elevation-placeholder',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe],
  template: `
    <svg viewBox="0 0 400 220" aria-hidden="true">
      <line x1="10" y1="200" x2="390" y2="200" />
      <rect x="60" y="80" width="280" height="120" />
      <polyline points="50,86 200,20 350,86" />
      <rect x="95" y="120" width="50" height="45" />
      <rect x="255" y="120" width="50" height="45" />
      <rect x="180" y="130" width="40" height="70" />
    </svg>
    <p>
      {{ 'layout.elevationLater' | translate: { side: ('layout.sides.' + side() | translate) } }}
    </p>
  `,
  styles: `
    :host {
      display: grid;
      place-content: center;
      justify-items: center;
      gap: 8px;
      height: 100%;
      padding: 12px;
      color: var(--muted);
      background: var(--paper);
      font-size: 12px;
      text-align: center;
    }
    svg {
      width: min(320px, 80%);
      fill: none;
      stroke: currentColor;
      stroke-width: 2;
    }
    p {
      margin: 0;
    }
  `,
})
export class ElevationPlaceholderComponent {
  readonly side = input.required<ElevationSide>();
}
