import { TestBed } from '@angular/core/testing';
import { provideTranslateService } from '@ngx-translate/core';
import {
  addOpening,
  counterIds,
  createProject,
  drawRoom,
  ProjectStore,
  type LevelId,
  type OpeningId,
  type Wall,
} from '@urdama/core';
import { ProjectService } from '../project/project.service';
import { OpeningTypesService } from './opening-types.service';
import { PropertiesPanelComponent } from './properties-panel.component';
import { SelectionService } from './selection.service';

describe('Opening types from a double click on the plan', () => {
  window.matchMedia ??= (query: string) =>
    ({
      matches: false,
      media: query,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }) as unknown as MediaQueryList;

  async function setup() {
    await TestBed.configureTestingModule({
      imports: [PropertiesPanelComponent],
      providers: [provideTranslateService({ lang: 'en' })],
    }).compileComponents();
    const project = TestBed.inject(ProjectService);
    const ids = counterIds();
    const store = new ProjectStore(createProject({ name: 'T', levelName: 'Ground' }, ids), ids);
    const level = Object.keys(store.model().levels)[0] as LevelId;
    store.run(drawRoom, {
      level,
      from: { x: 0, y: 0 },
      to: { x: 5000, y: 4000 },
      size: 'inside',
      name: 'Kitchen',
    });
    const wall = Object.values(store.model().walls).find(
      (w: Wall) => w.start.y === 4000 && w.end.y === 4000,
    )!;
    store.run(addOpening, { wall: wall.id, kind: 'window', offset: 1000 });
    project.load(store.model(), { name: null, handle: null, saved: false });
    const window = Object.keys(project.store.model().openings)[0] as OpeningId;
    const fixture = TestBed.createComponent(PropertiesPanelComponent);
    await fixture.whenStable();
    return { project, fixture, window };
  }

  it("selects the Opening and opens its family's types, ready for a new type", async () => {
    const { fixture, window } = await setup();
    // What the plan does on a double click: select the Opening, then ask for its types.
    TestBed.inject(SelectionService).current.set([{ kind: 'opening', id: window }]);
    TestBed.inject(OpeningTypesService).openFor(window);
    await fixture.whenStable();
    await new Promise((r) => setTimeout(r, 50));
    await fixture.whenStable();
    const dialog = document.querySelector('.p-dialog');
    expect(dialog?.textContent).toContain('openingTypes.title');
    expect(document.activeElement?.getAttribute('aria-label')).toBe('openingTypes.newName');
  });
});
