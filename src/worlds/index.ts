import { decodeWorld, type WorldSnapshot } from '../engine/world-file';

const worldUrls = import.meta.glob<string>('./*.idw', { query: '?url', import: 'default', eager: true });

const baseName = (path: string): string => path.slice(path.lastIndexOf('/') + 1).replace(/\.idw$/, '');

/** The world every visit opens on unless `?world=` names another. */
const PRIMARY_WORLD = 'meadow';

const presets = Object.keys(worldUrls)
  .sort()
  .map((path) => ({ name: baseName(path), url: worldUrls[path] }));
const loaded = new Map<number, Promise<WorldSnapshot | null>>();
let current = -1;

function firstPick(): number {
  const requested = new URLSearchParams(window.location.search).get('world');
  if (requested !== null) {
    const match = presets.findIndex((p) => p.name === requested);
    if (match >= 0) return match;
    console.warn(`[world] no default world "${requested}"; available: ${presets.map((p) => p.name).join(', ')}`);
  }
  const primary = presets.findIndex((p) => p.name === PRIMARY_WORLD);
  return primary >= 0 ? primary : Math.floor(Math.random() * presets.length);
}

async function load(index: number): Promise<WorldSnapshot | null> {
  const preset = presets[index];
  try {
    const response = await fetch(preset.url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await decodeWorld(await response.arrayBuffer());
  } catch (err) {
    console.warn(`[world] could not load "${preset.name}":`, err);
    return null;
  }
}

function preset(index: number): Promise<WorldSnapshot | null> {
  if (presets.length === 0) return Promise.resolve(null);
  current = index;
  let world = loaded.get(index);
  if (world === undefined) {
    world = load(index);
    loaded.set(index, world);
  }
  return world;
}

/**
 * The default world for this page visit (null = start empty). The choice is made once,
 * so resizes and tile size changes reload the same world: `?world=<name>` picks
 * src/worlds/<name>.idw, otherwise the primary world (meadow). If that world fails to
 * load, a random other one is tried.
 */
export async function pickDefaultWorld(): Promise<WorldSnapshot | null> {
  if (current >= 0) return preset(current);
  const first = firstPick();
  const world = await preset(first);
  if (world !== null || presets.length < 2) return world;
  return preset((first + 1 + Math.floor(Math.random() * (presets.length - 1))) % presets.length);
}

/** The bundled world after the current one (in file name order, wrapping), which becomes the current one. */
export function nextDefaultWorld(): Promise<WorldSnapshot | null> {
  return preset((current + 1) % Math.max(presets.length, 1));
}
