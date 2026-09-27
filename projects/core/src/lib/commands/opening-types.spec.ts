import { counterIds } from '../model/ids';
import { createProject } from '../model/new-project';
import { BUILT_IN_FAMILIES, resolveOpening } from '../model/opening-types';
import type { LevelId, Wall } from '../model/types';
import { ProjectStore } from '../store/project-store';
import { addOpening } from './add-opening';
import { drawRoom } from './draw-room';
import { updateOpening } from './update-opening';

function keuken() {
  const ids = counterIds();
  const store = new ProjectStore(createProject({ name: 'T', levelName: 'Ground floor' }, ids), ids);
  const level = Object.keys(store.model().levels)[0] as LevelId;
  store.run(drawRoom, {
    level,
    from: { x: 0, y: 0 },
    to: { x: 2670, y: 3730 },
    size: 'inside',
    name: 'Keuken',
  });
  const wall = (y: number): Wall =>
    Object.values(store.model().walls).find((w) => w.start.y === y && w.end.y === y)!;
  const openings = () =>
    Object.values(store.model().openings).map((o) => resolveOpening(store.model(), o)!);
  return { store, wall, openings };
}

describe('Opening families and types (ticket 16, ADR 0007)', () => {
  it('gives every new project a door and a window family, each with a default type from the Presets', () => {
    const model = createProject({ name: 'T', levelName: 'Ground floor' }, counterIds());
    const families = Object.values(model.openingFamilies);
    expect(families.map((f) => [f.id, f.kind])).toEqual([
      [BUILT_IN_FAMILIES.door, 'door'],
      [BUILT_IN_FAMILIES.window, 'window'],
    ]);
    const types = Object.values(model.openingTypes);
    expect(types.map((t) => [t.family, t.width, t.height])).toEqual([
      [BUILT_IN_FAMILIES.door, 930, 2115],
      [BUILT_IN_FAMILIES.window, 1200, 1200],
    ]);
  });

  it('places a door as an Opening of the default door type', () => {
    const { store, wall, openings } = keuken();
    store.run(addOpening, { wall: wall(3730).id, kind: 'door', offset: 580 });
    const [door] = openings();
    const type = store.model().openingTypes[door!.type]!;
    expect(type.family).toBe(BUILT_IN_FAMILIES.door);
    expect(door).toMatchObject({ kind: 'door', width: 930, height: 2115, sill: 0, offset: 580 });
    expect(Object.keys(store.model().openingTypes)).toHaveLength(2);
  });

  it('shares one type between Openings of the same size, and makes a new one for another size', () => {
    const { store, wall, openings } = keuken();
    store.run(addOpening, { wall: wall(3730).id, kind: 'door', offset: 100, width: 800 });
    store.run(addOpening, { wall: wall(3730).id, kind: 'door', offset: 1500, width: 800 });
    const [a, b] = openings();
    expect(a!.type).toBe(b!.type);
    expect(a!.width).toBe(800);
    expect(Object.keys(store.model().openingTypes)).toHaveLength(3);
  });

  it('changes only this Opening when its width is edited, as before', () => {
    const { store, wall, openings } = keuken();
    store.run(addOpening, { wall: wall(3730).id, kind: 'door', offset: 100 });
    store.run(addOpening, { wall: wall(3730).id, kind: 'door', offset: 1500 });
    const [a] = Object.values(store.model().openings);
    const result = store.run(updateOpening, { opening: a!.id, width: 800 });
    expect(result.ok).toBe(true);
    const [first, second] = openings();
    expect(first!.width).toBe(800);
    expect(second!.width).toBe(930);
    expect(first!.type).not.toBe(second!.type);
    store.undo();
    expect(openings().map((o) => o.width)).toEqual([930, 930]);
  });

  it('keeps sill, hinge and swing on the placed Opening', () => {
    const { store, wall, openings } = keuken();
    store.run(addOpening, { wall: wall(3730).id, kind: 'window', offset: 700, sill: 1000 });
    const [w] = Object.values(store.model().openings);
    store.run(updateOpening, { opening: w!.id, flipHinge: true, flipSwing: true, sill: 1100 });
    expect(openings()[0]).toMatchObject({
      kind: 'window',
      sill: 1100,
      hinge: 'end',
      swing: 'left',
    });
  });

  it('refuses an Opening whose type does not exist', () => {
    const { store, wall } = keuken();
    store.run(addOpening, { wall: wall(3730).id, kind: 'door', offset: 580 });
    const model = store.model();
    const [o] = Object.values(model.openings);
    const broken = { ...model, openingTypes: {} };
    expect(resolveOpening(broken, o!)).toBeNull();
  });
});
