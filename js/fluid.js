// Homepage background liquid: a low-res FLIP sim that pours in from the
// top right and fills the page up to the spout. The sim lives in
// js/fluid-sim.js and runs in a worker when OffscreenCanvas is available.
// It draws three layers: the water behind the page (.fluid-bg), a tint
// mask above the content (.fluid-tint) that shifts the hue of whatever is
// underwater, and the surface froth and bubbles over both (.fluid-froth).
import { FluidEngine, SPOUT_RISE } from './fluid-sim.js';

const RESIZE_DELAY = 150;
const POINTER_INTERVAL = 16;      // ms between pointer updates sent to the sim
const MAX_POINTER_SPEED = 2500;   // px/s

// The fill level (in 20% steps) and drain mode survive reloads.
const FILL_KEY = 'fluid-fill';
const DRAIN_KEY = 'fluid-drain';

function load(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function save(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Storage blocked; the water just starts over next visit.
  }
}

// Clicks on these keep their normal job and leave the water alone.
const INTERACTIVE = 'a, button, input, textarea, select, label, nav, footer, [data-href], [role="button"]';

function parseHex(value, fallback) {
  const hex = value.trim().replace('#', '');
  const full = hex.length === 3 ? [...hex].map(c => c + c).join('') : hex;
  if (!/^[0-9a-f]{6}$/i.test(full)) return fallback;
  return [0, 2, 4].map(i => parseInt(full.slice(i, i + 2), 16));
}

function readColors() {
  const styles = getComputedStyle(document.documentElement);
  return {
    fluid: parseHex(styles.getPropertyValue('--fluid'), [10, 19, 10]),
    hi: parseHex(styles.getPropertyValue('--fluid-hi'), [12, 23, 12]),
    tint: parseHex(styles.getPropertyValue('--fluid-tint'), [51, 204, 255]),
    foam: parseHex(styles.getPropertyValue('--fluid-foam'), [30, 60, 38]),
    froth: parseHex(styles.getPropertyValue('--fluid-froth'), [159, 232, 180]),
    glow: parseHex(styles.getPropertyValue('--fluid-glow'), [26, 138, 53]),
  };
}

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

// The height with mobile browser toolbars retracted, so the water still
// reaches the bottom edge after they slide away.
function viewportHeight() {
  const probe = document.createElement('div');
  probe.className = 'fluid-probe';
  document.body.appendChild(probe);
  const large = probe.offsetHeight;
  probe.remove();
  return Math.max(large, window.innerHeight);
}

// Display cells are whole device pixels so the scaled canvas stays crisp.
function measure(host, canvases, debug) {
  const want = parseFloat(getComputedStyle(host).getPropertyValue('--fluid-pitch')) || 6;
  const dpr = window.devicePixelRatio || 1;
  const pitch = Math.max(2, Math.round(want * dpr)) / dpr;
  const width = document.documentElement.clientWidth;
  const height = viewportHeight();
  // The floor is the footer's top edge, or the bottom of the viewport when
  // the footer is hidden (touch devices).
  const footer = document.querySelector('footer');
  const floor = footer?.getClientRects().length
    ? Math.min(height, footer.getBoundingClientRect().top) : height;
  const cols = Math.ceil(width / pitch);
  const rows = Math.ceil(height / pitch);
  for (const canvas of canvases) {
    canvas.style.setProperty('--fluid-w', `${cols * pitch}px`);
    canvas.style.setProperty('--fluid-h', `${rows * pitch}px`);
  }
  document.documentElement.style.setProperty('--spout-y', `${floor * (1 - SPOUT_RISE)}px`);
  // ?fluid-debug=fast pours in 15s for testing.
  const fillSeconds = debug === 'fast' ? 15 : 0;
  return { cols, rows, pitch, width, height, floor, reducedMotion: reduceMotion.matches, debug, fillSeconds };
}

function startWorker(canvases, roles, cfg, colors, onMessage, onFail) {
  if (!('transferControlToOffscreen' in canvases[0]) || typeof Worker === 'undefined') return null;
  let worker;
  try {
    worker = new Worker(new URL('./fluid-worker.js', import.meta.url), { type: 'module' });
    const offscreen = canvases.map(c => c.transferControlToOffscreen());
    worker.postMessage({ type: 'init', canvases: offscreen, roles, cfg, colors }, offscreen);
  } catch {
    worker?.terminate();
    return null;
  }
  let ready = false;
  worker.onmessage = ({ data }) => {
    if (data.type === 'ready') ready = true;
    else if (data.type === 'fail') onFail();
    else onMessage(data);
  };
  worker.onerror = () => {
    if (!ready) onFail();
  };
  return worker;
}

function startLocal(canvases, roles, cfg, colors, onMessage) {
  const layers = canvases.map((canvas, i) => ({ role: roles[i], canvas, ctx: canvas.getContext('2d') }));
  if (layers.some(l => !l.ctx)) return null;
  const engine = new FluidEngine(layers, cb => requestAnimationFrame(cb), onMessage);
  engine.setColors(colors);
  engine.configure(cfg);
  return engine;
}

export function initFluid() {
  const host = document.querySelector('.fluid-bg');
  if (!host) return;
  // The water layer is required; the tint and froth layers are optional.
  const found = [
    ['water', host],
    ['tint', document.querySelector('.fluid-tint')],
    ['froth', document.querySelector('.fluid-froth')],
  ].filter(([, el]) => el);
  const roles = found.map(([role]) => role);
  let canvases = found.map(([, el]) => el.querySelector('.fluid-canvas'));
  const debug = new URLSearchParams(location.search).get('fluid-debug');

  let readout = null;
  if (debug !== null) {
    readout = document.createElement('pre');
    readout.className = 'fluid-debug';
    document.body.appendChild(readout);
  }
  const onStats = s => {
    if (!readout) return;
    readout.textContent = `particles ${s.particles}\ncell ${s.cell}px\nstep ${s.ms.toFixed(2)}ms`
      + `\nfill ${(s.fill * 100).toFixed(0)}%\ntier ${s.tier}\ndensity ${s.density.toFixed(2)}\nspeed ${s.speed.toFixed(0)}`
      + `\n${worker ? 'worker' : 'main thread'}${s.sleeping ? '\nasleep' : ''}`;
  };

  const onMessage = msg => {
    if (msg.type === 'stats') onStats(msg.stats);
    else if (msg.type === 'fill') save(FILL_KEY, String(msg.level));
  };

  let cfg = null;
  let worker = null;
  let engine = null;
  let draining = load(DRAIN_KEY) === '1';
  const savedFill = parseFloat(load(FILL_KEY));
  const valve = document.querySelector('.fluid-valve');

  const fallback = () => {
    worker?.terminate();
    worker = null;
    // A transferred canvas can't be drawn on here, so swap in fresh ones.
    canvases = canvases.map(canvas => {
      const fresh = canvas.cloneNode();
      canvas.replaceWith(fresh);
      return fresh;
    });
    cfg = { ...measure(host, canvases, debug), draining, initialFill: savedFill };
    engine = startLocal(canvases, roles, cfg, readColors(), onMessage);
  };

  // A hidden or not-yet-laid-out page can report a zero-size viewport;
  // wait for a resize in that case.
  const begin = () => {
    cfg = { ...measure(host, canvases, debug), draining, initialFill: savedFill };
    if (cfg.cols < 1 || cfg.rows < 1 || cfg.floor < 1) return false;
    worker = startWorker(canvases, roles, cfg, readColors(), onMessage, fallback);
    if (!worker) engine = startLocal(canvases, roles, cfg, readColors(), onMessage);
    showValve();
    return true;
  };
  // The valve toggles drain mode: the spout stops and a drain opens in the
  // bottom-left corner; pressing it again closes the drain and pours.
  function syncValve() {
    if (!valve) return;
    valve.setAttribute('aria-pressed', String(draining));
    valve.dataset.cmd = draining ? 'pour' : 'drain';
  }

  function showValve() {
    if (!valve) return;
    syncValve();
    valve.hidden = reduceMotion.matches;
  }

  valve?.addEventListener('click', () => {
    draining = !draining;
    save(DRAIN_KEY, draining ? '1' : '0');
    syncValve();
    send('drain', { on: draining });
  });

  let started = begin();

  const send = (type, payload) => {
    if (worker) worker.postMessage({ type, ...payload });
    else if (engine) {
      if (type === 'config') engine.configure(payload.cfg);
      else if (type === 'colors') engine.setColors(payload.colors);
      else if (type === 'visible') engine.setVisible(payload.visible);
      else if (type === 'remove') engine.removeAt(payload.x, payload.y);
      else if (type === 'pointer') engine.pointer(payload.x, payload.y, payload.vx, payload.vy);
      else if (type === 'drain') engine.setDraining(payload.on);
      else if (type === 'splash') engine.splash(payload.points);
    }
  };

  const reconfigure = () => {
    cfg = { ...measure(host, canvases, debug), draining };
    send('config', { cfg });
  };

  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      if (!started) {
        started = begin();
        return;
      }
      const width = document.documentElement.clientWidth;
      const height = viewportHeight();
      const dpr = window.devicePixelRatio || 1;
      const want = parseFloat(getComputedStyle(host).getPropertyValue('--fluid-pitch')) || 6;
      const pitch = Math.max(2, Math.round(want * dpr)) / dpr;
      // Mobile browsers resize the viewport as their toolbars slide in and
      // out; small height-only changes keep the sim as it is.
      const minor = width === cfg.width && pitch === cfg.pitch
        && Math.abs(height - cfg.height) < cfg.height * 0.2;
      if (!minor) reconfigure();
    }, RESIZE_DELAY);
  });

  // Tap or click on open background scoops out a chunk of water.
  document.addEventListener('click', e => {
    if (!started || e.target.closest(INTERACTIVE)) return;
    const selection = window.getSelection();
    if (selection && !selection.isCollapsed) return;
    send('remove', { x: e.clientX, y: e.clientY });
  });

  // Pointer movement drags nearby water along. Velocity comes from the
  // last sent sample; updates are throttled to about one per frame.
  let last = null;
  document.addEventListener('pointermove', e => {
    if (!started) return;
    const t = e.timeStamp;
    if (last && t - last.t < POINTER_INTERVAL) return;
    let vx = 0;
    let vy = 0;
    if (last && t - last.t < 100) {
      const dt = (t - last.t) / 1000;
      vx = (e.clientX - last.x) / dt;
      vy = (e.clientY - last.y) / dt;
      const speed = Math.hypot(vx, vy);
      if (speed > MAX_POINTER_SPEED) {
        vx *= MAX_POINTER_SPEED / speed;
        vy *= MAX_POINTER_SPEED / speed;
      }
    }
    last = { t, x: e.clientX, y: e.clientY };
    send('pointer', { x: e.clientX, y: e.clientY, vx, vy });
  }, { passive: true });

  reduceMotion.addEventListener('change', () => {
    if (!started) return;
    showValve();
    reconfigure();
  });
  document.addEventListener('themechange', () => send('colors', { colors: readColors() }));
  // Other modules can release bubbles into the water: detail.points is a
  // list of { x, y, t } in viewport px, t = delay in ms.
  document.addEventListener('fluid-splash', e => {
    if (!started) return;
    send('splash', { points: e.detail.points });
  });
  document.addEventListener('visibilitychange', () => {
    send('visible', { visible: !document.hidden });
  });
}
