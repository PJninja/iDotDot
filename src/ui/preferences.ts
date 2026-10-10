import { SETTINGS } from '../settings';
import { BRUSH_MAX_DENSITY, BRUSH_MAX_RADIUS, BRUSH_MIN_DENSITY, BRUSH_MIN_RADIUS, type BrushShape } from './brush-picker';

/** Tile edges (CSS px) offered by the perf HUD's Tile Size dropdown. */
export const TILE_SIZES = [1, 2, 4, 8, 16];

/** User settings remembered across page loads. */
export interface Preferences {
  tileSize: number;
  brushShape: BrushShape;
  brushRadius: number;
  brushDensity: number;
}

const STORAGE_KEY = 'idotdot.preferences';

const DEFAULTS: Preferences = {
  tileSize: SETTINGS.TILE_SIZE,
  brushShape: 'circle',
  brushRadius: 4,
  brushDensity: 1,
};

const isNumberIn = (value: unknown, min: number, max: number): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;

/** Stored preferences with any missing or invalid field replaced by its default. */
export function loadPreferences(): Preferences {
  const prefs = { ...DEFAULTS };
  try {
    const stored: unknown = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? 'null');
    if (typeof stored !== 'object' || stored === null) return prefs;
    const s = stored as Record<string, unknown>;
    if (typeof s.tileSize === 'number' && TILE_SIZES.includes(s.tileSize)) prefs.tileSize = s.tileSize;
    if (s.brushShape === 'circle' || s.brushShape === 'square') prefs.brushShape = s.brushShape;
    if (isNumberIn(s.brushRadius, BRUSH_MIN_RADIUS, BRUSH_MAX_RADIUS)) prefs.brushRadius = Math.round(s.brushRadius);
    if (isNumberIn(s.brushDensity, BRUSH_MIN_DENSITY, BRUSH_MAX_DENSITY)) prefs.brushDensity = s.brushDensity;
  } catch {
    // Storage blocked or the entry is corrupt: use the defaults.
  }
  return prefs;
}

/** Merge `changes` into the stored preferences; silently does nothing if storage is unavailable. */
export function savePreferences(changes: Partial<Preferences>): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...loadPreferences(), ...changes }));
  } catch {
    // Storage blocked or full: the setting just won't persist.
  }
}
