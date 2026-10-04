import {
  ApplicationConfig,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { provideTranslateService } from '@ngx-translate/core';
import { provideTranslateHttpLoader } from '@ngx-translate/http-loader';
import { TranslateMessageFormatCompiler } from 'ngx-translate-messageformat-compiler';
import { provideOptimus } from '@openng/optimus-ui/config';
import { definePreset } from '@openng/optimus-ui-themes';
import Aura from '@openng/optimus-ui-themes/aura';

/** Aura with the app's blue as its primary colour. */
const URDAMA_PRESET = definePreset(Aura, {
  semantic: {
    primary: Object.fromEntries(
      [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950].map((n) => [n, `{blue.${n}}`]),
    ),
  },
});
import { LanguageService } from './language';
import { ProjectService } from './project/project.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    // Optimus UI (ADR 0008) with the Aura preset; dark mode follows the .app-dark class that
    // ThemeService sets from the user's choice or the OS.
    provideOptimus({
      ripple: false,
      theme: {
        preset: URDAMA_PRESET,
        options: { darkModeSelector: '.app-dark', cssLayer: false },
      },
    }),
    provideHttpClient(),
    // UI text lives in public/i18n/{lang}.json; keys are prefixed per feature (app.*, editor.*, panel.*).
    // ICU messages ({count, plural, …}) are compiled by messageformat (ADR 0005).
    provideTranslateService({
      lang: 'en',
      fallbackLang: 'en',
      loader: provideTranslateHttpLoader({ prefix: 'i18n/', suffix: '.json' }),
      compiler: TranslateMessageFormatCompiler,
    }),
    // Load the chosen language first (default names are translated), then restore the working copy.
    provideAppInitializer(async () => {
      const language = inject(LanguageService);
      const project = inject(ProjectService);
      await language.load();
      await project.restore();
    }),
  ],
};
