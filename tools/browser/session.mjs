// A warm browser: pay the roughly 7 s software shader compile once, then run many commands against
// the same page and GPU device in milliseconds. Every fresh page load costs the compile again (a
// persistent profile, a smaller window and a second page in the same browser did not help).
//
//   node tools/browser/session.mjs start [url] [--width 1280] [--height 720] [--port 9222]
//   node tools/browser/session.mjs status
//   node tools/browser/session.mjs eval "<js>"     run JS in the page, print the JSON result
//   node tools/browser/session.mjs goto <url>      load another page (pays the compile again)
//   node tools/browser/session.mjs stop
// Then pass `--session` to readgrid.mjs and shot.mjs. `start` leaves the sim stopped: a running sim
// queues frames far faster than the software GPU finishes them, and a later read would wait for
// all of them (one read took 55 s after 10 s of running). Run it on purpose with
// `eval "__world.start()"` or `readgrid.mjs --session --resume`, and stop it before reading.
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { settleSim } from './grid.mjs';
import {
  CHROMIUM_FLAGS, chromiumPath, ensureDevServer, FAST_COMPOSITING_CSS, parseArgs, readSession, SESSION_FILE,
  withSession,
} from './launch.mjs';

const { positional, named } = parseArgs(process.argv.slice(3));
const command = process.argv[2];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const killGroup = (pid) => {
  try {
    process.kill(-pid);
  } catch {
    try {
      process.kill(pid);
    } catch {
      // already gone
    }
  }
};
const answering = async (port) => {
  try {
    return (await fetch(`http://127.0.0.1:${port}/json/version`)).ok;
  } catch {
    return false;
  }
};

/**
 * Size the window until the loaded page's inner size is width x height. A viewport override would
 * vanish when a connection closes, so this sets the real window bounds, and it measures on the real
 * page through a fresh connection each round because the browser's own chrome (infobars and so on)
 * changes the inner size by an amount that cannot be known up front.
 */
async function fitWindow(width, height) {
  for (let round = 0; round < 5; round++) {
    const matched = await withSession(async (page) => {
      const inner = await page.evaluate(() => ({ w: innerWidth, h: innerHeight }));
      if (inner.w === width && inner.h === height) return true;
      const cdp = await page.context().newCDPSession(page);
      const { windowId } = await cdp.send('Browser.getWindowForTarget');
      const { bounds } = await cdp.send('Browser.getWindowBounds', { windowId });
      await cdp.send('Browser.setWindowBounds', {
        windowId,
        bounds: { width: bounds.width + width - inner.w, height: bounds.height + height - inner.h },
      });
      await cdp.detach();
      await page.waitForTimeout(400);
      return false;
    });
    if (matched) return;
  }
  console.log(`Could not size the window to ${width}x${height}; the page may be a different size.`);
}

async function start() {
  const existing = readSession();
  if (existing && (await answering(existing.port))) {
    console.log(`A session is already running on port ${existing.port} (${existing.url}). Use stop first.`);
    process.exit(1);
  }
  const url = positional[0] ?? 'http://localhost:5173/?world=farmstead';
  const port = Number(named.port ?? 9222);
  const width = Number(named.width ?? 1280);
  const height = Number(named.height ?? 720);
  const target = new URL(url);
  const stopServer = target.hostname === 'localhost' ? await ensureDevServer(target.origin) : Object.assign(() => {}, {});
  const profile = mkdtempSync(join(tmpdir(), 'idotdot-session-'));
  const browser = spawn(
    chromiumPath(),
    [...CHROMIUM_FLAGS, '--headless', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, `--window-size=${width},${height}`, '--no-first-run', 'about:blank'],
    { detached: true, stdio: 'ignore' },
  );
  browser.unref();
  for (let i = 0; i < 100 && !(await answering(port)); i++) await sleep(100);
  if (!(await answering(port))) {
    killGroup(browser.pid);
    throw new Error('Chromium did not open its debugging port');
  }
  writeFileSync(SESSION_FILE, JSON.stringify({ port, url, browserPid: browser.pid, serverPid: stopServer.startedPid, profile }));
  const began = Date.now();
  const hasSim = await withSession(async (page) => {
    await page.goto(url);
    await page.addStyleTag({ content: FAST_COMPOSITING_CSS });
    const found = await page.waitForFunction(() => window.__world?.width > 0, null, { timeout: 15000 }).then(() => true, () => false);
    if (!found) return false;
    await settleSim(page);
    await page.evaluate(() => window.__world.readGrid());
    return true;
  });
  await fitWindow(width, height);
  if (!hasSim) {
    console.log(`Session started on port ${port} at ${url} (no simulation on this page, nothing to warm).`);
    return;
  }
  console.log(`Session warm on port ${port} at ${url} after ${Date.now() - began} ms (viewport ${width}x${height}).`);
  console.log('The sim is stopped so no GPU work queues up; run it with: session.mjs eval "__world.start()"');
}

async function stop() {
  const session = readSession();
  if (session === null) {
    console.log('No session recorded.');
    return;
  }
  rmSync(SESSION_FILE, { force: true });
  killGroup(session.browserPid);
  if (session.serverPid) killGroup(session.serverPid);
  await sleep(500);
  try {
    rmSync(session.profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  } catch {
    // the temp profile is left for the OS to clean up
  }
  console.log('Session stopped.');
}

async function status() {
  const session = readSession();
  if (session === null || !(await answering(session.port))) {
    console.log('No warm session running.');
    process.exit(1);
  }
  await withSession(async (page) => {
    const sim = await page.evaluate(() => {
      const w = window.__world;
      return w ? { running: w.running, steps: w.stepCount, grid: `${w.width}x${w.height}`, idle: w.perf.idle } : null;
    });
    console.log(JSON.stringify({ port: session.port, page: page.url(), sim }));
  });
}

switch (command) {
  case 'start':
    await start();
    break;
  case 'stop':
    await stop();
    break;
  case 'status':
    await status();
    break;
  case 'eval':
    await withSession(async (page) => console.log(JSON.stringify(await page.evaluate(positional[0]))));
    break;
  case 'goto':
    await withSession(async (page) => {
      await page.goto(positional[0]);
      await page.addStyleTag({ content: FAST_COMPOSITING_CSS });
      console.log(`now at ${page.url()}`);
    });
    break;
  default:
    console.log('Usage: session.mjs start [url] | status | eval "<js>" | goto <url> | stop');
    process.exit(command ? 1 : 0);
}
process.exit(0);
