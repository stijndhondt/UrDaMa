import { layoutGrid } from './layout-grid';

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
