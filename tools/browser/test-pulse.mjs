// Electric pulse regression: a pulse must cross a steel wire once and leave it all steel again. If the
// spent stage were shorter than the live one the pulse would bounce for ever and the sim would never go
// idle, which no other check would notice. The grid is cleared first so only the wire is awake.
//   npm run test:pulse
// Needs software WebGPU (see smoke.mjs). About 45 s: the software GPU steps slowly even when almost
// nothing is awake, so this is separate from test:gpu. Exits 1 on any failure.
import { settleSim } from './grid.mjs';
import { ensureDevServer, HIDE_UI_CSS, withPage } from './launch.mjs';

const ORIGIN = 'http://localhost:5173';
const results = [];
const check = (name, pass, detail = '') => {
  results.push(pass);
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ` (${detail})` : ''}`);
};

async function pulseChecks() {
  await withPage(`${ORIGIN}/?world=farmstead`, async (page) => {
    await settleSim(page);
    const result = await page.evaluate(async () => {
      const world = window.__world;
      const STEEL = 17, LIVE = 28, SPENT = 29, X0 = 30, Y = 20, LENGTH = 31;
      world.stampCells(0, 0, world.width, world.height, new Uint32Array(world.width * world.height));
      world.stampCells(X0, Y, LENGTH, 1, new Uint32Array(LENGTH).fill(STEEL));
      world.stampCells(X0, Y, 1, 1, new Uint32Array([LIVE]));
      let furthest = 0;
      for (let chunk = 0; chunk < 16 && !(chunk > 0 && world.perf.idle); chunk++) {
        world.start();
        const target = world.stepCount + 40;
        while (world.stepCount < target && !world.perf.idle) await new Promise((r) => setTimeout(r, 4));
        world.stop();
        const grid = await world.readGrid();
        for (let x = 0; x < LENGTH; x++) {
          const type = grid[Y * world.width + X0 + x] & 0xff;
          if (type === LIVE || type === SPENT) furthest = Math.max(furthest, x);
        }
      }
      const grid = await world.readGrid();
      let steel = 0, charged = 0;
      for (let x = 0; x < LENGTH; x++) {
        const type = grid[Y * world.width + X0 + x] & 0xff;
        if (type === STEEL) steel++;
        else if (type === LIVE || type === SPENT) charged++;
      }
      return { furthest, steel, charged, idle: world.perf.idle, steps: world.stepCount };
    });
    check('a pulse crosses a steel wire end to end', result.furthest >= 30, `reached cell ${result.furthest} of 30`);
    check('the wire is all steel again and the sim idles', result.steel === 31 && result.charged === 0 && result.idle,
      `${result.steel} steel, ${result.charged} charged, idle ${result.idle}, ${result.steps} steps`);
  }, { css: HIDE_UI_CSS });
}

const stop = await ensureDevServer(ORIGIN);
try {
  await pulseChecks();
} catch (error) {
  check('ran to completion', false, String(error).slice(0, 200));
} finally {
  stop();
}
console.log(`\n${results.filter(Boolean).length} passed, ${results.filter((r) => !r).length} failed`);
process.exit(results.every(Boolean) ? 0 : 1);
