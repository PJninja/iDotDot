import { SETTINGS } from '../settings';
import type { ColliderManager, Rect } from '../engine/collider';

/** Live CSS-pixel-to-grid mapping (GpuSimulation); both change on resize. */
interface GridMapping {
  readonly tileSize: number;
  /** CSS y of grid row 0 relative to the canvas top. */
  readonly originY: number;
}

/**
 * Manages the HTML overlay layer that sits above the canvas (below the
 * header). The overlay root ignores pointer events; its children receive
 * them (see main.css).
 */
export class Overlay {
  readonly root: HTMLElement;
  /** Registered collider elements and the grid rect each currently occupies. */
  private readonly colliderRects = new Map<HTMLElement, Rect>();
  private readonly resizeObserver = new ResizeObserver(() => this.refreshColliders());

  constructor(
    rootId: string,
    private readonly colliders: ColliderManager,
    private readonly grid: GridMapping,
  ) {
    const root = document.getElementById(rootId);
    if (root === null) throw new Error(`#${rootId} element not found`);
    this.root = root;
  }

  /** Add an HTML element to the overlay. */
  add(element: HTMLElement): void {
    this.root.appendChild(element);
  }

  /**
   * Make the simulation treat an element as solid. Its DOM rect is converted
   * to a grid-space collider and kept up to date: it is re-measured when the
   * element resizes and on refreshColliders (call after window resizes).
   */
  registerCollider(element: HTMLElement): void {
    if (this.colliderRects.has(element)) return;
    const rect = this.measure(element);
    this.colliderRects.set(element, rect);
    this.colliders.add(rect);
    this.resizeObserver.observe(element);
  }

  /** Stop treating an element as solid. */
  unregisterCollider(element: HTMLElement): void {
    const rect = this.colliderRects.get(element);
    if (rect === undefined) return;
    this.colliders.remove(rect);
    this.colliderRects.delete(element);
    this.resizeObserver.unobserve(element);
  }

  /** Re-measure every registered element (layout and tile size change on resize). */
  refreshColliders(): void {
    for (const [element, old] of this.colliderRects) {
      const rect = this.measure(element);
      if (rect.x === old.x && rect.y === old.y && rect.w === old.w && rect.h === old.h) continue;
      this.colliders.remove(old);
      this.colliders.add(rect);
      this.colliderRects.set(element, rect);
    }
  }

  /** Grid-space rect covering every cell the element touches. */
  private measure(element: HTMLElement): Rect {
    const rect = element.getBoundingClientRect();
    const { tileSize, originY } = this.grid;
    const top = rect.top - SETTINGS.HEADER_HEIGHT - originY;
    const x = Math.floor(rect.left / tileSize);
    const y = Math.floor(top / tileSize);
    return {
      x,
      y,
      w: Math.max(1, Math.ceil(rect.right / tileSize) - x),
      h: Math.max(1, Math.ceil((top + rect.height) / tileSize) - y),
    };
  }
}
