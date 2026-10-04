import { readFileSync } from 'node:fs';
import { addOpening } from '../commands/add-opening';
import { drawRoom } from '../commands/draw-room';
import { updateOpening } from '../commands/update-opening';
import { counterIds } from '../model/ids';
import { createProject } from '../model/new-project';
import { BUILT_IN_FAMILIES, resolveOpening } from '../model/opening-types';
import type { LevelId, Model, Wall, WallId } from '../model/types';
import { ProjectStore } from '../store/project-store';
import { CURRENT_SCHEMA_VERSION, MIGRATIONS, parseProject, serializeProject } from './project-file';

function drawnHouse(): Model {
  const ids = counterIds();
  const store = new ProjectStore(
    createProject({ name: 'Thuis', levelName: 'Gelijkvloers' }, ids),
    ids,
  );
  const level = Object.keys(store.model().levels)[0] as LevelId;
  store.run(drawRoom, {
    level,
    from: { x: 0, y: 0 },
    to: { x: 2670, y: 3730 },
    size: 'inside',
    name: 'Keuken',
  });
  store.run(drawRoom, {
    level,
    from: { x: 0, y: -140 - 3940 },
    to: { x: 2670, y: -140 },
    size: 'inside',
    name: 'Achterhal',
  });
  const bottom = Object.values(store.model().walls).find(
    (w) => w.start.y === 3730 && w.end.y === 3730,
  )!;
  store.run(addOpening, { wall: bottom.id, kind: 'door', offset: 580 });
  store.run(addOpening, { wall: bottom.id, kind: 'window', offset: 1600, width: 600 });
  const door = Object.values(store.model().openings)[0]!;
  store.run(updateOpening, { opening: door.id, width: 830 });
  return store.model();
}

describe('project file (ADR 0004)', () => {
  it('saves, opens and saves again byte-identically', () => {
    const text = serializeProject(drawnHouse());
    const opened = parseProject(text);
    expect(opened.ok).toBe(true);
    expect(opened.ok && serializeProject(opened.model)).toBe(text);
  });

  it('opens to the same model it saved', () => {
    const model = drawnHouse();
    const opened = parseProject(serializeProject(model));
    expect(opened.ok && opened.model).toEqual(model);
  });

  it('writes a header, sorted collections and a trailing newline', () => {
    const text = serializeProject(drawnHouse());
    const doc = JSON.parse(text);
    expect(Object.keys(doc).slice(0, 4)).toEqual(['format', 'schemaVersion', 'units', 'project']);
    expect(doc.format).toBe('urdama');
    expect(doc.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(doc.units).toEqual({ length: 'mm' });
    const ids = doc.walls.map((w: { id: string }) => w.id);
    expect(ids).toEqual([...ids].sort());
    expect(text.endsWith('}\n')).toBe(true);
    expect(text).toContain('\n  "walls": [\n');
  });

  it('does not depend on the order elements were created in', () => {
    const model = drawnHouse();
    const reversed = { ...model, walls: Object.fromEntries(Object.entries(model.walls).reverse()) };
    expect(serializeProject(reversed)).toBe(serializeProject(model));
  });

  it('rounds lengths to 0.001 mm and omits values that follow a Preset', () => {
    const model = drawnHouse();
    const [id, wall] = Object.entries(model.walls)[0]!;
    const noisy: Wall = {
      ...wall,
      start: { x: wall.start.x + 1e-9, y: wall.start.y },
      thickness: 190.00049,
    };
    const text = serializeProject({ ...model, walls: { ...model.walls, [id as WallId]: noisy } });
    const saved = JSON.parse(text).walls.find((w: { id: string }) => w.id === id);
    expect(saved.start.x).toBe(wall.start.x);
    expect(saved.thickness).toBe(190);
    const other = JSON.parse(text).walls.find((w: { id: string }) => w.id !== id);
    expect('thickness' in other).toBe(false);
    expect('height' in other).toBe(false);
  });

  it('holds Source data only: no derived values', () => {
    const text = serializeProject(drawnHouse());
    expect(text).not.toMatch(/area|outline|footprint/i);
  });

  it('opens a file saved before the app was called Urdama, and saves it under the new name', () => {
    const text = serializeProject(drawnHouse()).replace(
      '"format": "urdama"',
      '"format": "lakudemis"',
    );
    const opened = parseProject(text);
    expect(opened.ok).toBe(true);
    if (opened.ok) expect(JSON.parse(serializeProject(opened.model)).format).toBe('urdama');
  });

  it('refuses a file from a newer version of Urdama', () => {
    const doc = JSON.parse(serializeProject(drawnHouse()));
    const result = parseProject(
      JSON.stringify({ ...doc, schemaVersion: CURRENT_SCHEMA_VERSION + 1 }),
    );
    expect(!result.ok && result.reason.key).toBe('file.newerVersion');
  });

  it('refuses files that are not Urdama projects', () => {
    expect(!parseProject('not json').ok && 'refused').toBe('refused');
    const r = parseProject(JSON.stringify({ hello: 'world' }));
    expect(!r.ok && r.reason.key).toBe('file.notAProject');
  });

  it('refuses a file whose elements refer to things that do not exist', () => {
    const doc = JSON.parse(serializeProject(drawnHouse()));
    doc.walls[0].level = 'lvl_gone';
    const result = parseProject(JSON.stringify(doc));
    expect(!result.ok && result.reason.key).toBe('file.broken');
  });

  it('has a migration step for every version before the current one', () => {
    for (let v = 1; v < CURRENT_SCHEMA_VERSION; v++) expect(MIGRATIONS[v]).toBeTypeOf('function');
    expect(Object.keys(MIGRATIONS).every((k) => Number(k) < CURRENT_SCHEMA_VERSION)).toBe(true);
  });

  describe('Opening families and types (ticket 16)', () => {
    const v1 = readFileSync(new URL('./fixtures/v1-house.lakudemis.json', import.meta.url), 'utf8');

    it("turns a Slice 1 file's doors and windows into Openings of the default families, same sizes", () => {
      const before = JSON.parse(v1).openings as {
        id: string;
        kind: string;
        width: number;
        height: number;
        sill: number;
        offset: number;
        hinge: string;
        swing: string;
        wall: string;
      }[];
      const opened = parseProject(v1);
      expect(opened.ok).toBe(true);
      if (!opened.ok) return;
      const model = opened.model;
      expect(Object.keys(model.openingFamilies).sort()).toEqual(
        [
          BUILT_IN_FAMILIES.door,
          BUILT_IN_FAMILIES.window,
          BUILT_IN_FAMILIES.wallOpening,
          BUILT_IN_FAMILIES.garageDoor,
        ].sort(),
      );
      for (const old of before) {
        const o = resolveOpening(model, model.openings[old.id]!)!;
        expect(o).toMatchObject({
          kind: old.kind,
          width: old.width,
          height: old.height,
          sill: old.sill,
          offset: old.offset,
          hinge: old.hinge,
          swing: old.swing,
          wall: old.wall,
        });
        expect(model.openingFamilies[model.openingTypes[o.type]!.family]!.kind).toBe(old.kind);
      }
      // The Preset-sized door and window share their family's default type; the small window has its own.
      // Plus the wall opening and garage door defaults from the step to version 3 (ticket 17).
      expect(Object.keys(model.openingTypes)).toHaveLength(5);
    });

    it('saves a migrated file as the current version, byte-identically on the next save', () => {
      const opened = parseProject(v1);
      if (!opened.ok) throw new Error('not opened');
      const text = serializeProject(opened.model);
      expect(JSON.parse(text).schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
      const again = parseProject(text);
      expect(again.ok && serializeProject(again.model)).toBe(text);
    });

    it('writes families and types as flat collections sorted by ID', () => {
      const doc = JSON.parse(serializeProject(drawnHouse()));
      const ids = (list: { id: string }[]) => list.map((x) => x.id);
      expect(ids(doc.openingTypes)).toEqual([...ids(doc.openingTypes)].sort());
      expect(doc.openingFamilies.map((f: { kind: string }) => f.kind)).toEqual([
        'door',
        'garageDoor',
        'wallOpening',
        'window',
      ]);
      expect(doc.openings.every((o: object) => !('width' in o) && !('kind' in o))).toBe(true);
    });
  });
});
