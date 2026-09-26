import { addOpening } from '../commands/add-opening';
import { drawRoom } from '../commands/draw-room';
import { drawRoomSeparator } from '../commands/draw-room-separator';
import { drawWall } from '../commands/draw-wall';
import { updateRoom } from '../commands/update-room';
import { counterIds } from '../model/ids';
import { createProject } from '../model/new-project';
import type { LevelId, Vec, Wall } from '../model/types';
import { quantityRows, toCsv } from '../report/quantities';
import { ProjectStore } from '../store/project-store';
import { netWallArea } from './surfaces';

const BOM = String.fromCharCode(0xfeff);
const m2 = (mm2: number | null | undefined) => (mm2 == null ? null : Math.round(mm2 / 1e4) / 100);

function setup() {
  const ids = counterIds();
  const store = new ProjectStore(createProject({ name: 'T', levelName: 'Ground floor' }, ids), ids);
  const level = Object.keys(store.model().levels)[0] as LevelId;
  let n = 0;
  const roomName = () => `Room ${++n}`;
  const room = (name: string) => Object.values(store.model().rooms).find((r) => r.name === name)!;
  const values = (name: string) => store.values.room(room(name).id);
  const height = store.model().project.presets.roomHeight;
  return { store, level, room, values, height, roomName };
}

describe('Room surfaces and Quantities (ticket 12)', () => {
  it('gives a Room its volume, floor finish, ceiling and wall area from the Room height', () => {
    const { store, level, values, height } = setup();
    store.run(drawRoom, {
      level,
      from: { x: 0, y: 0 },
      to: { x: 2670, y: 3730 },
      size: 'inside',
      name: 'Keuken',
    });
    const k = values('Keuken');
    const floor = 2670 * 3730;
    expect(m2(k.netFloorArea())).toBe(m2(floor));
    expect(k.height()).toBe(height);
    expect(Math.round(k.volume()! / 1e6)).toBe(Math.round((floor * height) / 1e6));
    expect(k.floorFinishArea()).toBe(k.netFloorArea());
    expect(k.ceilingArea()).toBe(k.netFloorArea());
    const s = k.surfaces()!;
    expect(Math.round(s.wallLength)).toBe(2 * (2670 + 3730));
    expect(m2(netWallArea(s, 'exact'))).toBe(m2(2 * (2670 + 3730) * height));

    store.run(updateRoom, { room: k.room()!.id, height: 2500 });
    expect(m2(netWallArea(k.surfaces()!, 'exact'))).toBe(m2(2 * (2670 + 3730) * 2500));
  });

  it("stops Living's wall area at the Room separator to the Eetkamer", () => {
    const { store, level, values, height, roomName } = setup();
    const points: Vec[] = [
      { x: 0, y: -3570 },
      { x: 2650, y: -3570 },
      { x: 2650, y: 0 },
      { x: 3340, y: 0 },
      { x: 3340, y: 3320 },
      { x: 0, y: 3320 },
    ];
    points.forEach((p, i) =>
      store.run(drawWall, {
        level,
        start: p,
        end: points[(i + 1) % points.length]!,
        side: 'left',
        roomName,
      }),
    );
    store.run(drawRoomSeparator, {
      level,
      start: { x: 0, y: 0 },
      end: { x: 2650, y: 0 },
      roomName,
    });
    const [living, eetkamer] = Object.values(store.model().rooms)
      .map((r) => store.values.room(r.id))
      .sort((a, b) => b.netFloorArea()! - a.netFloorArea()!);
    // Living 3.34 × 3.32: its perimeter minus the 2.65 m separator.
    expect(Math.round(living!.surfaces()!.wallLength)).toBe(2 * (3340 + 3320) - 2650);
    expect(Math.round(eetkamer!.surfaces()!.wallLength)).toBe(2650 + 2 * 3570);
    expect(m2(netWallArea(living!.surfaces()!, 'exact'))).toBe(
      m2((2 * (3340 + 3320) - 2650) * height),
    );
    void values;
  });

  it('subtracts Openings only below the Ceiling, and Belgian masonry ignores those under 0.25 m²', () => {
    const { store, level, values, room } = setup();
    store.run(drawRoom, {
      level,
      from: { x: 0, y: 0 },
      to: { x: 4000, y: 3000 },
      size: 'inside',
      name: 'Bureau',
    });
    store.run(updateRoom, { room: room('Bureau').id, height: 2000 });
    const bottom = Object.values(store.model().walls).find(
      (w: Wall) => w.start.y === 3000 && w.end.y === 3000,
    )!;
    // A door 930 × 2115: only 2000 mm of it lies below the Ceiling.
    store.run(addOpening, { wall: bottom.id, kind: 'door', offset: 300 });
    // A small window 400 × 500 on a 900 mm sill: 0.20 m².
    store.run(addOpening, {
      wall: bottom.id,
      kind: 'window',
      offset: 2000,
      width: 400,
      height: 500,
      sill: 900,
    });
    const s = values('Bureau').surfaces()!;
    const gross = 2 * (4000 + 3000) * 2000;
    expect(m2(s.grossWallArea)).toBe(m2(gross));
    expect(m2(netWallArea(s, 'exact'))).toBe(m2(gross - 930 * 2000 - 400 * 500));
    expect(m2(netWallArea(s, 'belgianMasonry'))).toBe(m2(gross - 930 * 2000));
    // Reveals: the sides, head and (for windows) sill inside the wall thickness, shown separately.
    const t = 140;
    const expected = t * (2 * 2000 + 0) + t * (2 * 500 + 400 + 400);
    expect(m2(s.revealArea)).toBe(m2(expected));
  });

  it('shares the reveals of a door between the two Rooms it connects', () => {
    const { store, level, values } = setup();
    store.run(drawRoom, {
      level,
      from: { x: 0, y: 0 },
      to: { x: 3000, y: 3000 },
      size: 'inside',
      name: 'A',
    });
    store.run(drawRoom, {
      level,
      from: { x: 3140, y: 0 },
      to: { x: 6000, y: 3000 },
      size: 'inside',
      name: 'B',
    });
    const shared = Object.values(store.model().walls).find(
      (w) => Math.abs(w.start.x - w.end.x) < 1 && w.start.x > 2900 && w.start.x < 3200,
    )!;
    store.run(addOpening, { wall: shared.id, kind: 'door', offset: 500 });
    const a = values('A').surfaces()!;
    const b = values('B').surfaces()!;
    expect(a.openings).toHaveLength(1);
    expect(b.openings).toHaveLength(1);
    expect(Math.round(a.revealArea + b.revealArea)).toBe(Math.round(140 * (2 * 2115 + 930)));
  });

  it('lists every Room and Level and exports CSV in the UI language', () => {
    const { store, level } = setup();
    store.run(drawRoom, {
      level,
      from: { x: 0, y: 0 },
      to: { x: 2670, y: 3730 },
      size: 'inside',
      name: 'Keuken',
    });
    const rows = quantityRows(store.model(), store.values, 'exact');
    expect(rows.map((r) => r.kind)).toEqual(['room', 'level']);
    expect(m2(rows[0]!.netFloorArea)).toBe(9.96);

    const csv = toCsv(['Room', 'Net floor area (m²)'], [['Keuken', 9.9591]], {
      separator: ';',
      decimalComma: true,
    });
    expect(csv.startsWith(BOM)).toBe(true);
    expect(csv).toBe(BOM + 'Room;Net floor area (m²)\r\nKeuken;9,96\r\n');
    expect(toCsv(['a', 'b'], [['x, "y"', 1.5]], { separator: ',', decimalComma: false })).toBe(
      BOM + 'a,b\r\n"x, ""y""",1.50\r\n',
    );
  });

  it("measures a sill from the Level's finished floor, whatever a Room's own Floor build-up", () => {
    const { store, level, values, room } = setup();
    store.run(drawRoom, {
      level,
      from: { x: 0, y: 0 },
      to: { x: 4000, y: 3000 },
      size: 'inside',
      name: 'Bureau',
    });
    // 50 mm more build-up than the Preset, and a low Ceiling at 2.00 m above that floor.
    const p = store.model().project.presets;
    store.run(updateRoom, {
      room: room('Bureau').id,
      height: 2000,
      floorBuildUp: p.floorBuildUp + 50,
    });
    const bottom = Object.values(store.model().walls).find(
      (w: Wall) => w.start.y === 3000 && w.end.y === 3000,
    )!;
    store.run(addOpening, { wall: bottom.id, kind: 'window', offset: 1000 });
    const s = values('Bureau').surfaces()!;
    // The window runs from 900 to 2100 above the finished floor: 850 to 2050 above this Room's
    // floor, so 1150 mm of it lies below the Ceiling.
    expect(m2(s.openings[0]!.cut)).toBe(m2(1200 * 1150));
  });
});
