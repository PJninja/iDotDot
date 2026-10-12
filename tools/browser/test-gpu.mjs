// The few things only a real GPU run can show, and that differ by device or break easily:
// the app boots and the sim steps, the board's tiles reach the GPU grid after the default world
// loads (the order that rebuildWorld depends on), and painting changes the world.
//   npm run test:gpu
// Needs software WebGPU (see smoke.mjs); one fresh page, so about 15 s. Exits 1 on any failure.
import { readGridSummary, settleSim } from './grid.mjs';
import { ensureDevServer, HIDE_UI_CSS, withPage } from './launch.mjs';

const ORIGIN = 'http://localhost:5173';
const results = [];
const check = (name, pass, detail = '') => {
  results.push(pass);
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ` (${detail})` : ''}`);
};

const stop = await ensureDevServer(ORIGIN);
try {
  await withPage(`${ORIGIN}/?world=farmstead`, async (page, log) => {
    await settleSim(page);
    const loaded = (await readGridSummary(page)).summary;
    check('the app boots to a world with tiles in it', loaded.tiles > 1000, `${loaded.tiles} tiles`);

    // Each chip's ring must be in the real grid: tiles just outside its box, none on its edge cells.
    const rings = await page.evaluate(async () => {
      const world = window.__world;
      const grid = await world.readGrid();
      const at = (x, y) => (x < 0 || y < 0 || x >= world.width || y >= world.height ? 0 : grid[y * world.width + x] & 0xff);
      const eps = 0.05 / world.tileSize;
      return [...document.querySelectorAll('.chip:not([hidden])')].map((chip) => {
        const r = chip.getBoundingClientRect();
        const x = Math.floor(r.left / world.tileSize + eps);
        const y = Math.floor((r.top - 48 - world.originY) / world.tileSize + eps);
        const w = Math.ceil(r.right / world.tileSize - eps) - x;
        const h = Math.ceil((r.bottom - 48 - world.originY) / world.tileSize - eps) - y;
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
} catch (error) {
  check('ran to completion', false, String(error).slice(0, 200));
} finally {
  stop();
}
console.log(`\n${results.filter(Boolean).length} passed, ${results.filter((r) => !r).length} failed`);
process.exit(results.every(Boolean) ? 0 : 1);
