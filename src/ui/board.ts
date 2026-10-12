import type { ElementRegistry } from '../engine/element';
import type { Rect } from '../engine/collider';
import type { GpuSimulation } from '../engine/gpu/gpu-simulation';
import type { Project } from '../projects/project';
import { SITE } from '../site';
import { BOARD_MARGIN, layoutChips, type BoardLayout } from './board-layout';
import type { Overlay } from './overlay';
import { fitRows, hashString, letterCells, ringCells, seededRandom, textMask } from './tile-art';

const TOP_PX = 16;
const NAME_PX = 44;
const TAGLINE_PX = 28;
const MIN_LETTER_ROWS = 5;
const CHIP_FILL_MIX = 0.2;
const BACKGROUND: [number, number, number] = [26, 26, 46];

interface Chip {
  project: Project;
  element: HTMLButtonElement;
  type: number;
  lit: boolean;
}

/**
 * The portfolio laid over the world: one chip per project (a collider ringed with tiles of
 * the project's own material), the name in tile lettering, a contact line and a tag bar.
 * Layout is in whole cells so every DOM edge lands on a cell edge; the tiles themselves
 * are written into the grid by `stamp`, which must run after every grid reset.
 */
export class Board {
  private readonly chips: Chip[] = [];
  private readonly heading: HTMLHeadingElement;
  private readonly contact: HTMLElement;
  readonly tagBar: HTMLElement;
  private layout: BoardLayout | null = null;
  private nameRows = 0;
  private taglineRows = 0;

  /** Exact grid rect of a chip's interior, or null while the chips are hidden. */
  private chipRect(index: number): Rect | null {
    const box = this.layout?.chips[index];
    return box === undefined ? null : { x: box.gx, y: box.gy, w: box.gw, h: box.gh };
  }

  /** Called when a chip is activated. */
  onOpen: ((project: Project, chip: HTMLElement) => void) | null = null;

  constructor(
    private readonly world: GpuSimulation,
    overlay: Overlay,
    private readonly registry: ElementRegistry,
    projects: readonly Project[],
  ) {
    this.heading = document.createElement('h1');
    this.heading.className = 'visually-hidden';
    this.heading.textContent = `${SITE.name}: ${SITE.tagline}`;
    overlay.add(this.heading);

    for (const project of projects) {
      const element = this.createChip(project);
      overlay.add(element);
      const index = this.chips.length;
      overlay.registerCollider(element, () => this.chipRect(index));
      const type = registry.getByName(project.border)?.type;
      if (type === undefined) throw new Error(`Project "${project.id}" uses unregistered border "${project.border}"`);
      this.chips.push({ project, element, type, lit: false });
    }

    this.contact = this.createContact();
    overlay.add(this.contact);
    overlay.registerCollider(this.contact);

    this.tagBar = document.createElement('div');
    this.tagBar.className = 'tag-bar';
    this.tagBar.setAttribute('role', 'group');
    this.tagBar.setAttribute('aria-label', 'Filter projects by tag');
    overlay.add(this.tagBar);
    overlay.registerCollider(this.tagBar);
  }

  private createChip(project: Project): HTMLButtonElement {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'chip';
    chip.dataset.id = project.id;
    chip.setAttribute('aria-haspopup', 'dialog');
    chip.setAttribute('aria-expanded', 'false');

    const head = document.createElement('span');
    head.className = 'chip-head';
    const icon = document.createElement('span');
    icon.className = 'chip-icon';
    icon.innerHTML = project.icon;
    const title = document.createElement('span');
    title.className = 'chip-title';
    title.textContent = project.title;
    head.append(icon, title);

    const summary = document.createElement('span');
    summary.className = 'chip-summary';
    summary.textContent = project.summary;

    const tags = document.createElement('span');
    tags.className = 'chip-tags';
    project.tags.forEach((tag, i) => {
      if (i > 0) tags.appendChild(document.createElement('i'));
      const word = document.createElement('span');
      word.textContent = tag;
      tags.appendChild(word);
    });

    chip.append(head, summary, tags);
    const [r, g, b] = this.registry.getByName(project.border)?.defaultColor ?? BACKGROUND;
    const mix = (bg: number, c: number): number => Math.round(bg * (1 - CHIP_FILL_MIX) + c * CHIP_FILL_MIX);
    chip.style.setProperty('--chip-fill', `rgb(${mix(BACKGROUND[0], r)}, ${mix(BACKGROUND[1], g)}, ${mix(BACKGROUND[2], b)})`);
    chip.addEventListener('click', () => this.onOpen?.(project, chip));
    return chip;
  }

  private createContact(): HTMLElement {
    const line = document.createElement('p');
    line.className = 'contact-line';
    const add = (node: HTMLElement): void => {
      line.append(node, ' ');
    };
    if (SITE.email !== '') {
      const email = document.createElement('a');
      email.href = `mailto:${SITE.email}`;
      email.textContent = 'Email';
      email.title = 'Copy the address';
      email.addEventListener('click', (e) => {
        e.preventDefault();
        void navigator.clipboard
          .writeText(SITE.email)
          .then(() => {
            email.textContent = 'Copied';
            window.setTimeout(() => (email.textContent = 'Email'), 1800);
          })
          .catch(() => {
            window.location.href = `mailto:${SITE.email}`;
          });
      });
      add(email);
    }
    for (const [label, href] of [['GitHub', SITE.github], ['Resume', SITE.resume]] as const) {
      if (href === '') continue;
      const a = document.createElement('a');
      a.href = href;
      a.textContent = label;
      add(a);
    }
    return line;
  }

  /**
   * Position every element on cell edges for the current grid. Returns false when the
   * chips do not fit (small windows), in which case they are hidden.
   */
  place(): boolean {
    const { tileSize: tile, originY } = this.world;
    const cells = (px: number): number => Math.max(1, Math.round(px / tile));
    const rowTop = (row: number): number => originY + row * tile;
    const rowAtOrBelow = (cssY: number): number => Math.ceil((cssY - originY) / tile - 1e-6);

    const margin = cells(BOARD_MARGIN);
    const nameRow = rowAtOrBelow(TOP_PX);
    const availCells = Math.floor(window.innerWidth / tile) - 2 * margin;
    this.nameRows = fitRows(SITE.name, Math.max(7, cells(NAME_PX)), availCells, MIN_LETTER_ROWS) || MIN_LETTER_ROWS;
    this.taglineRows = fitRows(SITE.tagline, Math.max(6, cells(TAGLINE_PX)), availCells, MIN_LETTER_ROWS);
    const taglineRow = nameRow + this.nameRows + cells(8);
    const taglineSpace = this.taglineRows > 0 ? this.taglineRows + cells(10) : cells(10) - cells(8);
    const contactRow = taglineRow + taglineSpace;

    const width = Math.max(120, window.innerWidth - 2 * margin * tile);
    this.contact.style.left = `${margin * tile}px`;
    this.contact.style.top = `${rowTop(contactRow)}px`;
    this.contact.style.maxWidth = `${width}px`;
    const contactRows = Math.ceil(this.contact.offsetHeight / tile);

    const tagRow = contactRow + contactRows + cells(6);
    this.tagBar.style.left = `${margin * tile}px`;
    this.tagBar.style.top = `${rowTop(tagRow)}px`;
    this.tagBar.style.maxWidth = `${width}px`;
    const tagRows = Math.ceil(this.tagBar.offsetHeight / tile);

    const topRow = tagRow + tagRows + cells(16);
    this.layout = layoutChips({
      tile,
      canvasWidth: window.innerWidth,
      gridHeight: this.world.height,
      topRow,
      count: this.chips.length,
    });
    for (const [i, chip] of this.chips.entries()) {
      const box = this.layout?.chips[i];
      chip.element.hidden = box === undefined;
      if (box === undefined || this.layout === null) continue;
      const s = chip.element.style;
      s.left = `${box.gx * tile}px`;
      s.top = `${rowTop(box.gy)}px`;
      s.width = `${box.gw * tile}px`;
      s.height = `${box.gh * tile}px`;
      s.setProperty('--chip-scale', String(this.layout.scale));
    }
    return this.layout !== null;
  }

  /** Write the name lettering and every chip's ring into the grid (after a grid reset). */
  stamp(): void {
    if (this.layout === null) return;
    this.stampLettering();
    for (const chip of this.chips) this.stampRing(chip);
  }

  private stampLettering(): void {
    const { tileSize: tile, originY } = this.world;
    const cells = (px: number): number => Math.max(1, Math.round(px / tile));
    const margin = cells(BOARD_MARGIN);
    const nameRow = Math.ceil((TOP_PX - originY) / tile - 1e-6);
    const random = seededRandom(hashString(SITE.name));
    const name = textMask(SITE.name, this.nameRows);
    this.world.stampCells(margin, nameRow, name.width, name.height, letterCells(name, random));
    if (this.taglineRows === 0) return;
    const tagline = textMask(SITE.tagline, this.taglineRows);
    this.world.stampCells(
      margin,
      nameRow + this.nameRows + cells(8),
      tagline.width,
      tagline.height,
      letterCells(tagline, random),
    );
  }

  private stampRing(chip: Chip): void {
    const index = this.chips.indexOf(chip);
    const box = this.layout?.chips[index];
    if (box === undefined || this.layout === null) return;
    const t = this.layout.ring;
    const w = box.gw + 2 * t;
    const h = box.gh + 2 * t;
    const random = seededRandom(hashString(chip.project.id));
    this.world.stampCells(box.gx - t, box.gy - t, w, h, ringCells(w, h, t, chip.type, chip.lit, random));
  }

  /**
   * Light the rings of the projects in `lit` (null = none) and restore the others. With
   * `restamp` false only the state changes, for use before `stamp` writes the whole board.
   */
  setLit(lit: ReadonlySet<string> | null, restamp = true): void {
    for (const chip of this.chips) {
      const next = lit?.has(chip.project.id) ?? false;
      if (next === chip.lit) continue;
      chip.lit = next;
      if (restamp) this.stampRing(chip);
    }
  }

  /** The chip element for a project id, if the board has one. */
  chipFor(id: string): HTMLElement | null {
    return this.chips.find((c) => c.project.id === id)?.element ?? null;
  }

  /** Material colors of a project's ring, used for the preview window frame. */
  borderElement(project: Project): { getColor(value: number, variant: number): [number, number, number] } | null {
    return this.registry.getByName(project.border);
  }
}
