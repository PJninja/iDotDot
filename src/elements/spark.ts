import { buildGradient } from '../engine/colors';
import { Element, type Reaction } from '../engine/element';
import { SETTINGS } from '../settings';

/**
 * Spark (type 11) - a glowing speck thrown off a burning ember. It flies on an
 * arc (updateSpark in engine/gpu/shaders.ts): its velocity lives in the value byte,
 * gravity bends it down and drag slows its sideways motion. It does not bounce: a
 * spark that hits something turns into a small flame, which can light wood. Its age
 * byte drives the color (white to yellow to dim orange) and it fades out as it ages.
 * Denser than flames and smoke, so it flies through them; water puts it out.
 */
export class Spark extends Element {
  readonly type = SETTINGS.SPARK_TYPE;
  readonly name = 'spark';
  readonly displayName = 'Spark';
  readonly defaultColor: [number, number, number] = [255, 224, 120];
  readonly phase = 'gas';
  readonly density = 0.3;

  /** Chance per step that gravity adds one cell/step of downward speed. */
  static GRAVITY = 0.4;
  /** Chance per step that sideways speed drops by one cell/step. */
  static DRAG = 0.05;
  /** Age steps per sim step (about 0.7 s of life at 6). */
  static AGE_RATE = 6;

  readonly ageRate = Spark.AGE_RATE;
  readonly reactions: readonly Reaction[] = [
    { with: SETTINGS.WATER_TYPE, becomes: SETTINGS.AIR_TYPE, chance: 1 },
  ];

  private readonly ramp = buildGradient([
    { at: 0, color: [255, 255, 240] },
    { at: 0.4, color: [255, 222, 96] },
    { at: 1, color: [156, 76, 30] },
  ]);

  getColor(_value: number, age: number): [number, number, number] {
    return this.ramp[age];
  }
}
