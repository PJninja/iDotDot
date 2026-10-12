// Shared helpers for driving the sim in headless Chromium. Plain Node (22+), no dependencies of its own:
// Playwright is found on the machine, not in this repo (the repo's only devDependencies are typescript and vite).
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

/**
 * Chromium flags that give a working software WebGPU in a GPU-less container. Each one was needed:
 * the Vulkan/swiftshader set provides the adapter; `--use-angle=swiftshader` lets the compositor
 * create the shared image behind the WebGPU canvas (without it the GPU process died on the first
 * presented frame and the device was lost); the last two keep 2D canvas text on the CPU (on the
 * software GPU the first fillText took about 9 s and froze the page).
 */
export const CHROMIUM_FLAGS = [
  '--enable-unsafe-webgpu',
  '--use-angle=swiftshader',
  '--use-vulkan=swiftshader',
  '--use-webgpu-adapter=swiftshader',
  '--enable-features=Vulkan',
  '--disable-vulkan-surface',
  '--enable-unsafe-swiftshader',
  '--ignore-gpu-blocklist',
  '--no-sandbox',
  '--disable-gpu-sandbox',
  '--disable-accelerated-2d-canvas',
  '--disable-gpu-rasterization',
];

/**
 * CSS for pages under test. The header's `backdrop-filter` blur is composited in software over the
 * WebGPU canvas and cut the sim from 60 steps/s to about 5; this switches it off.
 */
export const FAST_COMPOSITING_CSS = '#header { backdrop-filter: none !important; -webkit-backdrop-filter: none !important; }';

/** Hides every DOM layer over the canvas, for runs that only read simulation state. */
export const HIDE_UI_CSS = '#overlay, #header { visibility: hidden !important; }';


const PLAYWRIGHT_CANDIDATES = ['playwright', 'playwright-core', '/opt/node-tools/node_modules/playwright/index.mjs'];
const CHROMIUM_CANDIDATES = [process.env.CHROMIUM_PATH, '/opt/pw-browsers/chromium'];

/** Import Playwright from the repo, the global install or /opt/node-tools, whichever exists. */
export async function loadPlaywright() {
  const tried = [];
  for (const name of PLAYWRIGHT_CANDIDATES) {
    try {
      return await import(name.startsWith('/') ? pathToFileURL(name).href : name);
    } catch {
      tried.push(name);
    }
  }
  try {
    const globalRoot = createRequire(import.meta.url)('node:child_process')
      .execSync('npm root -g', { encoding: 'utf8' })
      .trim();
    return await import(pathToFileURL(join(globalRoot, 'playwright', 'index.mjs')).href);
  } catch {
    throw new Error(`Playwright not found (tried ${tried.join(', ')} and the global npm root)`);
  }
}

function chromiumPath() {
  return CHROMIUM_CANDIDATES.find((p) => p && existsSync(p));
}

/**
 * Make sure a Vite dev server answers at `origin`, starting `npx vite` if nothing does. Returns
 * a function that stops the server only if this call started it.
 */
export async function ensureDevServer(origin = 'http://localhost:5173') {
  const alive = async () => {
    try {
      return (await fetch(origin)).ok;
    } catch {
      return false;
    }
  };
  if (await alive()) return () => {};
  const url = new URL(origin);
  const child = spawn('npx', ['vite', '--port', url.port || '5173', '--strictPort'], {
    cwd: REPO_ROOT,
    stdio: 'ignore',
    detached: true,
  });
  child.unref();
  for (let i = 0; i < 50; i++) {
    if (await alive()) return () => process.kill(-child.pid);
    await new Promise((r) => setTimeout(r, 200));
  }
  process.kill(-child.pid);
  throw new Error(`Dev server did not start at ${origin}`);
}

/** Console messages that mean the GPU process died, not that the app is broken. */
const isDeviceLoss = (text) => /Instance reference no longer exists|device lost/i.test(text);

/**
 * Open `url` in a fresh headless Chromium with working software WebGPU and run `run(page, log)`.
 * `log` collects console errors and page errors; `log.deviceLost` is true if the GPU process was
 * killed. Options: width, height, css (a stylesheet added before the page's own scripts run;
 * defaults to FAST_COMPOSITING_CSS), initScript (a function run before the page's scripts),
 * flags (extra Chromium flags). The browser is always closed.
 */
export async function withPage(url, run, options = {}) {
  const { chromium } = await loadPlaywright();
  const browser = await chromium.launch({
    executablePath: chromiumPath(),
    args: [...CHROMIUM_FLAGS, ...(options.flags ?? [])],
  });
  const startedAt = Date.now();
  const log = { errors: [], pageErrors: [], failedRequests: [], deviceLost: false, elapsedMs: () => Date.now() - startedAt };
  try {
    const page = await browser.newPage({ viewport: { width: options.width ?? 1280, height: options.height ?? 720 } });
    page.on('console', (m) => {
      if (m.type() !== 'error' && m.type() !== 'warning') return;
      if (isDeviceLoss(m.text())) log.deviceLost = true;
      else if (m.type() === 'error') log.errors.push(m.text());
    });
    page.on('response', (r) => {
      if (r.status() >= 400) log.failedRequests.push(`${r.status()} ${r.url()}`);
    });
    page.on('pageerror', (e) => {
      if (isDeviceLoss(e.message)) log.deviceLost = true;
      else log.pageErrors.push(e.message);
    });
    const css = options.css ?? FAST_COMPOSITING_CSS;
    await page.addInitScript((text) => {
      document.addEventListener('DOMContentLoaded', () => {
        const style = document.createElement('style');
        style.textContent = text;
        document.head.appendChild(style);
      });
    }, css);
    if (options.initScript) await page.addInitScript(options.initScript);
    await page.goto(url);
    return await run(page, log);
  } finally {
    await browser.close();
  }
}

/** Parse `--name value` and `--flag` arguments; the rest are positional. */
export function parseArgs(argv, defaults = {}) {
  const positional = [];
  const named = { ...defaults };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith('--')) {
      positional.push(arg);
      continue;
    }
    const name = arg.slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) named[name] = true;
    else {
      named[name] = Number.isNaN(Number(next)) ? next : Number(next);
      i++;
    }
  }
  return { positional, named };
}

/**
 * Print the console errors a run collected; returns true if there were any (not counting a GPU death).
 * The browser asks for /favicon.ico itself, which the dev server answers with a 404 and Chromium
 * logs as "Failed to load resource"; that message is dropped when no request made by the page
 * failed, so a real missing asset (which does show up as a failed request) still counts.
 */
export function reportLog(log) {
  const pageRequestsFailed = log.failedRequests.length > 0;
  const errors = log.errors.filter((e) => pageRequestsFailed || !/Failed to load resource.*404/.test(e));
  for (const e of errors) console.log('[console.error]', e.slice(0, 300));
  for (const e of log.pageErrors) console.log('[pageerror]', e.slice(0, 300));
  for (const r of log.failedRequests) console.log('[failed request]', r);
  if (log.deviceLost) console.log(`[note] the GPU process was killed (${log.elapsedMs()} ms after launch)`);
  return errors.length + log.pageErrors.length + log.failedRequests.length > 0 || log.deviceLost;
}
