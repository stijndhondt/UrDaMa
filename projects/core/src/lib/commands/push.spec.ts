import { counterIds } from '../model/ids';
import { createProject } from '../model/new-project';
import type { LevelId } from '../model/types';
import { ProjectStore } from '../store/project-store';
import { drawRoom } from './draw-room';
import { resizeRoom } from './resize-room';
import { setPresets } from './set-presets';
import { setWallThickness } from './set-wall-thickness';

const m2 = (mm2: number | null | undefined) => (mm2 == null ? null : Math.round(mm2 / 1e4) / 100);

/** The reference house ground floor, drawn with the Room tool at its tape sizes. */
function referenceHouse() {
  const ids = counterIds();
  const store = new ProjectStore(
    createProject({ name: 'Thuis', levelName: 'Gelijkvloers' }, ids),
    ids,
  );
  const level = Object.keys(store.model().levels)[0] as LevelId;
  const draw = (name: string, x0: number, y0: number, x1: number, y1: number) => {
    const r = store.run(drawRoom, {
      level,
      from: { x: x0, y: y0 },
      to: { x: x1, y: y1 },
      size: 'inside',
      name,
    });
    if (!r.ok) throw new Error(`${name}: ${r.reason.key}`);
  };
  draw('Keuken', 0, 0, 2670, 3730);
  draw('Achterhal', 0, -140 - 3940, 2670, -140);
  draw('Badkamer', 0, -280 - 3940 - 1910, 2950, -280 - 3940);
  draw('Berging', 0, -420 - 3940 - 1910 - 1940, 3010, -420 - 3940 - 1910);
  draw('Eetkamer', 0, 3730 + 140, 2650, 3730 + 140 + 3570);
  draw('Living', 0, 3730 + 280 + 3570, 3340, 3730 + 280 + 3570 + 3320);
  const room = (name: string) => Object.values(store.model().rooms).find((r) => r.name === name)!;
  const areas = () =>
    Object.fromEntries(
      Object.values(store.model().rooms).map((r) => [
        r.name,
        m2(store.values.room(r.id).netFloorArea()),
      ]),
    );
  return { store, level, room, areas };
}

describe('thickness, Presets and push (ticket 09)', () => {
  it('thickens the Wall between two Rooms and pushes what is behind it, so no Room changes size', () => {
    const { store, areas, room } = referenceHouse();
    const before = areas();
    const shared = Object.values(store.model().walls).find(
      (w) => w.start.y === 0 && w.end.y === 0,
    )!; // Keuken top
    const seedBefore = room('Achterhal').seed;
    const result = store.run(setWallThickness, { wall: shared.id, thickness: 190 });
    expect(result.ok).toBe(true);
    expect(areas()).toEqual(before);
    expect(store.model().walls[shared.id]!.thickness).toBe(190);
    expect(room('Achterhal').seed.y).toBeCloseTo(seedBefore.y - 50, 6);
  });

  it('resets a Wall to follow the Preset again', () => {
    const { store, areas } = referenceHouse();
    const before = areas();
    const shared = Object.values(store.model().walls).find(
      (w) => w.start.y === 0 && w.end.y === 0,
    )!;
    store.run(setWallThickness, { wall: shared.id, thickness: 190 });
    store.run(setWallThickness, { wall: shared.id, thickness: null });
    expect(store.model().walls[shared.id]!.thickness).toBeUndefined();
    expect(areas()).toEqual(before);
  });

  it('changes the wall-thickness Preset for every Wall that follows it, keeping all Room sizes', () => {
    const { store, areas } = referenceHouse();
    const before = areas();
    const result = store.run(setPresets, { wallThickness: 190 });
    expect(result.ok).toBe(true);
    expect(store.model().project.presets.wallThickness).toBe(190);
    expect(Object.values(store.model().walls).every((w) => w.thickness === undefined)).toBe(true);
    expect(areas()).toEqual(before);
  });

  it('resizes a Room by its typed inside width: Keuken 2.67 → 2.70 m, every other Room keeps its size', () => {
    const { store, areas, room } = referenceHouse();
    const before = areas();
    const result = store.run(resizeRoom, {
      room: room('Keuken').id,
      axis: 'x',
      size: 2700,
      side: 'max',
    });
    expect(result.ok).toBe(true);
    // The push works here, so it isn't the fallback of ticket 36.
    expect(result.ok && result.patch.label.key).toBe('commands.resizeRoom.label');
    const after = areas();
    expect(after['Keuken']).toBe(10.07);
    for (const name of Object.keys(before))
      if (name !== 'Keuken') expect(after[name]).toBe(before[name]);
  });

  it('can move the other side instead', () => {
    const { store, areas, room } = referenceHouse();
    const result = store.run(resizeRoom, {
      room: room('Eetkamer').id,
      axis: 'y',
      size: 3600,
      side: 'min',
    });
    expect(result.ok).toBe(true);
    expect(areas()['Eetkamer']).toBe(m2(2650 * 3600));
  });

  it('refuses to resize a Room that is not a rectangle', () => {
    const { store, room } = referenceHouse();
    store.run(drawRoom, {
      level: room('Keuken').level,
      from: { x: 0, y: -4080 },
      to: { x: 1120, y: -3080 },
      size: 'inside',
      name: 'WC',
    });
    const result = store.run(resizeRoom, {
      room: room('Achterhal').id,
      axis: 'x',
      size: 3000,
      side: 'max',
    });
    expect(!result.ok && result.reason.key).toBe('commands.resizeRoom.notRectangular');
  });
});
