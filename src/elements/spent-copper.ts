import { buildGradient } from '../engine/colors';
import { Element } from '../engine/element';
import { SETTINGS } from '../settings';

/**
 * Spent copper (type 39) - copper that just carried a pulse, hidden from the picker. Static,
 * fades from dark copper back to copper, then turns into copper. It neither conducts nor can
 * be shocked, and it lasts longer than live copper does: that gap stops a pulse from bouncing
 * back into tiles that just discharged (the same trick as SpentSteel).
 */
export class SpentCopper extends Element {
  readonly type = SETTINGS.SPENT_COPPER_TYPE;
  readonly name = 'spent-copper';
  readonly displayName = 'Spent Copper';
  readonly defaultColor: [number, number, number] = [112, 66, 50];
  readonly hidden = true;

  /** Age steps per sim step (keep it below LiveCopper.AGE_RATE; 4 = 64 steps). */
  static AGE_RATE = 4;

  readonly ageRate = SpentCopper.AGE_RATE;
  readonly agedInto = [{ type: SETTINGS.COPPER_TYPE, chance: 1 }];
  readonly blastResistance = 0.95;

  private readonly ramp = buildGradient([
    { at: 0, color: [112, 66, 50] },
    { at: 1, color: [184, 104, 62] },
  ]);

  getColor(_value: number, age: number): [number, number, number] {
    return this.ramp[age];
  }
}
