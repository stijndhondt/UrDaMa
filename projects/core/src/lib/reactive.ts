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
 *   Room's name). Angular's debug name is fixed at creation.
 */
export function derived<T>(
  name: string | (() => string),
  compute: () => T,
  equal?: Equality<T>,
): Derived<T> {
  const debugName = typeof name === 'string' ? name : name();
  const value = equal ? computed(compute, { debugName, equal }) : computed(compute, { debugName });
  return Object.defineProperty(value, 'label', {
    get: typeof name === 'string' ? () => name : name,
    enumerable: true,
  }) as Derived<T>;
}
