import { counterIds } from '../model/ids';
import { createProject, defaultStoreyHeight } from '../model/new-project';
import type { LevelId, OpeningId, Wall } from '../model/types';
import { ProjectStore } from '../store/project-store';
import { addOpening } from './add-opening';
import { deleteElements } from './delete-elements';
import { drawRoom } from './draw-room';
import { moveWall } from './move-wall';
import { updateOpening } from './update-opening';

const m2 = (mm2: number) => Math.round(mm2 / 1e4) / 100;

function keuken() {
  const ids = counterIds();
  const store = new ProjectStore(createProject({ name: 'T', levelName: 'Ground floor' }, ids), ids);
  const level = Object.keys(store.model().levels)[0] as LevelId;
  store.run(drawRoom, {
    level,
    from: { x: 0, y: 0 },
    to: { x: 2670, y: 3730 },
    size: 'inside',
    name: 'Keuken',
  });
  /** The bottom Wall, from (2670, 3730) to (0, 3730). */
  const bottom = (): Wall =>
    Object.values(store.model().walls).find((w) => w.start.y === 3730 && w.end.y === 3730)!;
  const opening = () => Object.values(store.model().openings)[0]!;
  return { store, level, bottom, opening };
}

describe('doors and windows (ticket 11)', () => {
  it('places a door with the Preset sizes, 0.58 m from the Wall start', () => {
    const { store, bottom, opening } = keuken();
    const result = store.run(addOpening, { wall: bottom().id, kind: 'door', offset: 580 });
    expect(result.ok).toBe(true);
    expect(opening()).toMatchObject({
      kind: 'door',
      offset: 580,
      width: 930,
      height: 2115,
      sill: 0,
    });
  });

  it('places a window with its sill height from the Preset', () => {
    const { store, bottom, opening } = keuken();
    store.run(addOpening, { wall: bottom().id, kind: 'window', offset: 700 });
    expect(opening()).toMatchObject({ kind: 'window', width: 1200, height: 1200, sill: 900 });
  });

  it('subtracts Openings from the Net area of both Wall faces', () => {
    const { store, level, bottom } = keuken();
    store.run(addOpening, { wall: bottom().id, kind: 'door', offset: 580 });
    const faces = store.values.wall(bottom().id).faces()!;
    const height = defaultStoreyHeight(store.model().project.presets);
    expect(m2(faces.drawn.gross)).toBe(m2(2670 * height));
    expect(m2(faces.drawn.net)).toBe(m2(2670 * height - 930 * 2115));
    expect(m2(faces.other.net)).toBe(m2((2670 + 280) * height - 930 * 2115));
    void level;
  });

  it('refuses Openings that overlap each other or run past the Wall end', () => {
    const { store, bottom } = keuken();
    store.run(addOpening, { wall: bottom().id, kind: 'door', offset: 580 });
    const overlap = store.run(addOpening, { wall: bottom().id, kind: 'window', offset: 1000 });
    expect(!overlap.ok && overlap.reason.key).toBe('invariants.openingsOverlap');
    const past = store.run(addOpening, { wall: bottom().id, kind: 'window', offset: 2000 });
    expect(!past.ok && past.reason.key).toBe('invariants.openingOutsideWall');
  });

  it('deletes an Opening on its own, leaving the Wall', () => {
    const { store, bottom, opening } = keuken();
    store.run(addOpening, { wall: bottom().id, kind: 'door', offset: 580 });
    const result = store.run(deleteElements, {
      walls: [],
      rooms: [],
      openings: [opening().id as OpeningId],
    });
    expect(result.ok).toBe(true);
    expect(Object.keys(store.model().openings)).toHaveLength(0);
    expect(bottom()).toBeDefined();
  });

  it('flips a door and changes its size as single steps', () => {
    const { store, bottom, opening } = keuken();
    store.run(addOpening, { wall: bottom().id, kind: 'door', offset: 580 });
    const id = opening().id as OpeningId;
    const hinge = opening().hinge;
    store.run(updateOpening, { opening: id, flipHinge: true });
    expect(opening().hinge).not.toBe(hinge);
    store.run(updateOpening, { opening: id, width: 830 });
    expect(opening().width).toBe(830);
    store.undo();
    expect(opening().width).toBe(930);
  });

  it('moves with its Wall', () => {
    const { store, bottom, opening } = keuken();
    const wall = bottom().id;
    store.run(addOpening, { wall, kind: 'door', offset: 580 });
    store.run(moveWall, { wall, offset: -300 });
    expect(opening().offset).toBe(580);
    expect(opening().wall).toBe(wall);
  });
});
