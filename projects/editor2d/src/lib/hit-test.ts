/**
 * What is under a point on the plan: the element the Select tool picks, what the right-click menu
 * acts on (slice 2, ticket 04) and the length label a double click edits (ticket 23).
 */
import {
  distanceToSegment,
  insideArea,
  insideRing,
  levelWallOutlines,
  type Vec,
} from '@lakudemis/core';
import { faceLabelAt, faceLabels, openingOutline, type FaceLabel } from './draw-plan';
import type { EditorHost, Selection } from './host';
import type { View } from './view';

/** An element, or an enclosed area that has no Room (with the point clicked in it). */
export type PlanTarget = Selection | { readonly kind: 'empty'; readonly seed: Vec };

/** A Room separator (near its line), then an Opening, a Wall's body, and the Room around the point. */
export function elementAt(host: EditorHost, view: View, p: Vec): Selection | null {
  const level = host.level();
  const model = host.store.committedModel();
  const near = 6 / view.scale;
  for (const s of Object.values(model.roomSeparators)) {
    if (s.level === level && distanceToSegment(p, s.start, s.end) <= near)
      return { kind: 'separator', id: s.id };
  }
  const outlines = levelWallOutlines(model, level);
  for (const o of Object.values(model.openings)) {
    const ring = openingOutline(model, outlines, o);
    if (ring && insideRing(p, ring)) return { kind: 'opening', id: o.id };
  }
  for (const [id, outline] of outlines) if (insideRing(p, outline)) return { kind: 'wall', id };
  for (const area of host.store.values.level(level).footprint().areas) {
    if (area.rooms.length && insideArea(p, area.outline, area.islands))
      return { kind: 'room', id: area.rooms[0]! };
  }
  return null;
}

/** An element under the point, else the empty enclosed area around it, else nothing. */
export function targetAt(host: EditorHost, view: View, p: Vec): PlanTarget | null {
  const element = elementAt(host, view, p);
  if (element) return element;
  const empty = host.store.values
    .level(host.level())
    .footprint()
    .areas.find((a) => !a.rooms.length && insideArea(p, a.outline, a.islands));
  return empty ? { kind: 'empty', seed: p } : null;
}

/** Labels are only drawn where they are visible; a point can only be on one of those. */
const EVERYWHERE = { min: { x: -Infinity, y: -Infinity }, max: { x: Infinity, y: Infinity } };

/**
 * The length label of a Wall face at a screen point (ticket 23): a single click on it selects the
 * Wall, a double click opens the length editor there.
 */
export function lengthLabelAt(host: EditorHost, view: View, screen: Vec): FaceLabel | null {
  const values = host.store.values.level(host.level());
  return faceLabelAt(faceLabels(values.slice().walls, values.outlines(), view, EVERYWHERE), screen);
}
