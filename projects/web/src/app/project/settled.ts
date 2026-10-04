import { computed, type Signal } from '@angular/core';
import type { ProjectStore } from '@urdama/core';

/**
 * A value worked out from the model that holds still while a drag is under way, and follows once
 * it ends (ticket 33). For panels too costly to rebuild on every pointer move of a large plan, such
 * as the Quantities: on 220 Walls a rebuild per move took 190 ms. Outside a drag it follows every
 * change, a hover preview included; a click that changes nothing rebuilds nothing.
 */
export function settled<T>(store: ProjectStore, value: () => T): Signal<T> {
  const live = computed(value);
  // The value last shown outside a drag: what a drag holds. Read for the first time during a
  // drag, there is none, and the value follows the drag.
  let beforeDrag: { readonly value: T } | null = null;
  return computed(() => {
    if (store.isDragging()) return beforeDrag ? beforeDrag.value : live();
    beforeDrag = { value: live() };
    return beforeDrag.value;
  });
}
