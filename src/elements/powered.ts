import type { Reaction } from '../engine/element';
import { SETTINGS } from '../settings';

/** What switches a powered emitter on: a live conductor or shocked water touching it. */
const POWER_SOURCES = [
  SETTINGS.LIVE_STEEL_TYPE,
  SETTINGS.LIVE_COPPER_TYPE,
  SETTINGS.LIVE_FUSE_TYPE,
  SETTINGS.SHOCKED_WATER_TYPE,
] as const;

/** Chance per step that a powered emitter touching a power source switches on or refreshes its timer. */
export const POWER_CHANCE = 0.2;

/** Age steps per sim step of a lit stage (1 = about 256 steps, 4 s of light after the last pulse). */
export const POWER_HOLD_AGE_RATE = 1;

/**
 * One reaction per power source turning the tile into `becomes`. A lit stage points at its
 * twin: a reaction into the same type does nothing, so the two stages swap during a pulse
 * and every swap restarts the age, which keeps the emitter lit while pulses keep coming.
 */
export function poweredBy(becomes: number): Reaction[] {
  return POWER_SOURCES.map((source) => ({ with: source, becomes, chance: POWER_CHANCE }));
}
