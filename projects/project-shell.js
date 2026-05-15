import { initFooter } from '../js/footer.js';
import { initGlitch } from '../js/glitch.js';
import { initTheme } from '../js/theme.js';

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

  initFolders();
}

function initFolders() {
  const body = document.querySelector('.project-body');
  if (!body) return;

  const allChildren = [...body.children];
  const h3Indices = allChildren.reduce((acc, el, i) => {
    if (el.tagName === 'H3') acc.push(i);
    return acc;
  }, []);
  if (!h3Indices.length) return;

  [...h3Indices].reverse().forEach((h3Idx, ri) => {
    const i = h3Indices.length - 1 - ri;
    const h3 = allChildren[h3Idx];
    const nextH3Idx = h3Indices[i + 1] ?? allChildren.length;
    const contentEls = allChildren.slice(h3Idx + 1, nextH3Idx);

    const section = document.createElement('section');
    section.className = 'project-folder';

    const originalText = h3.textContent;
    h3.className = 'project-folder-header';
    h3.setAttribute('data-open', 'true');
    h3.textContent = '';
    const btn = document.createElement('button');
    btn.setAttribute('aria-expanded', 'true');
    btn.setAttribute('aria-controls', `folder-content-${i}`);
    btn.textContent = originalText;
    h3.append(btn);

    const contentDiv = document.createElement('div');
    contentDiv.className = 'project-folder-content';
    contentDiv.id = `folder-content-${i}`;
    contentEls.forEach(el => contentDiv.append(el));

    body.insertBefore(section, h3);
    section.append(h3, contentDiv);

    btn.addEventListener('click', () => {
      const open = h3.getAttribute('data-open') === 'true';
      h3.setAttribute('data-open', String(!open));
      btn.setAttribute('aria-expanded', String(!open));
      contentDiv.classList.toggle('project-folder-content--hidden', open);
    });
  });
}
