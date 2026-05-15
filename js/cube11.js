const GAME_H      = 180;
const FONT        = "13px 'Courier New', Courier, monospace";
const FONT_SZ     = 13;
const LINE_H      = FONT_SZ + 1;
const GRAVITY     = 280;
const MAX_PRESS   = 1800;
const CASTLE_X    = 24;
const HI_KEY      = 'cube11-hi';

const CASTLE_LINES = [
  '|^|^|^|',
  '|     |',
  '| [>] |',
  '|     |',
  '|_____|',
  '|_____|',
];

const ENEMY_LINES = [
  '┌──┐',
  '└──┘',
];

const EXPLOSION_FRAMES = [
  ['\\ /', '-X-', '/ \\'],
  ['* *', ' · ', '* *'],
];

// ── module state ─────────────────────────────────────────────────

let overlay, canvas, ctx, resizer;
let running   = false;
let score     = 0;
let castleHP  = 3;
let enemies    = [];
let arrows     = [];
let explosions = [];
let spawnTimer = 0;
let lastTime  = 0;
let animId    = null;
let pressStart = null;
let charging  = false;
let hintVisible = true;

// measured from font
let castleW = 0;
let enemyW  = 0;
const castleH = CASTLE_LINES.length * LINE_H;
const enemyH  = ENEMY_LINES.length  * LINE_H;

// ── helpers ───────────────────────────────────────────────────────

const css = prop => getComputedStyle(document.documentElement).getPropertyValue(prop).trim();
const groundY = () => canvas.height;
const castleTop = () => groundY() - castleH;

function difficulty() {
  return {
    speed:   55 + score * 4,
    spawnMs: Math.max(500, 2200 - score * 55),
  };
}

function measure() {
  ctx.font = FONT;
  castleW = ctx.measureText(CASTLE_LINES[0]).width;
  enemyW  = ctx.measureText(ENEMY_LINES[0]).width;
}

// ── lifecycle ─────────────────────────────────────────────────────

function stopListeners() {
  document.removeEventListener('mousedown',  onDown);
  document.removeEventListener('mouseup',    onUp);
  document.removeEventListener('touchstart', onDown);
  document.removeEventListener('touchend',   onUp);
  document.removeEventListener('keydown',    onKey);
}

export function startGame() {
  if (overlay) return;

  const footer  = document.querySelector('footer');
  const footerH = footer ? footer.offsetHeight : 50;

  overlay = document.createElement('div');
  overlay.style.cssText = [
    'position:fixed',
    `bottom:${footerH}px`,
    'left:0', 'right:0',
    `height:${GAME_H}px`,
    'z-index:200',
    'cursor:crosshair',
  ].join(';');

  canvas = document.createElement('canvas');
  canvas.style.cssText = 'display:block;width:100%;height:100%';
  overlay.appendChild(canvas);
  document.body.appendChild(overlay);

  canvas.width  = overlay.clientWidth;
  canvas.height = GAME_H;
  ctx = canvas.getContext('2d');
  measure();

  resizer = () => { canvas.width = overlay.clientWidth; canvas.height = GAME_H; measure(); };
  window.addEventListener('resize', resizer);

  score = 0; castleHP = 3; enemies = []; arrows = []; explosions = [];
  spawnTimer = 0; pressStart = null; charging = false; hintVisible = true;
  running   = true;
  lastTime  = performance.now();

  document.addEventListener('mousedown',  onDown);
  document.addEventListener('mouseup',    onUp);
  document.addEventListener('touchstart', onDown, { passive: true });
  document.addEventListener('touchend',   onUp);
  document.addEventListener('keydown',    onKey);

  animId = requestAnimationFrame(loop);
}

function teardown() {
  running = false;
  if (animId)  { cancelAnimationFrame(animId); animId = null; }
  if (resizer) { window.removeEventListener('resize', resizer); resizer = null; }
  stopListeners();
  if (overlay) { overlay.remove(); overlay = null; canvas = null; ctx = null; }
}

// ── input ─────────────────────────────────────────────────────────

function onDown() {
  if (!running) return;
  pressStart = Date.now();
  charging   = true;
}

function onUp() {
  if (!running || !charging) return;
  charging = false;
  fireArrow();
}

function onKey(e) {
  if (e.key === 'Escape') teardown();
}

// ── game logic ────────────────────────────────────────────────────

function fireArrow() {
  if (pressStart === null) return;
  const power = Math.min(Date.now() - pressStart, MAX_PRESS) / MAX_PRESS;
  pressStart  = null;

  hintVisible = false;
  const speed = 160 + power * 360;
  const angle = 32 * Math.PI / 180;

  arrows.push({
    x:  CASTLE_X + castleW + 4,
    y:  castleTop() + LINE_H * 1.5,
    vx: speed * Math.cos(angle),
    vy: -speed * Math.sin(angle),
  });
}

function spawnEnemy() {
  enemies.push({
    x: canvas.width + 10,
    y: groundY() - enemyH,
    w: enemyW,
    h: enemyH,
  });
}

function loop(ts) {
  const dt = Math.min((ts - lastTime) / 1000, 0.05);
  lastTime = ts;
  update(dt);
  if (!running) return;
  render();
  animId = requestAnimationFrame(loop);
}

function update(dt) {
  const { speed, spawnMs } = difficulty();
  const gY = groundY();

  spawnTimer += dt * 1000;
  if (spawnTimer >= spawnMs) {
    const variance = (Math.random() - 0.5) * spawnMs * 0.6;
    spawnTimer = variance;
    spawnEnemy();
  }

  for (const en of enemies) en.x -= speed * dt;

  for (const ar of arrows) {
    ar.x  += ar.vx * dt;
    ar.vy += GRAVITY * dt;
    ar.y  += ar.vy * dt;
  }

  // arrow × enemy
  for (let i = arrows.length - 1; i >= 0; i--) {
    const ar = arrows[i];
    if (ar.y > gY || ar.x > canvas.width || ar.x < 0) { arrows.splice(i, 1); continue; }
    let hit = false;
    for (let j = enemies.length - 1; j >= 0; j--) {
      const en = enemies[j];
      if (ar.x >= en.x && ar.x <= en.x + en.w && ar.y >= en.y && ar.y <= en.y + en.h) {
        explosions.push({ x: en.x, y: en.y - LINE_H * 0.5, frame: 0, timer: 0 });
        arrows.splice(i, 1);
        enemies.splice(j, 1);
        score++;
        hit = true;
        break;
      }
    }
    if (hit) continue;
  }

  // explosions
  for (let i = explosions.length - 1; i >= 0; i--) {
    const ex = explosions[i];
    ex.timer += dt * 1000;
    if (ex.timer >= 100) { ex.frame++; ex.timer = 0; }
    if (ex.frame >= EXPLOSION_FRAMES.length) explosions.splice(i, 1);
  }

  // enemy reaches castle
  const castleRight = CASTLE_X + castleW;
  for (let i = enemies.length - 1; i >= 0; i--) {
    const en = enemies[i];
    if (en.x <= castleRight) {
      enemies.splice(i, 1);
      castleHP--;
      if (castleHP <= 0) { endGame(); return; }
    }
  }
}

function endGame() {
  running = false;
  if (animId) { cancelAnimationFrame(animId); animId = null; }
  if (resizer) { window.removeEventListener('resize', resizer); resizer = null; }
  stopListeners();

  const prev = parseInt(localStorage.getItem(HI_KEY) || '0', 10);
  if (score > prev) localStorage.setItem(HI_KEY, String(score));
  const hi = Math.max(score, prev);

  drawGameOver(hi);

  const dismiss = () => {
    document.removeEventListener('mousedown', dismiss);
    document.removeEventListener('keydown',   dismiss);
    if (overlay) { overlay.remove(); overlay = null; canvas = null; ctx = null; }
  };
  setTimeout(() => {
    document.addEventListener('mousedown', dismiss);
    document.addEventListener('keydown',   dismiss);
  }, 800);
}

// ── rendering ─────────────────────────────────────────────────────

function render() {
  if (!ctx) return;
  const bg     = css('--bg')       || '#070d07';
  const fg     = css('--text')     || '#39ff66';
  const dim    = css('--border')   || '#1a4a2a';
  const accent = css('--accent')   || '#80ffaa';
  const gY     = groundY();

  // Clear with slight transparency for motion trail on arrows
  ctx.globalAlpha = 0.88;
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.globalAlpha = 1;

  // Ground line
  ctx.strokeStyle = dim;
  ctx.lineWidth   = 1;
  ctx.beginPath();
  ctx.moveTo(0, gY); ctx.lineTo(canvas.width, gY);
  ctx.stroke();

  ctx.font          = FONT;
  ctx.textBaseline  = 'top';
  ctx.textAlign     = 'left';

  drawCastle(fg, accent);
  for (const en of enemies) drawEnemy(en, fg);
  for (const ar of arrows)  drawArrow(ar, accent);
  for (const ex of explosions) drawExplosion(ex, accent);
  if (charging && pressStart !== null) drawChargeBar(fg, dim, gY);
  if (hintVisible) drawHint(dim);
  drawHUD(fg, dim);
}

function drawCastle(fg, accent) {
  const top = castleTop();

  // Health hearts
  let hearts = '';
  for (let i = 0; i < 3; i++) hearts += i < castleHP ? '♥' : '♡';
  ctx.fillStyle = castleHP <= 1 ? '#ff4d4d' : accent;
  ctx.fillText(hearts, CASTLE_X, top - FONT_SZ - 3);

  ctx.fillStyle = fg;
  for (let i = 0; i < CASTLE_LINES.length; i++) {
    ctx.fillText(CASTLE_LINES[i], CASTLE_X, top + i * LINE_H);
  }
}

function drawEnemy(en, fg) {
  ctx.fillStyle = fg;
  for (let i = 0; i < ENEMY_LINES.length; i++) {
    ctx.fillText(ENEMY_LINES[i], en.x, en.y + i * LINE_H);
  }
}

function drawExplosion(ex, accent) {
  const lines = EXPLOSION_FRAMES[ex.frame];
  ctx.fillStyle = accent;
  ctx.globalAlpha = ex.frame === 0 ? 1 : 0.55;
  for (let i = 0; i < lines.length; i++) {
    ctx.fillText(lines[i], ex.x, ex.y + i * LINE_H);
  }
  ctx.globalAlpha = 1;
}

function drawArrow(ar, accent) {
  ctx.fillStyle = accent;
  ctx.fillText('>', ar.x, ar.y);
}

function drawChargeBar(fg, dim, gY) {
  const power  = Math.min(Date.now() - pressStart, MAX_PRESS) / MAX_PRESS;
  const filled = Math.round(power * 10);
  const bar    = '[' + '░'.repeat(filled) + ' '.repeat(10 - filled) + ']';
  ctx.fillStyle = fg;
  ctx.fillText(bar, CASTLE_X + castleW + 8, gY - FONT_SZ - 4);
}

function drawHint(dim) {
  ctx.font      = FONT;
  ctx.fillStyle = dim;
  ctx.textAlign    = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText('press + hold then release to fire arrow', canvas.width / 2, 8);
  ctx.textAlign    = 'left';
}

function drawHUD(fg, dim) {
  const hi = localStorage.getItem(HI_KEY) || '0';
  const x  = canvas.width - 108;
  ctx.fillStyle = fg;  ctx.fillText(`SCORE:${score}`, x, 6);
  ctx.fillStyle = dim; ctx.fillText(`BEST: ${hi}`,    x, 6 + LINE_H + 2);
}

function drawGameOver(hi) {
  if (!ctx) return;
  const bg     = css('--bg')       || '#070d07';
  const cardBg = css('--bg-card')  || '#0d1a0d';
  const fg     = css('--text')     || '#39ff66';
  const dim    = css('--border')   || '#1a4a2a';
  const accent = css('--accent')   || '#80ffaa';

  ctx.globalAlpha = 0.92;
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.globalAlpha = 1;

  const bw = 230, bh = 106;
  const bx = (canvas.width - bw) / 2;
  const by = (canvas.height - bh) / 2;

  ctx.fillStyle   = cardBg;
  ctx.fillRect(bx - 1, by - 1, bw + 2, bh + 2);
  ctx.fillStyle   = cardBg;
  ctx.fillRect(bx, by, bw, bh);

  ctx.strokeStyle = fg;  ctx.lineWidth = 1;
  ctx.strokeRect(bx, by, bw, bh);
  ctx.strokeStyle = dim;
  ctx.strokeRect(bx + 3, by + 3, bw - 6, bh - 6);

  ctx.textAlign    = 'center';
  ctx.textBaseline = 'top';
  const cx = canvas.width / 2;

  ctx.font = `bold ${FONT_SZ + 5}px 'VT323', 'Courier New', monospace`;
  ctx.fillStyle = accent;
  ctx.fillText('GAME OVER', cx, by + 12);

  ctx.font = FONT;
  ctx.fillStyle = fg;
  ctx.fillText(`SCORE: ${score}`, cx, by + 38);
  ctx.fillStyle = fg;
  ctx.fillText(`BEST:  ${hi}`, cx, by + 38 + LINE_H + 3);
  ctx.fillStyle = fg;
  ctx.fillText('press any key to exit', cx, by + 38 + LINE_H * 2 + 10);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
}
