/**
 * The dependency engine (ADR 0003): named, lazy, cached, self-tracking values.
 *
 * This is the ONLY module in `core` allowed to import from `@angular/core`, and only
 * `signal` / `computed`. Everything else in `core` uses `source()` and `derived()`.
 */
import { computed, signal, type Signal, type WritableSignal } from '@angular/core';

/** Source data held by the engine: set it, and everything reading it becomes stale. */
export type Source<T> = WritableSignal<T>;

/** A Derived value: recalculated only when read after something it read has changed. */
export type Derived<T> = Signal<T> & {
  /** Readable name, e.g. "Keuken · Net floor area" (kept current if it depends on data). */
  readonly label: string;
};

export type Equality<T> = (a: T, b: T) => boolean;

export function source<T>(name: string, value: T, equal?: Equality<T>): Source<T> {
  return equal ? signal(value, { debugName: name, equal }) : signal(value, { debugName: name });
}

/**
 * @param name A readable name, or a function giving it (for names that follow the data, like a
 *   Room's name). A name function is never called while creating or computing the value, so it
 *   adds no hidden dependency; Angular's debug name is only set for fixed names.
 */
export function derived<T>(
  name: string | (() => string),
  compute: () => T,
  equal?: Equality<T>,
): Derived<T> {
  const label = typeof name === 'string' ? () => name : name;
  const tracked = () => {
    recalculations?.push(label);
    return compute();
  };
  const options = typeof name === 'string' ? { debugName: name } : {};
  const value = equal ? computed(tracked, { ...options, equal }) : computed(tracked, options);
  return Object.defineProperty(value, 'label', { get: label, enumerable: true }) as Derived<T>;
}

let recalculations: (() => string)[] | null = null;

/**
 * The recalculation log: runs `read` and returns the names of the Derived values that were
 * recalculated meanwhile. Names are looked up afterwards, outside any Derived value.
 */
export function recordRecalculations(read: () => void): string[] {
  const outer = recalculations;
  const log: (() => string)[] = [];
  recalculations = log;
  try {
    read();
  } finally {
    recalculations = outer;
  }
  outer?.push(...log);
  return log.map((label) => label());
}
