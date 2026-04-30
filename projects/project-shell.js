import { initFooter } from '../footer.js';
import { initGlitch } from '../glitch.js';
import { initTheme } from '../theme.js';

/**
 * @param {object} [options]
 * @param {string} [options.footerPrompt] - Text shown before the blinking cursor
 */
export function initProject({ footerPrompt = 'C:\\iDotDot\\projects> ' } = {}) {
  const footer = document.createElement('footer');
  footer.id = 'terminal-footer';
  footer.innerHTML =
    `<span id="footer-cmd" class="footer-cmd">${footerPrompt}</span>` +
    '<span class="cursor blink">_</span>';
  document.body.append(footer);

  const lightbox = document.createElement('div');
  lightbox.className = 'lightbox';
  lightbox.id = 'lightbox';
  lightbox.setAttribute('role', 'dialog');
  lightbox.setAttribute('aria-modal', 'true');
  lightbox.setAttribute('aria-label', 'Screenshot preview');
  lightbox.innerHTML = '<img id="lightbox-img" src="" alt="">';
  document.body.append(lightbox);

  initTheme();
  initFooter();
  initGlitch();

  const lightboxEl = document.getElementById('lightbox');
  const lightboxImg = document.getElementById('lightbox-img');

  document.querySelectorAll('.screenshot-grid img').forEach(img => {
    img.addEventListener('click', () => {
      lightboxImg.src = img.src;
      lightboxImg.alt = img.alt;
      lightboxEl.classList.add('open');
    });
  });

  lightboxEl.addEventListener('click', () => lightboxEl.classList.remove('open'));
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') lightboxEl.classList.remove('open');
  });
}
