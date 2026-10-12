// Screenshot a page.   node tools/browser/shot.mjs [url] [out.png]   (with --session: shot.mjs --session [out.png]) [--width 1280] [--height 720] [--wait 1500] [--eval "js"] [--hide-canvas] [--session]
// `--wait` is the delay after load before the shot; `--eval` runs a snippet in the page first.
// In this sandbox the WebGPU canvas comes out blank white in screenshots even while the sim runs, so
// use this for the DOM (overlay, windows, header) and `--hide-canvas` to show the page background
// in its place; use readgrid.mjs (with --png) to look at the world itself. The first sim frame also
// takes about 7 s here (software shader compile), so use a long `--wait` if you need steps.
// `--session` shoots the warm browser from session.mjs instead of loading the url (no compile, no wait).
import { ensureDevServer, FAST_COMPOSITING_CSS, parseArgs, reportLog, withPage, withSession } from './launch.mjs';

const { positional, named } = parseArgs(process.argv.slice(2), { width: 1280, height: 720, wait: 1500 });
// With --session there is no url (the warm page is shot), so the first positional is the output.
const [url, out] = named.session === true ? ['', positional[0] ?? 'shot.png'] : [positional[0] ?? 'http://localhost:5173/', positional[1] ?? 'shot.png'];
const HIDE_CANVAS = '#sandbox { visibility: hidden !important; }';

async function shoot(page, log) {
  if (named.session !== true) await page.waitForTimeout(named.wait);
  if (typeof named.eval === 'string') console.log('eval:', JSON.stringify(await page.evaluate(named.eval)));
  const hide = named.session === true && named['hide-canvas'] ? await page.addStyleTag({ content: HIDE_CANVAS }) : null;
  await page.screenshot({ path: out });
  await hide?.evaluate((node) => node.remove());
  console.log(`saved ${out} at ${log.elapsedMs()} ms`);
  return reportLog(log);
}

let failed = false;
if (named.session === true) {
  failed = await withSession(shoot);
} else {
  const target = new URL(url);
  const stop = target.hostname === 'localhost' ? await ensureDevServer(target.origin) : () => {};
  try {
    failed = await withPage(url, shoot, {
      width: named.width,
      height: named.height,
      css: named['hide-canvas'] ? `${FAST_COMPOSITING_CSS} ${HIDE_CANVAS}` : undefined,
    });
  } finally {
    stop();
  }
}
process.exit(failed ? 1 : 0);
