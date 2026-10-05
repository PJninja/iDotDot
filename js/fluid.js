// Homepage background liquid: a low-res FLIP sim that pours in from the
// top right and fills the page up to the spout. The sim lives in
// js/fluid-sim.js and runs in a worker when OffscreenCanvas is available.
import { FluidEngine } from './fluid-sim.js';

const RESIZE_DELAY = 150;
const POINTER_INTERVAL = 16;      // ms between pointer updates sent to the sim
const MAX_POINTER_SPEED = 2500;   // px/s

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
  };
}

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

// Display cells are whole device pixels so the scaled canvas stays crisp.
function measure(host, canvas, debug) {
  const want = parseFloat(getComputedStyle(host).getPropertyValue('--fluid-pitch')) || 6;
  const dpr = window.devicePixelRatio || 1;
  const pitch = Math.max(2, Math.round(want * dpr)) / dpr;
  const width = document.documentElement.clientWidth;
  const height = window.innerHeight;
  const footer = document.querySelector('footer');
  const floor = footer ? Math.min(height, footer.getBoundingClientRect().top) : height;
  const cols = Math.ceil(width / pitch);
  const rows = Math.ceil(height / pitch);
  canvas.style.setProperty('--fluid-w', `${cols * pitch}px`);
  canvas.style.setProperty('--fluid-h', `${rows * pitch}px`);
  // ?fluid-debug=fast pours in 15s for testing.
  const fillSeconds = debug === 'fast' ? 15 : 0;
  return { cols, rows, pitch, width, height, floor, reducedMotion: reduceMotion.matches, debug, fillSeconds };
}

function startWorker(canvas, cfg, colors, onStats, onFail) {
  if (!('transferControlToOffscreen' in canvas) || typeof Worker === 'undefined') return null;
  let worker;
  try {
    worker = new Worker(new URL('./fluid-worker.js', import.meta.url), { type: 'module' });
    const offscreen = canvas.transferControlToOffscreen();
    worker.postMessage({ type: 'init', canvas: offscreen, cfg, colors }, [offscreen]);
  } catch {
    worker?.terminate();
    return null;
  }
  let ready = false;
  worker.onmessage = ({ data }) => {
    if (data.type === 'ready') ready = true;
    else if (data.type === 'stats') onStats(data.stats);
    else if (data.type === 'fail') onFail();
  };
  worker.onerror = () => {
    if (!ready) onFail();
  };
  return worker;
}

function startLocal(canvas, cfg, colors, onStats) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  const engine = new FluidEngine(canvas, ctx, cb => requestAnimationFrame(cb), onStats);
  engine.setColors(colors);
  engine.configure(cfg);
  return engine;
}

export function initFluid() {
  const host = document.querySelector('.fluid-bg');
  if (!host) return;
  let canvas = host.querySelector('.fluid-canvas');
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

  let cfg = null;
  let worker = null;
  let engine = null;

  const fallback = () => {
    worker?.terminate();
    worker = null;
    // A transferred canvas can't be drawn on here, so swap in a fresh one.
    const fresh = canvas.cloneNode();
    canvas.replaceWith(fresh);
    canvas = fresh;
    cfg = measure(host, canvas, debug);
    engine = startLocal(canvas, cfg, readColors(), onStats);
  };

  // A hidden or not-yet-laid-out page can report a zero-size viewport;
  // wait for a resize in that case.
  const begin = () => {
    cfg = measure(host, canvas, debug);
    if (cfg.cols < 1 || cfg.rows < 1 || cfg.floor < 1) return false;
    worker = startWorker(canvas, cfg, readColors(), onStats, fallback);
    if (!worker) engine = startLocal(canvas, cfg, readColors(), onStats);
    return true;
  };
  let started = begin();

  const send = (type, payload) => {
    if (worker) worker.postMessage({ type, ...payload });
    else if (engine) {
      if (type === 'config') engine.configure(payload.cfg);
      else if (type === 'colors') engine.setColors(payload.colors);
      else if (type === 'visible') engine.setVisible(payload.visible);
      else if (type === 'remove') engine.removeAt(payload.x, payload.y);
      else if (type === 'pointer') engine.pointer(payload.x, payload.y, payload.vx, payload.vy);
    }
  };

  const reconfigure = () => {
    cfg = measure(host, canvas, debug);
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
      const height = window.innerHeight;
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
    if (started) reconfigure();
  });
  document.addEventListener('themechange', () => send('colors', { colors: readColors() }));
  document.addEventListener('visibilitychange', () => {
    send('visible', { visible: !document.hidden });
  });
}
