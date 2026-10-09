export type BrushShape = 'circle' | 'square';

/** Paintbrush icon for the brush button. */
const ICON_SVG =
  '<svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
  '<path d="M15.5 2.5 L9 9"/>' +
  '<path d="M9 9 C6 9 4 11 4 13.5 C4 14.5 4.5 15 5.5 15 C8 15 10 13 10 10 Z"/>' +
  '</svg>';

/** Small shape icons shown next to each option. */
const CIRCLE_ICON =
  '<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">' +
  '<circle cx="7" cy="7" r="5.5"/></svg>';
const SQUARE_ICON =
  '<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">' +
  '<rect x="1.5" y="1.5" width="11" height="11" rx="1"/></svg>';

export const BRUSH_MIN_RADIUS = 1;
export const BRUSH_MAX_RADIUS = 50;
export const BRUSH_MIN_DENSITY = 0.01;
export const BRUSH_MAX_DENSITY = 1;

/**
 * Header brush picker: an icon button that opens a panel to choose the
 * placement brush shape (circle or square), its radius and its density. Unlike the
 * element picker, the panel stays open while adjusting (so you can pick a
 * shape and then a radius); it closes on Escape or an outside click.
 */
export class BrushPicker {
  /** Called when the brush shape, radius or density (0..1) changes. */
  onChange: ((shape: BrushShape, radius: number, density: number) => void) | null = null;

  private readonly root: HTMLDivElement;
  private readonly button: HTMLButtonElement;
  private readonly dropdown: HTMLDivElement;
  private readonly shapeOptions: HTMLDivElement[] = [];
  private readonly radiusInput: HTMLInputElement;
  private readonly radiusValue: HTMLSpanElement;
  private selectedShape: BrushShape;
  private readonly densityInput: HTMLInputElement;
  private readonly densityValue: HTMLSpanElement;
  private selectedRadius: number;
  private selectedDensity: number;

  constructor(initialShape: BrushShape, initialRadius: number, initialDensity: number) {
    this.selectedShape = initialShape;
    this.selectedRadius = initialRadius;
    this.selectedDensity = initialDensity;

    this.root = document.createElement('div');
    this.root.className = 'brush-picker';

    this.button = document.createElement('button');
    this.button.type = 'button';
    this.button.className = 'picker-button';
    this.button.title = 'Choose brush';
    this.button.setAttribute('aria-haspopup', 'true');
    this.button.setAttribute('aria-expanded', 'false');
    this.button.innerHTML = ICON_SVG;

    this.dropdown = document.createElement('div');
    this.dropdown.className = 'picker-dropdown brush-dropdown';
    this.dropdown.hidden = true;

    // Shape section.
    const shapeSection = document.createElement('div');
    shapeSection.className = 'brush-section';
    shapeSection.setAttribute('role', 'radiogroup');
    const shapeLabel = document.createElement('div');
    shapeLabel.className = 'brush-section-label';
    shapeLabel.textContent = 'Shape';
    shapeSection.appendChild(shapeLabel);
    for (const shape of ['circle', 'square'] as const) {
      shapeSection.appendChild(this.createShapeOption(shape));
    }
    this.dropdown.appendChild(shapeSection);

    // Radius section.
    const radiusSection = document.createElement('div');
    radiusSection.className = 'brush-section';
    const radiusLabel = document.createElement('div');
    radiusLabel.className = 'brush-section-label';
    const radiusLabelText = document.createElement('span');
    radiusLabelText.textContent = 'Radius';
    this.radiusValue = document.createElement('span');
    this.radiusValue.className = 'brush-radius-value';
    this.radiusValue.textContent = String(this.selectedRadius);
    radiusLabel.appendChild(radiusLabelText);
    radiusLabel.appendChild(this.radiusValue);

    this.radiusInput = document.createElement('input');
    this.radiusInput.type = 'range';
    this.radiusInput.className = 'brush-radius-input';
    this.radiusInput.min = String(BRUSH_MIN_RADIUS);
    this.radiusInput.max = String(BRUSH_MAX_RADIUS);
    this.radiusInput.value = String(this.selectedRadius);
    this.radiusInput.addEventListener('input', () => {
      this.setRadius(Number(this.radiusInput.value));
    });

    radiusSection.appendChild(radiusLabel);
    radiusSection.appendChild(this.radiusInput);
    this.dropdown.appendChild(radiusSection);

    // Density section.
    const densitySection = document.createElement('div');
    densitySection.className = 'brush-section';
    const densityLabel = document.createElement('div');
    densityLabel.className = 'brush-section-label';
    const densityLabelText = document.createElement('span');
    densityLabelText.textContent = 'Density';
    this.densityValue = document.createElement('span');
    this.densityValue.className = 'brush-radius-value';
    densityLabel.appendChild(densityLabelText);
    densityLabel.appendChild(this.densityValue);

    this.densityInput = document.createElement('input');
    this.densityInput.type = 'range';
    this.densityInput.className = 'brush-radius-input';
    this.densityInput.min = String(Math.round(BRUSH_MIN_DENSITY * 100));
    this.densityInput.max = String(Math.round(BRUSH_MAX_DENSITY * 100));
    this.densityInput.addEventListener('input', () => {
      this.setDensity(Number(this.densityInput.value) / 100);
    });
    this.updateDensityDisplay();

    densitySection.appendChild(densityLabel);
    densitySection.appendChild(this.densityInput);
    this.dropdown.appendChild(densitySection);

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

  get shape(): BrushShape {
    return this.selectedShape;
  }

  get radius(): number {
    return this.selectedRadius;
  }

  get density(): number {
    return this.selectedDensity;
  }

  private createShapeOption(shape: BrushShape): HTMLDivElement {
    const option = document.createElement('div');
    option.className = 'brush-shape-option';
    option.setAttribute('role', 'radio');
    option.dataset.shape = shape;
    option.setAttribute('aria-selected', String(shape === this.selectedShape));

    const icon = document.createElement('span');
    icon.className = 'brush-shape-icon';
    icon.innerHTML = shape === 'circle' ? CIRCLE_ICON : SQUARE_ICON;

    const label = document.createElement('span');
    label.textContent = shape === 'circle' ? 'Circle' : 'Square';

    option.appendChild(icon);
    option.appendChild(label);
    option.addEventListener('click', () => this.selectShape(shape));
    this.shapeOptions.push(option);
    return option;
  }

  private selectShape(shape: BrushShape): void {
    this.selectedShape = shape;
    for (const option of this.shapeOptions) {
      option.setAttribute('aria-selected', String(option.dataset.shape === shape));
    }
    // Keep the panel open so a radius can be adjusted right after.
    this.onChange?.(this.selectedShape, this.selectedRadius, this.selectedDensity);
  }

  private setRadius(radius: number): void {
    this.selectedRadius = Math.min(BRUSH_MAX_RADIUS, Math.max(BRUSH_MIN_RADIUS, radius));
    this.radiusValue.textContent = String(this.selectedRadius);
    this.radiusInput.value = String(this.selectedRadius);
    this.onChange?.(this.selectedShape, this.selectedRadius, this.selectedDensity);
  }

  private setDensity(density: number): void {
    this.selectedDensity = Math.min(BRUSH_MAX_DENSITY, Math.max(BRUSH_MIN_DENSITY, density));
    this.updateDensityDisplay();
    this.onChange?.(this.selectedShape, this.selectedRadius, this.selectedDensity);
  }

  private updateDensityDisplay(): void {
    const percent = Math.round(this.selectedDensity * 100);
    this.densityValue.textContent = `${percent}%`;
    this.densityInput.value = String(percent);
  }

  private toggle(): void {
    if (this.dropdown.hidden) this.open();
    else this.close();
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
