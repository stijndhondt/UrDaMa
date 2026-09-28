import { Injectable, computed, effect, signal } from '@angular/core';
import { readJson, readSetting, writeSetting } from '../browser-setting';
import {
  LAYOUT_IDS,
  layoutGrid,
  type ElevationPanelId,
  type LayoutId,
  type LayoutSplit,
  type PanelId,
} from './layout-grid';

export type ElevationSide = 'front' | 'back' | 'left' | 'right';
export const ELEVATION_SIDES: readonly ElevationSide[] = ['front', 'back', 'left', 'right'];

const LAYOUT_KEY = 'lakudemis.layout';
const SPLIT_KEY = 'lakudemis.layoutSplit';
const SIDES_KEY = 'lakudemis.elevationSides';

const DEFAULT_SPLIT: LayoutSplit = { col: 60, row: 50 };
const DEFAULT_SIDES: Readonly<Record<ElevationPanelId, ElevationSide>> = {
  elevationA: 'front',
  elevationB: 'left',
};

/**
 * The centre's layout (ticket 11): the preset, a maximised panel, the divider positions and each
 * Elevation panel's side. A view setting, remembered per browser, never in the project file.
 * Plan only when nothing is remembered.
 */
@Injectable({ providedIn: 'root' })
export class LayoutService {
  readonly layout = signal<LayoutId>(readSetting(LAYOUT_KEY, LAYOUT_IDS) ?? 'plan');
  readonly maximized = signal<PanelId | null>(null);
  readonly split = signal<LayoutSplit>(readSplit());
  readonly sides = signal<Readonly<Record<ElevationPanelId, ElevationSide>>>(readSides());

  readonly grid = computed(() => layoutGrid(this.layout(), this.maximized(), this.split()));

  constructor() {
    effect(() => writeSetting(LAYOUT_KEY, this.layout()));
    effect(() => writeSetting(SPLIT_KEY, JSON.stringify(this.split())));
    effect(() => writeSetting(SIDES_KEY, JSON.stringify(this.sides())));
  }

  /** A new project starts in Plan only; the divider positions and sides stay as they were. */
  reset(): void {
    this.choose('plan');
  }

  choose(layout: LayoutId): void {
    this.layout.set(layout);
    this.maximized.set(null);
  }

  /** A panel's Maximise button: that panel alone; again (Restore) brings back the preset. */
  toggleMaximized(panel: PanelId): void {
    this.maximized.set(this.maximized() === panel ? null : panel);
  }

  /** Dragging a divider: its share of the centre, kept between 15 and 85 %. */
  setSplit(axis: 'col' | 'row', percent: number): void {
    this.split.set({ ...this.split(), [axis]: clampSplit(percent) });
  }

  setSide(panel: ElevationPanelId, side: ElevationSide): void {
    this.sides.set({ ...this.sides(), [panel]: side });
  }
}

const clampSplit = (percent: number): number =>
  Math.round(Math.min(85, Math.max(15, percent)) * 10) / 10;

/** The remembered divider positions, each kept between 15 and 85 %. */
function readSplit(): LayoutSplit {
  const v = readJson(SPLIT_KEY) as Partial<Record<keyof LayoutSplit, unknown>> | null;
  const read = (axis: keyof LayoutSplit) => {
    const n = v?.[axis];
    return typeof n === 'number' && Number.isFinite(n) ? clampSplit(n) : DEFAULT_SPLIT[axis];
  };
  return { col: read('col'), row: read('row') };
}

function readSides(): Record<ElevationPanelId, ElevationSide> {
  const v = readJson(SIDES_KEY) as Partial<Record<ElevationPanelId, unknown>> | null;
  const read = (panel: ElevationPanelId) => {
    const side = v?.[panel];
    return ELEVATION_SIDES.includes(side as ElevationSide)
      ? (side as ElevationSide)
      : DEFAULT_SIDES[panel];
  };
  return { elevationA: read('elevationA'), elevationB: read('elevationB') };
}
