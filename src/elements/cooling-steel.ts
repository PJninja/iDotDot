import { buildGradient } from '../engine/colors';
import { Element } from '../engine/element';
import { SETTINGS } from '../settings';

/**
 * Cooling steel (type 19) - steel that was hot, hidden from the picker. Static, fades from
 * dull red back to steel grey, then turns into steel. Unlike hot steel it neither heats nor
 * can be heated by neighbors, and it lasts longer than hot steel does: that gap stops heat
 * from bouncing back into tiles that just cooled, so a heat wave runs through steel once.
 */
export class CoolingSteel extends Element {
  readonly type = SETTINGS.COOLING_STEEL_TYPE;
  readonly name = 'cooling-steel';
  readonly displayName = 'Cooling Steel';
  readonly defaultColor: [number, number, number] = [150, 60, 40];
  readonly hidden = true;

  /** Age steps per sim step (keep it below HotSteel.AGE_RATE so cooling outlasts the heat; 0.4 = about 10 s). */
  static AGE_RATE = 0.4;

  readonly ageRate = CoolingSteel.AGE_RATE;
  readonly agedInto = [{ type: SETTINGS.STEEL_TYPE, chance: 1 }];
  readonly blastResistance = 0.98;

  private readonly ramp = buildGradient([
    { at: 0, color: [170, 52, 34] },
    { at: 0.5, color: [128, 90, 84] },
    { at: 1, color: [158, 168, 182] },
  ]);

  getColor(_value: number, age: number): [number, number, number] {
    return this.ramp[age];
  }
}
