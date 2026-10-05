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

// The fill level (in 20% steps), drain mode and tilt survive reloads.
const FILL_KEY = 'fluid-fill';
const DRAIN_KEY = 'fluid-drain';
const TILT_KEY = 'fluid-tilt';

// Tilt: on touch devices the water's gravity follows the phone.
const TILT_INTERVAL = 33;         // ms between gravity updates sent to the sim
const TILT_FLAT = 0.2;            // in-screen share of gravity below which the phone counts as flat

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
const touchOnly = window.matchMedia('(hover: none) and (pointer: coarse)');

// The screen's rotation from the device's natural orientation, in degrees
// counterclockwise.
function screenAngle() {
  const angle = screen.orientation?.angle ?? window.orientation ?? 0;
  return ((angle % 360) + 360) % 360;
}

// Gravity in screen space (x right, y down) from a deviceorientation event,
// or null when the phone lies too flat to tell. In the device frame, down is
// (cos β sin γ, -sin β) with y toward the top edge; flip y to point down,
// then undo the screen's rotation.
function screenGravity(e) {
  if (e.beta == null || e.gamma == null) return null;
  const beta = e.beta * Math.PI / 180;
  const gamma = e.gamma * Math.PI / 180;
  const x = Math.cos(beta) * Math.sin(gamma);
  const y = Math.sin(beta);
  if (Math.hypot(x, y) < TILT_FLAT) return null;
  const a = screenAngle() * Math.PI / 180;
  return [x * Math.cos(a) + y * Math.sin(a), y * Math.cos(a) - x * Math.sin(a)];
}

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
  return {
    cols, rows, pitch, width, height, floor, angle: screenAngle(),
    reducedMotion: reduceMotion.matches, debug, fillSeconds,
  };
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
  const tiltButton = document.querySelector('.fluid-tilt');

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
    showControls();
    return true;
  };
  // The valve toggles drain mode: the spout stops and a drain opens in the
  // bottom-left corner; pressing it again closes the drain and pours.
  function syncValve() {
    if (!valve) return;
    valve.setAttribute('aria-pressed', String(draining));
    valve.dataset.cmd = draining ? 'pour' : 'drain';
  }

  function showControls() {
    if (valve) {
      syncValve();
      valve.hidden = reduceMotion.matches;
    }
    if (tiltButton) {
      tiltButton.hidden = reduceMotion.matches || !touchOnly.matches
        || typeof DeviceOrientationEvent === 'undefined';
    }
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
      else if (type === 'gravity') engine.setGravity(payload.x, payload.y);
    }
  };

  // A rotated screen tells the sim how far it turned, so the water keeps
  // its place in the phone and pours to the new bottom.
  const reconfigure = () => {
    const angle = cfg.angle;
    cfg = { ...measure(host, canvases, debug), draining };
    cfg.rotate = (cfg.angle - angle + 360) % 360;
    send('config', { cfg });
  };

  // The tilt toggle makes gravity follow the phone. iOS asks permission
  // first, and only from a tap; elsewhere the events just flow.
  let tilting = false;
  let lastTilt = 0;
  const needsPermission = typeof DeviceOrientationEvent !== 'undefined'
    && typeof DeviceOrientationEvent.requestPermission === 'function';

  const onOrientation = e => {
    if (!started || reduceMotion.matches || e.timeStamp - lastTilt < TILT_INTERVAL) return;
    const g = screenGravity(e);
    if (!g) return;
    lastTilt = e.timeStamp;
    send('gravity', { x: g[0], y: g[1] });
  };

  async function allowTilt() {
    if (!needsPermission) return true;
    try {
      return await DeviceOrientationEvent.requestPermission() === 'granted';
    } catch {
      return false;
    }
  }

  function setTilt(on) {
    tilting = on;
    save(TILT_KEY, on ? '1' : '0');
    tiltButton?.setAttribute('aria-pressed', String(on));
    if (on) {
      window.addEventListener('deviceorientation', onOrientation);
    } else {
      window.removeEventListener('deviceorientation', onOrientation);
      send('gravity', { x: 0, y: 1 });
    }
  }

  // Tilt left on last visit comes back on: right away where no permission is
  // needed, else with the first tap on the page.
  const resumeTilt = e => {
    if (e.target.closest?.('.fluid-tilt')) return;
    document.removeEventListener('click', resumeTilt, true);
    allowTilt().then(ok => {
      if (ok && !tilting) setTilt(true);
    });
  };

  tiltButton?.addEventListener('click', () => {
    document.removeEventListener('click', resumeTilt, true);
    if (tilting) {
      setTilt(false);
      return;
    }
    allowTilt().then(ok => {
      if (ok) setTilt(true);
    });
  });

  const restoreTilt = () => {
    if (!tiltButton || tiltButton.hidden || load(TILT_KEY) !== '1') return;
    if (needsPermission) document.addEventListener('click', resumeTilt, true);
    else setTilt(true);
  };
  if (started) restoreTilt();

  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      if (!started) {
        started = begin();
        if (started) restoreTilt();
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
    showControls();
    if (reduceMotion.matches) send('gravity', { x: 0, y: 1 });
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
