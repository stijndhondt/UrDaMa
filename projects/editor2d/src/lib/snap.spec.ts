import type { WallOutline } from '@lakudemis/core';
import { snapToWalls } from './snap';

// A horizontal Wall, outer face at y = -140 from x = -140 to 2810, inner face at y = 0.
const wall: WallOutline = [
  { x: -140, y: -140 },
  { x: 2810, y: -140 },
  { x: 2670, y: 0 },
  { x: 0, y: 0 },
];

describe('snapToWalls', () => {
  it('prefers an outline corner within the radius', () => {
    expect(snapToWalls({ x: 2800, y: -130 }, [wall], 50)).toEqual({
      point: { x: 2810, y: -140 },
      kind: 'corner',
    });
  });

  it('snaps onto a face and rounds the position along it to the drag increment', () => {
    expect(snapToWalls({ x: 4, y: -145 }, [wall], 50, 10)).toEqual({
      point: { x: 0, y: -140 },
      kind: 'face',
    });
  });

  it('prefers a point on a face aligned with a Wall end over a nearby outline corner', () => {
    // Clicking at the inner corner line (x = 0) on the outer face must not jump to the corner at -140.
    const snap = snapToWalls({ x: 3, y: -142 }, [wall], 200, 10, [
      { x: 0, y: 0 },
      { x: 2670, y: 0 },
    ]);
    expect(snap).toEqual({ point: { x: 0, y: -140 }, kind: 'corner' });
  });

  it('returns nothing outside the radius', () => {
    expect(snapToWalls({ x: 1000, y: -400 }, [wall], 50)).toBeNull();
  });
});
