import {
  counterIds,
  createProject,
  drawRoom,
  levelWallOutlines,
  ProjectStore,
  wallFrame,
  type LevelId,
  type Wall,
} from '@urdama/core';
import { insideCorners, slideOffset } from './opening-slide';

/** A 6.00 × 4.00 m Room inside; its bottom Wall, the face towards the Room ('lo' or 'hi'). */
function room() {
  const ids = counterIds();
  const store = new ProjectStore(createProject({ name: 'T', levelName: 'G' }, ids), ids);
  const level = Object.keys(store.model().levels)[0] as LevelId;
  store.run(drawRoom, {
    level,
    from: { x: 0, y: 0 },
    to: { x: 6000, y: 4000 },
    size: 'inside',
    name: 'Room 1',
  });
  const model = store.model();
  const wall = Object.values(model.walls).find(
    (w: Wall) => w.start.y === 4000 && w.end.y === 4000,
  )!;
  const outline = levelWallOutlines(model, level).get(wall.id)!;
  const f = wallFrame(wall);
  // The inside face is the one nearer the Room (y = 4000).
  const face: 'lo' | 'hi' =
    Math.abs(f.across(outline[0]) - f.across({ x: 0, y: 4000 })) < 1 ? 'lo' : 'hi';
  const along = (x: number) => f.along({ x, y: 4000 });
  const slide = (raw: number, width: number, round = (mm: number) => Math.round(mm / 10) * 10) =>
    slideOffset(model, level, wall, outline, face, along(3000), raw, width, round);
  return { model, level, wall, outline, face, along, slide };
}

describe('sliding an Opening along its Wall', () => {
  it('measures from the inside corners of the face', () => {
    const { model, level, wall, outline, face, along } = room();
    const { first, last } = insideCorners(model, level, wall, outline, face, along(3000));
    expect(Math.abs(last - first)).toBeCloseTo(6000, 3);
  });

  it('rounds the distance from the inside corner, not the position on the Baseline', () => {
    const { model, level, wall, outline, face, along, slide } = room();
    const { first } = insideCorners(model, level, wall, outline, face, along(3000));
    expect(slide(first + 1234, 900) - first).toBe(1230);
  });

  it('stops at the inside corners on either side', () => {
    const { model, level, wall, outline, face, along, slide } = room();
    const { first, last } = insideCorners(model, level, wall, outline, face, along(3000));
    expect(slide(first - 500, 900)).toBe(first);
    expect(slide(last + 500, 900)).toBe(last - 900);
  });
});
