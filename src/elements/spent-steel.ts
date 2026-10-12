import { buildGradient } from '../engine/colors';
import { Element } from '../engine/element';
import { SETTINGS } from '../settings';

/**
 * Spent steel (type 29) - steel that just carried a pulse, hidden from the picker. Static,
 * fades from dull blue back to steel grey, then turns into steel. It neither conducts nor
 * can be shocked, and it lasts longer than live steel does: that gap stops a pulse from
 * bouncing back into tiles that just discharged (the same trick as CoolingSteel for heat).
 */
export class SpentSteel extends Element {
  readonly type = SETTINGS.SPENT_STEEL_TYPE;
  readonly name = 'spent-steel';
  readonly displayName = 'Spent Steel';
  readonly defaultColor: [number, number, number] = [74, 94, 134];
  readonly hidden = true;

  /** Age steps per sim step (keep it below LiveSteel.AGE_RATE; 4 = 64 steps, about 1 s). */
  static AGE_RATE = 4;

  readonly ageRate = SpentSteel.AGE_RATE;
  readonly agedInto = [{ type: SETTINGS.STEEL_TYPE, chance: 1 }];
  readonly blastResistance = 0.98;

  private readonly ramp = buildGradient([
    { at: 0, color: [74, 94, 134] },
    { at: 1, color: [158, 168, 182] },
  ]);

  getColor(_value: number, age: number): [number, number, number] {
    return this.ramp[age];
  }
}
