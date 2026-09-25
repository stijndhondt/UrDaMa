import { addRoom } from '../commands/add-room';
import { drawRoom, type DrawRoomArgs } from '../commands/draw-room';
import { wallOutlines } from '../geometry/wall-outlines';
import { counterIds } from '../model/ids';
import { createProject } from '../model/new-project';
import type { LevelId, Model, RoomId } from '../model/types';
import { ProjectStore } from './project-store';
import {
  Clipper64,
  ClipType,
  FillRule,
  PolyTree64,
  area as pathArea,
  isPositive,
} from 'clipper2-ts';

const m2 = (mm2: number | null | undefined) => (mm2 == null ? null : Math.round(mm2 / 1e4) / 100);

function setup() {
  const ids = counterIds();
  const model = createProject({ name: 'Thuis', levelName: 'Ground floor' }, ids);
  const store = new ProjectStore(model, ids);
  const level = Object.keys(model.levels)[0] as LevelId;
  const draw = (name: string, x0: number, y0: number, x1: number, y1: number) => {
    const args: DrawRoomArgs = {
      level,
      from: { x: x0, y: y0 },
      to: { x: x1, y: y1 },
      size: 'inside',
      name,
    };
    const result = store.run(drawRoom, args);
    if (!result.ok) throw new Error(`${name}: ${result.reason.key}`);
  };
  const area = (name: string) => {
    const room = Object.values(store.model().rooms).find((r) => r.name === name)!;
    return m2(store.values.room(room.id).netFloorArea());
  };
  return { store, level, draw, area };
}

/** No two Walls may overlap: the union of all outlines has the same area as their sum. */
function wallsOverlap(model: Model): boolean {
  const outlines = [
    ...wallOutlines(Object.values(model.walls), Object.values(model.wallConnections), 140).values(),
  ];
  const paths = outlines.map((o) => {
    const p = o.map((v) => ({ x: Math.round(v.x * 1000), y: Math.round(v.y * 1000) }));
    return isPositive(p) ? p : p.reverse();
  });
  const sum = paths.reduce((s, p) => s + Math.abs(pathArea(p)), 0);
  const tree = new PolyTree64();
  const c = new Clipper64();
  c.addSubject(paths);
  const out: { x: number; y: number }[][] = [];
  c.execute(ClipType.Union, FillRule.NonZero, out);
  const union = out.reduce((s, p) => s + pathArea(p), 0);
  void tree;
  return Math.abs(sum - union) / 1e6 > 1; // more than 1 mm² of overlap
}

describe('Rooms side by side (ticket 04)', () => {
  it('reuses an existing Wall when a Room starts on its far face', () => {
    const { store, draw, area } = setup();
    draw('Keuken', 0, 0, 2670, 3730);
    draw('Achterhal', 0, -140 - 3940, 2670, -140); // behind the Keuken, against its top Wall
    expect(Object.keys(store.model().walls)).toHaveLength(7);
    expect(
      Object.values(store.model().wallConnections).filter((c) => c.kind === 'tee'),
    ).toHaveLength(2);
    expect(area('Keuken')).toBe(9.96);
    expect(area('Achterhal')).toBe(10.52);
    expect(wallsOverlap(store.model())).toBe(false);
  });

  it('creates Walls only for the uncovered part of a partly shared edge', () => {
    const { store, draw, area } = setup();
    draw('Achterhal', 0, 0, 2670, 3940);
    draw('Badkamer', 0, -140 - 1910, 2950, -140); // wider than the Achterhal behind it
    expect(area('Achterhal')).toBe(10.52);
    expect(area('Badkamer')).toBe(5.63);
    expect(wallsOverlap(store.model())).toBe(false);
  });

  it('moves the Seed point of a Room that a new Room covers to its largest remaining piece', () => {
    const { store, draw, area } = setup();
    draw('Achterhal', 0, 0, 2670, 3940);
    draw('WC', 0, 1500, 1500, 2500); // against the left Wall, over the Achterhal's centre (1335, 1970)
    const hal = Object.values(store.model().rooms).find((r) => r.name === 'Achterhal')!;
    expect(store.values.room(hal.id).detection()?.status).toBe('enclosed');
    expect(area('WC')).toBe(1.5);
    expect(area('Achterhal')).toBe(m2(2670 * 3940 - (1500 + 140) * (1000 + 280)));
  });

  it('turns an enclosed area without a Room into a Room on request', () => {
    const { store, level, draw } = setup();
    draw('Keuken', 0, 0, 2670, 3730);
    const keuken = Object.values(store.model().rooms)[0]!;
    // Remove the Room but keep its Walls: an enclosed area with no Room.
    const { [keuken.id]: _removed, ...rooms } = store.model().rooms;
    store.replace({ ...store.model(), rooms, ceilings: {} });
    expect(store.values.level(level).footprint().areas[0]!.rooms).toHaveLength(0);

    const result = store.run(addRoom, { level, seed: { x: 1000, y: 1000 }, name: 'Keuken' });
    expect(result.ok).toBe(true);
    const room = Object.values(store.model().rooms)[0]!;
    expect(m2(store.values.room(room.id as RoomId).netFloorArea())).toBe(9.96);
    expect(store.run(addRoom, { level, seed: { x: 1500, y: 1500 }, name: 'Twice' }).ok).toBe(false);
  });

  it('draws the reference house ground floor at exactly its tape sizes (fixture)', () => {
    const { store, draw, area } = setup();
    // Rear extension, front to back: Keuken, Achterhal, Badkamer, Berging; the WC inside the Achterhal.
    draw('Keuken', 0, 0, 2670, 3730);
    draw('Achterhal', 0, -140 - 3940, 2670, -140);
    draw('Badkamer', 0, -280 - 3940 - 1910, 2950, -280 - 3940);
    draw('Berging', 0, -420 - 3940 - 1910 - 1940, 3010, -420 - 3940 - 1910);
    draw('WC', 0, -140 - 3940, 1120, -140 - 3940 + 1000);
    // Front block, in front of the Keuken: Eetkamer, then Living.
    draw('Eetkamer', 0, 3730 + 140, 2650, 3730 + 140 + 3570);
    draw('Living', 0, 3730 + 280 + 3570, 3340, 3730 + 280 + 3570 + 3320);

    expect(area('Keuken')).toBe(9.96);
    expect(area('Badkamer')).toBe(5.63);
    expect(area('Berging')).toBe(5.84);
    expect(area('Eetkamer')).toBe(9.46);
    expect(area('Living')).toBe(11.09);
    expect(area('WC')).toBe(1.12);
    expect(wallsOverlap(store.model())).toBe(false);
  });
});
