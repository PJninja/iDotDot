// Reading the simulation grid from a page, shared by readgrid.mjs and session.mjs.

/**
 * Stop the sim after `steps` more steps (0 = right away) so a readback does not queue behind
 * frames the software GPU has not finished. A stopped sim is only restarted when `restart` is
 * true (a warm session, where it was stopped by an earlier read); on a fresh page the sim starts
 * itself once the app has loaded the world.
 */
export async function settleSim(page, { steps = 0, restart = false, timeout = 30000 } = {}) {
  await page.waitForFunction(
    ({ steps, restart }) => {
      const world = window.__world;
      if (!world || !(world.width > 0)) return false;
      if (!world.running) {
        if (!restart) return false;
        world.start();
      }
      window.__readTarget ??= world.stepCount + steps;
      if (world.stepCount < window.__readTarget) return false;
      world.stop();
      delete window.__readTarget;
      return true;
    },
    { steps, restart },
    { polling: 10, timeout },
  );
}

/**
 * Read the grid back (the sim should be stopped, see settleSim) and summarize it: size, tile
 * count and tiles per element name. With `scale`, also draw it with the registry colors and
 * return the image as base64 PNG (`png`).
 */
export function readGridSummary(page, { scale = 0 } = {}) {
  return page.evaluate(async (imageScale) => {
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
    if (!imageScale) return { summary };
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
  }, scale);
}
