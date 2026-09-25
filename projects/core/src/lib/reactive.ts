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
export type Derived<T> = Signal<T>;

export type Equality<T> = (a: T, b: T) => boolean;

export function source<T>(name: string, value: T, equal?: Equality<T>): Source<T> {
  return equal ? signal(value, { debugName: name, equal }) : signal(value, { debugName: name });
}

export function derived<T>(name: string, compute: () => T, equal?: Equality<T>): Derived<T> {
  return equal
    ? computed(compute, { debugName: name, equal })
    : computed(compute, { debugName: name });
}
