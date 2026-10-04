import { TestBed } from '@angular/core/testing';
import {
  counterIds,
  createProject,
  drawRoom,
  moveWall,
  ProjectStore,
  type LevelId,
  type Wall,
} from '@urdama/core';
import { settled } from './settled';

describe('settled values (ticket 33)', () => {
  function setup() {
    const ids = counterIds();
    const store = new ProjectStore(
      createProject({ name: 'T', levelName: 'Ground floor' }, ids),
      ids,
    );
    const level = Object.keys(store.model().levels)[0] as LevelId;
    store.run(drawRoom, {
      level,
      from: { x: 0, y: 0 },
      to: { x: 4000, y: 3000 },
      size: 'inside',
      name: 'Hall',
    });
    const wall = Object.values(store.model().walls).find((w: Wall) => w.start.x === w.end.x)!;
    let runs = 0;
    const area = TestBed.runInInjectionContext(() =>
      settled(store, () => {
        runs++;
        return Object.values(store.model().rooms).map((r) =>
          store.values.room(r.id).netFloorArea(),
        );
      }),
    );
    return { store, wall, area, runs: () => runs };
  }

  it('holds still while a drag is under way, and follows when it ends', () => {
    const { store, wall, area, runs } = setup();
    const before = area();
    store.beginDrag();
    for (const offset of [50, 100, 150]) {
      store.preview(moveWall, { wall: wall.id, offset });
      expect(area()).toBe(before);
    }
    store.commitPreview();
    expect(area()).toBe(before);
    store.endDrag();
    expect(area()).not.toEqual(before);
    // Worked out before the drag and once after it; never for a move of the drag.
    expect(runs()).toBe(2);
  });

  it('follows a preview outside a drag (an Opening hovering along a Wall)', () => {
    const { store, wall, area } = setup();
    const before = area();
    store.preview(moveWall, { wall: wall.id, offset: 100 });
    expect(area()).not.toEqual(before);
    store.cancelPreview();
    expect(area()).toEqual(before);
  });

  it('rebuilds nothing for a click that changes nothing', () => {
    const { store, area, runs } = setup();
    area();
    store.beginDrag();
    area();
    store.endDrag();
    area();
    expect(runs()).toBe(1);
  });

  it('follows the drag when it is first read during one', () => {
    const { store, wall, area } = setup();
    store.beginDrag();
    store.preview(moveWall, { wall: wall.id, offset: 100 });
    const first = area();
    store.preview(moveWall, { wall: wall.id, offset: 200 });
    expect(area()).not.toEqual(first);
    store.cancelPreview();
    store.endDrag();
  });
});
