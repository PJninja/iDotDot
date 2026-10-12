// The few things only a real GPU run can show, and that differ by device or break easily:
// the app boots and the sim steps, the board's tiles reach the GPU grid after the default world
// loads (the order that rebuildWorld depends on), painting changes the world, and at fractional
// pixel ratios the canvas and the chips sit on whole device pixels.
//   npm run test:gpu
// Needs software WebGPU (see smoke.mjs); about 10 s. Exits 1 on any failure.
import { readGridSummary, settleSim } from './grid.mjs';
import { ensureDevServer, HIDE_UI_CSS, withPage } from './launch.mjs';

const ORIGIN = 'http://localhost:5173';
const results = [];
const check = (name, pass, detail = '') => {
  results.push(pass);
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ` (${detail})` : ''}`);
};

/** The boot, ring and painting checks, on one fresh page at 1x. */
async function simChecks() {
  await withPage(`${ORIGIN}/?world=farmstead`, async (page, log) => {
    await settleSim(page);
    const loaded = (await readGridSummary(page)).summary;
    check('the app boots to a world with tiles in it', loaded.tiles > 1000, `${loaded.tiles} tiles`);

    // Each chip's ring must be in the real grid: a tile just outside its box on every side.
    const rings = await page.evaluate(async () => {
      const world = window.__world;
      const grid = await world.readGrid();
      const at = (x, y) => (x < 0 || y < 0 || x >= world.width || y >= world.height ? 0 : grid[y * world.width + x] & 0xff);
      const canvasTop = document.getElementById('sandbox').getBoundingClientRect().top;
      return [...document.querySelectorAll('.chip:not([hidden])')].map((chip) => {
        const r = chip.getBoundingClientRect();
        const x = Math.round(r.left / world.tileSize);
        const y = Math.round((r.top - canvasTop - world.originY) / world.tileSize);
        const w = Math.round(r.width / world.tileSize);
        const h = Math.round(r.height / world.tileSize);
        const mx = x + (w >> 1), my = y + (h >> 1);
        return { id: chip.dataset.id, ringed: [at(x - 1, my), at(x + w, my), at(mx, y - 1), at(mx, y + h)].every((t) => t !== 0) };
      });
    });
    const missing = rings.filter((r) => !r.ringed).map((r) => r.id);
    check('every chip has its tile ring in the GPU grid', rings.length > 0 && missing.length === 0, missing.length ? `missing: ${missing.join(', ')}` : `${rings.length} chips`);

    // Painting: find an empty 9x9 patch anywhere, paint sand into it, run two steps, and count the sand.
    const painted = await page.evaluate(async () => {
      const world = window.__world;
      const grid = await world.readGrid();
      const sand = () => grid.reduce((n, w) => n + ((w & 0xff) === 1 ? 1 : 0), 0);
      for (let y = 4; y < world.height - 14; y += 5) {
        for (let x = 4; x < world.width - 14; x += 5) {
          let clear = true;
          for (let dy = 0; dy < 9 && clear; dy++) for (let dx = 0; dx < 9; dx++) if (grid[(y + dy) * world.width + x + dx] !== 0) clear = false;
          if (!clear) continue;
          world.paintStroke(x + 4, y + 4, x + 4, y + 4, { shape: 'circle', radius: 4, density: 1, type: 1 });
          return { before: sand() };
        }
      }
      return null;
    });
    if (painted === null) {
      check('painting adds tiles to the world', false, 'no empty 9x9 patch found');
    } else {
      await settleSim(page, { steps: 2, restart: true });
      const after = (await readGridSummary(page)).summary.byType.sand ?? 0;
      check('painting adds tiles to the world', after >= painted.before + 20, `sand ${painted.before} to ${after}`);
    }

    check('no errors, no lost device', log.errors.every((e) => /Failed to load resource.*404/.test(e)) && log.pageErrors.length === 0 && !log.deviceLost,
      [...log.pageErrors, log.deviceLost ? 'device lost' : ''].filter(Boolean).join(' | '));
  }, { css: HIDE_UI_CSS });
}

/**
 * At pixel ratios that give a fractional tile size (browser zoom 110%, a Pixel-class phone at
 * 2.625x), the real canvas must cover exactly its backing pixels, start on a device pixel, and
 * every chip must sit on a whole number of tiles. Needs only the DOM, so it is quick.
 */
async function pixelChecks() {
  for (const [dpr, width, height, label] of [[1.1, 1280, 720, 'browser zoom 110%'], [2.625, 412, 915, 'Pixel-class phone 2.625x']]) {
    await withPage(`${ORIGIN}/?world=farmstead`, async (page) => {
      // Chips exist as soon as the board is built; they are placed (style.width set) by the first rebuild.
      await page.waitForFunction(() => window.__world?.width > 0 && document.querySelector('.chip')?.style.width, null, { timeout: 20000 });
      const r = await page.evaluate(() => {
        const d = devicePixelRatio;
        const canvas = document.getElementById('sandbox');
        const box = canvas.getBoundingClientRect();
        const tilePx = Math.round(window.__world.tileSize * d);
        const off = (v) => Math.abs(v - Math.round(v));
        const chips = [...document.querySelectorAll('.chip:not([hidden])')].map((chip) => {
          const b = chip.getBoundingClientRect();
          return Math.max(off(((b.left - box.left) * d) / tilePx), off(((b.top - box.top) * d - (canvas.height - window.__world.height * tilePx)) / tilePx), off((b.width * d) / tilePx), off((b.height * d) / tilePx));
        });
        return {
          stretchW: Math.abs(box.width * d - canvas.width), stretchH: Math.abs(box.height * d - canvas.height),
          topOffEdge: off(box.top * d), chipOffTiles: Math.max(0, ...chips), tilePx,
        };
      });
      const tol = 0.05;
      check(`${label}: the canvas covers exactly its backing pixels`, r.stretchW < tol && r.stretchH < tol, `off by ${r.stretchW.toFixed(3)} x ${r.stretchH.toFixed(3)} px`);
      check(`${label}: the canvas starts on a device pixel`, r.topOffEdge < tol, `${r.topOffEdge.toFixed(3)} px off`);
      check(`${label}: every chip sits on whole tiles`, r.chipOffTiles * r.tilePx < tol * 2, `worst ${(r.chipOffTiles * r.tilePx).toFixed(3)} device px off`);
    }, { css: HIDE_UI_CSS, deviceScaleFactor: dpr, width, height });
  }
}

const stop = await ensureDevServer(ORIGIN);
try {
  await Promise.all([simChecks(), pixelChecks()]);
} catch (error) {
  check('ran to completion', false, String(error).slice(0, 200));
} finally {
  stop();
}
console.log(`\n${results.filter(Boolean).length} passed, ${results.filter((r) => !r).length} failed`);
process.exit(results.every(Boolean) ? 0 : 1);
