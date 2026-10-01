import { addOpening } from '../commands/add-opening';
import { drawRoom } from '../commands/draw-room';
import { drawRoomSeparator } from '../commands/draw-room-separator';
import { drawWall } from '../commands/draw-wall';
import { updateRoom } from '../commands/update-room';
import { counterIds } from '../model/ids';
import { createProject } from '../model/new-project';
import type { LevelId, Vec, Wall } from '../model/types';
import { ProjectStore } from '../store/project-store';
import { faceNetArea, netWallArea, type MeasurementRule } from './surfaces';

function setup() {
  const ids = counterIds();
  const store = new ProjectStore(createProject({ name: 'T', levelName: 'Ground floor' }, ids), ids);
  const level = Object.keys(store.model().levels)[0] as LevelId;
  let n = 0;
  const roomName = () => `Room ${++n}`;
  return { store, level, roomName };
}

const sum = (xs: readonly number[]) => xs.reduce((a, b) => a + b, 0);

describe("a Room's Wall faces (ticket 12)", () => {
  it("stops Living's Wall faces at the Room separator to the Eetkamer", () => {
    const { store, level, roomName } = setup();
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
    const faces = living!.surfaces()!.faces;
    // 0.69 m beside the Eetkamer, 3.32 m on each side, 3.34 m along the bottom: nothing along the
    // separator.
    expect(faces.map((f) => Math.round(f.length)).sort((a, b) => a - b)).toEqual([
      690, 3320, 3320, 3340,
    ]);
    expect(Math.round(sum(faces.map((f) => f.length)))).toBe(
      Math.round(living!.surfaces()!.wallLength),
    );
    // The long left Wall is shared: 3.32 m of it faces the Living, 3.57 m the Eetkamer.
    const left = Object.values(store.model().walls).find((w) => w.start.x === 0 && w.end.x === 0)!;
    const onLeft = (r: typeof living) =>
      r!
        .surfaces()!
        .faces.filter((f) => f.wall === left.id)
        .map((f) => Math.round(f.length));
    expect(onLeft(living)).toEqual([3320]);
    expect(onLeft(eetkamer)).toEqual([3570]);
  });

  it("adds up to the Room's net wall area and reveals, under both Measurement rules", () => {
    const { store, level } = setup();
    store.run(drawRoom, {
      level,
      from: { x: 0, y: 0 },
      to: { x: 4000, y: 3000 },
      size: 'inside',
      name: 'Bureau',
    });
    const room = Object.values(store.model().rooms)[0]!;
    store.run(updateRoom, { room: room.id, height: 2000 });
    const bottom = Object.values(store.model().walls).find(
      (w: Wall) => w.start.y === 3000 && w.end.y === 3000,
    )!;
    store.run(addOpening, { wall: bottom.id, kind: 'door', offset: 300 });
    store.run(addOpening, {
      wall: bottom.id,
      kind: 'window',
      offset: 2000,
      width: 400,
      height: 500,
      sill: 900,
    });
    const s = store.values.room(room.id).surfaces()!;
    expect(s.faces).toHaveLength(4);
    for (const rule of ['exact', 'belgianMasonry'] as MeasurementRule[])
      expect(Math.round(sum(s.faces.map((f) => faceNetArea(f, rule))))).toBe(
        Math.round(netWallArea(s, rule)),
      );
    expect(Math.round(sum(s.faces.map((f) => f.revealArea)))).toBe(Math.round(s.revealArea));
    // Both Openings are in the bottom Wall's face, 4.00 m long and 2.00 m high.
    const face = s.faces.find((f) => f.wall === bottom.id)!;
    expect(face.openings.map((o) => o.opening)).toHaveLength(2);
    expect(Math.round(face.length)).toBe(4000);
    expect(face.height).toBe(2000);
    expect(face.gross).toBe(face.length * 2000);
  });

  it('counts the reveals of an Opening in a Wall stub once, though both its faces bound the Room', () => {
    const { store, level, roomName } = setup();
    store.run(drawRoom, {
      level,
      from: { x: 0, y: 0 },
      to: { x: 6000, y: 4000 },
      size: 'inside',
      name: 'Hall',
    });
    store.run(drawWall, {
      level,
      start: { x: 3000, y: 0 },
      end: { x: 3000, y: 2500 },
      side: 'left',
      roomName,
    });
    const stub = Object.values(store.model().walls).find(
      (w: Wall) => w.start.x === 3000 && w.end.x === 3000,
    )!;
    store.run(addOpening, { wall: stub.id, kind: 'wallOpening', offset: 800 });
    const rooms = Object.values(store.model().rooms);
    expect(rooms).toHaveLength(1);
    const s = store.values.room(rooms[0]!.id).surfaces()!;
    const o = Object.values(store.model().openings)[0]!;
    const type = store.model().openingTypes[o.type]!;
    // Both its faces and its free end bound the Room.
    const faces = s.faces.filter((f) => f.wall === stub.id);
    expect(faces.map((f) => f.face)).toEqual(['drawn', 'other', 'end']);
    expect(Math.round(faces[2]!.length)).toBe(
      stub.thickness ?? store.model().project.presets.wallThickness,
    );
    // Sides and head through the Wall's thickness, once.
    expect(Math.round(s.revealArea)).toBe(
      Math.round(
        (stub.thickness ?? store.model().project.presets.wallThickness) *
          (2 * type.height + type.width),
      ),
    );
  });
});
