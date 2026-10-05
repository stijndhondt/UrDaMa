import { TestBed } from '@angular/core/testing';
import { provideTranslateService } from '@ngx-translate/core';
import { counterIds, createProject, drawRoom, ProjectStore, type LevelId } from '@urdama/core';
import { ProjectService } from '../project/project.service';
import { LengthEditorComponent } from './length-editor.component';

describe('Length editor (ticket 28)', () => {
  window.matchMedia ??= (query: string) =>
    ({
      matches: false,
      media: query,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }) as unknown as MediaQueryList;

  async function setup() {
    await TestBed.configureTestingModule({
      imports: [LengthEditorComponent],
      providers: [provideTranslateService({ lang: 'en' })],
    }).compileComponents();
    const project = TestBed.inject(ProjectService);
    const ids = counterIds();
    const store = new ProjectStore(createProject({ name: 'One', levelName: 'Ground' }, ids), ids);
    const level = Object.keys(store.model().levels)[0] as LevelId;
    store.run(drawRoom, {
      level,
      from: { x: 0, y: 0 },
      to: { x: 4000, y: 3000 },
      size: 'inside',
      name: 'Room 1',
    });
    project.load(store.model(), { name: null, handle: null, saved: false });
    const fixture = TestBed.createComponent(LengthEditorComponent);
    fixture.componentRef.setInput('wall', Object.values(project.store.model().walls)[0]);
    let closed = false;
    fixture.componentInstance.closed.subscribe(() => (closed = true));
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const type = async (text: string) => {
      const field = el.querySelector('input')!;
      field.value = text;
      field.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
      await fixture.whenStable();
    };
    return { project, el, type, isClosed: () => closed };
  }

  for (const text of ['0', 'abc', '-1']) {
    it(`says why "${text}" is not taken and leaves the model unchanged`, async () => {
      const { project, el, type, isClosed } = await setup();
      const before = project.store.model();
      await type(text);
      expect(el.querySelector('[role="alert"]')?.textContent).toContain('panel.wall.notALength');
      expect(project.store.model()).toBe(before);
      expect(isClosed()).toBe(false);
    });
  }

  it('drops the reason once a length is taken', async () => {
    const { el, type, isClosed } = await setup();
    await type('abc');
    await type('4500');
    expect(el.querySelector('[role="alert"]')).toBeNull();
    expect(isClosed()).toBe(true);
  });
});
