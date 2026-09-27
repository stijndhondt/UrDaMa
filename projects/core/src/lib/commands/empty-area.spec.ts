import { interiorPoint } from '../geometry/polygon';
import { counterIds } from '../model/ids';
import { createProject } from '../model/new-project';
import type { LevelId } from '../model/types';
import { ProjectStore } from '../store/project-store';
import { addRoom } from './add-room';
import { deleteElements } from './delete-elements';
import { drawRoom } from './draw-room';

describe('a Room again in an empty area (slice 2, ticket 03)', () => {
  it("deleting a Room and creating it again at the area's interior point gives the same Net floor area", () => {
    const ids = counterIds();
    const store = new ProjectStore(
      createProject({ name: 'T', levelName: 'Ground floor' }, ids),
      ids,
    );
    const level = Object.keys(store.model().levels)[0] as LevelId;
    store.run(drawRoom, {
      level,
      from: { x: 0, y: 0 },
      to: { x: 2670, y: 3730 },
      size: 'inside',
      name: 'Keuken',
    });
    const keuken = Object.values(store.model().rooms)[0]!;
    const before = store.values.room(keuken.id).netFloorArea();
    store.run(deleteElements, { walls: [], rooms: [keuken.id] });

    const empty = store.values
      .level(level)
      .footprint()
      .areas.find((a) => !a.rooms.length)!;
    expect(empty).toBeDefined();
    const result = store.run(addRoom, {
      level,
      seed: interiorPoint(empty.outline, empty.islands),
      name: 'Keuken',
    });
    expect(result.ok).toBe(true);
    const again = Object.values(store.model().rooms)[0]!;
    expect(store.values.room(again.id).netFloorArea()).toBeCloseTo(before!, 3);
  });
});
