import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  effect,
  inject,
  input,
} from '@angular/core';
import { ICONS, type IconName } from './icons.generated';

/**
 * An icon from the app's bundled set (ADR 0008: Iconify's Lucide icons, see
 * scripts/build-icons.mjs). Decorative: give the button or link around it an accessible name.
 */
@Component({
  selector: 'lk-icon',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '',
  host: { 'aria-hidden': 'true' },
  styles: `
    :host {
      display: inline-flex;
      width: 1em;
      height: 1em;
      flex-shrink: 0;
      font-size: 16px;
      line-height: 0;
    }
    :host ::ng-deep svg {
      width: 100%;
      height: 100%;
    }
  `,
})
export class IconComponent {
  readonly name = input.required<IconName>();
  private readonly el = inject<ElementRef<HTMLElement>>(ElementRef);

  constructor() {
    // The markup is our own, generated at build time from the icon set: never user input.
    effect(() => {
      this.el.nativeElement.innerHTML = `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">${ICONS[this.name()]}</svg>`;
    });
  }
}
