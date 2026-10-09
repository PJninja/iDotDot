/** Axis-aligned rectangle in grid coordinates. */
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Rect-list collider manager, in grid coordinates. The GPU simulation
 * rasterizes the rects into its solid mask: solid cells are never passable
 * and the brush skips them.
 */
export class ColliderManager {
  private readonly rects: Rect[] = [];

  /** Fired after rects are added, removed or cleared (the GPU backend rebuilds its solid mask). */
  onChange: (() => void) | null = null;

  add(rect: Rect): void {
    this.rects.push(rect);
    this.onChange?.();
  }

  remove(rect: Rect): boolean {
    const i = this.rects.indexOf(rect);
    if (i === -1) return false;
    this.rects.splice(i, 1);
    this.onChange?.();
    return true;
  }

  clear(): void {
    this.rects.length = 0;
    this.onChange?.();
  }

  /** Visit every collider rect (used to rasterize the GPU solid mask). */
  forEachRect(visit: (rect: Rect) => void): void {
    for (const r of this.rects) visit(r);
  }

  get count(): number {
    return this.rects.length;
  }
}
