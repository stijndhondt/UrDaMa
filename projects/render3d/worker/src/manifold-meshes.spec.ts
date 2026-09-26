import {
  addOpening,
  buildingSolids,
  counterIds,
  createProject,
  drawRoom,
  ProjectStore,
  type LevelId,
  type Wall,
} from '@lakudemis/core';
import Module from 'manifold-3d/manifold';
import { meshSolids } from './manifold-meshes';
import type { ElementMesh } from './protocol';

/** Every edge used by exactly two triangles, once in each direction: a closed, watertight mesh. */
function watertight(mesh: ElementMesh): boolean {
  const edges = new Map<string, number>();
  const { indices } = mesh;
  for (let i = 0; i < indices.length; i += 3) {
    for (let k = 0; k < 3; k++) {
      const a = indices[i + k]!;
      const b = indices[i + ((k + 1) % 3)]!;
      edges.set(`${a}>${b}`, (edges.get(`${a}>${b}`) ?? 0) + 1);
    }
  }
  return [...edges].every(([key, n]) => {
    const [a, b] = key.split('>');
    return n === 1 && edges.get(`${b}>${a}`) === 1;
  });
}

/** mm³, by the divergence theorem (positive for outward-facing triangles). */
function volume(mesh: ElementMesh): number {
  const p = mesh.positions;
  let v = 0;
  for (let i = 0; i < mesh.indices.length; i += 3) {
    const [a, b, c] = [0, 1, 2].map((k) => mesh.indices[i + k]! * 3);
    v +=
      (p[a]! * (p[b + 1]! * p[c + 2]! - p[b + 2]! * p[c + 1]!) -
        p[a + 1]! * (p[b]! * p[c + 2]! - p[b + 2]! * p[c]!) +
        p[a + 2]! * (p[b]! * p[c + 1]! - p[b + 1]! * p[c]!)) /
      6;
  }
  return v;
}

describe('manifold meshes (ticket 14)', () => {
  it('extrudes watertight solids and cuts Openings as clean holes', async () => {
    const wasm = await Module();
    wasm.setup();
    const ids = counterIds();
    const store = new ProjectStore(
      createProject({ name: 'T', levelName: 'Ground floor' }, ids),
      ids,
    );
    const level = Object.keys(store.model().levels)[0] as LevelId;
    store.run(drawRoom, {
      level,
      from: { x: 0, y: 0 },
      to: { x: 3000, y: 3000 },
      size: 'inside',
      name: 'Living',
    });
    const bottom = Object.values(store.model().walls).find(
      (w: Wall) => w.start.y === 3000 && w.end.y === 3000,
    )!;
    const solidsBefore = buildingSolids(store.model(), store.values);
    const before = meshSolids(wasm, solidsBefore).meshes.find((m) => m.id === bottom.id)!;
    store.run(addOpening, { wall: bottom.id, kind: 'window', offset: 500 });

    const { meshes, problems } = meshSolids(wasm, buildingSolids(store.model(), store.values));
    expect(problems).toEqual([]);
    expect(meshes.map((m) => m.kind).sort()).toEqual([
      'floorBuildUp',
      'slab',
      'wall',
      'wall',
      'wall',
      'wall',
    ]);
    for (const m of meshes) expect(watertight(m)).toBe(true);
    const after = meshes.find((m) => m.id === bottom.id)!;
    // The window's box through the 140 mm Wall is gone, no more, no less.
    const p = store.model().project.presets;
    expect(volume(before) - volume(after)).toBeCloseTo(p.windowWidth * p.windowHeight * 140, -3);
  });
});
