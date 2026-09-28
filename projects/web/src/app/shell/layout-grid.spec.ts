import { fittingLayout, layoutFits, layoutGrid } from './layout-grid';

const split = { col: 60, row: 40 };

describe('the centre layouts (ticket 11)', () => {
  it('shows the Plan alone in Plan only', () => {
    const g = layoutGrid('plan', null, split);
    expect(g.panels).toEqual(['plan']);
    expect(g.areas).toBe('"plan"');
    expect(g.dividers).toEqual([]);
  });

  it('puts 3D beside the Plan, split by a draggable column divider', () => {
    const g = layoutGrid('plan3d', null, split);
    expect(g.panels).toEqual(['plan', 'view3d']);
    expect(g.areas).toBe('"plan dv view3d"');
    expect(g.columns).toBe('60fr 6px 40fr');
    expect(g.dividers).toEqual([{ area: 'dv', axis: 'col' }]);
  });

  it('stacks an Elevation over 3D beside the Plan', () => {
    const g = layoutGrid('planElevation3d', null, split);
    expect(g.panels).toEqual(['plan', 'elevationA', 'view3d']);
    expect(g.areas).toBe('"plan dv elevationA" "plan dv dh" "plan dv view3d"');
    expect(g.rows).toBe('40fr 6px 60fr');
    expect(g.dividers.map((d) => d.axis)).toEqual(['col', 'row']);
  });

  it('shows Plan, two Elevations and 3D in 2 × 2', () => {
    const g = layoutGrid('grid', null, split);
    expect(g.panels).toEqual(['plan', 'elevationA', 'elevationB', 'view3d']);
    expect(g.areas).toBe('"plan dv1 elevationA" "dh dh dh" "elevationB dv2 view3d"');
    expect(g.dividers).toEqual([
      { area: 'dv1', axis: 'col' },
      { area: 'dh', axis: 'row' },
      { area: 'dv2', axis: 'col' },
    ]);
  });

  it('shows a maximised panel alone, if it is in the layout', () => {
    const g = layoutGrid('grid', 'elevationB', split);
    expect(g.panels).toEqual(['elevationB']);
    expect(g.areas).toBe('"elevationB"');
    expect(g.dividers).toEqual([]);
    expect(layoutGrid('plan3d', 'elevationB', split).panels).toEqual(['plan', 'view3d']);
  });
});

describe('layouts on a small screen', () => {
  const large = { width: 1400, height: 800 };
  const narrow = { width: 600, height: 800 };
  const low = { width: 1400, height: 400 };

  it('offers every layout when the centre has room for its panels', () => {
    expect(
      ['plan', 'plan3d', 'planElevation3d', 'grid'].every((l) => layoutFits(l as never, large)),
    ).toBe(true);
  });

  it('offers no side-by-side panels in a narrow centre, and no stacked ones in a low centre', () => {
    expect(layoutFits('plan', narrow)).toBe(true);
    expect(layoutFits('plan', { width: 200, height: 150 })).toBe(true);
    expect(layoutFits('plan3d', narrow)).toBe(false);
    expect(layoutFits('grid', narrow)).toBe(false);
    expect(layoutFits('plan3d', low)).toBe(true);
    expect(layoutFits('planElevation3d', low)).toBe(false);
    expect(layoutFits('grid', low)).toBe(false);
  });

  it('shows the largest layout that fits, keeping the chosen one for when the window grows', () => {
    expect(fittingLayout('grid', large)).toBe('grid');
    expect(fittingLayout('grid', low)).toBe('plan3d');
    expect(fittingLayout('grid', narrow)).toBe('plan');
    expect(fittingLayout('plan', narrow)).toBe('plan');
  });

  it('keeps the chosen layout while the centre has not been measured yet', () => {
    expect(fittingLayout('grid', null)).toBe('grid');
  });
});
