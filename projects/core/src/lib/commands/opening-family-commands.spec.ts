import { counterIds } from '../model/ids';
import { createProject } from '../model/new-project';
import { DEFAULT_DESIGNS, openingShape, type OpeningDesign } from '../model/opening-parts';
import { BUILT_IN_FAMILIES, resolveOpening } from '../model/opening-types';
import type { LevelId, Wall } from '../model/types';
import { openingFamilySolids } from '../geometry/solids';
import { ProjectStore } from '../store/project-store';
import { addOpening } from './add-opening';
import { drawRoom } from './draw-room';
import { updateOpeningFamily } from './opening-family-commands';

/** A Room with two doors of different types and a window. */
function house() {
  const ids = counterIds();
  const store = new ProjectStore(createProject({ name: 'T', levelName: 'Ground floor' }, ids), ids);
  const level = Object.keys(store.model().levels)[0] as LevelId;
  store.run(drawRoom, {
    level,
    from: { x: 0, y: 0 },
    to: { x: 8000, y: 4000 },
    size: 'inside',
    name: 'Hall',
  });
  const wall = Object.values(store.model().walls).find(
    (w: Wall) => w.start.y === 4000 && w.end.y === 4000,
  )!;
  store.run(addOpening, { wall: wall.id, kind: 'door', offset: 500 });
  store.run(addOpening, { wall: wall.id, kind: 'door', offset: 2500, width: 800 });
  store.run(addOpening, { wall: wall.id, kind: 'window', offset: 5000 });
  const resolved = () =>
    Object.values(store.model().openings).map((o) => resolveOpening(store.model(), o)!);
  return { store, resolved };
}

const slidingGlazed: OpeningDesign = {
  ...DEFAULT_DESIGNS.door,
  infill: { kind: 'leaves', count: 2, thickness: 40, operation: 'sliding', glazed: true },
};

describe('Opening family editor (ticket 20)', () => {
  it('a family change reaches all its types and Openings as one undo step', () => {
    const { store, resolved } = house();
    const before = store.model();
    const r = store.run(updateOpeningFamily, {
      family: BUILT_IN_FAMILIES.door,
      design: slidingGlazed,
    });
    expect(r.ok).toBe(true);
    const doors = resolved().filter((o) => o.kind === 'door');
    expect(doors).toHaveLength(2);
    for (const d of doors) expect(d.design).toEqual(slidingGlazed);
    // The window's family is untouched.
    expect(resolved().find((o) => o.kind === 'window')!.design).toEqual(DEFAULT_DESIGNS.window);
    store.undo();
    expect(store.model()).toEqual(before);
  });

  it('renames a family, and refuses an impossible design', () => {
    const { store } = house();
    store.run(updateOpeningFamily, { family: BUILT_IN_FAMILIES.door, name: ' Binnendeur ' });
    expect(store.model().openingFamilies[BUILT_IN_FAMILIES.door]!.name).toBe('Binnendeur');
    const bad = store.run(updateOpeningFamily, {
      family: BUILT_IN_FAMILIES.window,
      design: { ...DEFAULT_DESIGNS.window, infill: { kind: 'glazing', panes: 9, thickness: 24 } },
    });
    expect(bad.ok).toBe(false);
    expect(store.model().openingFamilies[BUILT_IN_FAMILIES.window]!.design).toBeUndefined();
  });

  it('keeps no design of its own when it is set back to the default', () => {
    const { store } = house();
    store.run(updateOpeningFamily, { family: BUILT_IN_FAMILIES.door, design: slidingGlazed });
    store.run(updateOpeningFamily, {
      family: BUILT_IN_FAMILIES.door,
      design: { ...DEFAULT_DESIGNS.door, infill: { ...DEFAULT_DESIGNS.door.infill } },
    });
    expect(store.model().openingFamilies[BUILT_IN_FAMILIES.door]!.design).toBeUndefined();
  });

  it('refuses a design of another kind’s infill (a window with leaves)', () => {
    const { store } = house();
    const r = store.run(updateOpeningFamily, {
      family: BUILT_IN_FAMILIES.window,
      design: DEFAULT_DESIGNS.door,
    });
    expect(r.ok).toBe(false);
  });
});

const placement = { width: 1800, height: 2100, sill: 0, hinge: 'start', swing: 'right' } as const;

describe('Opening family parameters (ticket 20)', () => {
  it('hangs sliding leaves on the Wall face, with no swing arc and where they slide to dashed', () => {
    const s = openingShape(slidingGlazed, placement, 200);
    const leaves = s.parts.filter((p) => p.kind === 'leaf');
    // Two glazed leaves: each stiles, a top rail and a lower panel around its glass.
    expect(leaves).toHaveLength(8);
    for (const l of leaves) expect([l.v0, l.v1]).toEqual([200, 240]);
    expect(s.plan.arcs).toEqual([]);
    expect(s.plan.dashed.length).toBe(8);
    // A glass panel in each leaf.
    expect(s.glassArea).toBeGreaterThan(0);
    expect(s.parts.filter((p) => p.kind === 'glass')).toHaveLength(2);
    // Opened, each leaf clears the opening but for the frame it overlaps (60 mm).
    const [first] = s.plan.dashed;
    expect(Math.max(first![0].u, first![1].u)).toBe(60);
  });

  it('divides a window into the panes asked for, with a post between each two', () => {
    const s = openingShape(
      { ...DEFAULT_DESIGNS.window, infill: { kind: 'glazing', panes: 3, thickness: 24 } },
      { ...placement, width: 1860, height: 1200 },
      140,
    );
    const panes = s.parts.filter((p) => p.kind === 'glass');
    expect(panes.map((p) => [p.u0, p.u1])).toEqual([
      [60, 600],
      [660, 1200],
      [1260, 1800],
    ]);
    expect(s.parts.filter((p) => p.kind === 'frame')).toHaveLength(6);
  });

  it('shows a glazed hinged leaf open in the plan, its glass in 3D, and never a too-narrow pane', () => {
    const glazed = openingShape(
      {
        ...DEFAULT_DESIGNS.door,
        infill: { kind: 'leaves', count: 1, thickness: 40, glazed: true },
      },
      { ...placement, width: 1000 },
      200,
    );
    // No glass left behind in the doorway: the plan has the open leaf and its arc only.
    expect(glazed.plan.rects.filter((r) => r.kind === 'glass')).toEqual([]);
    expect(glazed.plan.arcs).toHaveLength(1);
    // The leaf is stiles and rails around the glass, none in front of it.
    const glass = glazed.parts.find((p) => p.kind === 'glass')!;
    for (const l of glazed.parts.filter((p) => p.kind === 'leaf'))
      expect(l.u1 <= glass.u0 || l.u0 >= glass.u1 || l.z1 <= glass.z0 || l.z0 >= glass.z1).toBe(
        true,
      );
    const narrow = openingShape(
      { ...DEFAULT_DESIGNS.window, infill: { kind: 'glazing', panes: 6, thickness: 24 } },
      { ...placement, width: 400, height: 1000 },
      140,
    );
    const panes = narrow.parts.filter((p) => p.kind === 'glass');
    expect(panes).toHaveLength(2);
    for (const p of panes) expect(p.u1 - p.u0).toBeGreaterThanOrEqual(100);
  });

  it('gives garage door styles their own panels and plan symbol', () => {
    const garage = (style: 'sectional' | 'upAndOver' | 'roller') =>
      openingShape(
        {
          ...DEFAULT_DESIGNS.garageDoor,
          infill: { kind: 'panels', count: 4, thickness: 40, style },
        },
        { ...placement, width: 2400, height: 2100 },
        300,
      );
    expect(garage('sectional').parts.filter((p) => p.kind === 'panel')).toHaveLength(4);
    expect(garage('upAndOver').parts.filter((p) => p.kind === 'panel')).toHaveLength(1);
    // Roller slats about 100 mm high; a roller box instead of a long track.
    const roller = garage('roller');
    expect(roller.parts.filter((p) => p.kind === 'panel').length).toBe(20);
    expect(roller.plan.dashed).toHaveLength(4);
    const longest = (d: typeof roller.plan.dashed) =>
      Math.max(...d.map(([a, b]) => Math.abs(b.v - a.v)));
    expect(longest(roller.plan.dashed)).toBe(300);
    expect(longest(garage('upAndOver').plan.dashed)).toBeLessThan(
      longest(garage('sectional').plan.dashed),
    );
  });
});

describe('Opening family 3D (ticket 20)', () => {
  it('gives each part one solid, standing on the floor', () => {
    const s = openingShape(DEFAULT_DESIGNS.door, placement, 200);
    const solids = openingFamilySolids(s.parts);
    expect(solids.solids).toHaveLength(s.parts.length);
    expect(Math.min(...solids.solids.map((x) => x.body.bottom))).toBe(0);
    expect(solids.solids.map((x) => x.kind === 'openingPart' && x.part)).toEqual(
      s.parts.map((p) => p.kind),
    );
  });
});
