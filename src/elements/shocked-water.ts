import { buildGradient } from '../engine/colors';
import { Element } from '../engine/element';
import { SETTINGS } from '../settings';

/**
 * Shocked water (type 32) - water carrying an electric pulse, hidden from the picker.
 * Liquids do not age, so the pulse rides on a static solid drawn as pale tiles: it flashes
 * for a few steps, then turns into numb water. Water and steel beside it turn shocked or
 * live (their own rules name it).
 */
export class ShockedWater extends Element {
  readonly type = SETTINGS.SHOCKED_WATER_TYPE;
  readonly name = 'shocked-water';
  readonly displayName = 'Shocked Water';
  readonly defaultColor: [number, number, number] = [200, 236, 255];
  readonly hidden = true;

  /** Age steps per sim step (16 = 16 steps). */
  static AGE_RATE = 16;

  readonly ageRate = ShockedWater.AGE_RATE;
  readonly agedInto = [{ type: SETTINGS.NUMB_WATER_TYPE, chance: 1 }];
  readonly blastResistance = 0.75;

  private readonly ramp = buildGradient([
    { at: 0, color: [236, 250, 255] },
    { at: 1, color: [96, 170, 240] },
  ]);

  getColor(_value: number, age: number): [number, number, number] {
    return this.ramp[age];
  }
}
