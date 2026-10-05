import type { Vec } from '@urdama/core';

/** The plan's camera: millimetres ↔ CSS pixels. */
export class View {
  /** CSS pixels per millimetre */
  scale = 0.1;
  /** Screen position (CSS px) of the plan origin */
  offset: Vec = { x: 80, y: 80 };
  /**
   * Whether the view keeps fitting the plan when its panel changes size (ticket 30): from the
   * start and after every fit, until the user zooms or pans.
   */
  fitted = true;

  toScreen(p: Vec): Vec {
    return { x: p.x * this.scale + this.offset.x, y: p.y * this.scale + this.offset.y };
  }

  toModel(p: Vec): Vec {
    return { x: (p.x - this.offset.x) / this.scale, y: (p.y - this.offset.y) / this.scale };
  }

  /** Zooms by `factor` keeping the model point under `screen` fixed. */
  zoomAt(screen: Vec, factor: number): void {
    const next = Math.min(2, Math.max(0.005, this.scale * factor));
    this.offset = {
      x: screen.x - ((screen.x - this.offset.x) * next) / this.scale,
      y: screen.y - ((screen.y - this.offset.y) * next) / this.scale,
    };
    this.scale = next;
    this.fitted = false;
  }

  panBy(dx: number, dy: number): void {
    this.offset = { x: this.offset.x + dx, y: this.offset.y + dy };
    this.fitted = false;
  }

  /** Fits a model rectangle into a viewport of the given CSS size, with a margin. */
  fit(min: Vec, max: Vec, width: number, height: number, margin = 60): void {
    const w = Math.max(max.x - min.x, 1000);
    const h = Math.max(max.y - min.y, 1000);
    this.scale = Math.min(
      2,
      Math.max(0.005, Math.min((width - 2 * margin) / w, (height - 2 * margin) / h)),
    );
    this.offset = {
      x: (width - w * this.scale) / 2 - min.x * this.scale,
      y: (height - h * this.scale) / 2 - min.y * this.scale,
    };
    this.fitted = true;
  }

  /** The model rectangle visible in a viewport of the given CSS size. */
  visible(width: number, height: number): { min: Vec; max: Vec } {
    return { min: this.toModel({ x: 0, y: 0 }), max: this.toModel({ x: width, y: height }) };
  }
}
