import { buildGradient } from '../engine/colors';
import { Element } from '../engine/element';
import { SETTINGS } from '../settings';

/**
 * Charred bark (type 41) - scorched bark, hidden from the picker. Static and aging: it
 * glows red for a moment, then stands black and cracked until its life runs out and it
 * crumbles into an ember (which keeps the fire going in the trunk), a lump of charcoal or
 * ash. It is not flammable, so a charred trunk holds no flames on its own; the fire inside
 * it comes from the embers it leaves.
 */
export class CharredBark extends Element {
  readonly type = SETTINGS.CHARRED_BARK_TYPE;
  readonly name = 'charred-bark';
  readonly displayName = 'Charred Bark';
  readonly defaultColor: [number, number, number] = [40, 30, 28];
  readonly hidden = true;

  /** Age steps per sim step (mean lifetime about 256 / rate steps, 0.4 = about 11 s). */
  static AGE_RATE = 0.4;
  /** Chances that a tile that has run its life crumbles into an ember, charcoal or ash (the rest vanish). */
  static EMBER_CHANCE = 0.45;
  static CHARCOAL_CHANCE = 0.3;
  static ASH_CHANCE = 0.15;

  readonly ageRate = CharredBark.AGE_RATE;
  readonly agedInto = [
    { type: SETTINGS.EMBER_TYPE, chance: CharredBark.EMBER_CHANCE },
    { type: SETTINGS.CHARCOAL_TYPE, chance: CharredBark.CHARCOAL_CHANCE },
    { type: SETTINGS.ASH_TYPE, chance: CharredBark.ASH_CHANCE },
  ];
  readonly blastResistance = 0.15;

  private readonly ramp = buildGradient([
    { at: 0, color: [196, 70, 30] },
    { at: 0.12, color: [86, 34, 24] },
    { at: 0.3, color: [40, 30, 28] },
    { at: 0.9, color: [30, 26, 26] },
    { at: 1, color: [58, 34, 26] },
  ]);

  getColor(_value: number, age: number): [number, number, number] {
    return this.ramp[age];
  }
}
