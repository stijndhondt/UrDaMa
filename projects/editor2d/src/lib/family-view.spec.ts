import { DEFAULT_DESIGNS, openingShape } from '@lakudemis/core';
import { familyHandles, projectParts, type FamilyPreview } from './family-view';

const door: FamilyPreview = {
  design: DEFAULT_DESIGNS.door,
  placement: { width: 1000, height: 2100, sill: 0, hinge: 'start', swing: 'right' },
  depth: 200,
};
const parts = openingShape(door.design, door.placement, door.depth).parts;

describe('Opening family views (ticket 20)', () => {
  it('shows the same parts from every side: the leaf nearest from the swing side', () => {
    // The leaf hangs on the face it swings towards (v high): seen from the front it is the farthest,
    // drawn first.
    const front = projectParts(parts, 'front', 1000, 200);
    const back = projectParts(parts, 'back', 1000, 200);
    expect(front[0]!.kind).toBe('leaf');
    expect(front.at(-1)!.kind).toBe('frame');
    // Front and back mirror each other; top and left show the frame's depth across the Wall.
    const jamb = front.find((p) => p.kind === 'frame' && p.a0 === 0)!;
    expect(back.some((p) => p.kind === 'frame' && p.a0 === 1000 - jamb.a1)).toBe(true);
    const top = projectParts(parts, 'top', 1000, 200);
    expect(top.find((p) => p.kind === 'frame')).toMatchObject({ b0: 50, b1: 150 });
    const left = projectParts(parts, 'left', 1000, 200);
    expect(left.find((p) => p.kind === 'frame')).toMatchObject({ a0: 50, a1: 150 });
  });

  it('drags the frame width in 5 mm steps, within its limits', () => {
    const [width] = familyHandles(door, 'front');
    expect(width).toMatchObject({ parameter: 'frameWidth', a: 60, b: 1050 });
    expect(width!.drag(73, 1050)).toMatchObject({ value: 75, design: { frame: { width: 75 } } });
    expect(width!.drag(-40, 1050).value).toBe(10);
    // From the back the jamb is mirrored: dragging right makes it narrower.
    const [mirrored] = familyHandles(door, 'back');
    expect(mirrored!.a).toBe(940);
    expect(mirrored!.drag(1000 - 82, 0).value).toBe(80);
  });

  it('drags the frame depth from the top and the leaf thickness from the side', () => {
    const top = familyHandles(door, 'top');
    expect(top.map((h) => h.parameter)).toEqual(['frameDepth']);
    expect(top[0]!.drag(30, 100 + 61).value).toBe(120);
    const left = familyHandles(door, 'left');
    const thickness = left.find((h) => h.parameter === 'thickness')!;
    // The leaf lies against the back face of the frame (v 110..150): its free face at v = 110,
    // seen from the left at a = 200 - 110.
    expect(thickness.a).toBe(90);
    expect(thickness.drag(200 - 99, 0)).toMatchObject({
      value: 52,
      design: { infill: { thickness: 52 } },
    });
  });
});
