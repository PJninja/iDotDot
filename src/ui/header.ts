const SITE_TITLE = 'iDotDot by Anthony Liparulo';

/**
 * Populate the fixed 48px header bar. The element itself lives in
 * index.html; styling lives in main.css.
 */
export function initHeader(): void {
  const header = document.getElementById('header');
  if (header === null) throw new Error('#header element not found');

  const nav = header.querySelector('nav');
  if (nav === null) throw new Error('#header nav not found');

  const title = document.createElement('span');
  title.className = 'site-title';
  title.textContent = SITE_TITLE;
  // Insert before the actions block so space-between keeps the title left
  // and the action buttons right.
  nav.insertBefore(title, nav.firstChild);
}
