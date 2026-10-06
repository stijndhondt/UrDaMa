import { CURRENT_SCHEMA_VERSION, parseProject, serializeProject } from '../file/project-file';
import { buildingSolids } from '../geometry/solids';
import { counterIds } from '../model/ids';
import { createProject } from '../model/new-project';
import type { FloorOpeningId, LevelId, RoomId } from '../model/types';
import { ringArea } from '../geometry/vec';
import { ProjectStore } from '../store/project-store';
import { deleteElements } from './delete-elements';
import { drawFloorOpening, floorOpeningDirections, moveFloorOpening } from './floor-openings';
import { drawRoom } from './draw-room';
import { addLevel, deleteLevel } from './levels';

/** Two Levels, each with one 4 × 3 m Room at the same place. */
function twoLevels() {
  const ids = counterIds();
  const store = new ProjectStore(
    createProject({ name: 'Test', levelName: 'Gelijkvloers' }, ids),
    ids,
  );
  const ground = Object.keys(store.model().levels)[0] as LevelId;
  const added = store.run(addLevel, { relativeTo: ground, position: 'above', name: 'Verdieping' });
  if (!added.ok) throw new Error(added.reason.key);
  const first = Object.values(store.model().levels).find((l) => l.id !== ground)!.id;
  const room = (level: LevelId, name: string): RoomId => {
    const r = store.run(drawRoom, {
      level,
      from: { x: 0, y: 0 },
      to: { x: 4000, y: 3000 },
      size: 'inside',
      name,
    });
    if (!r.ok) throw new Error(r.reason.key);
    return Object.values(store.model().rooms).find((x) => x.name === name)!.id;
  };
  const living = room(ground, 'Living');
  const bedroom = room(first, 'Slaapkamer');
  return { store, ground, first, living, bedroom };
}

/** A rectangle's outline between two opposite corners */
const rect = (x0: number, y0: number, x1: number, y1: number) => [
  { x: x0, y: y0 },
  { x: x1, y: y0 },
  { x: x1, y: y1 },
  { x: x0, y: y1 },
];

/** A 1 × 1 m Floor opening (for a stair) inside both Rooms */
const square = { outline: rect(1000, 500, 2000, 1500) };

describe('Floor openings: holes for a stair or a lift through the Slab between two Levels', () => {
  it('drawn on the ground floor going up, it is a hole in the floor above: the bedroom loses 1 m² of floor finish, the living 1 m² of ceiling', () => {
    const { store, ground, first, living, bedroom } = twoLevels();
    const net = store.values.room(bedroom).netFloorArea()!;
    const slab = store.values.slab(first).area();
    const r = store.run(drawFloorOpening, { level: ground, ...square, direction: 'up' });
    expect(r.ok).toBe(true);

    const opening = Object.values(store.model().floorOpenings)[0]!;
    expect(opening.level).toBe(first);
    // The Room keeps its measured size; its floor finish and the Ceiling below lose the hole.
    expect(store.values.room(bedroom).netFloorArea()).toBe(net);
    expect(store.values.room(bedroom).floorFinishArea()).toBeCloseTo(net - 1e6, 0);
    expect(store.values.room(living).ceilingArea()).toBeCloseTo(net - 1e6, 0);
    expect(store.values.room(living).floorFinishArea()).toBe(net);
    expect(store.values.room(bedroom).ceilingArea()).toBe(net);
    expect(store.values.slab(first).area()).toBeCloseTo(slab - 1e6, 0);
  });

  it('drawn on the floor above going down, it is the same hole', () => {
    const { store, first } = twoLevels();
    expect(store.run(drawFloorOpening, { level: first, ...square, direction: 'down' }).ok).toBe(
      true,
    );
    expect(Object.values(store.model().floorOpenings)[0]!.level).toBe(first);
  });

  it('connects only Levels that exist: no Level above the top one, none below the lowest', () => {
    const { store, ground, first } = twoLevels();
    expect(floorOpeningDirections(store.model(), ground)).toEqual(['up']);
    expect(floorOpeningDirections(store.model(), first)).toEqual(['down']);
    const up = store.run(drawFloorOpening, { level: first, ...square, direction: 'up' });
    expect(!up.ok && up.reason.key).toBe('commands.floorOpening.noLevelAbove');
    const down = store.run(drawFloorOpening, { level: ground, ...square, direction: 'down' });
    expect(!down.ok && down.reason.key).toBe('commands.floorOpening.noLevelBelow');
  });

  it('is at least 100 mm each way', () => {
    const { store, ground } = twoLevels();
    const r = store.run(drawFloorOpening, {
      level: ground,
      outline: rect(0, 0, 50, 900),
      direction: 'up',
    });
    expect(!r.ok && r.reason.key).toBe('commands.floorOpening.tooSmall');
  });

  it('is a hole in the Slab and the Floor build-up in 3D', () => {
    const { store, ground, first } = twoLevels();
    store.run(drawFloorOpening, { level: ground, ...square, direction: 'up' });
    const solids = buildingSolids(store.model(), store.values).solids;
    const slab = solids.find((s) => s.kind === 'slab' && s.level === first)!;
    expect(slab.body.rings).toHaveLength(2);
    const buildUp = solids.find((s) => s.kind === 'floorBuildUp' && s.level === first)!;
    expect(buildUp.body.rings).toHaveLength(2);
    const below = solids.find((s) => s.kind === 'slab' && s.level === ground)!;
    expect(below.body.rings).toHaveLength(1);
  });

  it('reaching past the Room into its Wall, it is clipped to the Slab and the Floor build-up it cuts', () => {
    const { store, ground, first } = twoLevels();
    store.run(drawFloorOpening, {
      level: ground,
      outline: rect(3500, 500, 4500, 1500),
      direction: 'up',
    });
    const solids = buildingSolids(store.model(), store.values).solids;
    const xs = (ring: readonly { x: number }[]) => ring.map((p) => p.x);
    const slab = solids.find((s) => s.kind === 'slab' && s.level === first)!;
    expect(slab.body.rings).toHaveLength(2);
    expect(Math.max(...xs(slab.body.rings[1]!))).toBeCloseTo(4140, 6);
    const buildUp = solids.find((s) => s.kind === 'floorBuildUp' && s.level === first)!;
    expect(Math.max(...xs(buildUp.body.rings[1]!))).toBeCloseTo(4000, 6);
  });

  it('is deleted with the Delete key, and with either Level it connects', () => {
    for (const which of ['element', 'ground', 'first'] as const) {
      const { store, ground, first } = twoLevels();
      store.run(drawFloorOpening, { level: ground, ...square, direction: 'up' });
      const id = Object.keys(store.model().floorOpenings)[0] as FloorOpeningId;
      const r =
        which === 'element'
          ? store.run(deleteElements, { walls: [], rooms: [], floorOpenings: [id] })
          : store.run(deleteLevel, { level: which === 'ground' ? ground : first });
      expect(r.ok).toBe(true);
      expect(store.model().floorOpenings[id]).toBeUndefined();
    }
  });

  it('takes any outline, such as an L or a turned rectangle', () => {
    const { store, ground, first, bedroom } = twoLevels();
    const net = store.values.room(bedroom).netFloorArea()!;
    // An L: 2 × 1 m with a 1 × 1 m leg (3 m²)
    const l = [
      { x: 500, y: 500 },
      { x: 2500, y: 500 },
      { x: 2500, y: 1500 },
      { x: 1500, y: 1500 },
      { x: 1500, y: 2500 },
      { x: 500, y: 2500 },
    ];
    expect(store.run(drawFloorOpening, { level: ground, outline: l, direction: 'up' }).ok).toBe(
      true,
    );
    expect(store.values.room(bedroom).floorFinishArea()).toBeCloseTo(net - 3e6, 0);
    // A 1 × 1 m square turned 45°
    const turned = [
      { x: 3000, y: 800 },
      { x: 3500, y: 1300 },
      { x: 3000, y: 1800 },
      { x: 2500, y: 1300 },
    ];
    expect(Math.abs(ringArea(turned))).toBeCloseTo(0.5e6, 0);
    expect(
      store.run(drawFloorOpening, { level: first, outline: turned, direction: 'down' }).ok,
    ).toBe(true);
  });

  it('refuses an outline that crosses itself', () => {
    const { store, ground } = twoLevels();
    const bow = [
      { x: 0, y: 0 },
      { x: 1000, y: 1000 },
      { x: 1000, y: 0 },
      { x: 0, y: 1000 },
    ];
    const r = store.run(drawFloorOpening, { level: ground, outline: bow, direction: 'up' });
    expect(!r.ok && r.reason.key).toBe('commands.floorOpening.crossesItself');
  });

  it('keeps the two Levels it connects: a Level added between them is crossed, with a warning until a Room there contains it', () => {
    const { store, ground, first } = twoLevels();
    store.run(drawFloorOpening, { level: ground, ...square, direction: 'up' });
    const added = store.run(addLevel, { relativeTo: ground, position: 'above', name: 'Tussen' });
    expect(added.ok).toBe(true);
    const between = Object.values(store.model().levels).find((l) => l.name === 'Tussen')!.id;
    const opening = Object.values(store.model().floorOpenings)[0]!;
    expect(opening.below).toBe(ground);
    expect(opening.level).toBe(first);
    const crossed = () =>
      store.values
        .level(between)
        .warnings()
        .some((w) => w.key === 'warnings.floorOpeningCrossesLevel');
    expect(crossed()).toBe(true);
    // It goes through the floor of the Level in between too.
    const slab = buildingSolids(store.model(), store.values).solids.find(
      (s) => s.kind === 'slab' && s.level === between,
    );
    expect(slab).toBeUndefined(); // no Walls there yet: no Slab outline
    expect(
      store.run(drawRoom, {
        level: between,
        from: { x: 0, y: 0 },
        to: { x: 4000, y: 3000 },
        size: 'inside',
        name: 'Overloop',
      }).ok,
    ).toBe(true);
    expect(crossed()).toBe(false);
    const holes = buildingSolids(store.model(), store.values).solids.find(
      (s) => s.kind === 'slab' && s.level === between,
    )!;
    expect(holes.body.rings).toHaveLength(2);
  });

  it('files of schema 4 get the Level below each Floor opening', () => {
    const { store, ground } = twoLevels();
    store.run(drawFloorOpening, { level: ground, ...square, direction: 'up' });
    const doc = JSON.parse(serializeProject(store.model())) as {
      schemaVersion: number;
      floorOpenings: Record<string, unknown>[];
    };
    doc.schemaVersion = 4;
    for (const f of doc.floorOpenings) delete f['below'];
    const old = parseProject(JSON.stringify(doc));
    expect(old.ok && Object.values(old.model.floorOpenings)[0]!.below).toBe(ground);
  });

  it('is kept in the project file; files from before Floor openings open with none', () => {
    const { store, ground } = twoLevels();
    store.run(drawFloorOpening, { level: ground, ...square, direction: 'up' });
    const reopened = parseProject(serializeProject(store.model()));
    expect(reopened.ok && reopened.model.floorOpenings).toEqual(store.model().floorOpenings);

    const doc = JSON.parse(serializeProject(store.model())) as Record<string, unknown>;
    delete doc['floorOpenings'];
    doc['schemaVersion'] = 3;
    const old = parseProject(JSON.stringify(doc));
    expect(old.ok && old.model.floorOpenings).toEqual({});
    expect(CURRENT_SCHEMA_VERSION).toBe(5);
  });

  it('moves as a whole by dragging, as one undo step, still a hole of the same size', () => {
    const { store, ground, bedroom } = twoLevels();
    store.run(drawFloorOpening, { level: ground, ...square, direction: 'up' });
    const id = Object.keys(store.model().floorOpenings)[0] as FloorOpeningId;
    const net = store.values.room(bedroom).netFloorArea()!;
    expect(store.run(moveFloorOpening, { floorOpening: id, by: { x: 1500, y: 500 } }).ok).toBe(
      true,
    );
    expect(store.model().floorOpenings[id]!.outline).toEqual(rect(2500, 1000, 3500, 2000));
    expect(store.values.room(bedroom).floorFinishArea()).toBeCloseTo(net - 1e6, 0);
    store.undo();
    expect(store.model().floorOpenings[id]!.outline).toEqual(square.outline);
  });

  it('refuses a move of nothing, and of a Floor opening that does not exist', () => {
    const { store, ground } = twoLevels();
    store.run(drawFloorOpening, { level: ground, ...square, direction: 'up' });
    const id = Object.keys(store.model().floorOpenings)[0] as FloorOpeningId;
    const still = store.run(moveFloorOpening, { floorOpening: id, by: { x: 0, y: 0 } });
    expect(!still.ok && still.reason.key).toBe('commands.floorOpening.nothing');
    const gone = store.run(moveFloorOpening, {
      floorOpening: 'flo_none' as FloorOpeningId,
      by: { x: 100, y: 0 },
    });
    expect(gone.ok).toBe(false);
  });
});
