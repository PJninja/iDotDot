// UI tests that need no GPU. They cover the paths that are prone to break or differ by device:
// the board layout across screen sizes and pixel ratios, the project window with its focus and
// history handling, the tag filter, and the fallback to the plain page. Everything else (colors,
// copy, small states) is left to review.
//   npm run test:ui          (or: node tools/browser/test-ui.mjs [name filter])
// The board runs in a harness page against a fake world (tools/browser/harness); takes seconds.
// Exits 1 if any check fails.
import { computeGridGeometry, snapToDevicePixels } from '../../src/engine/grid-geometry.ts';
import { ensureDevServer, withPage } from './launch.mjs';

const ORIGIN = 'http://localhost:5173';
const HARNESS = `${ORIGIN}/tools/browser/harness/harness.html`;
const filter = process.argv[2];
const results = [];
const queue = [];

/** Queue a group; it runs on a page without WebGPU, and an uncaught page error fails it. */
function group(name, url, body, options = {}) {
  if (filter && !name.includes(filter)) return;
  queue.push({ name, url, body, options });
}

/** Run one queued group and print its lines together, so parallel groups do not interleave. */
async function runGroup({ name, url, body, options }) {
  const lines = [];
  const report = (check, pass, detail = '') => {
    results.push(pass);
    lines.push(`${pass ? 'PASS' : 'FAIL'}  ${name}: ${check}${detail ? ` (${detail})` : ''}`);
  };
  try {
    await withPage(url, async (page, log) => {
      await page.waitForTimeout(400);
      await body(page, report);
      if (log.pageErrors.length > 0) report('no uncaught page errors', false, log.pageErrors.join(' | ').slice(0, 200));
    }, { gpu: false, ...options });
  } catch (error) {
    report('ran to completion', false, String(error).slice(0, 200));
  }
  console.log(lines.join('\n'));
}

/** Run the queue with a few browsers at a time (each group is its own Chromium). */
async function runAll(limit = 4) {
  let next = 0;
  await Promise.all(Array.from({ length: limit }, async () => {
    while (next < queue.length) await runGroup(queue[next++]);
  }));
}

/** Final tiles stamped by the board (later stamps replace earlier ones), colliders, and fit. */
const boardState = (page) =>
  page.evaluate(() => {
    const h = window.__h;
    const tiles = new Map();
    for (const s of h.stamped) {
      for (let j = 0; j < s.h; j++) for (let i = 0; i < s.w; i++) {
        const word = s.words[j * s.w + i];
        const key = `${s.x + i},${s.y + j}`;
        if (word !== 0) tiles.set(key, word);
        else tiles.delete(key);
      }
    }
    const rects = [];
    h.colliders.forEachRect((r) => rects.push({ ...r }));
    const chips = rects.slice(0, document.querySelectorAll('.chip:not([hidden])').length);
    let overlaps = 0;
    for (let a = 0; a < rects.length; a++) for (let b = a + 1; b < rects.length; b++) {
      const p = rects[a], q = rects[b];
      if (p.x < q.x + q.w && q.x < p.x + p.w && p.y < q.y + q.h && q.y < p.y + p.h) overlaps++;
    }
    const mid = (r) => ({ x: r.x + (r.w >> 1), y: r.y + (r.h >> 1) });
    // The ring must touch the collider from outside on all four sides, and no ring tile may lie
    // inside it (a collider one cell too wide swallows the ring's inner row).
    const ringed = chips.length > 0 && chips.every((r) => {
      const m = mid(r);
      const outside = [[r.x - 1, m.y], [r.x + r.w, m.y], [m.x, r.y - 1], [m.x, r.y + r.h]];
      const inside = [[r.x, m.y], [r.x + r.w - 1, m.y], [m.x, r.y], [m.x, r.y + r.h - 1]];
      return outside.every(([x, y]) => tiles.has(`${x},${y}`)) && inside.every(([x, y]) => !tiles.has(`${x},${y}`));
    });
    const torches = [...tiles.values()].filter((w) => (w & 0xff) === 27).length;
    const lettersRight = Math.max(0, ...[...tiles.keys()].map((k) => Number(k.split(',')[0])));
    return { fits: h.fits, overlaps, ringed, torches, lettersRight, gridCells: h.gridWidth };
  });

/**
 * Pixel geometry, checked as arithmetic (no browser): at every pixel ratio that occurs, the canvas
 * covers whole device pixels, starts on a pixel edge under the snapped header, and is not stretched.
 */
function geometryChecks() {
  if (filter && !'pixel geometry'.includes(filter)) return;
  const ratios = [0.8, 0.9, 1, 1.1, 1.2, 1.25, 1.5, 1.75, 2, 2.625, 3];
  const windows = [[1280, 720], [1366, 768], [1920, 1080], [412, 915], [390, 844]];
  const bad = { stretched: [], offEdge: [], fractionalTile: [], overflow: [] };
  const whole = (v) => Math.abs(v - Math.round(v)) < 1e-9;
  for (const dpr of ratios) {
    for (const [w, h] of windows) {
      const header = snapToDevicePixels(48, dpr);
      const g = computeGridGeometry(w, h - header, dpr, 4, 2048);
      const label = `${dpr}x ${w}x${h}`;
      if (Math.abs(g.cssWidth * dpr - g.deviceWidth) > 1e-9 || Math.abs(g.cssHeight * dpr - g.deviceHeight) > 1e-9) bad.stretched.push(label);
      if (!whole(header * dpr)) bad.offEdge.push(label);
      if (!Number.isInteger(g.tilePx) || !whole(g.tileSize * dpr)) bad.fractionalTile.push(label);
      if (g.deviceWidth > w * dpr + 1e-6 || Math.round(header * dpr) + g.deviceHeight > h * dpr + 1e-6) bad.overflow.push(label);
    }
  }
  const report = (name, list) => {
    results.push(list.length === 0);
    console.log(`${list.length === 0 ? 'PASS' : 'FAIL'}  pixel geometry: ${name}${list.length ? ` (${list.slice(0, 4).join('; ')})` : ''}`);
  };
  report('the canvas is whole device pixels on screen, never stretched', bad.stretched);
  report('the canvas starts on a device pixel edge below the header', bad.offEdge);
  report('a tile is a whole number of device pixels', bad.fractionalTile);
  report('the canvas stays inside the window', bad.overflow);
}

const stop = await ensureDevServer(ORIGIN);
try {
  // Board layout: device-dependent (screen size, pixel ratio -> fractional tile sizes), and where
  // the ring/collider alignment and the lettering width have broken before.
  // Pixel ratios that divide the 4 px tile evenly (1x, 1.25x, 1.5x, 2x, 3x) behave like 1x. Browser
  // zoom (110%, 90%, ...) and some phones (Pixel-class 2.625x) give a fractional tile size instead.
  // Only combinations that can occur are listed.
  const screens = [
    ['desktop 1280x720, 20 projects', '?n=20', { width: 1280, height: 720 }, true],
    ['large 1920x1080, 20 projects', '?n=20', { width: 1920, height: 1080 }, true],
    ['browser zoom 110% (fractional tile size)', '?n=12', { width: 1280, height: 720, deviceScaleFactor: 1.1 }, true],
    ['Pixel-class phone 412x915 at 2.625x', '?n=3', { width: 412, height: 915, deviceScaleFactor: 2.625 }, true],
    ['phone 390x844, too many projects', '?n=10', { width: 390, height: 844 }, false],
    // The tile size dropdown (1, 2, 4, 8, 16 px); 4 px is the default and is covered above.
    ...[1, 2, 8, 16].map((tile) => [`${tile} px tiles, 12 projects`, `?n=12&tile=${tile}`, { width: 1280, height: 720 }, true]),
  ];
  for (const [label, query, options, fits] of screens) {
    await group(`layout: ${label}`, `${HARNESS}${query}`, async (page, t) => {
      const s = await boardState(page);
      t(fits ? 'every chip fits' : 'falls back to the plain page', s.fits === fits);
      if (!fits) return;
      t('chips do not overlap each other or the text', s.overlaps === 0, `${s.overlaps} overlaps`);
      t('a tile ring fits exactly around every chip', s.ringed);
      t('the name lettering stays inside the window', s.lettersRight < s.gridCells, `right edge ${s.lettersRight} of ${s.gridCells} cells`);
    }, options);
  }

  // Project window: custom focus handling and history, easy to break.
  await group('window and history', HARNESS, async (page, t) => {
    const chip = '.chip[data-id="idotdot"]';
    await page.click(chip);
    t('clicking a chip opens the preview', await page.isVisible('.project-window'));
    await page.keyboard.press('Escape');
    t('Escape closes it and focus returns to the chip',
      !(await page.isVisible('.project-window')) && (await page.evaluate(() => document.activeElement?.getAttribute('data-id'))) === 'idotdot');

    await page.click('.chip[data-id="placeholder-a"]');
    await page.click('.win-more');
    t('Read more opens the detail view and writes the URL hash',
      (await page.evaluate(() => location.hash)) === '#/placeholder-a' && (await page.isVisible('.project-window.is-detail')));
    await page.goBack();
    await page.waitForTimeout(150);
    t('Back closes the detail view', !(await page.isVisible('.project-window')) && (await page.evaluate(() => location.hash)) === '');

    await page.click(chip);
    for (let i = 0; i < 5; i++) await page.keyboard.press('Tab');
    t('Tab cannot leave the open window', await page.evaluate(() => document.querySelector('.project-window').contains(document.activeElement)));
  });

  await group('window deep link', `${HARNESS}#/idotdot`, async (page, t) => {
    t('a URL with a project hash opens its detail view', await page.isVisible('.project-window.is-detail'));
    await page.keyboard.press('Escape');
    await page.waitForTimeout(150);
    t('closing it clears the hash', (await page.evaluate(() => location.hash)) === '');
  });

  // Tag filter: restamps rings through the engine, and is restored from the URL.
  await group('tag filter', HARNESS, async (page, t) => {
    await page.click('.tag-word:has-text("Wood border")');
    const lit = (await boardState(page)).torches;
    await page.click('.tag-clear');
    const cleared = (await boardState(page)).torches;
    t('selecting a tag lights the matching chip and clearing restores it', lit === 3 && cleared === 0, `torches ${lit} then ${cleared}`);
  });

  await group('tag filter from the URL', `${HARNESS}?tag=Simulation`, async (page, t) => {
    t('a tag in the URL is selected and its chip is lit', (await boardState(page)).torches === 3);
  });

  // Fallbacks for devices without WebGPU (the real app, which returns before touching the GPU).
  await group('plain page', `${ORIGIN}/?view=plain`, async (page, t) => {
    const articles = await page.evaluate(() => document.querySelectorAll('#plain-view article').length);
    t('the plain page lists every project', articles >= 3, `${articles} articles`);
  });

  await group('no WebGPU', `${ORIGIN}/`, async (page, t) => {
    const notice = await page.evaluate(() => document.querySelector('.plain-notice')?.textContent);
    t('a browser without WebGPU gets the plain page with the reason', notice === 'WebGPU is not available in this browser, so the simulation cannot run.', notice);
  }, { initScript: () => Object.defineProperty(navigator, 'gpu', { value: undefined }) });
  geometryChecks();
  await runAll();
} finally {
  stop();
}

const failed = results.filter((pass) => !pass).length;
console.log(`\n${results.length - failed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
