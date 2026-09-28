/**
 * Draws one Level of the plan (Canvas2D, ADR 0005): only what is on screen, Walls batched into one path.
 */
import {
  boundingBox,
  boxesOverlap,
  interiorPoint,
  openingRect,
  wallFrame,
  type Box,
  type LevelId,
  type LevelSlice,
  type Model,
  type Opening,
  type RoomId,
  type Vec,
  type Wall,
  type WallId,
  type WallOutline,
} from '@lakudemis/core';
import type { EditorHost, Selection } from './host';
import type { View } from './view';

/** The colours the plan is drawn with. The app gives its theme's (EditorHost.colors). */
export interface PlanColors {
  readonly paper: string;
  readonly gridMinor: string;
  readonly gridMajor: string;
  /** A Room's area, and one the last edit changed */
  readonly area: string;
  readonly areaChanged: string;
  /** The hatch of an area without a Room */
  readonly hatch: string;
  readonly wallFill: string;
  readonly wallStroke: string;
  readonly separator: string;
  readonly levelBelow: string;
  readonly levelBelowStroke: string;
  readonly label: string;
  readonly muted: string;
  readonly ok: string;
  readonly warn: string;
  readonly bad: string;
  readonly accent: string;
  /** Text on the accent colour */
  readonly onAccent: string;
}

/** The light plan, used when the app gives no colours. */
export const DEFAULT_PLAN_COLORS: PlanColors = {
  paper: '#fbfaf7',
  gridMinor: '#efede8',
  gridMajor: '#dedbd4',
  area: '#ffffff',
  areaChanged: '#e3ecfc',
  hatch: '#d6d2c9',
  wallFill: '#cfd3da',
  wallStroke: '#2b313b',
  separator: '#8a93a3',
  levelBelow: 'rgba(120, 130, 150, 0.18)',
  levelBelowStroke: 'rgba(120, 130, 150, 0.45)',
  label: '#1d232b',
  muted: '#6b7280',
  ok: '#1f9d55',
  warn: '#c2410c',
  bad: '#d64545',
  accent: '#2f6fde',
  onAccent: '#ffffff',
};

let active: PlanColors = DEFAULT_PLAN_COLORS;

/** The colours of the frame being drawn: PlanEditor sets them from its host before each frame. */
export const planColors = (): PlanColors => active;

export function usePlanColors(colors: PlanColors): void {
  active = colors;
}

/** Whether a ring may be visible in a box (its bounding box overlaps it). */
export const overlaps = (ring: readonly Vec[], box: Box): boolean =>
  boxesOverlap(boundingBox(ring), box);

export function tracePolygon(
  ctx: CanvasRenderingContext2D,
  view: View,
  ring: readonly Vec[],
): void {
  ring.forEach((p, i) => {
    const s = view.toScreen(p);
    if (i === 0) ctx.moveTo(s.x, s.y);
    else ctx.lineTo(s.x, s.y);
  });
  ctx.closePath();
}

export interface DrawOptions {
  /** Rooms to highlight (changed by the last edit). */
  readonly highlight?: ReadonlySet<RoomId>;
  /** A Level to show faded underneath, as a tracing aid. */
  readonly below?: LevelId | null;
}

export function drawPlan(
  ctx: CanvasRenderingContext2D,
  view: View,
  host: EditorHost,
  width: number,
  height: number,
  options: DrawOptions = {},
): void {
  ctx.fillStyle = planColors().paper;
  ctx.fillRect(0, 0, width, height);
  drawGrid(ctx, view, width, height);

  const level = host.store.values.level(host.level());
  const slice = level.slice();
  const fp = level.footprint();
  const outlines = level.outlines();
  const box = view.visible(width, height);

  // Enclosed areas (Room floors), with free-standing islands cut out. Areas without a Room are hatched.
  const hatch = hatchPattern(ctx);
  for (const area of fp.areas) {
    if (!overlaps(area.outline, box)) continue;
    const changed = area.rooms.some((r) => options.highlight?.has(r));
    ctx.beginPath();
    tracePolygon(ctx, view, area.outline);
    for (const island of area.islands) tracePolygon(ctx, view, island);
    ctx.fillStyle = changed ? planColors().areaChanged : planColors().area;
    ctx.fill('evenodd');
    if (!area.rooms.length && hatch) {
      ctx.fillStyle = hatch;
      ctx.fill('evenodd');
    }
  }

  if (options.below) drawLevelBelow(ctx, view, host, options.below, box);

  // Walls: one batched path; a thick stroke under the fill merges touching outlines into one.
  ctx.beginPath();
  for (const wall of slice.walls) {
    const outline = outlines.get(wall.id);
    if (outline && overlaps(outline, box)) tracePolygon(ctx, view, outline);
  }
  ctx.lineJoin = 'miter';
  ctx.strokeStyle = planColors().wallStroke;
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.fillStyle = planColors().wallFill;
  ctx.fill('nonzero');

  drawOpenings(ctx, view, slice, outlines);

  // Room separators: dashed lines with no physical form.
  ctx.save();
  ctx.setLineDash([8, 5]);
  ctx.strokeStyle = planColors().separator;
  ctx.lineWidth = 1.5;
  for (const s of slice.separators) {
    const a = view.toScreen(s.start);
    const b = view.toScreen(s.end);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
  ctx.restore();

  drawWallDetails(ctx, view, host, slice, outlines, box);
  drawEmptyAreaLabels(ctx, view, host, fp.areas);

  // Room labels at their Seed points: the name, and the Net floor area or why there is none.
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (const room of slice.rooms) {
    const s = view.toScreen(room.seed);
    if (s.x < -200 || s.y < -50 || s.x > width + 200 || s.y > height + 50) continue;
    const detection = host.store.values.room(room.id).detection();
    ctx.font = '600 13px system-ui, sans-serif';
    ctx.fillStyle = planColors().label;
    ctx.fillText(room.name, s.x, s.y - 9);
    ctx.font = '12px system-ui, sans-serif';
    if (!detection || detection.status === 'notEnclosed') {
      ctx.fillStyle = planColors().bad;
      ctx.fillText(host.text('warnings.short.notEnclosed'), s.x, s.y + 9);
    } else if (detection.status === 'sharingArea') {
      ctx.fillStyle = planColors().warn;
      ctx.fillText(host.text('warnings.short.sharingArea'), s.x, s.y + 9);
    } else {
      ctx.fillStyle = options.highlight?.has(room.id) ? planColors().accent : planColors().muted;
      ctx.fillText(host.format.area(detection.area.area), s.x, s.y + 9);
    }
  }

  // The selection, whichever tool is active (it may have been made in the 3D view).
  for (const item of host.selection()) drawSelected(ctx, view, host, item, planColors().accent, 3);
}

/** "no Room · 9.96 m²" in the middle of each enclosed area without a Room (click it to make a Room). */
export function drawEmptyAreaLabels(
  ctx: CanvasRenderingContext2D,
  view: View,
  host: EditorHost,
  areas: readonly EmptyAreaInput[],
): void {
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (const b of emptyAreaButtons(areas, view)) {
    ctx.font = '12px system-ui, sans-serif';
    const text = `${host.text('areas.noRoom')} · ${host.format.area(b.area)}`;
    const w = ctx.measureText(text).width + 8;
    ctx.globalAlpha = 0.9;
    ctx.fillStyle = planColors().paper;
    ctx.fillRect(b.label.x - w / 2, b.label.y - 9, w, 18);
    ctx.globalAlpha = 1;
    ctx.fillStyle = planColors().muted;
    ctx.fillText(text, b.label.x, b.label.y);
    // The "+ Room" button: one click makes this area a Room, whatever tool is active.
    ctx.fillStyle = planColors().accent;
    ctx.beginPath();
    ctx.roundRect(b.button.x, b.button.y, b.button.w, b.button.h, b.button.h / 2);
    ctx.fill();
    ctx.font = '600 12px system-ui, sans-serif';
    ctx.fillStyle = planColors().onAccent;
    ctx.fillText(
      `+ ${host.text('areas.addRoom')}`,
      b.button.x + b.button.w / 2,
      b.button.y + b.button.h / 2,
    );
  }
  ctx.restore();
}

/** An enclosed area as the footprint gives it. */
export interface EmptyAreaInput {
  readonly outline: readonly Vec[];
  readonly islands: readonly (readonly Vec[])[];
  readonly rooms: readonly RoomId[];
  readonly area: number;
}

/** Where an empty area's label and "+ Room" button sit on screen, and the model point inside it. */
export interface EmptyAreaButton {
  /** mm, a point inside the area: the new Room's Seed point */
  readonly seed: Vec;
  /** mm² */
  readonly area: number;
  readonly label: Vec;
  readonly button: {
    readonly x: number;
    readonly y: number;
    readonly w: number;
    readonly h: number;
  };
}

/** Every enclosed area without a Room, with its label and button placed at a point inside it. */
export function emptyAreaButtons(areas: readonly EmptyAreaInput[], view: View): EmptyAreaButton[] {
  return areas
    .filter((a) => !a.rooms.length)
    .map((a) => {
      const seed = interiorPoint(a.outline, a.islands);
      const s = view.toScreen(seed);
      return { seed, area: a.area, label: s, button: { x: s.x - 40, y: s.y + 14, w: 80, h: 22 } };
    });
}

/** The "+ Room" button under a screen point, if any. */
export function emptyAreaButtonAt(
  buttons: readonly EmptyAreaButton[],
  p: Vec,
): EmptyAreaButton | null {
  return (
    buttons.find(
      (b) =>
        p.x >= b.button.x &&
        p.x <= b.button.x + b.button.w &&
        p.y >= b.button.y &&
        p.y <= b.button.y + b.button.h,
    ) ?? null
  );
}

/**
 * Always visible (Slice 1 spec): the length of every Wall face, and a marker at every Wall end:
 * green = corner Wall connection, blue = T, red square = connected to nothing.
 */
export function drawWallDetails(
  ctx: CanvasRenderingContext2D,
  view: View,
  host: EditorHost,
  slice: LevelSlice,
  outlines: ReadonlyMap<WallId, WallOutline>,
  box: Box,
): void {
  const ends = new Map<string, 'corner' | 'tee'>();
  for (const c of slice.connections) {
    ends.set(`${c.wall}:${c.end}`, c.kind);
    if (c.kind === 'corner') ends.set(`${c.to}:${c.toEnd}`, 'corner');
  }
  ctx.save();
  ctx.font = '11px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (const label of faceLabels(slice.walls, outlines, view, box)) {
    ctx.save();
    ctx.translate(label.pos.x, label.pos.y);
    ctx.rotate(label.angle);
    const text = host.format.length(label.length);
    const w = ctx.measureText(text).width + 6;
    ctx.globalAlpha = 0.85;
    ctx.fillStyle = planColors().paper;
    ctx.fillRect(-w / 2, -7, w, 14);
    ctx.globalAlpha = 1;
    ctx.fillStyle = planColors().label;
    ctx.fillText(text, 0, 0);
    ctx.restore();
  }
  for (const wall of slice.walls) {
    const outline = outlines.get(wall.id);
    if (!outline || !overlaps(outline, box)) continue;
    for (const end of ['start', 'end'] as const) {
      const s = view.toScreen(wall[end]);
      const kind = ends.get(`${wall.id}:${end}`);
      if (!kind) {
        ctx.strokeStyle = planColors().bad;
        ctx.lineWidth = 1.5;
        ctx.strokeRect(s.x - 4, s.y - 4, 8, 8);
      } else {
        ctx.fillStyle = kind === 'corner' ? planColors().ok : planColors().accent;
        ctx.beginPath();
        ctx.arc(s.x, s.y, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
  ctx.restore();
}

/** A face length label on the plan: which Wall face it measures, where it sits on screen. */
export interface FaceLabel {
  readonly wall: WallId;
  /** mm, the face's length */
  readonly length: number;
  /** Screen position of the label's centre, and its rotation (radians, kept readable) */
  readonly pos: Vec;
  readonly angle: number;
}

/** Labels for both faces of every Wall in view that is long enough on screen to carry one. */
export function faceLabels(
  walls: readonly Wall[],
  outlines: ReadonlyMap<WallId, WallOutline>,
  view: View,
  box: Box,
): FaceLabel[] {
  const labels: FaceLabel[] = [];
  for (const wall of walls) {
    const outline = outlines.get(wall.id);
    if (!outline || !overlaps(outline, box)) continue;
    const centre = {
      x: (outline[0].x + outline[1].x + outline[2].x + outline[3].x) / 4,
      y: (outline[0].y + outline[1].y + outline[2].y + outline[3].y) / 4,
    };
    for (const [a, b] of [
      [outline[0], outline[1]],
      [outline[3], outline[2]],
    ] as const) {
      const length = Math.hypot(b.x - a.x, b.y - a.y);
      if (length * view.scale < 45) continue;
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      const out = { x: mid.x - centre.x, y: mid.y - centre.y };
      const outLength = Math.hypot(out.x, out.y) || 1;
      const s = view.toScreen(mid);
      const pos = { x: s.x + (out.x / outLength) * 10, y: s.y + (out.y / outLength) * 10 };
      let angle = Math.atan2(b.y - a.y, b.x - a.x);
      if (angle > Math.PI / 2 || angle < -Math.PI / 2) angle += Math.PI;
      labels.push({ wall: wall.id, length, pos, angle });
    }
  }
  return labels;
}

/** The face label under a screen point, if any (labels are about 60 × 14 px). */
export function faceLabelAt(labels: readonly FaceLabel[], p: Vec): FaceLabel | null {
  for (const label of labels) {
    const dx = p.x - label.pos.x;
    const dy = p.y - label.pos.y;
    const along = dx * Math.cos(label.angle) + dy * Math.sin(label.angle);
    const across = -dx * Math.sin(label.angle) + dy * Math.cos(label.angle);
    if (Math.abs(along) <= 30 && Math.abs(across) <= 8) return label;
  }
  return null;
}

/** The outline of a selected (or hovered) element on the edited Level. */
export function drawSelected(
  ctx: CanvasRenderingContext2D,
  view: View,
  host: EditorHost,
  item: Selection,
  color: string,
  width: number,
): void {
  const model = host.store.model();
  const values = host.store.values.level(host.level());
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath();
  if (item.kind === 'separator') {
    const sep = model.roomSeparators[item.id];
    if (sep) {
      const a = view.toScreen(sep.start);
      const b = view.toScreen(sep.end);
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
    }
  } else {
    let ring: readonly Vec[] | null;
    if (item.kind === 'opening') {
      const o = model.openings[item.id];
      ring = o ? openingOutline(model, values.outlines(), o) : null;
    } else if (item.kind === 'wall') {
      ring = values.outlines().get(item.id) ?? null;
    } else {
      const d = host.store.values.room(item.id).detection();
      ring = d && d.status !== 'notEnclosed' ? d.area.outline : null;
    }
    if (ring) tracePolygon(ctx, view, ring);
  }
  ctx.stroke();
  ctx.restore();
}

/** The Level below, faded: its Walls only, light and without detail, to trace over. */
function drawLevelBelow(
  ctx: CanvasRenderingContext2D,
  view: View,
  host: EditorHost,
  level: LevelId,
  box: Box,
): void {
  const outlines = host.store.values.level(level).outlines();
  ctx.save();
  ctx.beginPath();
  for (const outline of outlines.values())
    if (overlaps(outline, box)) tracePolygon(ctx, view, outline);
  ctx.fillStyle = planColors().levelBelow;
  ctx.fill('nonzero');
  ctx.strokeStyle = planColors().levelBelowStroke;
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.restore();
}

/** An Opening's rectangle in the plan: its width along the Wall, across the Wall's full thickness. */
export function openingOutline(
  model: Pick<Model, 'walls' | 'openingTypes'>,
  outlines: ReadonlyMap<WallId, WallOutline>,
  o: Opening,
): Vec[] | null {
  const wall = model.walls[o.wall];
  const outline = outlines.get(o.wall);
  const width = model.openingTypes[o.type]?.width;
  return wall && outline && width
    ? [...openingRect(wall, outline, { offset: o.offset, width })]
    : null;
}

/** Openings: cut out of their Wall, with a door leaf and swing, or window glass lines. */
export function drawOpenings(
  ctx: CanvasRenderingContext2D,
  view: View,
  slice: LevelSlice,
  outlines: ReadonlyMap<WallId, WallOutline>,
): void {
  const walls = new Map(slice.walls.map((w) => [w.id as string, w]));
  ctx.save();
  for (const o of slice.openings) {
    const wall = walls.get(o.wall);
    const outline = outlines.get(o.wall);
    if (!wall || !outline) continue;
    const f = wallFrame(wall);
    const lo = f.across(outline[0]);
    const hi = f.across(outline[3]);
    const point = (t: number, s: number): Vec => view.toScreen(f.point(t, s));
    const t0 = o.offset;
    const t1 = o.offset + o.width;
    const corners = openingRect(wall, outline, o).map((c) => view.toScreen(c));
    ctx.beginPath();
    corners.forEach((c, i) => (i ? ctx.lineTo(c.x, c.y) : ctx.moveTo(c.x, c.y)));
    ctx.closePath();
    ctx.fillStyle = planColors().area;
    ctx.fill();
    ctx.strokeStyle = planColors().wallStroke;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(corners[0]!.x, corners[0]!.y);
    ctx.lineTo(corners[3]!.x, corners[3]!.y);
    ctx.moveTo(corners[1]!.x, corners[1]!.y);
    ctx.lineTo(corners[2]!.x, corners[2]!.y);
    ctx.stroke();
    if (o.kind === 'wallOpening' || o.kind === 'garageDoor') {
      // A wall opening: the head above, dashed along both faces. A garage door: its door in the
      // middle of the Wall, and its overhead track dashed into the Room.
      ctx.lineWidth = 1;
      ctx.setLineDash([5, 4]);
      ctx.beginPath();
      if (o.kind === 'wallOpening') {
        for (const s of [lo, hi]) {
          const a = point(t0, s);
          const b = point(t1, s);
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
        }
      } else {
        const inward = o.swing === 'right' ? 1 : -1;
        const face = inward > 0 ? Math.max(lo, hi) : Math.min(lo, hi);
        const depth = Math.min(o.height, 2500);
        for (const t of [t0, t1]) {
          const a = point(t, face);
          const b = point(t, face + inward * depth);
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
        }
        const a = point(t0, face + inward * depth);
        const b = point(t1, face + inward * depth);
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
      }
      ctx.stroke();
      ctx.setLineDash([]);
      if (o.kind === 'garageDoor') {
        const mid = (lo + hi) / 2;
        const a = point(t0, mid);
        const b = point(t1, mid);
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }
    } else if (o.kind === 'window') {
      const mid = (lo + hi) / 2;
      const gap = Math.max(1, Math.abs(hi - lo) * 0.12);
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (const s of [mid - gap, mid + gap]) {
        const a = point(t0, s);
        const b = point(t1, s);
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
      }
      ctx.stroke();
    } else {
      // Door: the leaf stands open at 90° on the swing side, with the swing arc.
      const face = o.swing === 'right' ? Math.max(lo, hi) : Math.min(lo, hi);
      const outward = o.swing === 'right' ? 1 : -1;
      const hingeT = o.hinge === 'start' ? t0 : t1;
      const freeT = o.hinge === 'start' ? t1 : t0;
      const hinge = point(hingeT, face);
      const leafEnd = point(hingeT, face + outward * o.width);
      const free = point(freeT, face);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(hinge.x, hinge.y);
      ctx.lineTo(leafEnd.x, leafEnd.y);
      ctx.stroke();
      const radius = Math.hypot(leafEnd.x - hinge.x, leafEnd.y - hinge.y);
      const a0 = Math.atan2(leafEnd.y - hinge.y, leafEnd.x - hinge.x);
      const a1 = Math.atan2(free.y - hinge.y, free.x - hinge.x);
      let sweep = a1 - a0;
      while (sweep > Math.PI) sweep -= 2 * Math.PI;
      while (sweep < -Math.PI) sweep += 2 * Math.PI;
      ctx.setLineDash([3, 3]);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(hinge.x, hinge.y, radius, a0, a0 + sweep, sweep < 0);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }
  ctx.restore();
}

let cachedHatch: {
  ctx: CanvasRenderingContext2D;
  color: string;
  pattern: CanvasPattern | null;
} | null = null;
function hatchPattern(ctx: CanvasRenderingContext2D): CanvasPattern | null {
  const color = planColors().hatch;
  if (cachedHatch?.ctx === ctx && cachedHatch.color === color) return cachedHatch.pattern;
  const tile = document.createElement('canvas');
  tile.width = tile.height = 10;
  const t = tile.getContext('2d');
  if (t) {
    t.strokeStyle = color;
    t.lineWidth = 1;
    t.beginPath();
    t.moveTo(0, 10);
    t.lineTo(10, 0);
    t.stroke();
  }
  cachedHatch = { ctx, color, pattern: ctx.createPattern(tile, 'repeat') };
  return cachedHatch.pattern;
}

function drawGrid(ctx: CanvasRenderingContext2D, view: View, width: number, height: number): void {
  for (const [step, color] of [
    [100, planColors().gridMinor],
    [1000, planColors().gridMajor],
  ] as const) {
    const px = step * view.scale;
    if (px < 8) continue;
    ctx.beginPath();
    for (let x = view.offset.x % px; x < width; x += px) {
      ctx.moveTo(Math.round(x) + 0.5, 0);
      ctx.lineTo(Math.round(x) + 0.5, height);
    }
    for (let y = view.offset.y % px; y < height; y += px) {
      ctx.moveTo(0, Math.round(y) + 0.5);
      ctx.lineTo(width, Math.round(y) + 0.5);
    }
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.stroke();
  }
}
