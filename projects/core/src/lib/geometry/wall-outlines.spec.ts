import type { Wall, WallConnection, WallId, WallConnectionId, LevelId } from '../model/types';
import { wallOutlines } from './wall-outlines';

const L1 = 'lvl_1' as LevelId;
const wall = (
  id: string,
  sx: number,
  sy: number,
  ex: number,
  ey: number,
  side: Wall['side'] = 'left',
  thickness?: number,
): Wall => ({
  id: id as WallId,
  level: L1,
  start: { x: sx, y: sy },
  end: { x: ex, y: ey },
  side,
  thickness,
  roomBounding: true,
});
const corner = (
  id: string,
  w: string,
  end: 'start' | 'end',
  to: string,
  toEnd: 'start' | 'end',
): WallConnection => ({
  id: id as WallConnectionId,
  wall: w as WallId,
  end,
  kind: 'corner',
  to: to as WallId,
  toEnd,
});
const round = (pts: readonly { x: number; y: number }[]) =>
  pts.map((p) => [Math.round(p.x * 1000) / 1000, Math.round(p.y * 1000) / 1000]);

describe('wallOutlines (joined Wall outlines, ADR 0001)', () => {
  it('draws a free Wall as a box on its side of the Baseline', () => {
    // Along +x, 'left' (visual up, y negative) with the 140 mm Preset.
    const out = wallOutlines([wall('w1', 0, 0, 3000, 0)], [], 140);
    expect(round(out.get('w1' as WallId)!)).toEqual([
      [0, -140],
      [3000, -140],
      [3000, 0],
      [0, 0],
    ]);
  });

  it('mitres a corner so the outer faces meet exactly at the outer corner', () => {
    // Inside faces on the Baselines, thickness outward ('left' on a clockwise loop).
    const walls = [wall('top', 0, 0, 3730, 0), wall('right', 3730, 0, 3730, 2670)];
    const out = wallOutlines(walls, [corner('c1', 'top', 'end', 'right', 'start')], 140);
    expect(round(out.get('top' as WallId)!)).toEqual([
      [0, -140],
      [3870, -140],
      [3730, 0],
      [0, 0],
    ]);
    expect(round(out.get('right' as WallId)!)).toEqual([
      [3870, -140],
      [3870, 2670],
      [3730, 2670],
      [3730, 0],
    ]);
  });

  it('mitres Walls of different thickness through the intersection of their faces', () => {
    const walls = [
      wall('top', 0, 0, 3000, 0, 'left', 190),
      wall('right', 3000, 0, 3000, 2000, 'left', 140),
    ];
    const out = wallOutlines(walls, [corner('c1', 'top', 'end', 'right', 'start')], 140);
    expect(round(out.get('top' as WallId)!)).toEqual([
      [0, -190],
      [3140, -190],
      [3000, 0],
      [0, 0],
    ]);
  });

  it('stops a T-connected Wall against the host face on its own side', () => {
    const host = wall('host', 0, 0, 4000, 0, 'right', 140); // occupies y 0..140
    const stem: Wall = wall('stem', 2000, 140, 2000, 2000, 'centre', 100);
    const tee: WallConnection = {
      id: 't1' as WallConnectionId,
      wall: 'stem' as WallId,
      end: 'start',
      kind: 'tee',
      to: 'host' as WallId,
      at: 2000,
    };
    const out = wallOutlines([host, stem], [tee], 140);
    const ys = out.get('stem' as WallId)!.map((p) => p.y);
    expect(Math.min(...ys)).toBeCloseTo(140, 6);
  });
});
