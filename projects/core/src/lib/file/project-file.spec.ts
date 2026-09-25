import { drawRoom } from '../commands/draw-room';
import { counterIds } from '../model/ids';
import { createProject } from '../model/new-project';
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
    expect(doc.format).toBe('lakudemis');
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

  it('refuses a file from a newer version of Lakudemis', () => {
    const doc = JSON.parse(serializeProject(drawnHouse()));
    const result = parseProject(
      JSON.stringify({ ...doc, schemaVersion: CURRENT_SCHEMA_VERSION + 1 }),
    );
    expect(!result.ok && result.reason.key).toBe('file.newerVersion');
  });

  it('refuses files that are not Lakudemis projects', () => {
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
});
