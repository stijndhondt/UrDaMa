import type { Command } from '../commands/command';
import { drawRoom } from '../commands/draw-room';
import { serializeProject } from '../file/project-file';
import { counterIds } from '../model/ids';
import { message } from '../model/message';
import { createProject } from '../model/new-project';
import type { LevelId } from '../model/types';
import { ProjectStore, UNDO_LIMIT } from './project-store';

function setup() {
  const ids = counterIds();
  const store = new ProjectStore(
    createProject({ name: 'Thuis', levelName: 'Ground floor' }, ids),
    ids,
  );
  const level = Object.keys(store.model().levels)[0] as LevelId;
  const draw = (name: string, x0: number, y0: number, x1: number, y1: number) =>
    store.run(drawRoom, {
      level,
      from: { x: x0, y: y0 },
      to: { x: x1, y: y1 },
      size: 'inside',
      name,
    });
  return { store, level, draw };
}

const rename: Command<string> = (model, name) => ({
  ok: true,
  model: { ...model, project: { ...model.project, name } },
  label: message('test.rename'),
});

describe('undo, redo and what changed (ticket 06)', () => {
  it('undoes every step back to the empty project, and redoes them exactly', () => {
    const { store, draw } = setup();
    const empty = serializeProject(store.model());
    draw('Keuken', 0, 0, 2670, 3730);
    draw('Achterhal', 0, -4080, 2670, -140);
    draw('WC', 0, -4080, 1120, -3080);
    const full = serializeProject(store.model());

    while (store.canUndo()) store.undo();
    expect(serializeProject(store.model())).toBe(empty);
    while (store.canRedo()) store.redo();
    expect(serializeProject(store.model())).toBe(full);
  });

  it('names each step for the undo menu', () => {
    const { store, draw } = setup();
    draw('Keuken', 0, 0, 2670, 3730);
    expect(store.undoLabel()).toEqual({
      key: 'commands.drawRoom.label',
      params: { name: 'Keuken' },
    });
    store.undo();
    expect(store.redoLabel()).toEqual({
      key: 'commands.drawRoom.label',
      params: { name: 'Keuken' },
    });
  });

  it('keeps the last 200 steps and forgets older ones', () => {
    const { store } = setup();
    for (let i = 0; i < UNDO_LIMIT + 5; i++) store.run(rename, `Name ${i}`);
    let steps = 0;
    while (store.canUndo()) {
      store.undo();
      steps++;
    }
    expect(steps).toBe(UNDO_LIMIT);
    expect(store.model().project.name).toBe('Name 4');
  });

  it('clears the history when another project is opened', () => {
    const { store, draw } = setup();
    draw('Keuken', 0, 0, 2670, 3730);
    store.replace(createProject({ name: 'Other', levelName: 'Ground floor' }, counterIds()));
    expect(store.canUndo()).toBe(false);
    expect(store.canRedo()).toBe(false);
  });

  it('reports which Rooms an edit changed, with old and new areas', () => {
    const { store, draw } = setup();
    draw('Achterhal', 0, 0, 2670, 3940);
    const first = store.lastChange();
    expect(
      first?.rooms.map((r) => [r.name, r.before, r.after && Math.round(r.after / 1e4) / 100]),
    ).toEqual([['Achterhal', undefined, 10.52]]);

    draw('WC', 0, 0, 1120, 1000);
    const second = store.lastChange()!;
    const byName = Object.fromEntries(second.rooms.map((r) => [r.name, r]));
    expect(Math.round(byName['Achterhal']!.before! / 1e4) / 100).toBe(10.52);
    expect(Math.round(byName['Achterhal']!.after! / 1e4) / 100).toBe(
      Math.round((2670 * 3940 - 1260 * 1140) / 1e4) / 100,
    );
    expect(byName['WC']!.before).toBeUndefined();
    expect(second.kind).toBe('do');
  });

  it('reports what undo changed too, and leaves unchanged Rooms out', () => {
    const { store, draw } = setup();
    draw('Keuken', 0, 0, 2670, 3730);
    draw('Berging', 5000, 0, 8010, 1940);
    store.undo();
    const change = store.lastChange()!;
    expect(change.kind).toBe('undo');
    expect(change.rooms.map((r) => r.name)).toEqual(['Berging']);
    expect(change.rooms[0]!.after).toBeUndefined();
  });
});
