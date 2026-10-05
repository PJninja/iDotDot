// Flip-dot display: renders text as a grid of discs that flip between an
// "off" and "on" face. Changing the message sweeps across the board column
// by column, flipping only the dots that differ.

const GLYPH_H = 9;    // 7 rows cap height + 2 rows descender
const LETTER_GAP = 1;
const LINE_GAP = 0;   // descender rows already separate lines
const PAD_X = 1;      // blank columns either side of the message
const PAD_TOP = 1;    // blank row above; descender rows pad the bottom
const COL_STEP = 5;   // ms between columns in a sweep
const JITTER = 40;    // ms of random lag per dot

// Condensed font: most glyphs are 4 dots wide (5 only where symmetry needs
// it), so more text fits per row and the dots can be larger.
// Glyphs: rows top to bottom, '#' = on. Width is taken from the row length.
// Rows past the end are blank, so only descenders need rows 8-9.
const FONT = {
  'A': '.##.|#..#|#..#|####|#..#|#..#|#..#',
  'B': '###.|#..#|#..#|###.|#..#|#..#|###.',
  'C': '.##.|#..#|#...|#...|#...|#..#|.##.',
  'D': '###.|#..#|#..#|#..#|#..#|#..#|###.',
  'E': '####|#...|#...|###.|#...|#...|####',
  'F': '####|#...|#...|###.|#...|#...|#...',
  'G': '.##.|#..#|#...|#.##|#..#|#..#|.###',
  'H': '#..#|#..#|#..#|####|#..#|#..#|#..#',
  'I': '###|.#.|.#.|.#.|.#.|.#.|###',
  'J': '...#|...#|...#|...#|...#|#..#|.##.',
  'K': '#..#|#..#|#.#.|##..|#.#.|#..#|#..#',
  'L': '#...|#...|#...|#...|#...|#...|####',
  'M': '#...#|##.##|#.#.#|#.#.#|#...#|#...#|#...#',
  'N': '#..#|##.#|##.#|#.##|#.##|#..#|#..#',
  'O': '.##.|#..#|#..#|#..#|#..#|#..#|.##.',
  'P': '###.|#..#|#..#|###.|#...|#...|#...',
  'Q': '.##.|#..#|#..#|#..#|#..#|#.#.|.#.#',
  'R': '###.|#..#|#..#|###.|#.#.|#..#|#..#',
  'S': '.###|#...|#...|.##.|...#|...#|###.',
  'T': '###|.#.|.#.|.#.|.#.|.#.|.#.',
  'U': '#..#|#..#|#..#|#..#|#..#|#..#|.##.',
  'V': '#...#|#...#|#...#|#...#|.#.#.|.#.#.|..#..',
  'W': '#...#|#...#|#...#|#.#.#|#.#.#|##.##|#...#',
  'X': '#...#|#...#|.#.#.|..#..|.#.#.|#...#|#...#',
  'Y': '#...#|#...#|.#.#.|..#..|..#..|..#..|..#..',
  'Z': '####|...#|..#.|..#.|.#..|#...|####',
  'a': '....|....|.##.|...#|.###|#..#|.###',
  'b': '#...|#...|###.|#..#|#..#|#..#|###.',
  'c': '....|....|.###|#...|#...|#...|.###',
  'd': '...#|...#|.###|#..#|#..#|#..#|.###',
  'e': '....|....|.##.|#..#|####|#...|.###',
  'f': '.##|#..|###|#..|#..|#..|#..',
  'g': '....|....|.###|#..#|#..#|#..#|.###|...#|.##.',
  'h': '#...|#...|###.|#..#|#..#|#..#|#..#',
  'i': '#|.|#|#|#|#|#',
  'j': '.#|..|.#|.#|.#|.#|.#|.#|#.',
  'k': '#...|#...|#..#|#.#.|##..|#.#.|#..#',
  'l': '#.|#.|#.|#.|#.|#.|.#',
  'm': '.....|.....|##.#.|#.#.#|#.#.#|#.#.#|#.#.#',
  'n': '....|....|###.|#..#|#..#|#..#|#..#',
  'o': '....|....|.##.|#..#|#..#|#..#|.##.',
  'p': '....|....|###.|#..#|#..#|#..#|###.|#...|#...',
  'q': '....|....|.###|#..#|#..#|#..#|.###|...#|...#',
  'r': '...|...|#.#|##.|#..|#..|#..',
  's': '....|....|.###|#...|.##.|...#|###.',
  't': '.#.|.#.|###|.#.|.#.|.#.|..#',
  'u': '....|....|#..#|#..#|#..#|#..#|.###',
  'v': '...|...|#.#|#.#|#.#|#.#|.#.',
  'w': '.....|.....|#...#|#...#|#.#.#|#.#.#|.#.#.',
  'x': '...|...|#.#|#.#|.#.|#.#|#.#',
  'y': '....|....|#..#|#..#|#..#|#..#|.###|...#|.##.',
  'z': '....|....|####|...#|.##.|#...|####',
  '0': '.##.|#..#|#..#|#.##|##.#|#..#|.##.',
  '1': '.#.|##.|.#.|.#.|.#.|.#.|###',
  '2': '.##.|#..#|...#|..#.|.#..|#...|####',
  '3': '###.|...#|...#|.##.|...#|...#|###.',
  '4': '#..#|#..#|#..#|####|...#|...#|...#',
  '5': '####|#...|###.|...#|...#|#..#|.##.',
  '6': '.##.|#...|#...|###.|#..#|#..#|.##.',
  '7': '####|...#|...#|..#.|.#..|.#..|.#..',
  '8': '.##.|#..#|#..#|.##.|#..#|#..#|.##.',
  '9': '.##.|#..#|#..#|.###|...#|...#|.##.',
  ' ': '..',
  '-': '..|..|..|..|##',
  '_': '....|....|....|....|....|....|####',
  '.': '.|.|.|.|.|.|#',
  ',': '.|.|.|.|.|.|#|#',
  ':': '.|.|.|#|.|.|#',
  '!': '#|#|#|#|#|.|#',
  '?': '.##.|#..#|...#|..#.|.#..|....|.#..',
  '\'': '#|#',
  '/': '...#|...#|..#.|..#.|.#..|#...|#...',
};

const GLYPHS = {};
for (const [ch, src] of Object.entries(FONT)) {
  const rows = src.split('|');
  GLYPHS[ch] = { rows, width: rows[0].length };
}

function glyph(ch) {
  return GLYPHS[ch] || GLYPHS[ch.toLowerCase()] || GLYPHS[ch.toUpperCase()] || GLYPHS['?'];
}

function textWidth(text) {
  let w = 0;
  for (const ch of text) w += glyph(ch).width + LETTER_GAP;
  return Math.max(0, w - LETTER_GAP);
}

// Greedy word wrap by dot columns. A word wider than maxCols gets its own line.
function wrap(text, maxCols) {
  const lines = [];
  let line = '';
  for (const word of text.split(' ')) {
    const next = line ? `${line} ${word}` : word;
    if (line && textWidth(next) > maxCols) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  lines.push(line);
  return lines;
}

// Narrowest column count that wraps text into at most maxLines lines.
function minColsFor(text, maxLines) {
  let cols = Math.max(...text.split(' ').map(textWidth));
  while (wrap(text, cols).length > maxLines) cols++;
  return cols;
}

function cssPx(styles, prop, fallback) {
  const v = parseFloat(styles.getPropertyValue(prop));
  return Number.isFinite(v) ? v : fallback;
}

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

export class FlipBoard {
  // host: block element the board fills; its --dot-max / --dot-min set the
  // dot pitch range and --dot-lines caps wrapping. messages: every string
  // the board may show, so it can size itself once and not jump around
  // between messages.
  constructor(host, messages) {
    this.host = host;
    this.messages = messages;
    this.text = '';
    this.queue = [];
    this.raf = 0;
    this.width = -1;

    this.el = document.createElement('div');
    this.el.className = 'flip-board';
    this.el.setAttribute('aria-hidden', 'true');
    host.appendChild(this.el);

    this.layout();
    new ResizeObserver(() => this.layout()).observe(host);
  }

  layout() {
    const width = this.host.clientWidth;
    const dpr = window.devicePixelRatio || 1;
    if (width === this.width && dpr === this.dpr) return;
    this.width = width;
    this.dpr = dpr;

    const styles = getComputedStyle(this.host);
    const maxPitch = cssPx(styles, '--dot-max', 6);
    const minPitch = cssPx(styles, '--dot-min', 3);
    const maxLines = cssPx(styles, '--dot-lines', Infinity);

    // Wrap where the dots would drop below --dot-min, but never past
    // --dot-lines; past that the dots shrink instead.
    const widest = Math.max(...this.messages.map(textWidth));
    const fitCols = Math.floor(width / minPitch) - PAD_X * 2;
    const lineCapCols = Number.isFinite(maxLines)
      ? Math.max(...this.messages.map(m => minColsFor(m, maxLines)))
      : 0;
    const maxTextCols = Math.min(widest, Math.max(fitCols, lineCapCols));

    let lineCount = 1;
    let textCols = 0;
    for (const msg of this.messages) {
      const lines = wrap(msg, maxTextCols);
      lineCount = Math.max(lineCount, lines.length);
      for (const l of lines) textCols = Math.max(textCols, textWidth(l));
    }

    const cols = textCols + PAD_X * 2;
    const rows = PAD_TOP + lineCount * GLYPH_H + (lineCount - 1) * LINE_GAP;
    // Disc and gap are whole device pixels, so every cell rasterises
    // identically. Fractional sizes get rounded differently dot to dot,
    // which makes the grid look uneven.
    const pitchDev = Math.max(2, Math.floor(Math.min(maxPitch, width / cols) * dpr));
    const gapDev = Math.max(1, Math.round(pitchDev * 0.2));
    const s = this.el.style;
    s.setProperty('--pitch', `${pitchDev / dpr}px`);
    s.setProperty('--disc', `${(pitchDev - gapDev) / dpr}px`);
    s.setProperty('--gap', `${gapDev / dpr}px`);

    if (cols === this.cols && rows === this.rows && maxTextCols === this.maxTextCols) return;
    this.cols = cols;
    this.rows = rows;
    this.maxTextCols = maxTextCols;
    s.setProperty('--cols', cols);
    this.build();
  }

  build() {
    cancelAnimationFrame(this.raf);
    this.queue = [];
    const frag = document.createDocumentFragment();
    this.dots = [];
    for (let i = 0; i < this.cols * this.rows; i++) {
      const d = document.createElement('span');
      d.className = 'dot';
      this.dots.push(d);
      frag.appendChild(d);
    }
    this.el.replaceChildren(frag);
    this.state = new Uint8Array(this.cols * this.rows);
    if (this.text) this.show(this.text, false);
  }

  bitmap(text) {
    const map = new Uint8Array(this.cols * this.rows);
    wrap(text, this.maxTextCols).forEach((line, li) => {
      const y0 = PAD_TOP + li * (GLYPH_H + LINE_GAP);
      let x = PAD_X;
      for (const ch of line) {
        const g = glyph(ch);
        g.rows.forEach((row, ry) => {
          for (let rx = 0; rx < row.length; rx++) {
            if (row[rx] === '#') map[(y0 + ry) * this.cols + x + rx] = 1;
          }
        });
        x += g.width + LETTER_GAP;
      }
    });
    return map;
  }

  show(text, animate = true) {
    this.text = text;
    const target = this.bitmap(text);
    cancelAnimationFrame(this.raf);
    this.queue = [];

    const instant = !animate || reduceMotion.matches;
    for (let i = 0; i < target.length; i++) {
      if (target[i] === this.state[i]) continue;
      if (instant) {
        this.flip(i, target[i], false);
      } else {
        const col = i % this.cols;
        this.queue.push({ i, on: target[i], t: col * COL_STEP + Math.random() * JITTER });
      }
    }
    if (!this.queue.length) return;

    this.queue.sort((a, b) => b.t - a.t);
    const start = performance.now();
    const tick = now => {
      const elapsed = now - start;
      while (this.queue.length && this.queue[this.queue.length - 1].t <= elapsed) {
        const { i, on } = this.queue.pop();
        this.flip(i, on, true);
      }
      if (this.queue.length) this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
  }

  flip(i, on, animate) {
    this.state[i] = on;
    this.dots[i].className = 'dot' + (on ? ' on' : '') + (animate ? ' flip' : '');
  }
}
