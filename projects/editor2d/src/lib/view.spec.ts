import { View } from './view';

describe('View: keeping a fitted plan fitted (ticket 30)', () => {
  const fitted = () => {
    const view = new View();
    view.fit({ x: 0, y: 0 }, { x: 10000, y: 8000 }, 800, 600);
    return view;
  };

  it('keeps fitting from the start and after a fit, until the user zooms or pans', () => {
    expect(new View().fitted).toBe(true);
    expect(fitted().fitted).toBe(true);
    const zoomed = fitted();
    zoomed.zoomAt({ x: 100, y: 100 }, 1.1);
    expect(zoomed.fitted).toBe(false);
    const panned = fitted();
    panned.panBy(10, 0);
    expect(panned.fitted).toBe(false);
    panned.fit({ x: 0, y: 0 }, { x: 10000, y: 8000 }, 800, 600);
    expect(panned.fitted).toBe(true);
  });
});
