const THEMES = {
  green: {
    '--accent':      '#80ffaa',
    '--bg':          '#070d07',
    '--bg-card':     '#0d1a0d',
    '--border':      '#1a4a2a',
    '--glow':        'rgba(57, 255, 102, 0.35)',
    '--glow-strong': 'rgba(57, 255, 102, 0.6)',
    '--text':        '#c8ffd6',
    '--text-dim':    '#7fd99a',
  },
  amber: {
    '--accent':      '#ffd966',
    '--bg':          '#0d0800',
    '--bg-card':     '#1a1000',
    '--border':      '#4a2a00',
    '--glow':        'rgba(255, 179, 0, 0.35)',
    '--glow-strong': 'rgba(255, 179, 0, 0.6)',
    '--text':        '#ffe6b8',
    '--text-dim':    '#e6b870',
  },
  cyan: {
    '--accent':      '#80f0ff',
    '--bg':          '#000d0d',
    '--bg-card':     '#001a1a',
    '--border':      '#004a4a',
    '--glow':        'rgba(0, 229, 255, 0.35)',
    '--glow-strong': 'rgba(0, 229, 255, 0.6)',
    '--text':        '#c8f5ff',
    '--text-dim':    '#7fd5e0',
  },
  white: {
    '--accent':      '#ffffff',
    '--bg':          '#0a0a0a',
    '--bg-card':     '#141414',
    '--border':      '#3a3a3a',
    '--glow':        'rgba(232, 232, 232, 0.25)',
    '--glow-strong': 'rgba(232, 232, 232, 0.5)',
    '--text':        '#f5f5f5',
    '--text-dim':    '#c8c8c8',
  },
  red: {
    '--accent':      '#ff8080',
    '--bg':          '#0d0000',
    '--bg-card':     '#1a0000',
    '--border':      '#4a0a0a',
    '--glow':        'rgba(255, 51, 51, 0.35)',
    '--glow-strong': 'rgba(255, 51, 51, 0.6)',
    '--text':        '#ffc8c8',
    '--text-dim':    '#e69090',
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
