import { setTheme, THEME_NAMES } from './theme.js';

function resolveUrl(path) {
  return /\/(posts|projects)\//.test(window.location.pathname) ? '../' + path : path;
}

function printDateTime() {
  const now = new Date();
  const date = now.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  const time = now.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  return `${date} ${time}`;
}

const SWATCH = '░'.repeat(15);

const COMMANDS = {
  'cd home':     () => ({ navigate: resolveUrl('index.html') }),
  'cd /':        () => ({ navigate: resolveUrl('index.html') }),
  'cd projects': () => ({ navigate: resolveUrl('index.html') + '#projects' }),
  'cd blog':     () => ({ navigate: resolveUrl('blog.html') }),
  'cd contact':  () => ({ navigate: resolveUrl('contact.html') }),
  'date':        () => ({ flash: printDateTime() }),
  'time':        () => ({ flash: printDateTime() }),
  'theme green': () => { setTheme('green'); return { flash: `theme: green  ${SWATCH}` }; },
  'theme amber': () => { setTheme('amber'); return { flash: `theme: amber  ${SWATCH}` }; },
  'theme cyan':  () => { setTheme('cyan');  return { flash: `theme: cyan   ${SWATCH}` }; },
  'theme white': () => { setTheme('white'); return { flash: `theme: white  ${SWATCH}` }; },
  'theme red':   () => { setTheme('red');   return { flash: `theme: red    ${SWATCH}` }; },
  'themes':      () => ({ flash: `Use 'theme <color>' to swap: ${THEME_NAMES.join(' | ')}` }),
  'play cube11': () => ({ game: 'cube11' }),
  'help':        () => ({ flash: 'commands: cd home | cd blog | cd contact | cd projects | themes | clear' }),
  'clear':       () => ({ clear: true }),
  'cls':         () => ({ clear: true }),
};

function resolvePageUrl(path) {
  if (path === 'home' || path === '/') return resolveUrl('index.html');
  if (path === 'projects') return resolveUrl('index.html') + '#projects';
  if (!path.endsWith('.html')) path += '.html';
  return resolveUrl(path);
}

export function executeCommand(rawInput) {
  const input = rawInput.trim().toLowerCase();
  const handler = COMMANDS[input];
  if (handler) return handler();

  if (input.startsWith('cd ')) {
    const path = rawInput.trim().slice(3).trim();
    return { navigate: resolvePageUrl(path) };
  }

  if (input.startsWith('run ')) {
    let url = rawInput.trim().slice(4).trim();
    if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
    return { open: url };
  }

  if (input.length) return { error: `'${rawInput.trim()}': command not found — type 'help' for commands` };
  return null;
}
