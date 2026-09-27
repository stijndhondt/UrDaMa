/**
 * Stable element IDs (ADR 0004): a readable kind prefix plus a random, time-sortable part,
 * e.g. `wal_01j8x5k2m3n4p5q6r7s8t9v0w1`. Never reused.
 */
import type { CollectionName } from './types';

export const ID_PREFIX = {
  project: 'prj',
  buildings: 'bld',
  levels: 'lvl',
  walls: 'wal',
  wallConnections: 'wcn',
  openingFamilies: 'ofm',
  openingTypes: 'oty',
  openings: 'opn',
  rooms: 'rom',
  roomSeparators: 'rsp',
  slabs: 'slb',
  ceilings: 'cei',
} as const satisfies Record<CollectionName | 'project', string>;

export type IdKind = keyof typeof ID_PREFIX;

/** Makes a new ID for an element of the given kind. */
export type IdGenerator = (kind: IdKind) => string;

const CROCKFORD = '0123456789abcdefghjkmnpqrstvwxyz';

/** Time-sortable random IDs (ULID-style: 10 characters of milliseconds, 16 random). */
export function randomIds(
  now: () => number = Date.now,
  random: () => number = Math.random,
): IdGenerator {
  let lastTime = -1;
  let lastRandom: number[] = [];
  return (kind) => {
    const time = now();
    let rnd: number[];
    if (time === lastTime) {
      // Same millisecond: increment the previous random part so IDs stay strictly sortable.
      rnd = [...lastRandom];
      for (let i = rnd.length - 1; i >= 0; i--) {
        if (rnd[i]! < 31) {
          rnd[i]!++;
          break;
        }
        rnd[i] = 0;
      }
    } else {
      rnd = Array.from({ length: 16 }, () => Math.floor(random() * 32));
    }
    lastTime = time;
    lastRandom = rnd;
    let t = time;
    let timePart = '';
    for (let i = 0; i < 10; i++) {
      timePart = CROCKFORD[t % 32] + timePart;
      t = Math.floor(t / 32);
    }
    return `${ID_PREFIX[kind]}_${timePart}${rnd.map((n) => CROCKFORD[n]).join('')}`;
  };
}

/** Deterministic IDs for tests and fixtures: `wal_0001`, `wal_0002`, … */
export function counterIds(): IdGenerator {
  let n = 0;
  return (kind) => `${ID_PREFIX[kind]}_${String(++n).padStart(4, '0')}`;
}
