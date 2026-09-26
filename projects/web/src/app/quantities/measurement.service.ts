import { Injectable, signal } from '@angular/core';
import type { MeasurementRule } from '@lakudemis/core';

/**
 * The Measurement rule the figures on screen use. It belongs to the report, never to elements:
 * the properties panel and the Quantities table show the same rule so their values agree.
 */
@Injectable({ providedIn: 'root' })
export class MeasurementService {
  readonly rule = signal<MeasurementRule>('exact');
}
