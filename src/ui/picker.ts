import type { Element, ElementRegistry } from '../engine/element';

/** Grid-of-tiles icon for the picker button. */
const ICON_SVG =
  '<svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">' +
  '<rect x="1.5" y="1.5" width="6.5" height="6.5" rx="1"/>' +
  '<rect x="10" y="1.5" width="6.5" height="6.5" rx="1"/>' +
  '<rect x="1.5" y="10" width="6.5" height="6.5" rx="1"/>' +
  '<rect x="10" y="10" width="6.5" height="6.5" rx="1"/>' +
  '</svg>';

/**
 * Header element picker: an icon button that opens a dropdown listing
 * every registered element. The selected element is what the brush
 * paints (Air acts as an eraser). Closes on selection, Escape, or an
 * outside click.
 */
export class ElementPicker {
  /** Called when the selected element changes. */
  onChange: ((type: number) => void) | null = null;

  private readonly root: HTMLDivElement;
  private readonly button: HTMLButtonElement;
  private readonly dropdown: HTMLUListElement;
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

    this.dropdown = document.createElement('ul');
    this.dropdown.className = 'picker-dropdown';
    this.dropdown.setAttribute('role', 'listbox');
    this.dropdown.hidden = true;
    for (const element of registry.list().filter((e) => !e.hidden)) {
      this.dropdown.appendChild(this.createOption(element));
    }

    this.root.appendChild(this.button);
    this.root.appendChild(this.dropdown);

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
    return li;
  }

  private select(element: Element): void {
    this.selectedType = element.type;
    for (const child of this.dropdown.children) {
      if (child instanceof HTMLElement) {
        child.setAttribute(
          'aria-selected',
          String(child.dataset['type'] === String(element.type)),
        );
      }
    }
    this.close();
    this.onChange?.(element.type);
  }

  private toggle(): void {
    if (this.dropdown.hidden) {
      this.open();
    } else {
      this.close();
    }
  }

  private open(): void {
    this.dropdown.hidden = false;
    this.button.setAttribute('aria-expanded', 'true');
  }

  private close(): void {
    this.dropdown.hidden = true;
    this.button.setAttribute('aria-expanded', 'false');
  }
}
