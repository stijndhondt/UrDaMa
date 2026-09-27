import { Injectable, computed, effect, signal } from '@angular/core';

export type ThemeChoice = 'system' | 'light' | 'dark';
export const THEME_CHOICES: readonly ThemeChoice[] = ['system', 'light', 'dark'];

const STORAGE_KEY = 'lakudemis.theme';

/**
 * Light or dark (ticket 09): follows the operating system unless the user picks one; the choice
 * is remembered per browser. The `app-dark` class on <html> switches the app's colours and
 * Optimus UI's (its darkModeSelector).
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  readonly choice = signal<ThemeChoice>(readStored());
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
      try {
        localStorage.setItem(STORAGE_KEY, this.choice());
      } catch {
        // storage unavailable: the choice just isn't remembered
      }
    });
  }

  /** The theme button: system → light → dark → system. */
  next(): void {
    this.choice.set(THEME_CHOICES[(THEME_CHOICES.indexOf(this.choice()) + 1) % 3]!);
  }
}

function readStored(): ThemeChoice {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return (THEME_CHOICES as readonly string[]).includes(v ?? '') ? (v as ThemeChoice) : 'system';
  } catch {
    return 'system';
  }
}
