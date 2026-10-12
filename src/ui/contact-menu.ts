import { SITE } from '../site';

const COPIED_MS = 1800;

interface Entry {
  label: string;
  href: string;
  /** Copies the address instead of following the link. */
  copy?: string;
}

/** The contact links that have a value, in display order. */
function entries(): Entry[] {
  const { email, github, resume }: { email: string; github: string; resume: string } = SITE;
  const list: Entry[] = [];
  if (email !== '') list.push({ label: 'Email', href: `mailto:${email}`, copy: email });
  if (github !== '') list.push({ label: 'GitHub', href: github });
  if (resume !== '') list.push({ label: 'Resume', href: resume });
  return list;
}

/**
 * The Contact word in the header and its list of links. The list is a flat panel with
 * stepped corners under the word, not a toolbox dropdown. It closes on Escape, on a press
 * outside it, and when focus leaves it. Email copies the address and says so; the link
 * still works as mailto if the clipboard is blocked. Nothing is added when `SITE` has no
 * contact links.
 */
export class ContactMenu {
  private readonly button = document.createElement('button');
  private readonly panel = document.createElement('div');

  /** Add the menu to `container`, before `before` when given. */
  constructor(container: Element, before: Element | null) {
    const items = entries();
    if (items.length === 0) return;

    const wrap = document.createElement('div');
    wrap.className = 'contact-menu';

    this.button.type = 'button';
    this.button.className = 'header-link contact-button';
    this.button.textContent = 'Contact';
    this.button.setAttribute('aria-haspopup', 'true');
    this.button.setAttribute('aria-expanded', 'false');
    this.button.addEventListener('click', () => (this.panel.hidden ? this.open() : this.close(true)));

    this.panel.className = 'contact-panel';
    this.panel.hidden = true;
    for (const entry of items) this.panel.appendChild(this.createItem(entry));

    wrap.append(this.button, this.panel);
    container.insertBefore(wrap, before);

    wrap.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !this.panel.hidden) {
        e.stopPropagation();
        this.close(true);
      }
    });
    wrap.addEventListener('focusout', (e) => {
      if (!this.panel.hidden && !wrap.contains(e.relatedTarget as Node | null)) this.close(false);
    });
    window.addEventListener('pointerdown', (e) => {
      if (!this.panel.hidden && !wrap.contains(e.target as Node)) this.close(false);
    }, true);
  }

  private createItem(entry: Entry): HTMLAnchorElement {
    const link = document.createElement('a');
    link.className = 'contact-item';
    link.href = entry.href;
    link.textContent = entry.label;
    if (entry.copy === undefined) {
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      return link;
    }
    const address = entry.copy;
    link.addEventListener('click', (e) => {
      e.preventDefault();
      void navigator.clipboard
        .writeText(address)
        .then(() => {
          link.textContent = 'Copied';
          window.setTimeout(() => (link.textContent = entry.label), COPIED_MS);
        })
        .catch(() => {
          window.location.href = entry.href;
        });
    });
    return link;
  }

  private open(): void {
    this.panel.hidden = false;
    this.button.setAttribute('aria-expanded', 'true');
    this.panel.querySelector<HTMLElement>('a')?.focus();
  }

  private close(returnFocus: boolean): void {
    this.panel.hidden = true;
    this.button.setAttribute('aria-expanded', 'false');
    if (returnFocus) this.button.focus();
  }
}
