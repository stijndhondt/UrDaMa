/**
 * Invariants checked at the end of every command (ticket 11): a command that would break one is
 * refused and changes nothing, so the model can never be saved in a broken state.
 */
import { message, type Message } from './message';
import type { Model } from './types';
import { distance } from '../geometry/vec';

export function checkInvariants(model: Model): Message | null {
  const has = (collection: keyof Model, id: string) =>
    Object.hasOwn(model[collection] as object, id);
  const missing = (what: string, id: string) =>
    message('invariants.missingReference', { what, id });

  for (const l of Object.values(model.levels))
    if (!has('buildings', l.building)) return missing('building', l.building);
  for (const s of Object.values(model.slabs))
    if (!has('levels', s.level)) return missing('level', s.level);
  for (const w of Object.values(model.walls)) {
    if (!has('levels', w.level)) return missing('level', w.level);
    if (distance(w.start, w.end) <= 0) return message('invariants.zeroLength', { id: w.id });
  }
  const corners = new Set<string>();
  for (const c of Object.values(model.wallConnections)) {
    if (!has('walls', c.wall)) return missing('wall', c.wall);
    if (!has('walls', c.to)) return missing('wall', c.to);
    if (c.kind === 'corner') {
      for (const key of [`${c.wall}:${c.end}`, `${c.to}:${c.toEnd}`]) {
        if (corners.has(key)) return message('invariants.twoCorners', { wall: key.split(':')[0]! });
        corners.add(key);
      }
    }
  }
  for (const o of Object.values(model.openings))
    if (!has('walls', o.wall)) return missing('wall', o.wall);
  for (const r of Object.values(model.rooms))
    if (!has('levels', r.level)) return missing('level', r.level);
  for (const s of Object.values(model.roomSeparators)) {
    if (!has('levels', s.level)) return missing('level', s.level);
    if (!has('walls', s.startWall)) return missing('wall', s.startWall);
    if (!has('walls', s.endWall)) return missing('wall', s.endWall);
  }
  for (const c of Object.values(model.ceilings))
    if (!has('rooms', c.room)) return missing('room', c.room);
  return null;
}
