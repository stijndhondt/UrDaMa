import { counterIds, createProject, drawRoom, ProjectStore, type LevelId } from '@lakudemis/core';
import { faceLabels } from './draw-plan';
import type { EditorHost } from './host';
import { lengthLabelAt } from './hit-test';
import { View } from './view';

/** A 3 × 4 m Room on the plan at the default view. */
function plan() {
  const ids = counterIds();
  const store = new ProjectStore(createProject({ name: 'T', levelName: 'Ground floor' }, ids), ids);
  const level = Object.keys(store.model().levels)[0] as LevelId;
  store.run(drawRoom, {
    level,
    from: { x: 0, y: 0 },
    to: { x: 3000, y: 4000 },
    size: 'inside',
    name: 'Keuken',
  });
  const host = { store, level: () => level } as unknown as EditorHost;
  return { store, level, host, view: new View() };
}

describe('the length label under the pointer (ticket 23)', () => {
  it('finds the face label drawn at a screen point, with its Wall and face length', () => {
    const { store, level, host, view } = plan();
    const values = store.values.level(level);
    const everywhere = { min: { x: -1e9, y: -1e9 }, max: { x: 1e9, y: 1e9 } };
    const [label] = faceLabels(values.slice().walls, values.outlines(), view, everywhere);
    const found = lengthLabelAt(host, view, label!.pos);
    expect(found?.wall).toBe(label!.wall);
    expect(found?.length).toBeCloseTo(label!.length);
  });

  it('finds nothing away from the labels', () => {
    const { host, view } = plan();
    expect(lengthLabelAt(host, view, view.toScreen({ x: 1500, y: 2000 }))).toBeNull();
  });
});
