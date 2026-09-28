import { readFileSync } from 'node:fs';
import { parseProject, serializeProject } from '../file/project-file';
import { counterIds } from '../model/ids';
import { createProject } from '../model/new-project';
import { BUILT_IN_FAMILIES, resolveOpening } from '../model/opening-types';
import type { LevelId, OpeningTypeId, Wall } from '../model/types';
import { ProjectStore } from '../store/project-store';
import { faceNetArea } from '../values/surfaces';
import { addOpening } from './add-opening';
import { drawRoom } from './draw-room';

function garage() {
  const ids = counterIds();
  const store = new ProjectStore(createProject({ name: 'T', levelName: 'Ground floor' }, ids), ids);
  const level = Object.keys(store.model().levels)[0] as LevelId;
  store.run(drawRoom, {
    level,
    from: { x: 0, y: 0 },
    to: { x: 6000, y: 3000 },
    size: 'inside',
    name: 'Garage',
  });
  const bottom = Object.values(store.model().walls).find(
    (w: Wall) => w.start.y === 3000 && w.end.y === 3000,
  )!;
  const room = Object.values(store.model().rooms)[0]!;
  const face = () =>
    store.values
      .room(room.id)
      .surfaces()!
      .faces.find((f) => f.wall === bottom.id)!;
  return { store, bottom, face };
}

describe('wall openings and garage doors (ticket 17)', () => {
  it('gives every new project built-in wall opening and garage door families', () => {
    const model = createProject({ name: 'T', levelName: 'Ground floor' }, counterIds());
    const kinds = Object.values(model.openingFamilies).map((f) => f.kind);
    expect(kinds).toEqual(['door', 'window', 'wallOpening', 'garageDoor']);
    expect(Object.values(model.openingTypes)).toHaveLength(4);
  });

  it('places a wall opening that cuts its Wall and counts in the net face area and reveals', () => {
    const { store, bottom, face } = garage();
    const before = face();
    const result = store.run(addOpening, { wall: bottom.id, kind: 'wallOpening', offset: 500 });
    expect(result.ok).toBe(true);
    const o = resolveOpening(store.model(), Object.values(store.model().openings)[0]!)!;
    expect(o.kind).toBe('wallOpening');
    expect(o.sill).toBe(0);
    const after = face();
    expect(Math.round(faceNetArea(after, 'exact'))).toBe(
      Math.round(faceNetArea(before, 'exact') - o.width * Math.min(o.height, after.height)),
    );
    // Sides and head inside the 140 mm Wall; no sill on the floor.
    expect(Math.round(after.revealArea)).toBe(Math.round(140 * (2 * o.height + o.width)));
  });

  it('places a garage door, and a chosen Opening type with its sizes', () => {
    const { store, bottom, face } = garage();
    const garageType = Object.values(store.model().openingTypes).find(
      (t) => t.family === BUILT_IN_FAMILIES.garageDoor,
    )!;
    const result = store.run(addOpening, {
      wall: bottom.id,
      kind: 'garageDoor',
      type: garageType.id as OpeningTypeId,
      offset: 1000,
    });
    expect(result.ok).toBe(true);
    const o = resolveOpening(store.model(), Object.values(store.model().openings)[0]!)!;
    expect(o).toMatchObject({ kind: 'garageDoor', width: garageType.width, sill: 0 });
    expect(o.type).toBe(garageType.id);
    expect(face().openings.map((c) => c.opening)).toEqual([o.id]);
  });

  it('adds the new families to a schema 2 file on open, keeping its doors', () => {
    const v2 = readFileSync(
      new URL('../file/fixtures/v2-house.lakudemis.json', import.meta.url),
      'utf8',
    );
    const opened = parseProject(v2);
    expect(opened.ok).toBe(true);
    if (!opened.ok) return;
    const kinds = Object.values(opened.model.openingFamilies)
      .map((f) => f.kind)
      .sort();
    expect(kinds).toEqual(['door', 'garageDoor', 'wallOpening', 'window']);
    const [door] = Object.values(opened.model.openings);
    expect(resolveOpening(opened.model, door!)).toMatchObject({ kind: 'door', width: 930 });
    const again = parseProject(serializeProject(opened.model));
    expect(again.ok && serializeProject(again.model)).toBe(serializeProject(opened.model));
  });
});
