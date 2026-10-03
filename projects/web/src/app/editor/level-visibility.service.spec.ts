import { TestBed } from '@angular/core/testing';
import { provideTranslateService } from '@ngx-translate/core';
import {
  counterIds,
  createProject,
  drawRoom,
  moveWall,
  ProjectStore,
  type LevelId,
  type Wall,
} from '@lakudemis/core';
import { ProjectService } from '../project/project.service';
import { LevelVisibilityService } from './level-visibility.service';

describe('Level visibility (ticket 33)', () => {
  it('keeps the same hidden set while a drag is previewed, so no view redraws for it', () => {
    TestBed.configureTestingModule({ providers: [provideTranslateService({ lang: 'en' })] });
    const project = TestBed.inject(ProjectService);
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
    project.load(store.model(), { name: null, handle: null, saved: false });
    const visibility = TestBed.inject(LevelVisibilityService);
    const before = visibility.hidden();
    const wall = Object.values(project.store.model().walls).find(
      (w: Wall) => w.start.x === w.end.x,
    )!;
    for (const offset of [50, 100]) project.store.preview(moveWall, { wall: wall.id, offset });
    expect(visibility.hidden()).toBe(before);
    project.store.cancelPreview();
  });
});
