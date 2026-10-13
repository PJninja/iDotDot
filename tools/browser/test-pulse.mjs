// Electric pulse regression: a pulse must cross a steel wire and a copper wire once and leave each as it
// was. If a spent stage were shorter than its live stage the pulse would bounce for ever and the sim would
// never go idle, which no other check would notice. Copper must also throw no arcs. The grid is cleared
// first so only the two wires are awake; they run side by side, out of arc range of each other.
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
      const STEEL = 17, LIVE = 28, SPENT = 29, ARC = 30, COPPER = 37, LIVE_COPPER = 38, SPENT_COPPER = 39;
      const X0 = 30, Y = 20, Y_COPPER = 26, LENGTH = 31;
      world.stampCells(0, 0, world.width, world.height, new Uint32Array(world.width * world.height));
      world.stampCells(X0, Y, LENGTH, 1, new Uint32Array(LENGTH).fill(STEEL));
      world.stampCells(X0, Y, 1, 1, new Uint32Array([LIVE]));
      world.stampCells(X0, Y_COPPER, LENGTH, 1, new Uint32Array(LENGTH).fill(COPPER));
      world.stampCells(X0, Y_COPPER, 1, 1, new Uint32Array([LIVE_COPPER]));
      let furthest = 0, furthestCopper = 0, copperArcs = 0;
      for (let chunk = 0; chunk < 32 && !(chunk > 0 && world.perf.idle); chunk++) {
        world.start();
        const target = world.stepCount + 20;
        while (world.stepCount < target && !world.perf.idle) await new Promise((r) => setTimeout(r, 4));
        world.stop();
        const grid = await world.readGrid();
        for (let x = 0; x < LENGTH; x++) {
          const type = grid[Y * world.width + X0 + x] & 0xff;
          if (type === LIVE || type === SPENT) furthest = Math.max(furthest, x);
          const copperType = grid[Y_COPPER * world.width + X0 + x] & 0xff;
          if (copperType === LIVE_COPPER || copperType === SPENT_COPPER) furthestCopper = Math.max(furthestCopper, x);
        }
        for (let row = Y_COPPER - 2; row <= Y_COPPER + 2; row++) {
          for (let x = X0 - 2; x < X0 + LENGTH + 2; x++) if ((grid[row * world.width + x] & 0xff) === ARC) copperArcs++;
        }
      }
      const grid = await world.readGrid();
      let steel = 0, charged = 0, copper = 0, copperCharged = 0;
      for (let x = 0; x < LENGTH; x++) {
        const type = grid[Y * world.width + X0 + x] & 0xff;
        if (type === STEEL) steel++;
        else if (type === LIVE || type === SPENT) charged++;
        const copperType = grid[Y_COPPER * world.width + X0 + x] & 0xff;
        if (copperType === COPPER) copper++;
        else if (copperType === LIVE_COPPER || copperType === SPENT_COPPER) copperCharged++;
      }
      return { furthest, furthestCopper, copperArcs, steel, charged, copper, copperCharged, idle: world.perf.idle, steps: world.stepCount };
    });
    check('a pulse crosses a steel wire end to end', result.furthest >= 30, `reached cell ${result.furthest} of 30`);
    check('the wire is all steel again and the sim idles', result.steel === 31 && result.charged === 0 && result.idle,
      `${result.steel} steel, ${result.charged} charged, idle ${result.idle}, ${result.steps} steps`);
    check('a pulse crosses a copper wire end to end', result.furthestCopper >= 30, `reached cell ${result.furthestCopper} of 30`);
    check('the copper wire is all copper again and threw no arcs', result.copper === 31 && result.copperCharged === 0 && result.copperArcs === 0,
      `${result.copper} copper, ${result.copperCharged} charged, ${result.copperArcs} arcs`);
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
