import { counterIds } from '../model/ids';
import { createProject } from '../model/new-project';
import { BUILT_IN_FAMILIES, resolveOpening } from '../model/opening-types';
import type { LevelId, Opening, OpeningTypeId, Wall } from '../model/types';
import { ProjectStore } from '../store/project-store';
import { addOpening } from './add-opening';
import { drawRoom } from './draw-room';
import {
  addOpeningType,
  deleteOpeningType,
  renameOpeningType,
  setOpeningType,
  updateOpeningType,
} from './opening-type-commands';
import { updateOpening } from './update-opening';

/** A 6 × 4 m Room with three doors in its bottom Wall: two of one type, one of another. */
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
  for (const offset of [500, 2500]) store.run(addOpening, { wall: wall.id, kind: 'door', offset });
  store.run(addOpening, { wall: wall.id, kind: 'door', offset: 5000, width: 800 });
  const doors = () =>
    Object.values(store.model().openings)
      .sort((a, b) => a.offset - b.offset)
      .map((o) => resolveOpening(store.model(), o)!);
  const [a, b, c] = doors();
  return { store, doors, a: a!, b: b!, c: c! };
}

const typeOf = (store: ProjectStore, o: Opening) => store.model().openingTypes[o.type]!;

describe('Opening types (ticket 18)', () => {
  it('adds a named type to a family, and renames it', () => {
    const { store } = house();
    const added = store.run(addOpeningType, {
      family: BUILT_IN_FAMILIES.door,
      name: 'Front door',
      width: 1000,
      height: 2300,
    });
    expect(added.ok).toBe(true);
    const front = Object.values(store.model().openingTypes).find((t) => t.name === 'Front door')!;
    expect(front).toMatchObject({ family: BUILT_IN_FAMILIES.door, width: 1000, height: 2300 });
    store.run(renameOpeningType, { type: front.id, name: 'Voordeur' });
    expect(store.model().openingTypes[front.id]!.name).toBe('Voordeur');
    // An empty name shows the sizes again.
    store.run(renameOpeningType, { type: front.id, name: '  ' });
    expect(store.model().openingTypes[front.id]!.name).toBeUndefined();
  });

  it('changes every Opening of a type and no other when the type changes', () => {
    const { store, doors, a, c } = house();
    const result = store.run(updateOpeningType, { type: a.type, width: 1000 });
    expect(result.ok).toBe(true);
    const [na, nb, nc] = doors();
    expect([na!.width, nb!.width]).toEqual([1000, 1000]);
    expect(nc!.width).toBe(c.width);
    expect(na!.type).toBe(a.type);
  });

  it('detaches one Opening into a new type with "only this one", leaving the others', () => {
    const { store, doors, a } = house();
    store.run(renameOpeningType, { type: a.type, name: 'Front door' });
    const result = store.run(updateOpening, { opening: a.id, width: 1000 });
    expect(result.ok).toBe(true);
    const [na, nb] = doors();
    expect(na!.type).not.toBe(a.type);
    expect(na!.width).toBe(1000);
    expect(typeOf(store, na!).name).toBe('Front door (2)');
    expect(nb!.type).toBe(a.type);
    expect(nb!.width).toBe(a.width);
    // Detaching again takes the next free number.
    store.run(updateOpening, { opening: nb!.id, width: 1100 });
    expect(typeOf(store, doors()[1]!).name).toBe('Front door (3)');
  });

  it('refuses to delete a type in use, with the reason, and deletes an unused one', () => {
    const { store, a } = house();
    const refused = store.run(deleteOpeningType, { type: a.type });
    expect(refused.ok).toBe(false);
    expect(!refused.ok && refused.reason).toMatchObject({
      key: 'commands.openingType.inUse',
      params: { count: 2 },
    });
    const added = store.run(addOpeningType, {
      family: BUILT_IN_FAMILIES.window,
      width: 600,
      height: 600,
    });
    expect(added.ok).toBe(true);
    const unused = Object.values(store.model().openingTypes).find((t) => t.width === 600)!;
    expect(store.run(deleteOpeningType, { type: unused.id }).ok).toBe(true);
    expect(store.model().openingTypes[unused.id]).toBeUndefined();
  });

  it('gives an Opening another type of its family, and refuses one of another family', () => {
    const { store, doors, a, c } = house();
    expect(store.run(setOpeningType, { opening: a.id, type: c.type }).ok).toBe(true);
    expect(doors()[0]!.width).toBe(c.width);
    const windowType = Object.values(store.model().openingTypes).find(
      (t) => t.family === BUILT_IN_FAMILIES.window,
    )!;
    expect(store.run(setOpeningType, { opening: a.id, type: windowType.id }).ok).toBe(false);
  });

  it('refuses a type size that is not possible', () => {
    const { store, a } = house();
    expect(store.run(updateOpeningType, { type: a.type as OpeningTypeId, width: 0 }).ok).toBe(
      false,
    );
  });

  it('keeps one unnamed type per size: a type resized onto another merges into it', () => {
    const { store, doors, a, c } = house();
    // The 800 type of the third door, resized to the shared 930: one type for all three.
    expect(store.run(updateOpeningType, { type: c.type, width: a.width }).ok).toBe(true);
    const types = new Set(doors().map((d) => d.type));
    expect(types).toEqual(new Set([a.type]));
    expect(store.model().openingTypes[c.type]).toBeUndefined();
    // Clearing a name onto a size an unnamed type has: merged as well.
    store.run(addOpeningType, {
      family: BUILT_IN_FAMILIES.door,
      name: 'Spare',
      width: a.width,
      height: a.height,
    });
    const spare = Object.values(store.model().openingTypes).find((t) => t.name === 'Spare')!;
    store.run(renameOpeningType, { type: spare.id, name: '' });
    expect(store.model().openingTypes[spare.id]).toBeUndefined();
  });

  it('refuses a name another type of the family already has', () => {
    const { store, a, c } = house();
    store.run(renameOpeningType, { type: a.type, name: 'Front door' });
    const refused = store.run(renameOpeningType, { type: c.type, name: ' Front door ' });
    expect(!refused.ok && refused.reason.key).toBe('commands.openingType.nameTaken');
    const added = store.run(addOpeningType, {
      family: BUILT_IN_FAMILIES.door,
      name: 'Front door',
      width: 700,
      height: 2000,
    });
    expect(added.ok).toBe(false);
  });
});

describe("An Opening type's sill height", () => {
  /** A 6 × 4 m Room and its bottom Wall, with a named window type at a 1100 mm sill. */
  function withHighWindow() {
    const ids = counterIds();
    const store = new ProjectStore(createProject({ name: 'T', levelName: 'Ground' }, ids), ids);
    const level = Object.keys(store.model().levels)[0] as LevelId;
    store.run(drawRoom, {
      level,
      from: { x: 0, y: 0 },
      to: { x: 6000, y: 4000 },
      size: 'inside',
      name: 'Kitchen',
    });
    const wall = Object.values(store.model().walls).find(
      (w: Wall) => w.start.y === 4000 && w.end.y === 4000,
    )!;
    expect(
      store.run(addOpeningType, {
        family: BUILT_IN_FAMILIES.window,
        name: 'Kitchen window',
        width: 1200,
        height: 1000,
        sill: 1100,
      }).ok,
    ).toBe(true);
    const type = Object.values(store.model().openingTypes).find(
      (t) => t.name === 'Kitchen window',
    )!;
    /** Places a window of the type, or with null the window tool's default. */
    const place = (offset: number, chosen: OpeningTypeId | null = type.id) => {
      store.run(addOpening, { wall: wall.id, kind: 'window', offset, type: chosen ?? undefined });
      return Object.values(store.model().openings).find((o) => o.offset === offset)!;
    };
    return { store, type, place };
  }

  it('places its windows at its sill; a type without one at the Preset sill', () => {
    const { store, place } = withHighWindow();
    expect(place(500).sill).toBe(1100);
    expect(place(3000, null).sill).toBe(store.model().project.presets.windowSill);
  });

  it('changes where new windows go, not the ones already placed', () => {
    const { store, type, place } = withHighWindow();
    const placed = place(500);
    expect(store.run(updateOpeningType, { type: type.id, sill: 1200 }).ok).toBe(true);
    expect(store.model().openingTypes[type.id]!.sill).toBe(1200);
    expect(store.model().openings[placed.id]!.sill).toBe(1100);
    expect(place(3000).sill).toBe(1200);
  });

  it('lets a placed window keep a sill of its own, in its own type', () => {
    const { store, type, place } = withHighWindow();
    const placed = place(500);
    store.run(updateOpening, { opening: placed.id, sill: 800 });
    expect(store.model().openings[placed.id]).toMatchObject({ sill: 800, type: type.id });
  });

  it('keeps the sill when one window is detached into a type of its own', () => {
    const { store, place } = withHighWindow();
    const placed = place(500);
    store.run(updateOpening, { opening: placed.id, width: 1000 });
    const detached = typeOf(store, store.model().openings[placed.id]!);
    expect(detached.name).toBe('Kitchen window (2)');
    expect(detached.sill).toBe(1100);
  });

  it('refuses a sill below the floor', () => {
    const { store, type } = withHighWindow();
    const before = store.model();
    const refused = store.run(updateOpeningType, { type: type.id, sill: -10 });
    expect(refused.ok).toBe(false);
    expect(store.model()).toBe(before);
  });
});
