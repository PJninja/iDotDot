import type { Preferences } from './preferences';

type Mode = Preferences['mode'];

/**
 * Text controls at the right of the header: the portfolio / play switch, Reset world and
 * the link to the plain page. Portfolio mode hides the toolbox (CSS keys off
 * `html[data-mode]`); play mode shows it. Each control is plain text with its own
 * treatment, not the toolbox button recipe.
 */
export class ModeControls {
  private readonly buttons = new Map<Mode, HTMLButtonElement>();
  /** The Reset world link, which the contact menu is inserted before. */
  readonly resetLink = document.createElement('button');
  readonly links = document.createElement('div');

  /** Called when the visitor switches mode. */
  onModeChange: ((mode: Mode) => void) | null = null;
  /** Called when the visitor asks for a fresh copy of this visit's world. */
  onReset: (() => void) | null = null;

  constructor(mode: Mode) {
    const nav = document.querySelector('#header nav');
    const actions = document.querySelector('#header .header-actions');
    if (nav === null || actions === null) throw new Error('#header nav not found');

    const links = this.links;
    links.className = 'header-links';

    const group = document.createElement('div');
    group.className = 'mode-switch';
    group.setAttribute('role', 'group');
    group.setAttribute('aria-label', 'Mode');
    for (const [value, label] of [['portfolio', 'Portfolio'], ['play', 'Play']] as const) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'mode-word';
      button.textContent = label;
      button.addEventListener('click', () => this.set(value, true));
      this.buttons.set(value, button);
      group.appendChild(button);
    }

    const reset = this.resetLink;
    reset.type = 'button';
    reset.className = 'header-link';
    reset.textContent = 'Reset world';
    reset.addEventListener('click', () => this.onReset?.());

    const plain = document.createElement('a');
    plain.className = 'header-link';
    plain.href = '?view=plain';
    plain.textContent = 'Plain view';

    links.append(group, reset, plain);
    nav.insertBefore(links, actions);
    this.set(mode, false);
  }

  private set(mode: Mode, notify: boolean): void {
    document.documentElement.dataset.mode = mode;
    for (const [value, button] of this.buttons) button.setAttribute('aria-pressed', String(value === mode));
    if (notify) this.onModeChange?.(mode);
  }
}
