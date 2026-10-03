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
import type { TreeNode } from '@openng/optimus-ui/api';
import { ProjectService } from '../project/project.service';
import { BuildingPanelComponent } from './building-panel.component';

describe('Building panel speed (ticket 33)', () => {
  window.matchMedia ??= (query: string) =>
    ({
      matches: false,
      media: query,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }) as unknown as MediaQueryList;

  async function setup() {
    await TestBed.configureTestingModule({
      imports: [BuildingPanelComponent],
      providers: [provideTranslateService({ lang: 'en' })],
    }).compileComponents();
    const project = TestBed.inject(ProjectService);
    // A 3 × 3 grid of Rooms.
    const ids = counterIds();
    const store = new ProjectStore(
      createProject({ name: 'Grid', levelName: 'Ground floor' }, ids),
      ids,
    );
    const level = Object.keys(store.model().levels)[0] as LevelId;
    for (let j = 0; j < 3; j++)
      for (let i = 0; i < 3; i++)
        store.run(drawRoom, {
          level,
          from: { x: i * 3140, y: j * 3140 },
          to: { x: i * 3140 + 3000, y: j * 3140 + 3000 },
          size: 'inside',
          name: `R${i}-${j}`,
        });
    project.load(store.model(), { name: null, handle: null, saved: false });
    const fixture = TestBed.createComponent(BuildingPanelComponent);
    await fixture.whenStable();
    const wall = Object.values(project.store.model().walls).find(
      // A Wall between the first and second row, under the first Room.
      (w: Wall) =>
        w.start.y === w.end.y &&
        Math.abs(w.start.y - (3140 - 140)) < 200 &&
        Math.min(w.start.x, w.end.x) < 1500 &&
        Math.max(w.start.x, w.end.x) > 1500,
    )!;
    return { project, panel: fixture.componentInstance, wall, fixture };
  }

  it('is not rebuilt while a drag is previewed, only when it is committed', async () => {
    const { project, panel, wall } = await setup();
    const before = (panel as unknown as { nodes: () => TreeNode[] }).nodes();
    project.store.preview(moveWall, { wall: wall.id, offset: 50 });
    expect((panel as unknown as { nodes: () => TreeNode[] }).nodes()).toBe(before);
    project.store.cancelPreview();
  });

  it('keeps the rows of unchanged elements on the page when an edit is committed', async () => {
    const { project, panel, wall, fixture } = await setup();
    const level = project.level();
    const open = panel as unknown as { setOpen: (n: TreeNode, open: boolean) => void };
    for (const g of ['rooms', 'walls']) open.setOpen({ key: `${level}/${g}` }, true);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const rowOf = (text: string) =>
      [...el.querySelectorAll('li')].find((li) => li.textContent?.trim().startsWith(text));
    const room = rowOf('R2-2')!;
    expect(room).toBeDefined();
    expect(project.store.run(moveWall, { wall: wall.id, offset: 50 }).ok).toBe(true);
    await fixture.whenStable();
    // Its row is the same element: the tree updated its rows, it didn't draw them all again.
    expect(rowOf('R2-2')).toBe(room);
  });
});
