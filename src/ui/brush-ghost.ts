import type { BrushShape } from './brush-picker';

/**
 * Outline of the cells the brush would paint, drawn under the pointer. It is a
 * small 2D canvas snapped to the tile grid and redrawn only when the shape,
 * radius or tile size changes, so following the pointer is just a move. The
 * covered cells match the paint shader's test (distance from the center cell
 * at most the radius, Euclidean for circles, Chebyshev for squares).
 */
export class BrushGhost {
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private drawnKey = '';

  constructor() {
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'brush-ghost';
    this.canvas.hidden = true;
    const ctx = this.canvas.getContext('2d');
    if (ctx === null) throw new Error('2D canvas unavailable');
    this.ctx = ctx;
    document.body.appendChild(this.canvas);
  }

  /** Show the brush centered on grid cell (gx, gy); `top` is the CSS y of grid row 0. */
  show(gx: number, gy: number, shape: BrushShape, radius: number, tileSize: number, top: number): void {
    const r = Math.max(0, Math.round(radius));
    this.draw(shape, r, tileSize);
    this.canvas.style.transform = `translate(${(gx - r) * tileSize}px, ${top + (gy - r) * tileSize}px)`;
    this.canvas.hidden = false;
  }

  hide(): void {
    this.canvas.hidden = true;
  }

  private draw(shape: BrushShape, r: number, tileSize: number): void {
    const dpr = window.devicePixelRatio || 1;
    const key = `${shape}:${r}:${tileSize}:${dpr}`;
    if (key === this.drawnKey) return;
    this.drawnKey = key;

    const span = 2 * r + 1;
    const tilePx = Math.max(1, Math.round(tileSize * dpr));
    this.canvas.width = span * tilePx;
    this.canvas.height = span * tilePx;
    this.canvas.style.width = `${(span * tilePx) / dpr}px`;
    this.canvas.style.height = `${(span * tilePx) / dpr}px`;

    const covered = (dx: number, dy: number): boolean => {
      if (Math.abs(dx) > r || Math.abs(dy) > r) return false;
      return shape === 'square' || Math.hypot(dx, dy) <= r;
    };

    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (covered(dx, dy)) ctx.fillRect((dx + r) * tilePx, (dy + r) * tilePx, tilePx, tilePx);
      }
    }

    // Edge of the covered cells: a line on every side that faces an uncovered cell.
    const line = Math.max(1, Math.round(dpr));
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (!covered(dx, dy)) continue;
        const x = (dx + r) * tilePx;
        const y = (dy + r) * tilePx;
        if (!covered(dx, dy - 1)) ctx.fillRect(x, y, tilePx, line);
        if (!covered(dx, dy + 1)) ctx.fillRect(x, y + tilePx - line, tilePx, line);
        if (!covered(dx - 1, dy)) ctx.fillRect(x, y, line, tilePx);
        if (!covered(dx + 1, dy)) ctx.fillRect(x + tilePx - line, y, line, tilePx);
      }
    }
  }
}
