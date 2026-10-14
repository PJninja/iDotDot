import type { Element, ElementRegistry } from '../engine/element';
import { SETTINGS } from '../settings';
import { SEARCH_ICON } from './gallery';

/** Grid-of-tiles icon for the picker button. */
const ICON_SVG =
  '<svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">' +
  '<rect x="1.5" y="1.5" width="6.5" height="6.5" rx="1"/>' +
  '<rect x="10" y="1.5" width="6.5" height="6.5" rx="1"/>' +
  '<rect x="1.5" y="10" width="6.5" height="6.5" rx="1"/>' +
  '<rect x="10" y="10" width="6.5" height="6.5" rx="1"/>' +
  '</svg>';

const SVG_OPEN =
  '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">';

/** Filter toggles, in the order they appear. */
const FILTERS: readonly { label: string; icon: string; matches: (e: Element) => boolean }[] = [
  {
    label: 'Solid',
    icon: SVG_OPEN + '<path d="M2.5 2.5 H13.5 V13.5 H2.5 Z M2.5 8 H13.5 M8 2.5 V8 M5.5 8 V13.5 M10.5 8 V13.5"/></svg>',
    matches: (e) => e.phase === 'solid',
  },
  {
    label: 'Liquid',
    icon: SVG_OPEN + '<path d="M8 2 C8 2 3.5 7.2 3.5 10 A4.5 4.5 0 0 0 12.5 10 C12.5 7.2 8 2 8 2 Z"/></svg>',
    matches: (e) => e.phase === 'liquid',
  },
  {
    label: 'Gas',
    icon:
      SVG_OPEN +
      '<path d="M2 4.5 Q5 2.5 8 4.5 T14 4.5 M2 8.5 Q5 6.5 8 8.5 T14 8.5 M2 12.5 Q5 10.5 8 12.5 T14 12.5"/></svg>',
    matches: (e) => e.phase === 'gas',
  },
  {
    label: 'Emitters',
    icon:
      SVG_OPEN + '<path d="M5 10.5 H11 V14 H5 Z M8 8 V2.5 M5 8.5 L2.5 5 M11 8.5 L13.5 5"/></svg>',
    matches: (e) => e.isEmitter,
  },
];

/**
 * Header element picker: an icon button that opens a panel listing every
 * element not marked hidden. The selected element is what the brush paints
 * (Air acts as an eraser). A search field and Solid / Liquid / Gas / Emitters
 * toggles narrow the list (one toggle at a time: pressing one releases the others,
 * pressing it again shows all; Air passes every toggle so the eraser is always at
 * hand). Closes on selection, Escape, or an outside click.
 */
export class ElementPicker {
  /** Called when the selected element changes. */
  onChange: ((type: number) => void) | null = null;

  private readonly root: HTMLDivElement;
  private readonly button: HTMLButtonElement;
  private readonly panel: HTMLDivElement;
  private readonly search: HTMLInputElement;
  private readonly list: HTMLUListElement;
  private readonly empty: HTMLParagraphElement;
  private readonly options: { element: Element; li: HTMLLIElement }[] = [];
  private readonly toggles: { filter: (typeof FILTERS)[number]; button: HTMLButtonElement }[] = [];
  private activeFilter: (typeof FILTERS)[number] | null = null;
  private selectedType: number;

  constructor(registry: ElementRegistry, initialType: number) {
    this.selectedType = initialType;

    this.root = document.createElement('div');
    this.root.className = 'element-picker';

    this.button = document.createElement('button');
    this.button.type = 'button';
    this.button.className = 'picker-button';
    this.button.title = 'Choose element';
    this.button.setAttribute('aria-haspopup', 'listbox');
    this.button.setAttribute('aria-expanded', 'false');
    this.button.innerHTML = ICON_SVG;

    this.panel = document.createElement('div');
    this.panel.className = 'picker-dropdown element-panel';
    this.panel.hidden = true;

    const filters = document.createElement('div');
    filters.className = 'element-filters';

    this.search = document.createElement('input');
    this.search.type = 'search';
    this.search.className = 'element-search';
    this.search.placeholder = 'Search';
    this.search.setAttribute('aria-label', 'Search elements');
    this.search.autocomplete = 'off';
    this.search.spellcheck = false;
    this.search.addEventListener('input', () => this.applyFilter());
    this.search.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter') return;
      const first = this.options.find((o) => !o.li.hidden);
      if (first !== undefined) this.select(first.element);
    });
    const searchBox = document.createElement('label');
    searchBox.className = 'element-search-box';
    searchBox.innerHTML = SEARCH_ICON;
    searchBox.appendChild(this.search);
    filters.appendChild(searchBox);

    const filterGroup = document.createElement('div');
    filterGroup.className = 'element-toggles';
    filterGroup.setAttribute('role', 'group');
    filterGroup.setAttribute('aria-label', 'Filter elements');
    for (const filter of FILTERS) {
      const { label, icon } = filter;
      const toggle = document.createElement('button');
      toggle.type = 'button';
      toggle.className = 'element-toggle';
      toggle.title = label;
      toggle.setAttribute('aria-label', label);
      toggle.setAttribute('aria-pressed', 'false');
      toggle.innerHTML = icon;
      toggle.addEventListener('click', () => this.toggleFilter(filter));
      this.toggles.push({ filter, button: toggle });
      filterGroup.appendChild(toggle);
    }
    filters.appendChild(filterGroup);

    this.list = document.createElement('ul');
    this.list.className = 'element-list';
    this.list.setAttribute('role', 'listbox');
    for (const element of registry.list().filter((e) => !e.hidden)) {
      this.list.appendChild(this.createOption(element));
    }

    this.empty = document.createElement('p');
    this.empty.className = 'element-empty';
    this.empty.textContent = 'No elements match.';
    this.empty.hidden = true;

    this.panel.append(filters, this.list, this.empty);
    this.root.appendChild(this.button);
    this.root.appendChild(this.panel);

    const actions = document.querySelector('#header .header-actions');
    if (actions === null) throw new Error('#header .header-actions not found');
    actions.appendChild(this.root);

    this.button.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggle();
    });
    document.addEventListener('pointerdown', (e) => {
      if (e.target instanceof Node && !this.root.contains(e.target)) {
        this.close();
      }
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') this.close();
    });
  }

  get type(): number {
    return this.selectedType;
  }

  private createOption(element: Element): HTMLLIElement {
    const li = document.createElement('li');
    li.className = 'picker-option';
    li.setAttribute('role', 'option');
    li.dataset.type = String(element.type);
    li.setAttribute('aria-selected', String(element.type === this.selectedType));

    const swatch = document.createElement('span');
    swatch.className = 'picker-swatch';
    const [r, g, b] = element.defaultColor;
    swatch.style.background = `rgb(${r}, ${g}, ${b})`;

    const label = document.createElement('span');
    label.textContent = element.displayName;

    li.appendChild(swatch);
    li.appendChild(label);
    li.addEventListener('click', () => this.select(element));
    this.options.push({ element, li });
    return li;
  }

  private toggleFilter(filter: (typeof FILTERS)[number]): void {
    this.activeFilter = this.activeFilter === filter ? null : filter;
    for (const { filter: f, button } of this.toggles) {
      button.setAttribute('aria-pressed', String(f === this.activeFilter));
    }
    this.applyFilter();
  }

  private applyFilter(): void {
    const query = this.search.value.trim().toLowerCase();
    let shown = 0;
    for (const { element, li } of this.options) {
      const filterMatch =
        this.activeFilter === null || element.type === SETTINGS.AIR_TYPE || this.activeFilter.matches(element);
      const textMatch =
        query === '' ||
        element.displayName.toLowerCase().includes(query) ||
        element.name.toLowerCase().includes(query);
      li.hidden = !(filterMatch && textMatch);
      if (!li.hidden) shown++;
    }
    this.empty.hidden = shown > 0;
  }

  private select(element: Element): void {
    this.selectedType = element.type;
    for (const { element: e, li } of this.options) {
      li.setAttribute('aria-selected', String(e.type === element.type));
    }
    this.close();
    this.onChange?.(element.type);
  }

  private toggle(): void {
    if (this.panel.hidden) {
      this.open();
    } else {
      this.close();
    }
  }

  private open(): void {
    this.panel.hidden = false;
    this.button.setAttribute('aria-expanded', 'true');
    // Typing right after opening replaces the last search. Touch screens skip it so the keyboard stays down.
    if (window.matchMedia('(pointer: fine)').matches) {
      this.search.focus();
      this.search.select();
    }
  }

  private close(): void {
    if (this.panel.hidden) return;
    if (this.panel.contains(document.activeElement)) this.button.focus();
    this.panel.hidden = true;
    this.button.setAttribute('aria-expanded', 'false');
  }
}
