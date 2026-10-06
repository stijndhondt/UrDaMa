import { checkInvariants } from '../model/invariants';
import { counterIds } from '../model/ids';
import { createProject } from '../model/new-project';
import { DEFAULT_DESIGNS } from '../model/opening-parts';
import { BUILT_IN_FAMILIES, resolveOpening } from '../model/opening-types';
import type { LevelId, OpeningFamilyId, Wall } from '../model/types';
import { ProjectStore } from '../store/project-store';
import { addOpening } from './add-opening';
import { drawRoom } from './draw-room';
import { libraryFamily, importOpeningFamily, type LibraryFamily } from './opening-library';
import { addOpeningType } from './opening-type-commands';
import { updateOpeningFamily } from './opening-family-commands';

function project() {
  const ids = counterIds();
  const store = new ProjectStore(createProject({ name: 'T', levelName: 'Ground floor' }, ids), ids);
  const level = Object.keys(store.model().levels)[0] as LevelId;
  store.run(drawRoom, {
    level,
    from: { x: 0, y: 0 },
    to: { x: 6000, y: 4000 },
    size: 'inside',
    name: 'Hall',
  });
  const wall = Object.values(store.model().walls).find(
    (w: Wall) => w.start.y === 4000 && w.end.y === 4000,
  )!;
  return { store, wall };
}

const sliding: LibraryFamily = {
  id: 'lib-1',
  kind: 'door',
  name: 'Sliding door',
  design: {
    ...DEFAULT_DESIGNS.door,
    infill: { kind: 'leaves', count: 2, thickness: 40, operation: 'sliding' },
  },
  types: [
    { name: 'Patio', width: 1800, height: 2100 },
    { width: 1400, height: 2100 },
  ],
};

describe('Opening library (ticket 21)', () => {
  it('imports a family and its types as one undo step, every reference consistent', () => {
    const { store, wall } = project();
    const before = store.model();
    const r = store.run(importOpeningFamily, { family: sliding });
    expect(r.ok).toBe(true);
    const model = store.model();
    expect(checkInvariants(model, before)).toBeNull();
    const family = Object.values(model.openingFamilies).find((f) => f.name === 'Sliding door')!;
    expect(family).toMatchObject({ kind: 'door', design: sliding.design });
    expect(family.id in before.openingFamilies).toBe(false);
    const types = Object.values(model.openingTypes).filter((t) => t.family === family.id);
    expect(types.map((t) => [t.name, t.width])).toEqual([
      ['Patio', 1800],
      [undefined, 1400],
    ]);
    // A type of it places an Opening of that family's design.
    const patio = types.find((t) => t.name === 'Patio')!;
    store.run(addOpening, { wall: wall.id, kind: 'door', offset: 1000, type: patio.id });
    const o = Object.values(store.model().openings)[0]!;
    expect(resolveOpening(store.model(), o)).toMatchObject({ width: 1800, design: sliding.design });
    store.undo();
    store.undo();
    expect(store.model()).toEqual(before);
  });

  it('gives an imported family a free name when the project has one by that name', () => {
    const { store } = project();
    store.run(importOpeningFamily, { family: sliding });
    store.run(importOpeningFamily, { family: sliding });
    const names = Object.values(store.model().openingFamilies)
      .map((f) => f.name)
      .filter(Boolean);
    expect(names).toEqual(['Sliding door', 'Sliding door (2)']);
  });

  it('does not take a name an unnamed family shows (its kind)', () => {
    const { store } = project();
    store.run(importOpeningFamily, {
      family: { ...sliding, name: 'Door' },
      shownNames: ['Door', 'Window'],
    });
    const names = Object.values(store.model().openingFamilies).map((f) => f.name);
    expect(names).toContain('Door (2)');
  });

  it('refuses a library family with an impossible design or no type', () => {
    const { store } = project();
    expect(
      store.run(importOpeningFamily, {
        family: { ...sliding, design: { ...sliding.design!, frame: { width: 0, depth: 100 } } },
      }).ok,
    ).toBe(false);
    expect(store.run(importOpeningFamily, { family: { ...sliding, types: [] } }).ok).toBe(false);
  });

  it('saves a project family with its types for the library, and imports it back the same', () => {
    const { store } = project();
    const door = BUILT_IN_FAMILIES.door as OpeningFamilyId;
    store.run(updateOpeningFamily, { family: door, name: 'Inner door', design: sliding.design });
    store.run(addOpeningType, { family: door, name: 'Narrow', width: 730, height: 2115 });
    const saved = libraryFamily(store.model(), door, 'lib-9')!;
    expect(saved).toEqual({
      id: 'lib-9',
      kind: 'door',
      name: 'Inner door',
      design: sliding.design,
      // Narrowest first; the project's own unnamed door type comes along.
      types: [
        { name: 'Narrow', width: 730, height: 2115 },
        { width: 930, height: 2115 },
      ],
    });
    store.run(importOpeningFamily, { family: saved });
    expect(Object.values(store.model().openingFamilies).map((f) => f.name)).toContain(
      'Inner door (2)',
    );
  });

  it("carries a window type's sill height to the library and back", () => {
    const { store } = project();
    const window = BUILT_IN_FAMILIES.window as OpeningFamilyId;
    store.run(addOpeningType, {
      family: window,
      name: 'High',
      width: 600,
      height: 600,
      sill: 1600,
    });
    const saved = libraryFamily(store.model(), window, 'lib-w')!;
    expect(saved.types).toContainEqual({ name: 'High', width: 600, height: 600, sill: 1600 });
    store.run(importOpeningFamily, { family: saved });
    const imported = Object.values(store.model().openingTypes).filter((t) => t.name === 'High');
    expect(imported.map((t) => t.sill)).toEqual([1600, 1600]);
  });
});
