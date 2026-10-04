import { Injectable, effect, inject, signal } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { firstValueFrom } from 'rxjs';
import { readSetting, writeSetting } from './browser-setting';

export const LANGUAGES = ['en', 'nl'] as const;
export type Language = (typeof LANGUAGES)[number];

const STORAGE_KEY = 'urdama.language';

/** The UI language, remembered per browser (a convenience, never project data). */
@Injectable({ providedIn: 'root' })
export class LanguageService {
  private readonly translate = inject(TranslateService);
  readonly current = signal<Language>(readSetting(STORAGE_KEY, LANGUAGES) ?? 'en');
  /**
   * The language whose texts are loaded. Labels built in code (menus, options given to UI
   * components as data) re-read their texts when this changes, not when the choice changes,
   * which is before the new file has arrived.
   */
  readonly loaded = signal<string>('');

  constructor() {
    this.translate.onLangChange.subscribe((e) => this.loaded.set(e.lang));
    effect(() => {
      const lang = this.current();
      this.translate.use(lang);
      document.documentElement.lang = lang;
      writeSetting(STORAGE_KEY, lang);
    });
  }

  /**
   * A text built in code (menus, options given to UI components as data): read in a computed,
   * it is read again when a language's texts have loaded.
   */
  text(key: string, params?: object): string {
    this.loaded();
    return this.translate.instant(key, params);
  }

  /** Loads the chosen language's texts before the app starts (so defaults are translated). */
  load(): Promise<unknown> {
    return firstValueFrom(this.translate.use(this.current()));
  }
}
