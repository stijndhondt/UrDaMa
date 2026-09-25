/**
 * Draws one Level of the plan (Canvas2D, ADR 0005): only what is on screen, Walls batched into one path.
 */
import type { LevelSlice, RoomId, Vec, WallId, WallOutline } from '@lakudemis/core';
import type { EditorHost } from './host';
import type { View } from './view';

export const PLAN_COLORS = {
  paper: '#fbfaf7',
  gridMinor: '#efede8',
  gridMajor: '#dedbd4',
  area: '#ffffff',
  areaChanged: '#e3ecfc',
  wallFill: '#cfd3da',
  wallStroke: '#2b313b',
  label: '#1d232b',
  muted: '#6b7280',
  warn: '#c2410c',
  bad: '#d64545',
  accent: '#2f6fde',
} as const;

export interface Box {
  readonly min: Vec;
  readonly max: Vec;
}

export function overlaps(ring: readonly Vec[], box: Box): boolean {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of ring) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  return maxX >= box.min.x && minX <= box.max.x && maxY >= box.min.y && minY <= box.max.y;
}

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
}

export function drawPlan(
  ctx: CanvasRenderingContext2D,
  view: View,
  host: EditorHost,
  width: number,
  height: number,
  options: DrawOptions = {},
): void {
  ctx.fillStyle = PLAN_COLORS.paper;
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
    ctx.fillStyle = changed ? PLAN_COLORS.areaChanged : PLAN_COLORS.area;
    ctx.fill('evenodd');
    if (!area.rooms.length && hatch) {
      ctx.fillStyle = hatch;
      ctx.fill('evenodd');
    }
  }

  // Walls: one batched path; a thick stroke under the fill merges touching outlines into one.
  ctx.beginPath();
  for (const wall of slice.walls) {
    const outline = outlines.get(wall.id);
    if (outline && overlaps(outline, box)) tracePolygon(ctx, view, outline);
  }
  ctx.lineJoin = 'miter';
  ctx.strokeStyle = PLAN_COLORS.wallStroke;
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.fillStyle = PLAN_COLORS.wallFill;
  ctx.fill('nonzero');

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
    ctx.fillStyle = PLAN_COLORS.label;
    ctx.fillText(room.name, s.x, s.y - 9);
    ctx.font = '12px system-ui, sans-serif';
    if (!detection || detection.status === 'notEnclosed') {
      ctx.fillStyle = PLAN_COLORS.bad;
      ctx.fillText(host.text('warnings.notEnclosed.short'), s.x, s.y + 9);
    } else if (detection.status === 'sharingArea') {
      ctx.fillStyle = PLAN_COLORS.warn;
      ctx.fillText(host.text('warnings.sharingArea.short'), s.x, s.y + 9);
    } else {
      ctx.fillStyle = options.highlight?.has(room.id) ? PLAN_COLORS.accent : PLAN_COLORS.muted;
      ctx.fillText(host.format.area(detection.area.area), s.x, s.y + 9);
    }
  }
}

/** "no Room · 9.96 m²" in the middle of each enclosed area without a Room (click it to make a Room). */
export function drawEmptyAreaLabels(
  ctx: CanvasRenderingContext2D,
  view: View,
  host: EditorHost,
  areas: readonly { outline: readonly Vec[]; rooms: readonly RoomId[]; area: number }[],
): void {
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '12px system-ui, sans-serif';
  for (const area of areas) {
    if (area.rooms.length) continue;
    const xs = area.outline.map((p) => p.x);
    const ys = area.outline.map((p) => p.y);
    const c = view.toScreen({
      x: (Math.min(...xs) + Math.max(...xs)) / 2,
      y: (Math.min(...ys) + Math.max(...ys)) / 2,
    });
    const text = `${host.text('areas.noRoom')} · ${host.format.area(area.area)}`;
    const w = ctx.measureText(text).width + 8;
    ctx.fillStyle = 'rgba(251,250,247,.9)';
    ctx.fillRect(c.x - w / 2, c.y - 9, w, 18);
    ctx.fillStyle = PLAN_COLORS.muted;
    ctx.fillText(text, c.x, c.y);
  }
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
  for (const wall of slice.walls) {
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
      ctx.save();
      ctx.translate(pos.x, pos.y);
      ctx.rotate(angle);
      const text = host.format.length(length);
      const w = ctx.measureText(text).width + 6;
      ctx.fillStyle = 'rgba(251,250,247,.85)';
      ctx.fillRect(-w / 2, -7, w, 14);
      ctx.fillStyle = PLAN_COLORS.label;
      ctx.fillText(text, 0, 0);
      ctx.restore();
    }
    for (const end of ['start', 'end'] as const) {
      const s = view.toScreen(wall[end]);
      const kind = ends.get(`${wall.id}:${end}`);
      if (!kind) {
        ctx.strokeStyle = PLAN_COLORS.bad;
        ctx.lineWidth = 1.5;
        ctx.strokeRect(s.x - 4, s.y - 4, 8, 8);
      } else {
        ctx.fillStyle = kind === 'corner' ? '#1f9d55' : PLAN_COLORS.accent;
        ctx.beginPath();
        ctx.arc(s.x, s.y, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
  ctx.restore();
}

let cachedHatch: { ctx: CanvasRenderingContext2D; pattern: CanvasPattern | null } | null = null;
function hatchPattern(ctx: CanvasRenderingContext2D): CanvasPattern | null {
  if (cachedHatch?.ctx === ctx) return cachedHatch.pattern;
  const tile = document.createElement('canvas');
  tile.width = tile.height = 10;
  const t = tile.getContext('2d');
  if (t) {
    t.strokeStyle = '#d6d2c9';
    t.lineWidth = 1;
    t.beginPath();
    t.moveTo(0, 10);
    t.lineTo(10, 0);
    t.stroke();
  }
  cachedHatch = { ctx, pattern: ctx.createPattern(tile, 'repeat') };
  return cachedHatch.pattern;
}

function drawGrid(ctx: CanvasRenderingContext2D, view: View, width: number, height: number): void {
  for (const [step, color] of [
    [100, PLAN_COLORS.gridMinor],
    [1000, PLAN_COLORS.gridMajor],
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
