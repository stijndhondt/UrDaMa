import { counterIds } from '../model/ids';
import { createProject } from '../model/new-project';
import type { LevelId, Vec, Wall } from '../model/types';
import { ProjectStore } from '../store/project-store';
import { drawRoom } from './draw-room';
import { drawWall } from './draw-wall';
import { angleAtEnd, rotateWall, wallAnchors, wallAngle, type WallAnchor } from './rotate-wall';

/** One Room, 4 × 3 m inside, from (0, 0) to (4000, 3000). */
function oneRoom() {
  const ids = counterIds();
  const store = new ProjectStore(
    createProject({ name: 'Test', levelName: 'Gelijkvloers' }, ids),
    ids,
  );
  const level = Object.keys(store.model().levels)[0] as LevelId;
  const r = store.run(drawRoom, {
    level,
    from: { x: 0, y: 0 },
    to: { x: 4000, y: 3000 },
    size: 'inside',
    name: 'Room',
  });
  if (!r.ok) throw new Error(r.reason.key);
  const walls = () => Object.values(store.model().walls);
  const vertical = (w: Wall) => Math.abs(w.start.x - w.end.x) < 1;
  const horizontal = (w: Wall) => Math.abs(w.start.y - w.end.y) < 1;
  const right = () => walls().find((w) => vertical(w) && w.start.x > 2000)!;
  const top = () => walls().find((w) => horizontal(w) && w.start.y < 1500)!;
  const bottom = () => walls().find((w) => horizontal(w) && w.start.y > 1500)!;
  return { store, level, walls, right, top, bottom };
}

const length = (w: Wall) => Math.hypot(w.end.x - w.start.x, w.end.y - w.start.y);
const near = (a: Vec, b: Vec) => {
  expect(a.x).toBeCloseTo(b.x, 6);
  expect(a.y).toBeCloseTo(b.y, 6);
};
/** The anchor of a Wall at its lower (y larger) end, on the outside face. */
function outerBottomCorner(store: ProjectStore, wall: Wall): WallAnchor {
  const anchors = wallAnchors(store.model(), wall);
  return (['start-lo', 'start-hi', 'end-lo', 'end-hi'] as const).reduce((best, a) =>
    anchors[a].y > anchors[best].y + 1 ||
    (Math.abs(anchors[a].y - anchors[best].y) < 1 && anchors[a].x > anchors[best].x)
      ? a
      : best,
  );
}

describe('turning a Wall around an anchor', () => {
  it('a Wall has an angle between 0° and 180°, anticlockwise on screen, whichever way it was drawn', () => {
    const { right, top } = oneRoom();
    expect(wallAngle(right())).toBeCloseTo(90, 9);
    expect(wallAngle(top())).toBeCloseTo(0, 9);
  });

  it('Ends slide: the right Wall turns to 92° around its outer bottom corner; the corner stays, the neighbours stay horizontal and connected', () => {
    const { store, right, top, bottom } = oneRoom();
    const wall = right();
    const anchor = outerBottomCorner(store, wall);
    const pivot = wallAnchors(store.model(), wall)[anchor];
    const result = store.run(rotateWall, { wall: wall.id, angle: 92, anchor, mode: 'slide' });
    expect(result.ok).toBe(true);

    expect(wallAngle(store.model().walls[wall.id]!)).toBeCloseTo(92, 9);
    near(wallAnchors(store.model(), store.model().walls[wall.id]!)[anchor], pivot);
    for (const w of [top(), bottom()]) expect(w.start.y).toBeCloseTo(w.end.y, 9);
    // Every corner of the turned Wall is still shared with its neighbour.
    const t = store.model().walls[wall.id]!;
    for (const c of Object.values(store.model().wallConnections))
      if (c.kind === 'corner' && (c.wall === t.id || c.to === t.id)) {
        const [a, ae, b, be] = [
          store.model().walls[c.wall]!,
          c.end,
          store.model().walls[c.to]!,
          c.toEnd,
        ];
        near(a[ae], b[be]);
      }
  });

  it('Neighbours tilt: the Wall keeps its length; its corner partners follow its ends', () => {
    const { store, right, top } = oneRoom();
    const wall = right();
    const topId = top().id;
    const before = length(wall);
    const anchor = outerBottomCorner(store, wall);
    const result = store.run(rotateWall, { wall: wall.id, angle: 88.5, anchor, mode: 'wall' });
    expect(result.ok).toBe(true);
    const t = store.model().walls[wall.id]!;
    expect(length(t)).toBeCloseTo(before, 6);
    expect(wallAngle(t)).toBeCloseTo(88.5, 9);
    const tilted = store.model().walls[topId]!;
    expect(Math.abs(tilted.start.y - tilted.end.y)).toBeGreaterThan(1);
  });

  it('a Wall T-connected onto the turned Wall keeps its direction and still reaches it', () => {
    const { store, level, right } = oneRoom();
    const r = store.run(drawWall, {
      level,
      start: { x: 0, y: 1500 },
      end: { x: 4000, y: 1500 },
      side: 'centre',
      roomName: (i) => `Room ${i + 2}`,
    });
    expect(r.ok).toBe(true);
    const wall = right();
    const anchor = outerBottomCorner(store, wall);
    expect(store.run(rotateWall, { wall: wall.id, angle: 93, anchor, mode: 'slide' }).ok).toBe(
      true,
    );
    const tee = Object.values(store.model().wallConnections).find(
      (c) => c.kind === 'tee' && c.to === wall.id,
    );
    expect(tee).toBeDefined();
    const middle = store.model().walls[tee!.wall]!;
    expect(middle.start.y).toBeCloseTo(middle.end.y, 9);
    expect(Object.keys(store.model().rooms)).toHaveLength(2);
  });

  it('measures the angle from the Wall connected at one end: in a rectangular Room every corner is 90°', () => {
    const { store, right } = oneRoom();
    for (const end of ['start', 'end'] as const)
      expect(angleAtEnd(store.model(), right(), end)!.angle).toBeCloseTo(90, 9);
  });

  it('turned to 92° from the Wall at one end, the corner between them opens to exactly 92°', () => {
    const { store, right } = oneRoom();
    const wall = right();
    const anchor = outerBottomCorner(store, wall);
    // The end at the bottom (the anchor's end) keeps its neighbour; measure from that one.
    const end = anchor.startsWith('start') ? 'start' : 'end';
    const r = store.run(rotateWall, {
      wall: wall.id,
      angle: 92,
      anchor,
      mode: 'slide',
      relativeTo: end,
    });
    expect(r.ok).toBe(true);
    expect(angleAtEnd(store.model(), store.model().walls[wall.id]!, end)!.angle).toBeCloseTo(92, 9);
  });

  it('measured from an end with nothing connected, it is refused', () => {
    const ids = counterIds();
    const store = new ProjectStore(createProject({ name: 'T', levelName: 'G' }, ids), ids);
    const level = Object.keys(store.model().levels)[0] as LevelId;
    store.run(drawWall, {
      level,
      start: { x: 0, y: 0 },
      end: { x: 3000, y: 0 },
      side: 'centre',
      roomName: (i) => `Room ${i + 1}`,
    });
    const wall = Object.values(store.model().walls)[0]!;
    expect(angleAtEnd(store.model(), wall, 'start')).toBeNull();
    const r = store.run(rotateWall, {
      wall: wall.id,
      angle: 80,
      anchor: 'centre',
      mode: 'wall',
      relativeTo: 'start',
    });
    expect(!r.ok && r.reason.key).toBe('commands.rotateWall.nothingConnected');
  });

  it('turning to the angle it already has changes nothing', () => {
    const { store, right } = oneRoom();
    const result = store.run(rotateWall, {
      wall: right().id,
      angle: 90,
      anchor: 'centre',
      mode: 'wall',
    });
    expect(result.ok).toBe(false);
  });
});
