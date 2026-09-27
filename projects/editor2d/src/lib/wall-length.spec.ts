import type { Wall, WallId, LevelId } from '@lakudemis/core';
import { growOptions } from './wall-length';

const wall = (x0: number, y0: number, x1: number, y1: number): Wall => ({
  id: 'wal_1' as WallId,
  level: 'lvl_1' as LevelId,
  start: { x: x0, y: y0 },
  end: { x: x1, y: y1 },
  side: 'left',
  roomBounding: true,
});

describe('which way a Wall grows', () => {
  it('offers left / both / right for a horizontal Wall, whichever way it was drawn', () => {
    expect(growOptions(wall(0, 0, 3000, 0)).map((o) => [o.label, o.end])).toEqual([
      ['left', 'start'],
      ['both', 'both'],
      ['right', 'end'],
    ]);
    expect(growOptions(wall(3000, 0, 0, 0)).map((o) => [o.label, o.end])).toEqual([
      ['left', 'end'],
      ['both', 'both'],
      ['right', 'start'],
    ]);
  });

  it('offers up / both / down for a vertical Wall (the plan has y pointing down)', () => {
    expect(growOptions(wall(0, 2000, 0, 0)).map((o) => [o.label, o.end])).toEqual([
      ['up', 'end'],
      ['both', 'both'],
      ['down', 'start'],
    ]);
  });

  it('offers start / both / end for a diagonal Wall', () => {
    expect(growOptions(wall(0, 0, 3000, 1000)).map((o) => [o.label, o.end])).toEqual([
      ['start', 'start'],
      ['both', 'both'],
      ['end', 'end'],
    ]);
  });
});
