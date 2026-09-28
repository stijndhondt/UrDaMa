import { Injectable, computed, inject } from '@angular/core';
import { LanguageService } from './language';

const LOCALES = { en: 'en-GB', nl: 'nl-BE' } as const;

/**
 * Numbers as the user reads them (Slice 1 spec, "Units on screen"): lengths in m and areas in m²
 * with 2 decimals, thicknesses in mm; decimal comma in Dutch.
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
  private readonly whole = computed(
    () => new Intl.NumberFormat(LOCALES[this.language.current()], { maximumFractionDigits: 0 }),
  );

  /** "3.73 m" / "3,73 m" */
  length = (mm: number): string => `${this.twoDecimals().format(mm / 1000)} m`;
  /** "9.96 m²" from mm² */
  area = (mm2: number): string => `${this.twoDecimals().format(mm2 / 1e6)} m²`;
  /** "23.45 m³" from mm³ */
  volume = (mm3: number): string => `${this.twoDecimals().format(mm3 / 1e9)} m³`;
  /** "140 mm" */
  millimetres = (mm: number): string => `${this.whole().format(mm)} mm`;
  /** An Opening's size, "0.93 × 2.12 m" */
  openingSize = (width: number, height: number): string =>
    `${this.decimal(width / 1000)} × ${this.decimal(height / 1000)} m`;
  /** A plain number with 2 decimals in the current language (for CSV). */
  decimal = (value: number): string => this.twoDecimals().format(value);
}
