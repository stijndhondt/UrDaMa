/**
 * The centre's preset layouts (ticket 11, ticket 05's decision): which view panels show and how
 * they sit in a CSS grid, with draggable dividers between them. Plan only is the default.
 */
export type LayoutId = 'plan' | 'plan3d' | 'planElevation3d' | 'grid';
export const LAYOUT_IDS: readonly LayoutId[] = ['plan', 'plan3d', 'planElevation3d', 'grid'];

export type ElevationPanelId = 'elevationA' | 'elevationB';
export type PanelId = 'plan' | ElevationPanelId | 'view3d';

/** Where the dividers are: the first column's and the top row's share of the centre (%). */
export interface LayoutSplit {
  readonly col: number;
  readonly row: number;
}

export interface Divider {
  /** Its grid area */
  readonly area: string;
  /** A column divider moves left–right, a row divider up–down */
  readonly axis: 'col' | 'row';
}

export interface LayoutGrid {
  /** The panels shown, in reading order */
  readonly panels: readonly PanelId[];
  /** grid-template-areas, grid-template-columns and grid-template-rows */
  readonly areas: string;
  readonly columns: string;
  readonly rows: string;
  readonly dividers: readonly Divider[];
}

const PANELS: Record<LayoutId, readonly PanelId[]> = {
  plan: ['plan'],
  plan3d: ['plan', 'view3d'],
  planElevation3d: ['plan', 'elevationA', 'view3d'],
  grid: ['plan', 'elevationA', 'elevationB', 'view3d'],
};

/** The grid for a layout; a maximised panel of the layout fills the centre on its own. */
export function layoutGrid(
  layout: LayoutId,
  maximized: PanelId | null,
  split: LayoutSplit,
): LayoutGrid {
  const panels = PANELS[layout];
  const one = (panel: PanelId): LayoutGrid => ({
    panels: [panel],
    areas: `"${panel}"`,
    columns: '1fr',
    rows: '1fr',
    dividers: [],
  });
  if (maximized && panels.includes(maximized)) return one(maximized);
  const columns = `${split.col}fr 6px ${100 - split.col}fr`;
  const rows = `${split.row}fr 6px ${100 - split.row}fr`;
  switch (layout) {
    case 'plan':
      return one('plan');
    case 'plan3d':
      return {
        panels,
        areas: '"plan dv view3d"',
        columns,
        rows: '1fr',
        dividers: [{ area: 'dv', axis: 'col' }],
      };
    case 'planElevation3d':
      return {
        panels,
        areas: '"plan dv elevationA" "plan dv dh" "plan dv view3d"',
        columns,
        rows,
        dividers: [
          { area: 'dv', axis: 'col' },
          { area: 'dh', axis: 'row' },
        ],
      };
    case 'grid':
      return {
        panels,
        areas: '"plan dv1 elevationA" "dh dh dh" "elevationB dv2 view3d"',
        columns,
        rows,
        dividers: [
          { area: 'dv1', axis: 'col' },
          { area: 'dh', axis: 'row' },
          { area: 'dv2', axis: 'col' },
        ],
      };
  }
}
