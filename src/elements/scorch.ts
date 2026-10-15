import { buildGradient } from '../engine/colors';
import { Element } from '../engine/element';
import { SETTINGS } from '../settings';
import { Explosion } from './explosion';

/**
 * Scorch (type 52) - what a burnt-out blast tile leaves, hidden from the picker. A static
 * aging solid that blastHit and blastFill never take, so a cell the blast has left cannot
 * be refilled by the live tiles around it: without it, once the core burns out the
 * surviving shell spreads back into the empty middle and the blast hangs at one size.
 * It cools through dark red to ash grey, then turns into smoke, a flame, a spark or
 * rubble (the Explosion chances) or vanishes.
 */
export class Scorch extends Element {
  readonly type = SETTINGS.SCORCH_TYPE;
  readonly name = 'scorch';
  readonly displayName = 'Scorch';
  readonly defaultColor: [number, number, number] = [90, 40, 30];
  readonly hidden = true;

  /** Age steps per sim step (20 = about 13 steps, longer than any blast tile keeps spreading after a neighbor dies). */
  static AGE_RATE = 20;

  readonly ageRate = Scorch.AGE_RATE;
  readonly agedInto = [
    { type: SETTINGS.SMOKE_TYPE, chance: Explosion.SMOKE_CHANCE },
    { type: SETTINGS.FLAME_TYPE, chance: Explosion.FLAME_CHANCE },
    { type: SETTINGS.SPARK_TYPE, chance: Explosion.SPARK_CHANCE },
    { type: SETTINGS.RUBBLE_TYPE, chance: Explosion.RUBBLE_CHANCE },
  ].filter((outcome) => outcome.chance > 0);

  private readonly ramp = buildGradient([
    { at: 0, color: [96, 40, 26] },
    { at: 0.4, color: [58, 36, 30] },
    { at: 1, color: [30, 40, 34] },
  ]);

  getColor(_value: number, age: number): [number, number, number] {
    return this.ramp[age];
  }
}
