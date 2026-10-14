import { decodeWorld, type WorldSnapshot } from '../engine/world-file';

const worldUrls = import.meta.glob<string>('./*.idw', { query: '?url', import: 'default', eager: true });

const baseName = (path: string): string => path.slice(path.lastIndexOf('/') + 1).replace(/\.idw$/, '');

/** The world every visit opens on unless `?world=` names another. */
const PRIMARY_WORLD = 'meadow';
/** The same for phone-sized windows: worlds named `*-mobile` are cut to a phone's grid and only used there. */
const PRIMARY_MOBILE_WORLD = 'meadow-mobile';

const presets = Object.keys(worldUrls)
  .sort()
  .map((path) => {
    const name = baseName(path);
    return { name, url: worldUrls[path], mobile: name.endsWith('-mobile') };
  });
const loaded = new Map<number, Promise<WorldSnapshot | null>>();
let current = -1;

/** Indices of the presets for phone windows (`mobile`) or for every other window. */
const kindOf = (mobile: boolean): number[] => presets.flatMap((p, i) => (p.mobile === mobile ? [i] : []));

function firstPick(mobile: boolean): number {
  const pool = kindOf(mobile);
  const requested = new URLSearchParams(window.location.search).get('world');
  if (requested !== null) {
    const match = pool.find((i) => presets[i].name === requested);
    if (match !== undefined) return match;
    console.warn(`[world] no default world "${requested}" for this window; available: ${pool.map((i) => presets[i].name).join(', ')}`);
  }
  const primary = presets.findIndex((p) => p.name === (mobile ? PRIMARY_MOBILE_WORLD : PRIMARY_WORLD));
  return primary >= 0 ? primary : pool[Math.floor(Math.random() * pool.length)];
}

async function load(index: number): Promise<WorldSnapshot | null> {
  const preset = presets[index];
  try {
    const response = await fetch(preset.url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const world = await decodeWorld(await response.arrayBuffer());
    return preset.mobile ? world : { ...world, wings: true };
  } catch (err) {
    console.warn(`[world] could not load "${preset.name}":`, err);
    return null;
  }
}

function preset(index: number | undefined): Promise<WorldSnapshot | null> {
  if (index === undefined) return Promise.resolve(null);
  current = index;
  let world = loaded.get(index);
  if (world === undefined) {
    world = load(index);
    loaded.set(index, world);
  }
  return world;
}

/**
 * The default world for this page visit (null = start empty). `mobile` asks for a phone-sized
 * world (a window under the narrow layout's width), otherwise one of the big worlds. The choice
 * is made once per kind, so resizes and tile size changes reload the same world:
 * `?world=<name>` picks src/worlds/<name>.idw, otherwise the primary world (meadow, or
 * meadow-mobile). If that world fails to load, a random other one of the kind is tried.
 */
export async function pickDefaultWorld(mobile: boolean): Promise<WorldSnapshot | null> {
  const pool = kindOf(mobile);
  if (current >= 0 && presets[current].mobile === mobile) return preset(current);
  if (pool.length === 0) return null;
  const first = firstPick(mobile);
  const world = await preset(first);
  if (world !== null || pool.length < 2) return world;
  const others = pool.filter((i) => i !== first);
  return preset(others[Math.floor(Math.random() * others.length)]);
}

/** The bundled world of the same kind after the current one (in file name order, wrapping), which becomes the current one. */
export function nextDefaultWorld(mobile: boolean): Promise<WorldSnapshot | null> {
  const pool = kindOf(mobile);
  const at = pool.indexOf(current);
  return preset(pool[(at + 1) % Math.max(pool.length, 1)]);
}
