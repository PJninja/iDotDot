// UI tests that need no GPU: the portfolio board, window, tag filter, routing and modes run in a
// harness page against a fake world (tools/browser/harness), and the plain page loads from the app.
//   npm run test:ui          (or: node tools/browser/test-ui.mjs [name filter])
// Takes a few seconds: there is no shader compile. Exits 1 if any check fails.
import { ensureDevServer, withPage } from './launch.mjs';

const ORIGIN = 'http://localhost:5173';
const HARNESS = `${ORIGIN}/tools/browser/harness/harness.html`;
const filter = process.argv[2];
const results = [];
const check = (group, name, pass, detail = '') => {
  results.push({ group, name, pass });
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${group}: ${name}${detail ? ` (${detail})` : ''}`);
};
const wanted = (group) => !filter || group.includes(filter);

/** Run `body(page, log)` on the harness (or any url) without WebGPU; page errors fail the group. */
async function group(name, url, body, options = {}) {
  if (!wanted(name)) return;
  try {
    await withPage(url, async (page, log) => {
      await page.waitForTimeout(options.settleMs ?? 400);
      await body(page, (n, pass, detail) => check(name, n, pass, detail));
      check(name, 'no page errors', log.pageErrors.length === 0, log.pageErrors.join(' | ').slice(0, 200));
    }, { gpu: false, ...options });
  } catch (error) {
    check(name, 'ran to completion', false, String(error).slice(0, 200));
  }
}

/** Layout summary for the board: fit, collider overlap, and a tile ring on every chip's outside edge. */
const boardSummary = () =>
  page => page.evaluate(() => {
    const h = window.__h;
    const world = { w: h.stamped.reduce((m, s) => Math.max(m, s.x + s.w), 0) };
    const occupied = new Map();
    for (const s of h.stamped) for (let j = 0; j < s.h; j++) for (let i = 0; i < s.w; i++) {
      if (s.words[j * s.w + i] !== 0) occupied.set(`${s.x + i},${s.y + j}`, true);
    }
    const rects = [];
    h.colliders.forEachRect((r) => rects.push({ ...r }));
    const chipCount = document.querySelectorAll('.chip:not([hidden])').length;
    const chipRects = rects.slice(0, chipCount);
    let overlaps = 0;
    for (let a = 0; a < rects.length; a++) for (let b = a + 1; b < rects.length; b++) {
      const p = rects[a], q = rects[b];
      if (p.x < q.x + q.w && q.x < p.x + p.w && p.y < q.y + q.h && q.y < p.y + p.h) overlaps++;
    }
    const ringed = chipRects.every((r) => occupied.has(`${r.x - 1},${r.y + (r.h >> 1)}`) && occupied.has(`${r.x + r.w},${r.y + (r.h >> 1)}`)
      && occupied.has(`${r.x + (r.w >> 1)},${r.y - 1}`) && occupied.has(`${r.x + (r.w >> 1)},${r.y + r.h}`));
    return { fits: h.fits, chipCount, colliders: rects.length, overlaps, ringed, lettering: world.w > 0 };
  });

const stop = await ensureDevServer(ORIGIN);
try {
  // --- layout: which sizes fit, and ring/collider alignment --------------------------------------
  const layouts = [
    ['1280x720 with 20 projects', '?n=20', 1280, 720, true],
    ['1366x768 with 20 projects', '?n=20', 1366, 768, true],
    ['1920x1080 with 20 projects', '?n=20', 1920, 1080, true],
    ['390x844 with 3 projects', '?n=3', 390, 844, true],
    ['390x844 with 10 projects', '?n=10', 390, 844, false],
    ['1280x720 at 2 px tiles', '?n=12&tile=2', 1280, 720, true],
  ];
  for (const [label, query, width, height, fits] of layouts) {
    await group(`layout ${label}`, `${HARNESS}${query}`, async (page, t) => {
      const s = await boardSummary()(page);
      t(`fits is ${fits}`, s.fits === fits);
      if (!fits) return;
      t('every chip is a collider', s.chipCount > 0 && s.colliders >= s.chipCount);
      t('no colliders overlap', s.overlaps === 0, `${s.overlaps} overlaps`);
      t('rings sit just outside every chip', s.ringed);
      t('lettering stamped', s.lettering);
    }, { width, height });
  }

  // --- project window: preview, detail, focus, history ------------------------------------------
  await group('window', HARNESS, async (page, t) => {
    const chip = '.chip[data-id="idotdot"]';
    await page.click(chip);
    t('click opens the preview', await page.isVisible('.project-window'));
    t('scrim is shown', await page.isVisible('.project-scrim'));
    t('chip reports expanded', (await page.getAttribute(chip, 'aria-expanded')) === 'true');
    t('dialog is labelled by its title', (await page.getAttribute('.project-window', 'aria-labelledby')) === 'project-window-title');
    t('preview does not touch the URL', (await page.evaluate(() => location.hash)) === '');
    await page.keyboard.press('Escape');
    t('Escape closes', !(await page.isVisible('.project-window')));
    t('focus returns to the chip', await page.evaluate(() => document.activeElement?.getAttribute('data-id') === 'idotdot'));
    t('chip reports collapsed', (await page.getAttribute(chip, 'aria-expanded')) === 'false');

    await page.click('.chip[data-id="placeholder-a"]');
    await page.click('.win-more');
    t('detail writes the hash', (await page.evaluate(() => location.hash)) === '#/placeholder-a');
    t('detail is the expanded window', await page.evaluate(() => document.querySelector('.project-window').classList.contains('is-detail')));
    await page.goBack();
    await page.waitForTimeout(150);
    t('Back closes the detail view', !(await page.isVisible('.project-window')));
    t('Back clears the hash', (await page.evaluate(() => location.hash)) === '');

    await page.click('.chip[data-id="placeholder-b"]');
    await page.click('.win-more');
    await page.click('.win-close');
    await page.waitForTimeout(150);
    t('Close from detail closes', !(await page.isVisible('.project-window')));
    t('Close from detail clears the hash', (await page.evaluate(() => location.hash)) === '');

    await page.click(chip);
    await page.mouse.click(20, 400);
    t('clicking the scrim closes', !(await page.isVisible('.project-window')));

    await page.click(chip);
    for (let i = 0; i < 4; i++) await page.keyboard.press('Tab');
    t('Tab stays inside the window', await page.evaluate(() => document.querySelector('.project-window').contains(document.activeElement)));
    await page.keyboard.press('Escape');
  });

  await group('window deep link', `${HARNESS}#/idotdot`, async (page, t) => {
    t('a hash opens that project in detail', await page.evaluate(() => !document.querySelector('.project-scrim').hidden && document.querySelector('.project-window.is-detail') !== null));
    await page.keyboard.press('Escape');
    await page.waitForTimeout(150);
    t('closing clears the hash', (await page.evaluate(() => location.hash)) === '');
  });

  // --- tag filter -----------------------------------------------------------------------------
  await group('tag filter', HARNESS, async (page, t) => {
    const stamps = () => page.evaluate(() => window.__h.stamped.length);
    const torchesInLast = () => page.evaluate(() => window.__h.stamped.at(-1).words.filter((w) => (w & 0xff) === 27).length);
    const before = await stamps();
    await page.click('.tag-word:has-text("Wood border")');
    t('a lit ring has three torches', (await torchesInLast()) === 3);
    t('only the matching chip is restamped', (await stamps()) === before + 1);
    t('the tag is in the URL', /tag=Wood(\+|%20)border/.test(await page.evaluate(() => location.search)));
    t('the word is pressed', (await page.getAttribute('.tag-word:has-text("Wood border")', 'aria-pressed')) === 'true');
    await page.click('.tag-clear');
    t('clearing restamps the ring', (await stamps()) === before + 2);
    t('no torches remain', (await torchesInLast()) === 0);
  });

  await group('tag filter from the URL', `${HARNESS}?tag=Simulation`, async (page, t) => {
    t('the word is pre-selected', (await page.getAttribute('.tag-word:has-text("Simulation")', 'aria-pressed')) === 'true');
    const lit = await page.evaluate(() => window.__h.stamped.filter((s) => s.words.some((w) => (w & 0xff) === 27)).length);
    t('exactly one ring is stamped lit', lit === 1, `${lit} lit rings`);
  });

  // --- modes ----------------------------------------------------------------------------------
  await group('modes', HARNESS, async (page, t) => {
    t('portfolio mode hides the toolbox', !(await page.isVisible('#header .header-actions')));
    await page.click('.mode-word:has-text("Play")');
    t('play mode shows the toolbox', await page.isVisible('#header .header-actions'));
    t('the mode is on the root element', (await page.evaluate(() => document.documentElement.dataset.mode)) === 'play');
  });

  // --- plain page (loaded from the real app, which returns before touching WebGPU) --------------
  await group('plain page', `${ORIGIN}/?view=plain`, async (page, t) => {
    const facts = await page.evaluate(() => ({
      plain: document.documentElement.classList.contains('plain'),
      h1: document.querySelector('#plain-view h1')?.textContent,
      articles: document.querySelectorAll('#plain-view article').length,
      images: document.querySelectorAll('#plain-view img').length,
      scrolls: document.documentElement.scrollHeight > innerHeight,
    }));
    t('the plain class is set', facts.plain);
    t('the name is the heading', facts.h1 === 'Anthony Liparulo', facts.h1);
    t('every project is an article', facts.articles >= 3);
    t('screenshots are included', facts.images >= 3);
    t('the page scrolls', facts.scrolls);
  }, { height: 600 });

  await group('plain page without WebGPU', `${ORIGIN}/`, async (page, t) => {
    const notice = await page.evaluate(() => document.querySelector('.plain-notice')?.textContent);
    t('states the fact', notice === 'WebGPU is not available in this browser, so the simulation cannot run.', notice);
  }, { initScript: () => Object.defineProperty(navigator, 'gpu', { value: undefined }) });
} finally {
  stop();
}

const failed = results.filter((r) => !r.pass);
console.log(`\n${results.length - failed.length} passed, ${failed.length} failed`);
process.exit(failed.length > 0 ? 1 : 0);
