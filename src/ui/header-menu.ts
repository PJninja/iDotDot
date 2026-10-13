/**
 * Open/close behavior shared by the header's dropdown menus (Contact, Settings): the button
 * toggles the panel, which closes on Escape, on a press outside `wrap`, and when focus leaves
 * it. Opening focuses the panel's first control. Returns `close` for items that act and then
 * dismiss the menu.
 */
export function wireHeaderMenu(wrap: HTMLElement, button: HTMLButtonElement, panel: HTMLElement): (returnFocus: boolean) => void {
  const open = (): void => {
    panel.hidden = false;
    button.setAttribute('aria-expanded', 'true');
    panel.querySelector<HTMLElement>('a, button')?.focus();
  };
  const close = (returnFocus: boolean): void => {
    panel.hidden = true;
    button.setAttribute('aria-expanded', 'false');
    if (returnFocus) button.focus();
  };

  button.setAttribute('aria-haspopup', 'true');
  button.setAttribute('aria-expanded', 'false');
  panel.hidden = true;
  button.addEventListener('click', () => (panel.hidden ? open() : close(true)));
  wrap.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !panel.hidden) {
      e.stopPropagation();
      close(true);
    }
  });
  wrap.addEventListener('focusout', (e) => {
    if (!panel.hidden && !wrap.contains(e.relatedTarget as Node | null)) close(false);
  });
  window.addEventListener('pointerdown', (e) => {
    if (!panel.hidden && !wrap.contains(e.target as Node)) close(false);
  }, true);
  return close;
}
