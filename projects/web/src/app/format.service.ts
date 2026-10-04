import { Injectable, computed, inject } from '@angular/core';
import { LanguageService } from './language';

const LOCALES = { en: 'en-GB', nl: 'nl-BE' } as const;

/**
 * Numbers as the user reads them (Slice 1 spec, "Units on screen"): lengths in m with 3 decimals
 * (to the mm), areas and volumes with 2 decimals, thicknesses in mm; decimal comma in Dutch.
 */
@Injectable({ providedIn: 'root' })
export class FormatService {
  private readonly language = inject(LanguageService);
  private readonly twoDecimals = computed(
    () =>
      new Intl.NumberFormat(LOCALES[this.language.current()], {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }),
  );
  private readonly threeDecimals = computed(
    () =>
      new Intl.NumberFormat(LOCALES[this.language.current()], {
        minimumFractionDigits: 3,
        maximumFractionDigits: 3,
      }),
  );
  private readonly whole = computed(
    () => new Intl.NumberFormat(LOCALES[this.language.current()], { maximumFractionDigits: 0 }),
  );

  /** "3.730 m" / "3,730 m" */
  length = (mm: number): string => `${this.metres(mm / 1000)} m`;
  /** "9.96 m²" from mm² */
  area = (mm2: number): string => `${this.twoDecimals().format(mm2 / 1e6)} m²`;
  /** "23.45 m³" from mm³ */
  volume = (mm3: number): string => `${this.twoDecimals().format(mm3 / 1e9)} m³`;
  /** "140 mm" */
  millimetres = (mm: number): string => `${this.whole().format(mm)} mm`;
  /** An Opening's size, "0.930 × 2.115 m" */
  openingSize = (width: number, height: number): string =>
    `${this.metres(width / 1000)} × ${this.metres(height / 1000)} m`;
  private readonly plain = computed(
    () =>
      new Intl.NumberFormat(LOCALES[this.language.current()], {
        maximumFractionDigits: 1,
        useGrouping: false,
      }),
  );
  /** mm as an entry field shows it and the user types it back: "2670", "884,5". */
  mm = (mm: number): string => this.plain().format(mm);
  /** A length in m with 3 decimals (to the mm), without the unit, for labels: "2,670". */
  metres = (m: number): string => this.threeDecimals().format(m);
  /** A plain number with 2 decimals in the current language (for CSV). */
  decimal = (value: number): string => this.twoDecimals().format(value);
}
