import { SITE } from '../site';
import { wireHeaderMenu } from './header-menu';

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
  /** Add the menu to `container`, before `before` when given. */
  constructor(container: Element, before: Element | null) {
    const items = entries();
    if (items.length === 0) return;

    const wrap = document.createElement('div');
    wrap.className = 'contact-menu';

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'header-link contact-button';
    button.textContent = 'Contact';

    const panel = document.createElement('div');
    panel.className = 'header-panel';
    for (const entry of items) panel.appendChild(this.createItem(entry));

    wrap.append(button, panel);
    container.insertBefore(wrap, before);
    wireHeaderMenu(wrap, button, panel);
  }

  private createItem(entry: Entry): HTMLAnchorElement {
    const link = document.createElement('a');
    link.className = 'menu-item';
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
}
