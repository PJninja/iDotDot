import { buildGradient } from '../engine/colors';
import { Element } from '../engine/element';
import { SETTINGS } from '../settings';

/**
 * Arc (type 30) - a brief electric crackle, hidden from the picker. A static solid that
 * ages like the explosion and vanishes. Live steel and generators throw it into open air
 * (the generic emitter). It starts pulses in steel, shocks water and ignites flammables
 * and bombs (their own rules name it).
 */
export class Arc extends Element {
  readonly type = SETTINGS.ARC_TYPE;
  readonly name = 'arc';
  readonly displayName = 'Arc';
  readonly defaultColor: [number, number, number] = [200, 230, 255];
  readonly hidden = true;

  /** Age steps per sim step (32 = 8 steps, about 0.13 s). */
  static AGE_RATE = 32;

  readonly ageRate = Arc.AGE_RATE;

  private readonly ramp = buildGradient([
    { at: 0, color: [255, 255, 255] },
    { at: 0.4, color: [170, 214, 255] },
    { at: 1, color: [84, 104, 190] },
  ]);

  getColor(_value: number, age: number): [number, number, number] {
    return this.ramp[age];
  }
}
