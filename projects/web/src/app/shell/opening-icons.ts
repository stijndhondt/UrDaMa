import type { OpeningKind } from '@lakudemis/core';
import type { IconName } from './icons.generated';

/** The icon of each Opening kind, wherever Openings are listed or shown (ticket 17). */
export const OPENING_ICONS: Readonly<Record<OpeningKind, IconName>> = {
  door: 'door-open',
  window: 'app-window',
  wallOpening: 'rectangle-vertical',
  garageDoor: 'warehouse',
};
