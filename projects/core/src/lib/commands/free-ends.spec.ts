import { parseProject, serializeProject } from '../file/project-file';
import { counterIds } from '../model/ids';
import { createProject } from '../model/new-project';
import type { LevelId } from '../model/types';
import { ProjectStore } from '../store/project-store';
import { drawWall } from './draw-wall';
import { updateWall } from './update-wall';

describe('Free ends: Wall ends connected to nothing on purpose', () => {
  function gardenWall() {
    const ids = counterIds();
    const store = new ProjectStore(
      createProject({ name: 'Test', levelName: 'Gelijkvloers' }, ids),
      ids,
    );
    const level = Object.keys(store.model().levels)[0] as LevelId;
    const r = store.run(drawWall, {
      level,
      start: { x: 0, y: 0 },
      end: { x: 3000, y: 0 },
      side: 'centre',
      roomName: (i) => `Room ${i + 1}`,
    });
    if (!r.ok) throw new Error(r.reason.key);
    const wall = Object.values(store.model().walls)[0]!;
    const unconnected = () =>
      store.values
        .level(level)
        .warnings()
        .find((w) => w.key === 'warnings.unconnectedEnds')?.params?.['count'] ?? 0;
    return { store, wall, unconnected };
  }

  it('a free-standing Wall has 2 unconnected ends; stated as Free ends they are not flagged', () => {
    const { store, wall, unconnected } = gardenWall();
    expect(unconnected()).toBe(2);
    expect(store.run(updateWall, { wall: wall.id, freeEnds: true }).ok).toBe(true);
    expect(unconnected()).toBe(0);
    expect(store.run(updateWall, { wall: wall.id, freeEnds: false }).ok).toBe(true);
    expect(unconnected()).toBe(2);
    expect('freeEnds' in store.model().walls[wall.id]!).toBe(false);
  });

  it('Free ends are kept in the project file', () => {
    const { store, wall } = gardenWall();
    store.run(updateWall, { wall: wall.id, freeEnds: true });
    const reopened = parseProject(serializeProject(store.model()));
    expect(reopened.ok && reopened.model.walls[wall.id]?.freeEnds).toBe(true);
  });
});
