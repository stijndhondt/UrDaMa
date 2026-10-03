import { counterIds } from '../model/ids';
import { createProject } from '../model/new-project';
import { drawRoom } from '../commands/draw-room';
import { ProjectStore } from './project-store';
import type { LevelId } from '../model/types';

const m2 = (mm2: number | null | undefined) => (mm2 == null ? null : Math.round(mm2 / 1e4) / 100);

function newStore() {
  const ids = counterIds();
  const model = createProject({ name: 'Thuis', levelName: 'Ground floor' }, ids);
  const store = new ProjectStore(model, ids);
  const level = Object.keys(model.levels)[0] as LevelId;
  return { store, level };
}

describe('ProjectStore: drawing a Room (ticket 03)', () => {
  it('gives a Room drawn at its inside size exactly that Net floor area', () => {
    const { store, level } = newStore();
    const result = store.run(drawRoom, {
      level,
      from: { x: 0, y: 0 },
      to: { x: 2670, y: 3730 },
      size: 'inside',
      name: 'Keuken',
    });
    expect(result.ok).toBe(true);
    const room = Object.values(store.model().rooms)[0]!;
    expect(room.name).toBe('Keuken');
    expect(m2(store.values.room(room.id).netFloorArea())).toBe(9.96);
  });

  it('grows the Walls outward, so the Level gross area includes their thickness', () => {
    const { store, level } = newStore();
    store.run(drawRoom, {
      level,
      from: { x: 0, y: 0 },
      to: { x: 2670, y: 3730 },
      size: 'inside',
      name: 'Keuken',
    });
    expect(Object.keys(store.model().walls)).toHaveLength(4);
    expect(m2(store.values.level(level).grossArea())).toBe(m2((2670 + 280) * (3730 + 280)));
  });

  it('treats the rectangle as the outside size when asked', () => {
    const { store, level } = newStore();
    store.run(drawRoom, {
      level,
      from: { x: 3010, y: 4010 },
      to: { x: 0, y: 0 },
      size: 'outside',
      name: 'Keuken',
    });
    const room = Object.values(store.model().rooms)[0]!;
    expect(m2(store.values.room(room.id).netFloorArea())).toBe(m2(2730 * 3730));
  });

  it('names Derived values readably', () => {
    const { store, level } = newStore();
    store.run(drawRoom, {
      level,
      from: { x: 0, y: 0 },
      to: { x: 2670, y: 3730 },
      size: 'inside',
      name: 'Keuken',
    });
    const room = Object.values(store.model().rooms)[0]!;
    expect(store.values.room(room.id).netFloorArea.label).toBe('Keuken · Net floor area');
  });

  it('records each command as forward and reverse patches', () => {
    const { store, level } = newStore();
    const before = store.model();
    const result = store.run(drawRoom, {
      level,
      from: { x: 0, y: 0 },
      to: { x: 2670, y: 3730 },
      size: 'inside',
      name: 'Keuken',
    });
    expect(
      result.ok &&
        result.patch.ops.filter((op) => op.collection === 'walls' && !op.before && op.after),
    ).toHaveLength(4);
    store.undo();
    expect(store.model()).toEqual(before);
  });

  it('refuses a command that would break an invariant, and changes nothing', () => {
    const { store } = newStore();
    const before = store.model();
    const result = store.run(drawRoom, {
      level: 'lvl_missing' as LevelId,
      from: { x: 0, y: 0 },
      to: { x: 1000, y: 1000 },
      size: 'inside',
      name: 'X',
    });
    expect(result.ok).toBe(false);
    expect(!result.ok && result.reason.key).toBe('invariants.missingReference');
    expect(store.model()).toBe(before);
  });

  it('refuses a Room smaller than the minimum size', () => {
    const { store, level } = newStore();
    const result = store.run(drawRoom, {
      level,
      from: { x: 0, y: 0 },
      to: { x: 50, y: 3000 },
      size: 'inside',
      name: 'X',
    });
    expect(!result.ok && result.reason.key).toBe('commands.drawRoom.tooSmall');
  });

  it('shows a dragged Room live through a preview, and only commits on release', () => {
    const { store, level } = newStore();
    store.preview(drawRoom, {
      level,
      from: { x: 0, y: 0 },
      to: { x: 2000, y: 2000 },
      size: 'inside',
      name: 'R',
    });
    const room = Object.values(store.model().rooms)[0]!;
    expect(m2(store.values.room(room.id).netFloorArea())).toBe(4);
    store.preview(drawRoom, {
      level,
      from: { x: 0, y: 0 },
      to: { x: 3000, y: 2000 },
      size: 'inside',
      name: 'R',
    });
    expect(m2(store.values.room(Object.values(store.model().rooms)[0]!.id).netFloorArea())).toBe(6);
    store.cancelPreview();
    expect(Object.keys(store.model().rooms)).toHaveLength(0);
    store.preview(drawRoom, {
      level,
      from: { x: 0, y: 0 },
      to: { x: 3000, y: 2000 },
      size: 'inside',
      name: 'R',
    });
    store.commitPreview();
    expect(Object.keys(store.model().rooms)).toHaveLength(1);
    expect(store.canUndo()).toBe(true);
  });
});

describe('ProjectStore: a drag (ticket 33)', () => {
  it('says whether a drag is under way, however often it is begun or ended', () => {
    const { store } = newStore();
    expect(store.isDragging()).toBe(false);
    store.beginDrag();
    store.beginDrag();
    expect(store.isDragging()).toBe(true);
    store.endDrag();
    expect(store.isDragging()).toBe(false);
    store.endDrag();
    expect(store.isDragging()).toBe(false);
  });
});
