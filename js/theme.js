const THEMES = {
  green: {
    '--accent':      '#80ffaa',
    '--bg':          '#070d07',
    '--bg-card':     '#0d1a0d',
    '--border':      '#1a4a2a',
    '--glow':        'rgba(57, 255, 102, 0.35)',
    '--glow-strong': 'rgba(57, 255, 102, 0.6)',
    '--text':        '#39ff66',
    '--text-dim':    '#1a8a35',
  },
  amber: {
    '--accent':      '#ffd966',
    '--bg':          '#0d0800',
    '--bg-card':     '#1a1000',
    '--border':      '#4a2a00',
    '--glow':        'rgba(255, 179, 0, 0.35)',
    '--glow-strong': 'rgba(255, 179, 0, 0.6)',
    '--text':        '#ffb300',
    '--text-dim':    '#8a5500',
  },
  cyan: {
    '--accent':      '#80f0ff',
    '--bg':          '#000d0d',
    '--bg-card':     '#001a1a',
    '--border':      '#004a4a',
    '--glow':        'rgba(0, 229, 255, 0.35)',
    '--glow-strong': 'rgba(0, 229, 255, 0.6)',
    '--text':        '#00e5ff',
    '--text-dim':    '#007a8a',
  },
  white: {
    '--accent':      '#ffffff',
    '--bg':          '#0a0a0a',
    '--bg-card':     '#141414',
    '--border':      '#3a3a3a',
    '--glow':        'rgba(232, 232, 232, 0.25)',
    '--glow-strong': 'rgba(232, 232, 232, 0.5)',
    '--text':        '#e8e8e8',
    '--text-dim':    '#707070',
  },
  red: {
    '--accent':      '#ff8080',
    '--bg':          '#0d0000',
    '--bg-card':     '#1a0000',
    '--border':      '#4a0a0a',
    '--glow':        'rgba(255, 51, 51, 0.35)',
    '--glow-strong': 'rgba(255, 51, 51, 0.6)',
    '--text':        '#ff3333',
    '--text-dim':    '#8a1515',
  },
};

function applyTheme(name) {
  const theme = THEMES[name];
  if (!theme) return;
  const root = document.documentElement;
  for (const [prop, value] of Object.entries(theme)) {
    root.style.setProperty(prop, value);
  }
}

export function setTheme(name) {
  applyTheme(name);
  localStorage.setItem('theme', name);
}

export function initTheme() {
  const saved = localStorage.getItem('theme');
  if (saved) applyTheme(saved);
}

export const THEME_NAMES = Object.keys(THEMES);
