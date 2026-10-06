// Flip-dot display: renders text as a grid of discs that flip between an
// "off" and "on" face. Changing the message sweeps across the board column
// by column, flipping only the dots that differ. The board is drawn on one
// canvas from pre-rendered disc images: as hundreds of animated elements it
// stalled phones' main thread (and the water with it) on every change.

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

// Disc faces: a highlight over the face colour domes each disc, matching a
// CSS radial-gradient(circle at 35% 30%, white at alpha, transparent at
// stop). Lit discs glow, blurred like a box-shadow of GLOW_BLUR pitches.
const SHINE_OFF = { alpha: 0.18, stop: 0.6 };
const SHINE_ON = { alpha: 0.45, stop: 0.55 };
const GLOW_BLUR = 0.7;
// Distance from the highlight centre to the disc box's farthest corner,
// in disc widths: the gradient's full radius.
const SHINE_REACH = Math.hypot(0.65, 0.7);

// Discs flip about their horizontal axis: squash to edge-on, swap face,
// open back up with a small settle like a magnet catching the disc. Scale
// keyframes are [time share, vertical scale], eased in and out within each
// span. A disc turning on fades its glow in after the swap; one turning off
// drops it at once.
const FLIP_MS = 180;
const FLIP_SWAP = 0.45;
const FLIP_SCALE = [[0, 1], [0.45, 0], [0.8, 1], [0.9, 0.8], [1, 1]];

// CSS ease-in-out, cubic-bezier(0.42, 0, 0.58, 1): solve x(u) = t, return y(u).
function easeInOut(t) {
  let lo = 0;
  let hi = 1;
  let u = t;
  for (let n = 0; n < 16; n++) {
    u = (lo + hi) / 2;
    const x = 3 * u * (1 - u) * (1 - u) * 0.42 + 3 * u * u * (1 - u) * 0.58 + u * u * u;
    if (x < t) lo = u;
    else hi = u;
  }
  return 3 * u * u * (1 - u) + u * u * u;
}

function flipScale(p) {
  for (let k = 1; k < FLIP_SCALE.length; k++) {
    const [t1, s1] = FLIP_SCALE[k];
    if (p > t1) continue;
    const [t0, s0] = FLIP_SCALE[k - 1];
    return s0 + (s1 - s0) * easeInOut((p - t0) / (t1 - t0));
  }
  return 1;
}

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
    // Dot index -> start time of its flip, for discs mid-flip.
    this.anims = new Map();
    this.state = new Uint8Array(0);
    this.raf = 0;
    this.width = -1;

    this.el = document.createElement('div');
    this.el.className = 'flip-board';
    this.el.setAttribute('aria-hidden', 'true');
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'flip-canvas';
    this.ctx = this.canvas.getContext('2d');
    // Resolves the colour custom properties for the canvas.
    this.probe = document.createElement('span');
    this.probe.hidden = true;
    this.el.append(this.canvas, this.probe);
    host.appendChild(this.el);

    this.layout();
    new ResizeObserver(() => this.layout()).observe(host);
    document.addEventListener('themechange', () => {
      this.paintSprites();
      this.draw(performance.now());
    });
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
    const discDev = pitchDev - gapDev;
    // Room around the discs for the glow of lit ones at the board's edge.
    const padDev = Math.ceil(GLOW_BLUR * pitchDev) + 1;
    this.pitch = pitchDev / dpr;
    this.dev = { pitch: pitchDev, disc: discDev, pad: padDev };

    const resized = cols !== this.cols || rows !== this.rows || maxTextCols !== this.maxTextCols;
    this.cols = cols;
    this.rows = rows;
    this.maxTextCols = maxTextCols;
    const boardW = cols * pitchDev - gapDev;
    const boardH = rows * pitchDev - gapDev;
    const s = this.el.style;
    s.setProperty('--board-w', `${boardW / dpr}px`);
    s.setProperty('--board-h', `${boardH / dpr}px`);
    s.setProperty('--glow-pad', `${padDev / dpr}px`);
    this.canvas.width = boardW + 2 * padDev;
    this.canvas.height = boardH + 2 * padDev;
    this.paintSprites();

    if (resized) {
      cancelAnimationFrame(this.raf);
      this.raf = 0;
      this.queue = [];
      this.anims.clear();
      this.state = new Uint8Array(cols * rows);
      if (this.text) {
        this.show(this.text, false);
        return;
      }
    }
    this.draw(performance.now());
  }

  color(value, fallback) {
    this.probe.style.color = '';
    this.probe.style.color = value.trim();
    return this.probe.style.color ? getComputedStyle(this.probe).color : fallback;
  }

  // Renders the off face, the on face and the glow once per size and theme;
  // each image is a disc centred in a square with room for the glow.
  paintSprites() {
    if (!this.ctx || !this.dev) return;
    const styles = getComputedStyle(this.el);
    const onColor = this.color(styles.getPropertyValue('--dot-on'), '#7fd99a');
    const offColor = this.color(styles.getPropertyValue('--dot-off'), '#0f240f');
    const glowColor = this.color(styles.getPropertyValue('--glow'), 'rgba(57, 255, 102, 0.35)');
    const { pitch, disc, pad } = this.dev;
    const size = disc + 2 * pad;
    const mid = pad + disc / 2;
    const sprite = () => {
      const c = document.createElement('canvas');
      c.width = size;
      c.height = size;
      return c.getContext('2d');
    };
    const disk = (ctx, x) => {
      ctx.beginPath();
      ctx.arc(x, mid, disc / 2, 0, 2 * Math.PI);
    };
    const face = (fill, shine) => {
      const ctx = sprite();
      disk(ctx, mid);
      ctx.fillStyle = fill;
      ctx.fill();
      const hx = pad + 0.35 * disc;
      const hy = pad + 0.3 * disc;
      const g = ctx.createRadialGradient(hx, hy, 0, hx, hy, SHINE_REACH * disc * shine.stop);
      g.addColorStop(0, `rgba(255, 255, 255, ${shine.alpha})`);
      g.addColorStop(1, 'rgba(255, 255, 255, 0)');
      ctx.fillStyle = g;
      ctx.fill();
      return ctx.canvas;
    };
    // Glow alone: the disc is drawn off the image and only its shadow,
    // offset back, lands on it.
    const glow = sprite();
    glow.shadowColor = glowColor;
    glow.shadowBlur = GLOW_BLUR * pitch;
    glow.shadowOffsetX = 2 * size;
    disk(glow, mid - 2 * size);
    glow.fillStyle = '#000';
    glow.fill();
    this.sprites = { off: face(offColor, SHINE_OFF), on: face(onColor, SHINE_ON), glow: glow.canvas };
  }

  // Redraws the board: all of it, or with band set, only the columns the
  // discs mid-flip reach (a sweep moves through a few dozen at a time),
  // clipped so the rest stays as it is.
  draw(now, band = false) {
    const { ctx, sprites, cols, state } = this;
    if (!ctx || !sprites) return;
    const { pitch, disc, pad } = this.dev;
    const size = disc + 2 * pad;
    let c0 = 0;
    let c1 = cols - 1;
    if (band) {
      if (!this.anims.size) return;
      c0 = cols;
      c1 = 0;
      for (const i of this.anims.keys()) {
        c0 = Math.min(c0, i % cols);
        c1 = Math.max(c1, i % cols);
      }
    }
    // A disc's image (with its glow) reaches into the neighbouring columns.
    const x0 = c0 * pitch;
    const x1 = c1 * pitch + size;
    ctx.save();
    ctx.beginPath();
    ctx.rect(x0, 0, x1 - x0, this.canvas.height);
    ctx.clip();
    ctx.clearRect(x0, 0, x1 - x0, this.canvas.height);
    const first = Math.max(0, Math.floor((x0 - size) / pitch) + 1);
    const last = Math.min(cols - 1, Math.floor(x1 / pitch));
    const moving = [];
    for (let row = 0, base = 0; row < this.rows; row++, base += cols) {
      for (let col = first; col <= last; col++) {
        const i = base + col;
        if (this.anims.has(i)) {
          moving.push(i);
          continue;
        }
        const x = col * pitch;
        const y = row * pitch;
        if (state[i]) {
          ctx.drawImage(sprites.glow, x, y);
          ctx.drawImage(sprites.on, x, y);
        } else {
          ctx.drawImage(sprites.off, x, y);
        }
      }
    }
    // Discs mid-flip go over the still ones.
    for (const i of moving) {
      const p = Math.min(1, (now - this.anims.get(i)) / FLIP_MS);
      if (p >= 1) this.anims.delete(i);
      const lit = state[i] === 1;
      const swapped = p >= FLIP_SWAP;
      const h = size * flipScale(p);
      const x = (i % cols) * pitch;
      const y = Math.floor(i / cols) * pitch + (size - h) / 2;
      if (lit && swapped) {
        ctx.globalAlpha = easeInOut((p - FLIP_SWAP) / (1 - FLIP_SWAP));
        ctx.drawImage(sprites.glow, x, y, size, h);
        ctx.globalAlpha = 1;
      }
      if (h > 0.01) ctx.drawImage(lit === swapped ? sprites.on : sprites.off, x, y, size, h);
    }
    ctx.restore();
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

  // Returns the animated flips as [{ i, t }]: dot index and delay in ms.
  show(text, animate = true) {
    this.text = text;
    const target = this.bitmap(text);
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.queue = [];

    const instant = !animate || reduceMotion.matches;
    for (let i = 0; i < target.length; i++) {
      if (target[i] === this.state[i]) continue;
      if (instant) {
        this.flip(i, target[i], null);
      } else {
        const col = i % this.cols;
        this.queue.push({ i, on: target[i], t: col * COL_STEP + Math.random() * JITTER });
      }
    }
    const flips = this.queue.map(({ i, t }) => ({ i, t }));
    this.queue.sort((a, b) => b.t - a.t);
    this.run(performance.now());
    return flips;
  }

  // Lets the queued flips out as they come due and redraws every frame
  // until the last disc settles.
  run(start) {
    const tick = now => {
      this.raf = 0;
      const elapsed = now - start;
      while (this.queue.length && this.queue[this.queue.length - 1].t <= elapsed) {
        const { i, on } = this.queue.pop();
        this.flip(i, on, now);
      }
      this.draw(now, true);
      if (this.queue.length || this.anims.size) this.raf = requestAnimationFrame(tick);
    };
    if (this.queue.length || this.anims.size) this.raf = requestAnimationFrame(tick);
    else this.draw(performance.now());
  }

  // Viewport center of dot i.
  dotCenter(i, rect = this.el.getBoundingClientRect()) {
    return {
      x: rect.left + (i % this.cols + 0.5) * this.pitch,
      y: rect.top + (Math.floor(i / this.cols) + 0.5) * this.pitch,
    };
  }

  // Sets dot i, flipping it from time `start` (ms), or at once if null.
  flip(i, on, start) {
    this.state[i] = on;
    if (start == null) this.anims.delete(i);
    else this.anims.set(i, start);
  }
}
