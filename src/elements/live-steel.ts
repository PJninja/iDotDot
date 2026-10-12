import { buildGradient } from '../engine/colors';
import { Element } from '../engine/element';
import { SETTINGS } from '../settings';

/**
 * Live steel (type 28) - steel carrying an electric pulse, hidden from the picker. Static,
 * flashes blue-white and fades as it ages. Steel beside it turns live too (the spread rule
 * lives on Steel), so a pulse runs along a steel structure, and it throws arcs into open
 * air (the generic emitter). When its life ends it turns into spent steel, rarely into hot
 * steel: that is the overload, so a wire that carries many pulses starts to glow.
 */
export class LiveSteel extends Element {
  readonly type = SETTINGS.LIVE_STEEL_TYPE;
  readonly name = 'live-steel';
  readonly displayName = 'Live Steel';
  readonly defaultColor: [number, number, number] = [150, 205, 255];
  readonly hidden = true;

  /** Age steps per sim step (8 = 32 steps, about 0.5 s); shorter-lived than SpentSteel, or the pulse bounces. */
  static AGE_RATE = 8;
  /** Chance that a finished pulse leaves hot steel instead of spent steel, per tile per pulse. */
  static OVERLOAD_CHANCE = 0.003;
  /** Chance per step, per empty cell beside the tile, that the cell fills with an arc. */
  static ARC_CHANCE = 0.01;

  readonly ageRate = LiveSteel.AGE_RATE;
  readonly agedInto = [
    { type: SETTINGS.SPENT_STEEL_TYPE, chance: 1 - LiveSteel.OVERLOAD_CHANCE },
    { type: SETTINGS.HOT_STEEL_TYPE, chance: LiveSteel.OVERLOAD_CHANCE },
  ];
  readonly emitType = SETTINGS.ARC_TYPE;
  readonly emitChance = LiveSteel.ARC_CHANCE;
  readonly emitBelow = true;
  readonly blastResistance = 0.98;

  private readonly ramp = buildGradient([
    { at: 0, color: [236, 248, 255] },
    { at: 0.3, color: [132, 190, 255] },
    { at: 1, color: [110, 134, 178] },
  ]);

  getColor(_value: number, age: number): [number, number, number] {
    return this.ramp[age];
  }
}
