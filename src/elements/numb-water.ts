import { buildGradient } from '../engine/colors';
import { Element } from '../engine/element';
import { SETTINGS } from '../settings';

/**
 * Numb water (type 33) - water that just carried a pulse, hidden from the picker. A static
 * solid that cannot be shocked again, then turns back into water. Shocked water plus numb
 * water must last at least as long as live steel, or a pool would shock itself forever.
 */
export class NumbWater extends Element {
  readonly type = SETTINGS.NUMB_WATER_TYPE;
  readonly name = 'numb-water';
  readonly displayName = 'Numb Water';
  readonly defaultColor: [number, number, number] = [58, 120, 196];
  readonly hidden = true;

  /** Age steps per sim step (10 = 26 steps; with ShockedWater it outlasts LiveSteel). */
  static AGE_RATE = 10;

  readonly ageRate = NumbWater.AGE_RATE;
  readonly agedInto = [{ type: SETTINGS.WATER_TYPE, chance: 1 }];
  readonly blastResistance = 0.75;

  private readonly ramp = buildGradient([
    { at: 0, color: [96, 170, 240] },
    { at: 1, color: [52, 120, 200] },
  ]);

  getColor(_value: number, age: number): [number, number, number] {
    return this.ramp[age];
  }
}
