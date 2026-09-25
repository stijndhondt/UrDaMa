import { Component, inject } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { LANGUAGES, LanguageService } from './language';

@Component({
  selector: 'lk-root',
  imports: [TranslatePipe],
  template: `
    <header class="bar">
      <h1 class="brand">Lakudemis</h1>
      <span class="tagline">{{ 'app.tagline' | translate }}</span>
      <span class="spacer"></span>
      <label class="lang">
        {{ 'app.language' | translate }}
        <select
          [value]="language.current()"
          (change)="language.current.set($any($event.target).value)"
        >
          @for (l of languages; track l) {
            <option [value]="l">{{ 'app.languages.' + l | translate }}</option>
          }
        </select>
      </label>
    </header>
    <main class="stage">
      <canvas class="plan" [attr.aria-label]="'app.planLabel' | translate"></canvas>
    </main>
  `,
  styles: `
    :host {
      display: grid;
      grid-template-rows: auto 1fr;
      height: 100vh;
    }
    .bar {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 8px 16px;
      border-bottom: 1px solid var(--line);
      background: var(--panel);
    }
    .brand {
      font-size: 16px;
      margin: 0;
    }
    .tagline {
      color: var(--muted);
    }
    .spacer {
      flex: 1;
    }
    .lang {
      display: flex;
      align-items: center;
      gap: 6px;
      color: var(--muted);
    }
    .stage {
      position: relative;
      overflow: hidden;
    }
    .plan {
      display: block;
      width: 100%;
      height: 100%;
      background: var(--paper);
    }
  `,
})
export class App {
  protected readonly language = inject(LanguageService);
  protected readonly languages = LANGUAGES;
}
