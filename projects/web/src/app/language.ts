import { Injectable, effect, inject, signal } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { firstValueFrom } from 'rxjs';

export const LANGUAGES = ['en', 'nl'] as const;
export type Language = (typeof LANGUAGES)[number];

const STORAGE_KEY = 'lakudemis.language';

/** The UI language, remembered per browser (a convenience, never project data). */
@Injectable({ providedIn: 'root' })
export class LanguageService {
  private readonly translate = inject(TranslateService);
  readonly current = signal<Language>(readStored() ?? 'en');

  constructor() {
    effect(() => {
      const lang = this.current();
      this.translate.use(lang);
      document.documentElement.lang = lang;
      try {
        localStorage.setItem(STORAGE_KEY, lang);
      } catch {
        // storage unavailable: the choice just isn't remembered
      }
    });
  }

  /** Loads the chosen language's texts before the app starts (so defaults are translated). */
  load(): Promise<unknown> {
    return firstValueFrom(this.translate.use(this.current()));
  }
}

function readStored(): Language | null {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return (LANGUAGES as readonly string[]).includes(v ?? '') ? (v as Language) : null;
  } catch {
    return null;
  }
}
