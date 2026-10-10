import { decodeWorld, type WorldSnapshot } from '../engine/world-file';

const worldUrls = import.meta.glob<string>('./*.idw', { query: '?url', import: 'default', eager: true });

const baseName = (path: string): string => path.slice(path.lastIndexOf('/') + 1).replace(/\.idw$/, '');

let chosen: Promise<WorldSnapshot | null> | null = null;

async function load(): Promise<WorldSnapshot | null> {
  const names = Object.keys(worldUrls).map((path) => ({ name: baseName(path), url: worldUrls[path] }));
  if (names.length === 0) return null;
  const requested = new URLSearchParams(window.location.search).get('world');
  let pick = names[Math.floor(Math.random() * names.length)];
  if (requested !== null) {
    const match = names.find((n) => n.name === requested);
    if (match) pick = match;
    else console.warn(`[world] no default world "${requested}"; available: ${names.map((n) => n.name).join(', ')}`);
  }
  try {
    const response = await fetch(pick.url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await decodeWorld(await response.arrayBuffer());
  } catch (err) {
    console.warn(`[world] could not load "${pick.name}":`, err);
    return null;
  }
}

/**
 * The default world for this page visit (null = start empty). The choice is made once,
 * so resizes and tile size changes reload the same world: `?world=<name>` picks
 * src/worlds/<name>.idw, otherwise a random bundled world.
 */
export function pickDefaultWorld(): Promise<WorldSnapshot | null> {
  chosen ??= load();
  return chosen;
}
