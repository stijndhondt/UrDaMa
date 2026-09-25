import type { Vec } from '@lakudemis/core';

/** Drag increments (Slice 1 spec): 10 mm; Shift = coarse (100 mm); Ctrl = fine (1 mm). */
export function increment(mods: { shift: boolean; ctrl: boolean }): number {
  return mods.ctrl ? 1 : mods.shift ? 100 : 10;
}

export function snapToIncrement(p: Vec, step: number): Vec {
  return { x: Math.round(p.x / step) * step, y: Math.round(p.y / step) * step };
}
