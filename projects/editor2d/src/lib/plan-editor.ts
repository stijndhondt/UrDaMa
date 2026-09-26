/**
 * The plan editor (ADR 0005): a framework-free Canvas2D editor for one Level.
 * The app around it supplies an EditorHost and calls `invalidate()` when the model changes.
 */
import type { RoomId } from '@lakudemis/core';
import { drawPlan } from './draw-plan';
import type { EditorHost } from './host';
import { RoomTool } from './tools/room-tool';
import { WallTool } from './tools/wall-tool';
import { SelectTool } from './tools/select-tool';
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
    };
    this.setTool('room');

    this.listen(canvas, 'pointerdown', (e) => this.onPointerDown(e as PointerEvent));
    this.listen(canvas, 'pointermove', (e) => this.onPointerMove(e as PointerEvent));
    this.listen(canvas, 'pointerup', (e) => this.onPointerUp(e as PointerEvent));
    this.listen(canvas, 'wheel', (e) => this.onWheel(e as WheelEvent), { passive: false });
    this.listen(canvas, 'contextmenu', (e) => e.preventDefault());
    this.resize = new ResizeObserver(() => this.measure());
    this.resize.observe(canvas);
    this.measure();
  }

  get toolName(): ToolName | null {
    return this.tool?.name ?? null;
  }

  setTool(name: ToolName): void {
    const next = this.tools[name];
    if (!next || next === this.tool) return;
    this.tool?.cancel();
    this.tool = next;
    this.invalidate();
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

  private draw(): void {
    const dpr = window.devicePixelRatio || 1;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawPlan(this.ctx, this.view, this.host, this.width, this.height, {
      highlight: this.highlight,
    });
    this.tool?.drawOverlay(this.ctx);
  }

  private measure(): void {
    const dpr = window.devicePixelRatio || 1;
    this.width = this.canvas.clientWidth;
    this.height = this.canvas.clientHeight;
    this.canvas.width = Math.round(this.width * dpr);
    this.canvas.height = Math.round(this.height * dpr);
    this.invalidate();
  }

  private info(e: PointerEvent | WheelEvent): PointerInfo {
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
      return;
    }
    if (e.button !== 0) return;
    this.last = this.info(e);
    this.tool?.pointerDown(this.last);
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
