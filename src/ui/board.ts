import type { Rect } from '../engine/collider';
import type { ElementRegistry } from '../engine/element';
import type { GpuSimulation } from '../engine/gpu/gpu-simulation';
import { fitWorld, type WorldSnapshot } from '../engine/world-file';
import type { Project } from '../projects/project';
import { SITE } from '../site';
import { WIDE } from '../worlds/board-slots';
import { placeBoard, type BoardPlacement, type CellBox } from './board-layout';
import { Gallery } from './gallery';
import { headerHeight } from './frame';
import type { Overlay } from './overlay';
import type { ProjectFilter } from './project-filter';
import { hashString, ringCells, seededRandom } from './tile-art';

const CHIP_FILL_MIX = 0.2;
const BACKGROUND: [number, number, number] = [13, 42, 31];

interface Slot {
  element: HTMLButtonElement;
  icon: HTMLElement;
  title: HTMLElement;
  summary: HTMLElement;
  tags: HTMLElement;
  /** The project shown in this slot, null when the slot is empty on this page. */
  project: Project | null;
  lit: boolean;
}

/**
 * The portfolio laid into the world: a block of chip slots in the rock under the surface and
 * a gallery corridor with the search, tags and pager. Positions come from the shared slot
 * geometry (`worlds/board-slots.ts`) through the same anchor as the default world, so the
 * scenery built around the slots lines up at every window size. Each slot is a collider with
 * a ring of the project's material stamped around it; an empty slot shows the world's own
 * rock. `stamp` must run after every grid reset.
 */
export class Board {
  private readonly slots: Slot[] = [];
  private readonly gallery: Gallery;
  private placement: BoardPlacement | null = null;
  private base: Uint32Array | null = null;
  private baseKey = '';
  private baseWorld: WorldSnapshot | null = null;

  /** Called when a chip is activated. */
  onOpen: ((project: Project, chip: HTMLElement) => void) | null = null;

  constructor(
    private readonly world: GpuSimulation,
    private readonly overlay: Overlay,
    private readonly registry: ElementRegistry,
    private readonly filter: ProjectFilter,
  ) {
    const heading = document.createElement('h1');
    heading.className = 'visually-hidden';
    heading.textContent = SITE.name;
    overlay.add(heading);

    for (let i = 0; i < WIDE.slots.length; i++) {
      const slot = this.createSlot();
      slot.element.hidden = true;
      overlay.add(slot.element);
      this.slots.push(slot);
    }

    this.gallery = new Gallery(filter);
    this.gallery.element.hidden = true;
    overlay.add(this.gallery.element);

    filter.onChange = () => this.refresh();
  }

  private createSlot(): Slot {
    const element = document.createElement('button');
    element.type = 'button';
    element.className = 'chip';
    element.setAttribute('aria-haspopup', 'dialog');
    element.setAttribute('aria-expanded', 'false');

    const head = document.createElement('span');
    head.className = 'chip-head';
    const icon = document.createElement('span');
    icon.className = 'chip-icon';
    const title = document.createElement('span');
    title.className = 'chip-title';
    head.append(icon, title);
    const summary = document.createElement('span');
    summary.className = 'chip-summary';
    const tags = document.createElement('span');
    tags.className = 'chip-tags';
    element.append(head, summary, tags);

    const slot: Slot = { element, icon, title, summary, tags, project: null, lit: false };
    element.addEventListener('click', () => {
      if (slot.project !== null) this.onOpen?.(slot.project, element);
    });
    return slot;
  }

  /** Fill a slot's text and colors from a project. */
  private fill(slot: Slot, project: Project): void {
    slot.project = project;
    slot.element.dataset.id = project.id;
    slot.icon.innerHTML = project.icon;
    slot.title.textContent = project.title;
    slot.summary.textContent = project.summary;
    slot.tags.replaceChildren(
      ...project.tags.map((tag) => {
        const word = document.createElement('span');
        word.textContent = tag;
        return word;
      }),
    );
    const [r, g, b] = this.registry.getByName(project.border)?.defaultColor ?? BACKGROUND;
    const mix = (bg: number, c: number): number => Math.round(bg * (1 - CHIP_FILL_MIX) + c * CHIP_FILL_MIX);
    slot.element.style.setProperty('--chip-fill', `rgb(${mix(BACKGROUND[0], r)}, ${mix(BACKGROUND[1], g)}, ${mix(BACKGROUND[2], b)})`);
  }

  /** Projects per page for the current layout (0 when the board does not fit). */
  private get pageSize(): number {
    return this.placement?.chips.length ?? 0;
  }

  /**
   * Lay the board out for the current grid and window and show the current page. Returns
   * false when it does not fit (short or very narrow windows), in which case everything is
   * hidden and the caller shows the plain page.
   */
  place(): boolean {
    this.placement = placeBoard({
      tile: this.world.tileSize,
      gridWidth: this.world.width,
      gridHeight: this.world.height,
      windowWidth: window.innerWidth,
      windowHeight: window.innerHeight,
      headerHeight: headerHeight(),
      world: this.baseWorld ?? undefined,
    });
    const placement = this.placement;
    if (placement === null) {
      for (const slot of this.slots) this.hideSlot(slot);
      this.setGalleryShown(false);
      return false;
    }

    const { tileSize: tile, originY } = this.world;
    const boxStyle = (element: HTMLElement, box: CellBox): void => {
      element.style.left = `${box.gx * tile}px`;
      element.style.top = `${originY + box.gy * tile}px`;
      element.style.width = `${box.gw * tile}px`;
      element.style.height = `${box.gh * tile}px`;
    };
    placement.chips.forEach((box, i) => boxStyle(this.slots[i].element, box));
    for (const slot of this.slots) slot.element.style.setProperty('--chip-scale', String(placement.chipScale));
    boxStyle(this.gallery.element, placement.gallery);
    this.gallery.element.style.setProperty('--gallery-scale', String(placement.galleryScale));
    this.gallery.setCompact(placement.mode !== 'wide');
    this.setGalleryShown(true);
    this.gallery.render(this.pageSize);

    const items = this.filter.pageItems(this.pageSize);
    this.slots.forEach((slot, i) => {
      const project = i < placement.chips.length ? (items[i] ?? null) : null;
      slot.lit = this.filter.active;
      if (project === null) this.hideSlot(slot);
      else this.showSlot(slot, project);
    });
    return true;
  }

  private showSlot(slot: Slot, project: Project): void {
    this.fill(slot, project);
    slot.element.hidden = false;
    const index = this.slots.indexOf(slot);
    this.overlay.registerCollider(slot.element, () => this.cellRect(this.placement?.chips[index]));
  }

  /** A cell box as a collider rect: laid out in whole cells, so it is exact and never measured from the DOM. */
  private cellRect(box: CellBox | undefined): Rect | null {
    return box === undefined ? null : { x: box.gx, y: box.gy, w: box.gw, h: box.gh };
  }

  private hideSlot(slot: Slot): void {
    slot.project = null;
    slot.element.hidden = true;
    this.overlay.unregisterCollider(slot.element);
  }

  private setGalleryShown(shown: boolean): void {
    this.gallery.element.hidden = !shown;
    if (shown) this.overlay.registerCollider(this.gallery.element, () => this.cellRect(this.placement?.gallery));
    else this.overlay.unregisterCollider(this.gallery.element);
  }

  /** The world the slots' empty rock is restored from; null when the grid starts empty. */
  setBase(world: WorldSnapshot | null): void {
    this.baseWorld = world;
    this.baseKey = '';
  }

  /** Cells of the default world on the current grid, cached until the grid or tile size changes. */
  private baseCells(): Uint32Array | null {
    if (this.baseWorld === null) return null;
    const key = `${this.world.width}x${this.world.height}@${this.world.tileSize}`;
    if (key !== this.baseKey || this.base === null) {
      this.base = fitWorld(this.baseWorld, this.world.width, this.world.height, this.world.tileSize);
      this.baseKey = key;
    }
    return this.base;
  }

  /** Write every slot's ring or empty rock into the grid (after a grid reset). */
  stamp(): void {
    for (let i = 0; i < this.pageSize; i++) this.stampSlot(i);
  }

  /** Ring around a shown chip (the interior is cleared), or the world's own cells for an empty slot. */
  private stampSlot(index: number): void {
    const placement = this.placement;
    const box = placement?.chips[index];
    if (placement === null || box === undefined) return;
    const slot = this.slots[index];
    const t = placement.ring;
    const x = box.gx - t;
    const y = box.gy - t;
    const w = box.gw + 2 * t;
    const h = box.gh + 2 * t;
    if (slot.project === null) {
      this.world.stampCells(x, y, w, h, this.restoreCells(x, y, w, h));
      return;
    }
    const type = this.registry.getByName(slot.project.border)?.type;
    if (type === undefined) throw new Error(`Project "${slot.project.id}" uses unregistered border "${slot.project.border}"`);
    const random = seededRandom(hashString(slot.project.id));
    this.world.stampCells(x, y, w, h, ringCells(w, h, t, type, slot.lit, random));
  }

  private restoreCells(x: number, y: number, w: number, h: number): Uint32Array {
    const words = new Uint32Array(w * h);
    const base = this.baseCells();
    if (base === null) return words;
    for (let row = 0; row < h; row++) {
      const gy = y + row;
      if (gy < 0 || gy >= this.world.height) continue;
      for (let col = 0; col < w; col++) {
        const gx = x + col;
        if (gx >= 0 && gx < this.world.width) words[row * w + col] = base[gy * this.world.width + gx];
      }
    }
    return words;
  }

  /**
   * Show the page the filter now selects: update the chips that changed, restamp only their
   * slots, and redraw the gallery. Called on every search, tag or page change.
   */
  private refresh(): void {
    const placement = this.placement;
    if (placement === null) return;
    this.gallery.render(this.pageSize);
    const items = this.filter.pageItems(this.pageSize);
    const lit = this.filter.active;
    for (const [i, slot] of this.slots.entries()) {
      if (i >= placement.chips.length) continue;
      const project = items[i] ?? null;
      if (project === slot.project && lit === slot.lit) continue;
      slot.lit = lit;
      if (project === null) this.hideSlot(slot);
      else this.showSlot(slot, project);
      this.stampSlot(i);
    }
  }

  /** The chip element for a project id, if it is on the current page. */
  chipFor(id: string): HTMLElement | null {
    return this.slots.find((s) => s.project?.id === id)?.element ?? null;
  }

  /** Material colors of a project's ring, used for the preview window frame. */
  borderElement(project: Project): { getColor(value: number, variant: number): [number, number, number] } | null {
    return this.registry.getByName(project.border);
  }
}
