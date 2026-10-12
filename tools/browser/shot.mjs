// Screenshot a page.   node tools/browser/shot.mjs [url] [out.png] [--width 1280] [--height 720] [--wait 1500] [--eval "js"] [--hide-canvas]
// `--wait` is the delay after load before the shot; `--eval` runs a snippet in the page first.
// In this sandbox the WebGPU canvas comes out blank white in screenshots even while the sim runs, so
// use this for the DOM (overlay, windows, header) and `--hide-canvas` to show the page background
// in its place; use readgrid.mjs (with --png) to look at the world itself. The first sim frame also
// takes about 7 s here (software shader compile), so use a long `--wait` if you need steps.
import { ensureDevServer, FAST_COMPOSITING_CSS, parseArgs, reportLog, withPage } from './launch.mjs';

const { positional, named } = parseArgs(process.argv.slice(2), { width: 1280, height: 720, wait: 1500 });
const url = positional[0] ?? 'http://localhost:5173/';
const out = positional[1] ?? 'shot.png';
const target = new URL(url);
const stop = target.hostname === 'localhost' ? await ensureDevServer(target.origin) : () => {};
try {
  await withPage(
    url,
    async (page, log) => {
      await page.waitForTimeout(named.wait);
      if (typeof named.eval === 'string') console.log('eval:', JSON.stringify(await page.evaluate(named.eval)));
      await page.screenshot({ path: out });
      console.log(`saved ${out} at ${log.elapsedMs()} ms`);
      reportLog(log);
    },
    {
      width: named.width,
      height: named.height,
      css: named['hide-canvas'] ? `${FAST_COMPOSITING_CSS} #sandbox { visibility: hidden !important; }` : undefined,
    },
  );
} finally {
  stop();
}
