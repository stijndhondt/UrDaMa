import { computed, type Signal } from '@angular/core';
import type { ProjectStore } from '@lakudemis/core';

/**
 * A value worked out from the model that holds still while a drag is previewed, and follows once
 * it is committed or cancelled (ticket 33). For panels too costly to rebuild on every pointer move
 * of a large plan, such as the Quantities: on 220 Walls a rebuild per move took 190 ms.
 */
export function settled<T>(store: ProjectStore, value: () => T): Signal<T> {
  let last: { readonly value: T } | null = null;
  return computed(() => {
    // While previewing, only the preview flag is read: moves of the drag don't run `value`.
    if (store.isPreviewing() && last) return last.value;
    last = { value: value() };
    return last.value;
  });
}
