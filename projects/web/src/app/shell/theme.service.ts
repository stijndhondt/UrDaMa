import { Injectable, computed, effect, signal } from '@angular/core';
import { readSetting, writeSetting } from '../browser-setting';

export type ThemeChoice = 'system' | 'light' | 'dark';
export const THEME_CHOICES: readonly ThemeChoice[] = ['system', 'light', 'dark'];

const STORAGE_KEY = 'urdama.theme';

/**
 * Light or dark (ticket 09): follows the operating system unless the user picks one; the choice
 * is remembered per browser. The `app-dark` class on <html> switches the app's colours and
 * Optimus UI's (its darkModeSelector).
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  readonly choice = signal<ThemeChoice>(readSetting(STORAGE_KEY, THEME_CHOICES) ?? 'system');
  /** The OS's setting; tests (jsdom) have no matchMedia. */
  private readonly media =
    typeof matchMedia === 'function' ? matchMedia('(prefers-color-scheme: dark)') : null;
  private readonly systemDark = signal(this.media?.matches ?? false);
  readonly dark = computed(() =>
    this.choice() === 'system' ? this.systemDark() : this.choice() === 'dark',
  );

  constructor() {
    this.media?.addEventListener('change', (e) => this.systemDark.set(e.matches));
    effect(() => {
      document.documentElement.classList.toggle('app-dark', this.dark());
      document.documentElement.style.colorScheme = this.dark() ? 'dark' : 'light';
      writeSetting(STORAGE_KEY, this.choice());
    });
  }

  /** The theme button: system → light → dark → system. */
  next(): void {
    this.choice.set(THEME_CHOICES[(THEME_CHOICES.indexOf(this.choice()) + 1) % 3]!);
  }
}
