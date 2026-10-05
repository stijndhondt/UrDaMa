import { TestBed } from '@angular/core/testing';
import { provideTranslateService } from '@ngx-translate/core';
import {
  addLevel,
  counterIds,
  createProject,
  drawRoom,
  ProjectStore,
  type LevelId,
} from '@urdama/core';
import { ProjectService } from '../project/project.service';
import { DeleteLevelDialogComponent } from './delete-level-dialog.component';
import { DeleteLevelService } from './delete-level.service';

describe('Deleting a Level asks in an app dialog (ticket 32)', () => {
  window.matchMedia ??= (query: string) =>
    ({
      matches: false,
      media: query,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }) as unknown as MediaQueryList;

  async function setup() {
    await TestBed.configureTestingModule({
      imports: [DeleteLevelDialogComponent],
      providers: [provideTranslateService({ lang: 'en' })],
    }).compileComponents();
    const project = TestBed.inject(ProjectService);
    const ids = counterIds();
    const store = new ProjectStore(createProject({ name: 'Two', levelName: 'Ground' }, ids), ids);
    const ground = Object.keys(store.model().levels)[0] as LevelId;
    store.run(addLevel, {
      relativeTo: ground,
      position: 'above',
      name: 'First',
      storeyHeight: 2800,
    });
    const first = Object.values(store.model().levels).find((l) => l.name === 'First')!.id;
    store.run(drawRoom, {
      level: first,
      from: { x: 0, y: 0 },
      to: { x: 4000, y: 3000 },
      size: 'inside',
      name: 'Bedroom',
    });
    project.load(store.model(), { name: null, handle: null, saved: false });
    const fixture = TestBed.createComponent(DeleteLevelDialogComponent);
    await fixture.whenStable();
    const asking = TestBed.inject(DeleteLevelService);
    asking.asking.set(first);
    await fixture.whenStable();
    const button = (label: string) =>
      [...document.querySelectorAll<HTMLButtonElement>('.p-dialog button')].find(
        (b) => b.textContent?.trim() === label || b.getAttribute('aria-label') === label,
      )!;
    return { project, fixture, first, button };
  }

  it('asks in a dialog naming the Level and what goes with it', async () => {
    const { button } = await setup();
    const dialog = document.querySelector('.p-dialog')!;
    expect(dialog).not.toBeNull();
    expect(dialog.textContent).toContain('panel.level.confirmDelete');
    expect(button('panel.level.delete')).toBeDefined();
    expect(button('common.cancel')).toBeDefined();
  });

  it('leaves the model unchanged on Cancel', async () => {
    const { project, fixture, button } = await setup();
    const before = project.store.model();
    button('common.cancel').click();
    await fixture.whenStable();
    expect(project.store.model()).toBe(before);
  });

  it('deletes the Level as one undo step on confirming', async () => {
    const { project, fixture, first, button } = await setup();
    button('panel.level.delete').click();
    await fixture.whenStable();
    expect(project.store.model().levels[first]).toBeUndefined();
    project.store.undo();
    expect(project.store.model().levels[first]?.name).toBe('First');
    expect(Object.values(project.store.model().rooms).map((r) => r.name)).toContain('Bedroom');
  });
});
