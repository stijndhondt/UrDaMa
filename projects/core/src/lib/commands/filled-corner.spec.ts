import { insideRing } from '../geometry/polygon';
import { counterIds } from '../model/ids';
import { createProject } from '../model/new-project';
import type { LevelId, Vec } from '../model/types';
import { ProjectStore } from '../store/project-store';
import { drawRoom } from './draw-room';

/** Room 1, 5.00 × 4.00 m inside at the origin (140 mm Walls), and a second Room as given. */
function twoRooms(from: Vec, to: Vec) {
  const ids = counterIds();
  const store = new ProjectStore(createProject({ name: 'T', levelName: 'G' }, ids), ids);
  const level = Object.keys(store.model().levels)[0] as LevelId;
  store.run(drawRoom, {
    level,
    from: { x: 0, y: 0 },
    to: { x: 5000, y: 4000 },
    size: 'inside',
    name: 'Room 1',
  });
  const result = store.run(drawRoom, { level, from, to, size: 'inside', name: 'Room 2' });
  expect(result.ok).toBe(true);
  const room = Object.values(store.model().rooms).find((r) => r.name === 'Room 2')!;
  const footprint = store.values.level(level).footprint();
  return {
    status: store.values.room(room.id).detection()?.status,
    /** Whether a plan point lies inside the Walls' merged outline */
    solid: (p: Vec) => footprint.outer.some((ring) => insideRing(p, ring)),
  };
}

describe('a solid corner where Walls meet only at a point (ticket 25)', () => {
  it('encloses a Room started on the outer bottom-left corner and drawn to the right', () => {
    const { status, solid } = twoRooms({ x: -140, y: 4140 }, { x: 5010, y: 6430 });
    expect(status).toBe('enclosed');
    // The square between Room 1's bottom Wall end and the new left Wall is filled.
    expect(solid({ x: -210, y: 4070 })).toBe(true);
  });

  it('does the same mirrored, rotated and upside down', () => {
    // From the outer bottom-right corner, drawn to the left.
    let r = twoRooms({ x: 5140, y: 4140 }, { x: -10, y: 6430 });
    expect(r.status).toBe('enclosed');
    expect(r.solid({ x: 5210, y: 4070 })).toBe(true);
    // From the outer top-left corner, drawn up and to the right.
    r = twoRooms({ x: -140, y: -140 }, { x: 5010, y: -2430 });
    expect(r.status).toBe('enclosed');
    expect(r.solid({ x: -210, y: -70 })).toBe(true);
    // From the outer top-left corner, drawn down and to the left (beside the left Wall).
    r = twoRooms({ x: -140, y: -140 }, { x: -2430, y: 4010 });
    expect(r.status).toBe('enclosed');
    expect(r.solid({ x: -70, y: -210 })).toBe(true);
  });

  it('leaves an ordinary shared Wall as it was', () => {
    // Started on the inside line, as in a plan with flush outer faces.
    const { status, solid } = twoRooms({ x: 0, y: 4140 }, { x: 5000, y: 6430 });
    expect(status).toBe('enclosed');
    expect(solid({ x: -70, y: 4070 })).toBe(true);
  });
});
