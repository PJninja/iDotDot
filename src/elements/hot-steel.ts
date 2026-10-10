import { buildGradient } from '../engine/colors';
import { Element, type Reaction } from '../engine/element';
import { SETTINGS } from '../settings';

/**
 * Hot steel (type 18) - steel that has been heated, hidden from the picker. Static, glows
 * from white-orange to red as it ages, then turns into cooling steel. It heats the steel
 * beside it (see Steel) and lights flammables and dries wet sand and mud it touches (their
 * own rules name it).
 */
export class HotSteel extends Element {
  readonly type = SETTINGS.HOT_STEEL_TYPE;
  readonly name = 'hot-steel';
  readonly displayName = 'Hot Steel';
  readonly defaultColor: [number, number, number] = [255, 150, 60];
  readonly hidden = true;

  /** Age steps per sim step (mean hot time about 256 / rate steps, 0.6 = about 7 s). */
  static AGE_RATE = 0.6;

  /** Chance per step that hot steel touching water quenches into cooling steel (the water boils, see Water). */
  static QUENCH_CHANCE = 0.15;

  readonly ageRate = HotSteel.AGE_RATE;
  readonly agedInto = [{ type: SETTINGS.COOLING_STEEL_TYPE, chance: 1 }];
  readonly blastResistance = 0.98;
  readonly reactions: readonly Reaction[] = [
    { with: SETTINGS.WATER_TYPE, becomes: SETTINGS.COOLING_STEEL_TYPE, chance: HotSteel.QUENCH_CHANCE },
  ];

  private readonly ramp = buildGradient([
    { at: 0, color: [255, 214, 150] },
    { at: 0.3, color: [255, 140, 50] },
    { at: 1, color: [190, 50, 28] },
  ]);

  getColor(_value: number, age: number): [number, number, number] {
    return this.ramp[age];
  }
}
