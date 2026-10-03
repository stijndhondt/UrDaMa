import { TestBed } from '@angular/core/testing';
import {
  counterIds,
  createProject,
  drawRoom,
  moveWall,
  ProjectStore,
  type LevelId,
  type Wall,
} from '@lakudemis/core';
import { settled } from './settled';

describe('settled values (ticket 33)', () => {
  function store() {
    const ids = counterIds();
    const s = new ProjectStore(createProject({ name: 'T', levelName: 'Ground floor' }, ids), ids);
    const level = Object.keys(s.model().levels)[0] as LevelId;
    s.run(drawRoom, {
      level,
      from: { x: 0, y: 0 },
      to: { x: 4000, y: 3000 },
      size: 'inside',
      name: 'Hall',
    });
    const wall = Object.values(s.model().walls).find((w: Wall) => w.start.x === w.end.x)!;
    return { s, wall };
  }

  it('holds still while a drag is previewed, and follows when it is committed or cancelled', () => {
    const { s, wall } = store();
    let runs = 0;
    const area = TestBed.runInInjectionContext(() =>
      settled(s, () => {
        runs++;
        return Object.values(s.model().rooms).map((r) => s.values.room(r.id).netFloorArea());
      }),
    );
    const before = area();
    for (const offset of [50, 100, 150]) s.preview(moveWall, { wall: wall.id, offset });
    expect(area()).toBe(before);
    s.cancelPreview();
    expect(area()).toEqual(before);
    s.preview(moveWall, { wall: wall.id, offset: 100 });
    area();
    s.commitPreview();
    expect(area()).not.toEqual(before);
    // Computed when shown, after the cancel and after the commit; never for a preview.
    expect(runs).toBe(3);
  });
});
