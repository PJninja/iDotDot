// Read the simulation grid back and summarize it, optionally as an image.
//   node tools/browser/readgrid.mjs [url] [--steps 0] [--png out.png] [--scale 2] [--session] [--resume]
// Prints the grid size and a count of tiles per element name, which is how to check what the sim
// actually holds (stamped rings, a loaded world, painted tiles). `--png` draws the grid with the
// element colors into an image: page.screenshot shows the WebGPU canvas as blank white in this
// sandbox, so this is the way to look at the world. Colors come from the element registry, so
// smoke, steam and water haze are drawn as plain tiles.
// Needs window.__world (set in main.ts). The sim is stopped as soon as it starts (`--steps N` lets
// it run N steps first) because the page submits frames far faster than the software GPU finishes
// them and the readback waits for everything queued. On a fresh page the header and overlay are
// hidden while reading (`--hide-ui false` to keep them), which also speeds the first frame up.
// `--session` reads from the warm browser started by session.mjs (no 7 s compile, and the url is
// ignored); the sim stays stopped afterwards unless `--resume` is given.
import { writeFileSync } from 'node:fs';
import { readGridSummary, settleSim } from './grid.mjs';
import { ensureDevServer, HIDE_UI_CSS, parseArgs, reportLog, withPage, withSession } from './launch.mjs';

const { positional, named } = parseArgs(process.argv.slice(2));
const url = positional[0] ?? 'http://localhost:5173/?world=farmstead';
const useSession = named.session === true;
const scale = Number(named.scale ?? 2);

async function read(page, log) {
  await settleSim(page, { steps: Number(named.steps ?? 0), restart: useSession });
  const result = await readGridSummary(page, { scale: typeof named.png === 'string' ? scale : 0 });
  if (named.resume) await page.evaluate(() => window.__world.start());
  console.log(JSON.stringify(result.summary, null, 2));
  if (result.png) {
    writeFileSync(named.png, Buffer.from(result.png, 'base64'));
    console.log(`saved ${named.png}`);
  }
  console.log(`read in ${log.elapsedMs()} ms`);
  return reportLog(log);
}

let failed = false;
if (useSession) {
  failed = await withSession((page, log) => read(page, log));
} else {
  const target = new URL(url);
  const stop = target.hostname === 'localhost' ? await ensureDevServer(target.origin) : () => {};
  try {
    failed = await withPage(url, read, { css: named['hide-ui'] === 'false' ? undefined : HIDE_UI_CSS });
  } finally {
    stop();
  }
}
process.exit(failed ? 1 : 0);
