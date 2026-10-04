/**
 * The plan editor (ADR 0005): a framework-free Canvas2D editor for one Level.
 * The app around it supplies an EditorHost and calls `invalidate()` when the model changes.
 */
import { addRoom, type OpeningKind, type OpeningTypeId, type RoomId, type Vec } from '@urdama/core';
import {
  DEFAULT_PLAN_COLORS,
  drawPlan,
  emptyAreaButtonAt,
  emptyAreaButtons,
  usePlanColors,
} from './draw-plan';
import type { EditorHost } from './host';
import { lengthLabelAt, targetAt } from './hit-test';
import { RoomTool } from './tools/room-tool';
import { WallTool } from './tools/wall-tool';
import { SelectTool } from './tools/select-tool';
import { SeparatorTool } from './tools/separator-tool';
import { OpeningTool } from './tools/opening-tool';
import { FloorOpeningTool } from './tools/floor-opening-tool';
import type { PointerInfo, Tool, ToolContext, ToolName } from './tools/tool';
import { TypedInput } from './typed-input';
import { View } from './view';

export class PlanEditor {
  readonly view = new View();
  private readonly ctx: CanvasRenderingContext2D;
  private readonly typed: TypedInput;
  private readonly tools: Partial<Record<ToolName, Tool>>;
  private tool: Tool | null = null;
  private last: PointerInfo | null = null;
  /**
   * A drag from the Library panel over the plan: the tool to return to when it ends, and the type
   * the dragged kind's tool placed before
   */
  private drag: {
    readonly tool: ToolName | null;
    readonly kind: OpeningKind;
    readonly type: OpeningTypeId | null;
  } | null = null;
  private pan: { x: number; y: number } | null = null;
  private spaceHeld = false;
  private frame = 0;
  private width = 0;
  private height = 0;
  private highlight: ReadonlySet<RoomId> = new Set();
  private readonly resize: ResizeObserver;
  private readonly cleanup: (() => void)[] = [];

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly host: EditorHost,
  ) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas2D is not available');
    this.ctx = ctx;
    const parent = canvas.parentElement;
    if (!parent) throw new Error('The plan canvas needs a parent element');
    this.typed = new TypedInput(parent);
    const toolContext: ToolContext = {
      host,
      view: this.view,
      typed: this.typed,
      invalidate: () => this.invalidate(),
    };
    this.tools = {
      select: new SelectTool(toolContext),
      room: new RoomTool(toolContext),
      wall: new WallTool(toolContext),
      separator: new SeparatorTool(toolContext),
      door: new OpeningTool(toolContext, 'door'),
      window: new OpeningTool(toolContext, 'window'),
      wallOpening: new OpeningTool(toolContext, 'wallOpening'),
      garageDoor: new OpeningTool(toolContext, 'garageDoor'),
      floorOpening: new FloorOpeningTool(toolContext),
    };
    this.setTool('room');

    this.listen(canvas, 'pointerdown', (e) => this.onPointerDown(e as PointerEvent));
    this.listen(canvas, 'pointermove', (e) => this.onPointerMove(e as PointerEvent));
    this.listen(canvas, 'pointerup', (e) => this.onPointerUp(e as PointerEvent));
    // A pointer held down on the plan is a drag: costly views hold still until it ends (ticket 33).
    this.listen(canvas, 'pointercancel', () => this.host.store.endDrag());
    this.listen(canvas, 'wheel', (e) => this.onWheel(e as WheelEvent), { passive: false });
    this.listen(canvas, 'dblclick', (e) => this.onDoubleClick(e as MouseEvent));
    this.listen(canvas, 'contextmenu', (e) => e.preventDefault());
    // Alt inverts snapping while held (ticket 26): show it at once, without waiting for a move,
    // and keep the key from opening the browser's menu.
    for (const type of ['keydown', 'keyup'] as const) {
      this.listen(window, type, (e) => {
        const key = e as KeyboardEvent;
        if (key.key !== 'Alt' || !this.last) return;
        key.preventDefault();
        this.last = { ...this.last, alt: type === 'keydown' };
        this.tool?.pointerMove(this.last);
        this.invalidate();
      });
    }
    this.resize = new ResizeObserver(() => this.measure());
    this.resize.observe(canvas);
    this.measure();
  }

  get toolName(): ToolName | null {
    return this.tool?.name ?? null;
  }

  /** The Opening type an Opening tool places (null: its kind's default size). */
  openingType(kind: OpeningKind): OpeningTypeId | null {
    const tool = this.tools[kind];
    return tool instanceof OpeningTool ? tool.chosenType : null;
  }

  /**
   * The tool bar's Opening type list (ticket 17): the tool of the type's kind, placing that type.
   * The tool keeps placing it, also when it is chosen again by its button or key.
   */
  placeOpeningType(kind: OpeningKind, type: OpeningTypeId): void {
    this.setTool(kind);
    const tool = this.tools[kind];
    if (tool instanceof OpeningTool) tool.setType(type);
  }

  /**
   * An Opening type dragged over the plan from the Library panel (ticket 21): the Opening tool of
   * its kind follows the pointer along the Wall, and the drop places it as a click would.
   */
  dragOpeningType(kind: OpeningKind, type: OpeningTypeId, e: MouseEvent, drop: boolean): void {
    if (!this.drag) {
      this.drag = { tool: this.tool?.name ?? null, kind, type: this.openingType(kind) };
      this.placeOpeningType(kind, type);
    }
    this.last = this.info(e);
    if (drop) {
      this.tool?.pointerDown(this.last);
      this.endDrag();
    } else {
      this.tool?.pointerMove(this.last);
    }
    this.invalidate();
  }

  /** A drag from the Library panel ended (dropped, or left the plan): the tool before it again. */
  endDrag(): void {
    if (!this.drag) return;
    const { tool: before, kind, type } = this.drag;
    this.drag = null;
    this.tool?.cancel();
    const dragged = this.tools[kind];
    if (dragged instanceof OpeningTool) dragged.setType(type);
    if (before) this.chooseTool(before);
    this.invalidate();
  }

  setTool(name: ToolName): void {
    const next = this.tools[name];
    if (!next || next === this.tool) return;
    this.tool?.cancel();
    this.tool = next;
    this.invalidate();
  }

  /** A tool chosen by its button or key: an Opening tool places the type last chosen for it. */
  chooseTool(name: ToolName): void {
    this.setTool(name);
  }

  /** Changed Rooms to highlight (old → new feedback). */
  setHighlight(rooms: ReadonlySet<RoomId>): void {
    this.highlight = rooms;
    this.invalidate();
  }

  /** Keyboard input routed from the app; returns true when the editor used the key. */
  handleKeyDown(e: KeyboardEvent): boolean {
    if (e.key === ' ') {
      this.spaceHeld = true;
      return true;
    }
    return this.tool?.keyDown(e, this.last) ?? false;
  }

  handleKeyUp(e: KeyboardEvent): void {
    if (e.key === ' ') this.spaceHeld = false;
  }

  /** Abandons what the current tool is doing (Level switch, dialog opening, …). */
  cancel(): void {
    this.tool?.cancel();
  }

  /** Fits everything drawn on the current Level into view (F). */
  fit(): void {
    const outlines = this.host.store.values.level(this.host.level()).outlines();
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const outline of outlines.values())
      for (const p of outline) {
        minX = Math.min(minX, p.x);
        minY = Math.min(minY, p.y);
        maxX = Math.max(maxX, p.x);
        maxY = Math.max(maxY, p.y);
      }
    if (minX === Infinity) return;
    this.view.fit({ x: minX, y: minY }, { x: maxX, y: maxY }, this.width, this.height);
    this.invalidate();
  }

  /** Asks for a redraw on the next animation frame. */
  invalidate(): void {
    if (this.frame) return;
    this.frame = requestAnimationFrame(() => {
      this.frame = 0;
      try {
        this.draw();
      } catch (error) {
        // One failed frame must never stop the editor (canvas-speed prototype lesson).
        console.error('Plan frame failed', error);
      }
    });
  }

  destroy(): void {
    cancelAnimationFrame(this.frame);
    this.tool?.cancel();
    this.resize.disconnect();
    this.cleanup.forEach((fn) => fn());
    this.typed.destroy();
  }

  private reportedScale = 0;

  private draw(): void {
    usePlanColors(this.host.colors?.() ?? DEFAULT_PLAN_COLORS);
    const dpr = window.devicePixelRatio || 1;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawPlan(this.ctx, this.view, this.host, this.width, this.height, {
      highlight: this.highlight,
      below: this.host.levelBelow?.() ?? null,
    });
    this.tool?.drawOverlay(this.ctx);
    if (this.view.scale !== this.reportedScale) {
      this.reportedScale = this.view.scale;
      this.host.zoomChanged?.(this.view.scale);
    }
  }

  private measure(): void {
    const dpr = window.devicePixelRatio || 1;
    this.width = this.canvas.clientWidth;
    this.height = this.canvas.clientHeight;
    this.canvas.width = Math.round(this.width * dpr);
    this.canvas.height = Math.round(this.height * dpr);
    this.invalidate();
  }

  private info(e: MouseEvent): PointerInfo {
    const r = this.canvas.getBoundingClientRect();
    const screen = { x: e.clientX - r.left, y: e.clientY - r.top };
    return {
      screen,
      model: this.view.toModel(screen),
      shift: e.shiftKey,
      ctrl: e.ctrlKey || e.metaKey,
      alt: e.altKey,
    };
  }

  private onPointerDown(e: PointerEvent): void {
    this.canvas.focus({ preventScroll: true });
    this.canvas.setPointerCapture(e.pointerId);
    if (e.button === 1 || (e.button === 0 && this.spaceHeld)) {
      this.pan = { x: e.clientX, y: e.clientY };
      return;
    }
    if (e.button === 2) {
      this.tool?.cancel();
      this.openContextMenu(this.info(e));
      return;
    }
    if (e.button !== 0) return;
    this.last = this.info(e);
    if (this.addRoomAt(this.last.screen)) return;
    this.host.store.beginDrag();
    this.tool?.pointerDown(this.last);
  }

  /**
   * A double click on a Wall's length label, with any tool (ticket 23): whatever the tool began
   * is cancelled, the Wall selected and the app asked to open its length editor there.
   */
  private onDoubleClick(e: MouseEvent): void {
    const p = this.info(e);
    const label = lengthLabelAt(this.host, this.view, p.screen);
    if (!label || !this.host.editLength) return;
    this.tool?.cancel();
    this.host.select([{ kind: 'wall', id: label.wall }]);
    this.invalidate();
    this.host.editLength(label.wall, p.screen, label.length);
  }

  /** Right-click: select what is under the pointer (unless it is already selected) and ask for the menu. */
  private openContextMenu(p: PointerInfo): void {
    const target = targetAt(this.host, this.view, p.model);
    if (!target) return;
    if (target.kind !== 'empty') {
      const selected = this.host
        .selection()
        .some((s) => s.kind === target.kind && s.id === target.id);
      if (!selected) this.host.select([target]);
    }
    this.invalidate();
    this.host.contextMenu?.(p.screen, target);
  }

  /** A click on an empty area's "+ Room" button makes it a Room, whatever tool is active. */
  private addRoomAt(screen: Vec): boolean {
    const level = this.host.level();
    const button = emptyAreaButtonAt(
      emptyAreaButtons(this.host.store.values.level(level).footprint().areas, this.view),
      screen,
    );
    if (!button) return false;
    this.tool?.cancel();
    const before = new Set(Object.keys(this.host.store.committedModel().rooms));
    const result = this.host.store.run(addRoom, {
      level,
      seed: button.seed,
      name: this.host.nextRoomName(),
    });
    if (!result.ok) {
      this.host.refused(result.reason, screen);
      return true;
    }
    const added = Object.values(this.host.store.committedModel().rooms).find(
      (r) => !before.has(r.id),
    );
    if (added) this.host.select([{ kind: 'room', id: added.id }]);
    this.invalidate();
    return true;
  }

  private onPointerMove(e: PointerEvent): void {
    if (this.pan) {
      this.view.panBy(e.clientX - this.pan.x, e.clientY - this.pan.y);
      this.pan = { x: e.clientX, y: e.clientY };
      this.invalidate();
      return;
    }
    this.last = this.info(e);
    this.tool?.pointerMove(this.last);
  }

  private onPointerUp(e: PointerEvent): void {
    if (this.pan) {
      this.pan = null;
      return;
    }
    if (e.button !== 0) return;
    this.last = this.info(e);
    this.tool?.pointerUp(this.last);
    this.host.store.endDrag();
  }

  private onWheel(e: WheelEvent): void {
    e.preventDefault();
    this.view.zoomAt(this.info(e).screen, Math.pow(1.1, -e.deltaY / 100));
    this.invalidate();
  }

  private listen(
    target: EventTarget,
    type: string,
    handler: (e: Event) => void,
    options?: AddEventListenerOptions,
  ): void {
    target.addEventListener(type, handler, options);
    this.cleanup.push(() => target.removeEventListener(type, handler, options));
  }
}
