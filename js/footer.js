import { executeCommand } from './commands.js';

let DEFAULT_TEXT = 'C:\\iDotDot> ';
let typedBuffer = '';
let focused = false;

function navigate(cmd, url) {
  typedBuffer = '';
  updateCmd(cmd);
  window.location.href = url;
}

function flash(cmd, message) {
  const saved = DEFAULT_TEXT + typedBuffer;
  cmd.textContent = message;
  setTimeout(() => { cmd.textContent = saved; }, 3000);
}

function updateCmd(cmd) {
  cmd.textContent = DEFAULT_TEXT + typedBuffer;
}

function runCommand(cmd) {
  const result = executeCommand(typedBuffer);
  typedBuffer = '';

  if (!result)             { updateCmd(cmd); return; }
  if (result.navigate)     { navigate(cmd, result.navigate); }
  else if (result.open)    { window.open(result.open, '_blank', 'noopener'); updateCmd(cmd); }
  else if (result.flash)   { flash(cmd, result.flash); }
  else if (result.error)   { flash(cmd, result.error); }
  else if (result.clear)   { updateCmd(cmd); }
  else if (result.game)    { import(`./${result.game}.js`).then(m => m.startGame()); updateCmd(cmd); }
}

function restoreToBuffer(cmd) {
  const sel = window.getSelection()?.toString().trim() ?? '';
  if (sel.length > 1) {
    const preview = sel.length > 28 ? sel.slice(0, 28) + '...' : sel;
    cmd.textContent = `${DEFAULT_TEXT}copy "${preview}" `;
  } else {
    updateCmd(cmd);
  }
}

function hrefLabel(href) {
  if (!href || href === '#') return null;
  if (href.startsWith('mailto:')) return null;
  if (href.startsWith('http')) return null;
  const path = href.replace(/^\.\.\//, '').replace(/\.html$/, '');
  if (path === '#projects' || path === 'index#projects') return 'cd projects';
  if (path === 'index' || path === '') return 'cd home';
  if (path.startsWith('#')) return `cd ${path.slice(1)}`;
  return `cd ${path}`;
}

export function initFooter() {
  const cmd = document.getElementById('footer-cmd');
  if (!cmd) return;

  const footer = cmd.closest('footer');
  const cursor = cmd.nextElementSibling;

  DEFAULT_TEXT = cmd.textContent;

  function activate() {
    focused = true;
    footer.classList.add('terminal-active');
    cursor?.classList.remove('blink');
  }

  function deactivate() {
    focused = false;
    typedBuffer = '';
    footer.classList.remove('terminal-active');
    cursor?.classList.add('blink');
    updateCmd(cmd);
  }

  footer.addEventListener('click', activate);

  document.addEventListener('mouseover', e => {
    const link = e.target.closest('a, button');
    if (link) {
      const label = hrefLabel(link.getAttribute('href'));
      if (label) cmd.textContent = `${DEFAULT_TEXT}${label} `;
      return;
    }
    const card = e.target.closest('[data-href]');
    if (card) {
      const label = hrefLabel(card.getAttribute('data-href'));
      if (label) cmd.textContent = `${DEFAULT_TEXT}${label} `;
    }
  });

  document.addEventListener('mouseout', e => {
    if (!e.target.closest('a, button') && !e.target.closest('[data-href]')) return;
    restoreToBuffer(cmd);
  });

  document.addEventListener('selectionchange', () => {
    const sel = window.getSelection()?.toString().trim() ?? '';
    if (sel.length > 1) {
      const preview = sel.length > 28 ? sel.slice(0, 28) + '...' : sel;
      cmd.textContent = `${DEFAULT_TEXT}copy "${preview}" `;
    } else {
      updateCmd(cmd);
    }
  });

  document.addEventListener('keydown', e => {
    const tag = document.activeElement?.tagName;
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(tag) || document.activeElement?.isContentEditable) return;
    if (!focused) return;

    if (e.key === 'Escape') {
      deactivate();
    } else if (e.key === 'Enter') {
      runCommand(cmd);
    } else if (e.key === 'Backspace') {
      e.preventDefault();
      typedBuffer = typedBuffer.slice(0, -1);
      updateCmd(cmd);
    } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      typedBuffer += e.key;
      updateCmd(cmd);
    }
  });
}
