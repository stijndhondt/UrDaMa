import { Injectable, computed, inject, signal } from '@angular/core';
import { MEASUREMENT_RULES, type MeasurementRule } from '@lakudemis/core';
import { LanguageService } from '../language';

/**
 * The Measurement rule the figures on screen use. It belongs to the report, never to elements:
 * the properties panel and the Quantities table show the same rule so their values agree.
 */
@Injectable({ providedIn: 'root' })
export class MeasurementService {
  private readonly language = inject(LanguageService);
  readonly rule = signal<MeasurementRule>('exact');

  /** The rules as choices, in the user's language. */
  readonly options = computed(() =>
    (Object.keys(MEASUREMENT_RULES) as MeasurementRule[]).map((value) => ({
      value,
      label: this.language.text('quantities.rules.' + value),
    })),
  );
}
