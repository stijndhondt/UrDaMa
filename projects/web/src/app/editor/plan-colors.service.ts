import { Injectable, inject } from '@angular/core';
import { DEFAULT_PLAN_COLORS, type PlanColors } from '@lakudemis/editor2d';
import { ThemeService } from '../shell/theme.service';

/**
 * The drawing canvases' colours (plan, Elevations) from the app's theme (styles.css, --plan-*
 * and friends), read when first drawn in a theme: a canvas needs the colours themselves, not CSS
 * variables.
 */
@Injectable({ providedIn: 'root' })
export class PlanColorsService {
  private readonly theme = inject(ThemeService);
  private cache: { dark: boolean; colors: PlanColors } | null = null;

  colors(): PlanColors {
    const dark = this.theme.dark();
    if (this.cache?.dark === dark) return this.cache.colors;
    const style = getComputedStyle(document.documentElement);
    const read = (name: string, fallback: string) =>
      style.getPropertyValue(name).trim() || fallback;
    const d = DEFAULT_PLAN_COLORS;
    const colors: PlanColors = {
      paper: read('--paper', d.paper),
      gridMinor: read('--plan-grid-minor', d.gridMinor),
      gridMajor: read('--plan-grid-major', d.gridMajor),
      area: read('--plan-area', d.area),
      areaChanged: read('--accent-soft', d.areaChanged),
      hatch: read('--plan-hatch', d.hatch),
      wallFill: read('--plan-wall-fill', d.wallFill),
      wallStroke: read('--plan-wall-stroke', d.wallStroke),
      separator: read('--plan-separator', d.separator),
      levelBelow: d.levelBelow,
      levelBelowStroke: d.levelBelowStroke,
      label: read('--ink', d.label),
      muted: read('--muted', d.muted),
      ok: read('--ok', d.ok),
      warn: read('--warn', d.warn),
      bad: read('--bad', d.bad),
      accent: read('--accent', d.accent),
      onAccent: read('--accent-ink', d.onAccent),
    };
    this.cache = { dark, colors };
    return colors;
  }
}
