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

/** What the board put in the world: final tiles (later stamps replace earlier ones), chips and colliders. */
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
    const canvasTop = document.getElementById('sandbox').getBoundingClientRect().top;
    const cellBox = (b) => ({
      x: Math.round(b.left / h.tileSize), y: Math.round((b.top - canvasTop - h.originY) / h.tileSize),
      w: Math.round(b.width / h.tileSize), h: Math.round(b.height / h.tileSize),
    });
    const chipEls = [...document.querySelectorAll('.chip:not([hidden])')];
    const chips = chipEls.map((el) => cellBox(el.getBoundingClientRect()));
    let overlaps = 0;
    for (let a = 0; a < rects.length; a++) for (let b = a + 1; b < rects.length; b++) {
      const p = rects[a], q = rects[b];
      if (p.x < q.x + q.w && q.x < p.x + p.w && p.y < q.y + q.h && q.y < p.y + p.h) overlaps++;
    }
    // Each chip's collider must be exactly its cell box; the ring must touch it from outside on all
    // four sides, and no ring tile may lie inside it (a collider one cell too wide swallows a ring row).
    const exact = chips.length > 0 && chips.every((c) => rects.some((r) => r.x === c.x && r.y === c.y && r.w === c.w && r.h === c.h));
    const ringed = chips.length > 0 && chips.every((r) => {
      const mx = r.x + (r.w >> 1), my = r.y + (r.h >> 1);
      const outside = [[r.x - 1, my], [r.x + r.w, my], [mx, r.y - 1], [mx, r.y + r.h]];
      const inside = [[r.x, my], [r.x + r.w - 1, my], [mx, r.y], [mx, r.y + r.h - 1]];
      return outside.every(([x, y]) => tiles.has(`${x},${y}`)) && inside.every(([x, y]) => !tiles.has(`${x},${y}`));
    });
    const gallery = document.querySelector('.gallery:not([hidden])')?.getBoundingClientRect();
    const boxes = [...chipEls.map((el) => el.getBoundingClientRect()), ...(gallery ? [gallery] : [])];
    const inWindow = boxes.every((b) => b.left >= -0.5 && b.right <= innerWidth + 0.5 && b.top >= canvasTop - 0.5 && b.bottom <= innerHeight + 0.5);
    const torches = [...tiles.values()].filter((w) => (w & 0xff) === 27).length;
    return { fits: h.fits, chips: chips.length, ids: chipEls.map((el) => el.dataset.id), overlaps, exact, ringed, inWindow, torches };
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
  // the chip/collider/ring alignment has broken before. Windows 920 px and wider show four big
  // chips, 420 px and wider one column of two big chips, narrower ones two small chips, and a
  // canvas shorter than 600 px falls back to the plain page.
  // Pixel ratios that divide the 4 px tile evenly (1.25x, 1.5x, 2x, 3x) behave like 1x; browser zoom
  // (110%, 90%, ...) and some phones (Pixel-class 2.625x) give a fractional tile size instead.
  // Only combinations that can occur are listed.
  const screens = [
    ['desktop 1280x720', '?n=12', { width: 1280, height: 720 }, 4, 400],
    ['large 1920x1080', '?n=12', { width: 1920, height: 1080 }, 4, 400],
    ['browser zoom 110% (fractional tile size)', '?n=12', { width: 1280, height: 720, deviceScaleFactor: 1.1 }, 4, 400],
    ['tablet 700x900 (one column of big chips)', '?n=12', { width: 700, height: 900 }, 2, 400],
    ['Pixel-class phone 412x915 at 2.625x (small chips)', '?n=12', { width: 412, height: 915, deviceScaleFactor: 2.625 }, 2, 200],
    ['window too short for the board', '?n=12', { width: 1280, height: 500 }, 0, 0],
    // The tile size dropdown (1, 2, 4, 8, 16 px); 4 px is the default and is covered above.
    ...[1, 2, 8, 16].map((tile) => [`${tile} px tiles`, `?n=12&tile=${tile}`, { width: 1280, height: 720 }, 4, 400]),
  ];
  for (const [label, query, options, chips, chipWidth] of screens) {
    group(`layout: ${label}`, `${HARNESS}${query}`, async (page, t) => {
      const s = await boardState(page);
      t(chips === 0 ? 'falls back to the plain page' : `shows ${chips} chips`, chips === 0 ? !s.fits : s.fits && s.chips === chips, `${s.chips} chips`);
      if (chips === 0) return;
      const width = await page.evaluate(() => document.querySelector('.chip:not([hidden])').getBoundingClientRect().width);
      t(`a chip is about ${chipWidth} CSS px wide`, Math.abs(width - chipWidth) <= 0.08 * chipWidth, `${width} px`);
      const clipped = await page.evaluate(() => [...document.querySelectorAll('.chip:not([hidden])')].filter((c) => {
        const box = c.getBoundingClientRect();
        const tags = c.querySelector('.chip-tags');
        const tagBox = tags.getBoundingClientRect();
        return tags.scrollHeight > tags.clientHeight + 1 || tagBox.bottom > box.bottom - 1 || tagBox.height < 5;
      }).length);
      t('every chip shows its tags in full', clipped === 0, `${clipped} chips clip them`);
      t('each chip is a collider with exactly its cell box, and none overlap', s.exact && s.overlaps === 0, `${s.overlaps} overlaps`);
      t('a tile ring fits exactly around every chip', s.ringed);
      t('the chips and the gallery stay inside the window', s.inWindow);
    }, options);
  }

  // Project window: custom focus handling and history, easy to break.
  group('window and history', HARNESS, async (page, t) => {
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

  group('window deep link', `${HARNESS}#/idotdot`, async (page, t) => {
    t('a URL with a project hash opens its detail view', await page.isVisible('.project-window.is-detail'));
    await page.keyboard.press('Escape');
    await page.waitForTimeout(150);
    t('closing it clears the hash', (await page.evaluate(() => location.hash)) === '');
  });

  // Browsing: the gallery's tag words, search and pager decide which projects the chips show, and
  // re-stamp the rings through the engine.
  group('browsing: tags', HARNESS, async (page, t) => {
    const before = await boardState(page);
    await page.click('.tag-word:has-text("Placeholder")');
    const filtered = await boardState(page);
    t('a tag narrows the chips to its projects and lights their rings',
      filtered.chips > 0 && filtered.chips < before.chips && filtered.torches === 3 * filtered.chips, `${before.chips} to ${filtered.chips} chips, ${filtered.torches} torches`);
    await page.click('.tag-clear');
    const cleared = await boardState(page);
    t('clearing brings every project back and puts the lit rings out', cleared.chips === before.chips && cleared.torches === 0);
  });

  group('browsing: tag from the URL', `${HARNESS}?tag=Placeholder`, async (page, t) => {
    const s = await boardState(page);
    t('a tag in the URL is selected and its chips are lit', (await page.getAttribute('.tag-word:has-text("Placeholder")', 'aria-pressed')) === 'true' && s.chips === 2 && s.torches === 6, `${s.chips} chips`);
  });

  group('browsing: search', HARNESS, async (page, t) => {
    await page.fill('.gallery-search', 'wood');
    const hit = await boardState(page);
    await page.fill('.gallery-search', 'zzzz');
    const miss = await boardState(page);
    t('search shows only matching projects, and says so when nothing matches',
      hit.chips === 1 && hit.ids[0] === 'placeholder-b' && miss.chips === 0 && (await page.isVisible('.gallery-empty')), `${hit.chips} then ${miss.chips} chips`);
  });

  group('browsing: pages', `${HARNESS}?n=12`, async (page, t) => {
    const first = await boardState(page);
    await page.click('.gallery-step[aria-label="Next page"]');
    const second = await boardState(page);
    t('Next shows the following projects and keeps rings and colliders exact',
      first.chips === 4 && second.chips === 4 && second.ids.every((id) => !first.ids.includes(id)) && second.exact && second.ringed && (await page.evaluate(() => location.search)).includes('page=2'),
      `page 2 ids: ${second.ids.join(', ')}`);
  });

  // Fallbacks for devices without WebGPU (the real app, which returns before touching the GPU).
  group('plain page', `${ORIGIN}/?view=plain`, async (page, t) => {
    const articles = await page.evaluate(() => document.querySelectorAll('#plain-view article').length);
    t('the plain page lists every project', articles >= 3, `${articles} articles`);
  });

  group('no WebGPU', `${ORIGIN}/`, async (page, t) => {
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
