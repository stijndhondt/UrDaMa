import { Injectable, computed, effect, signal } from '@angular/core';
import { readSetting, writeSetting } from '../browser-setting';
import {
  LAYOUT_IDS,
  layoutGrid,
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

/**
 * The centre's layout (ticket 11): the preset, a maximised panel, the divider positions and each
 * Elevation panel's side. A view setting, remembered per browser, never in the project file.
 * Plan only when nothing is remembered.
 */
@Injectable({ providedIn: 'root' })
export class LayoutService {
  readonly layout = signal<LayoutId>(readSetting(LAYOUT_KEY, LAYOUT_IDS) ?? 'plan');
  readonly maximized = signal<PanelId | null>(null);
  readonly split = signal<LayoutSplit>(readJson(SPLIT_KEY, DEFAULT_SPLIT));
  readonly sides = signal<Readonly<Record<'elevationA' | 'elevationB', ElevationSide>>>(
    readJson(SIDES_KEY, { elevationA: 'front', elevationB: 'left' }),
  );

  readonly grid = computed(() => layoutGrid(this.layout(), this.maximized(), this.split()));

  constructor() {
    effect(() => writeSetting(LAYOUT_KEY, this.layout()));
    effect(() => writeSetting(SPLIT_KEY, JSON.stringify(this.split())));
    effect(() => writeSetting(SIDES_KEY, JSON.stringify(this.sides())));
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
    const value = Math.round(Math.min(85, Math.max(15, percent)) * 10) / 10;
    this.split.set({ ...this.split(), [axis]: value });
  }

  setSide(panel: 'elevationA' | 'elevationB', side: ElevationSide): void {
    this.sides.set({ ...this.sides(), [panel]: side });
  }
}

function readJson<T extends object>(key: string, fallback: T): T {
  try {
    const v = JSON.parse(localStorage.getItem(key) ?? 'null') as unknown;
    return v && typeof v === 'object' ? { ...fallback, ...(v as object) } : fallback;
  } catch {
    return fallback;
  }
}
