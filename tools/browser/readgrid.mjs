// Read the simulation grid back and summarize it, optionally as an image.
//   node tools/browser/readgrid.mjs [url] [--steps 0] [--png out.png] [--scale 2] [--hide-ui false]
// Prints the grid size and a count of tiles per element name, which is how to check what the sim
// actually holds (stamped rings, a loaded world, painted tiles). `--png` draws the grid with the
// element colors into an image: page.screenshot shows the WebGPU canvas as blank white in this
// sandbox, so this is the way to look at the world. Colors come from the element registry, so
// smoke, steam and water haze are drawn as plain tiles.
// Needs window.__world (set in main.ts). `--steps N` stops the sim after N steps (default 0: as soon
// as it starts) before reading, because the page submits frames far faster than the software GPU
// finishes them and the readback waits for everything queued. `--hide-ui` (on by default) hides the
// header and overlay, which also speeds the first frame up.
import { writeFileSync } from 'node:fs';
import { ensureDevServer, HIDE_UI_CSS, parseArgs, reportLog, withPage } from './launch.mjs';

const { positional, named } = parseArgs(process.argv.slice(2));
const url = positional[0] ?? 'http://localhost:5173/?world=farmstead';
const hideUi = named['hide-ui'] !== 'false';
const scale = Number(named.scale ?? 2);
const target = new URL(url);
const stop = target.hostname === 'localhost' ? await ensureDevServer(target.origin) : () => {};
let failed = false;
try {
  await withPage(
    url,
    async (page, log) => {
      await page.waitForFunction(
        (steps) => {
          const world = window.__world;
          if (!world?.running || world.stepCount < steps) return false;
          world.stop();
          return true;
        },
        named.steps ?? 0,
        { polling: 10, timeout: 20000 },
      );
      const result = await page.evaluate(
        async ({ wantImage, imageScale }) => {
          const world = window.__world;
          const grid = await world.readGrid();
          const byType = {};
          let tiles = 0;
          for (const word of grid) {
            const type = word & 0xff;
            if (type === 0) continue;
            tiles++;
            const name = world.registry.get(type)?.name ?? `type ${type}`;
            byType[name] = (byType[name] ?? 0) + 1;
          }
          const summary = { width: world.width, height: world.height, tileSize: world.tileSize, tiles, byType };
          if (!wantImage) return { summary };
          const canvas = document.createElement('canvas');
          canvas.width = world.width * imageScale;
          canvas.height = world.height * imageScale;
          const ctx = canvas.getContext('2d');
          ctx.fillStyle = '#1a1a2e';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          for (let i = 0; i < grid.length; i++) {
            const word = grid[i];
            const element = world.registry.get(word & 0xff);
            if (!element || (word & 0xff) === 0) continue;
            const row = element.ageRate > 0 ? word >>> 24 : (word >>> 16) & 0xff;
            const [r, g, b] = element.getColor((word >>> 8) & 0xff, row);
            ctx.fillStyle = `rgb(${r},${g},${b})`;
            ctx.fillRect((i % world.width) * imageScale, Math.floor(i / world.width) * imageScale, imageScale, imageScale);
          }
          return { summary, png: canvas.toDataURL('image/png').split(',')[1] };
        },
        { wantImage: typeof named.png === 'string', imageScale: scale },
      );
      console.log(JSON.stringify(result.summary, null, 2));
      if (result.png) {
        writeFileSync(named.png, Buffer.from(result.png, 'base64'));
        console.log(`saved ${named.png}`);
      }
      console.log(`read at ${log.elapsedMs()} ms`);
      failed = reportLog(log);
    },
    { css: hideUi ? HIDE_UI_CSS : undefined },
  );
} finally {
  stop();
}
process.exit(failed ? 1 : 0);
