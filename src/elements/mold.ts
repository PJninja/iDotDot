import { buildGradient } from '../engine/colors';
import { Element, type Reaction } from '../engine/element';
import { SETTINGS } from '../settings';

/**
 * Mold (type 23) - a static, aging fungus that rots what it grows on. Wood and grass
 * touching it slowly turn into mold (their own rules, see Wood and Grass), and mold
 * itself decays into dirt after its life (color ramp from fresh teal fuzz to brown),
 * so a rotting log ends as a pile of dirt, which mud and grass then reclaim. Where it
 * touches air it occasionally gives off methane. Fire burns it away (flammable, but
 * damp, so it catches slowly) and acid eats it.
 *
 * Aging is generic (engine/gpu/shaders.ts, ageTile): the tile's age byte picks the color row.
 */
export class Mold extends Element {
  readonly type = SETTINGS.MOLD_TYPE;
  readonly name = 'mold';
  readonly displayName = 'Mold';
  readonly defaultColor: [number, number, number] = [96, 168, 140];

  /** Age steps per sim step (mean lifetime about 256 / rate steps, 0.12 = about 35 s). */
  static AGE_RATE = 0.12;
  /** Chance per step that a tile touching air turns into methane. */
  static METHANE_CHANCE = 0.0003;
  /** Chance per step that mold touching a flame catches and turns into an ember. */
  static FLAME_IGNITE_CHANCE = 0.008;
  /** Chance per step that mold touching an ember catches. */
  static EMBER_IGNITE_CHANCE = 0.002;
  /** Chance per step that mold touching a spark catches. */
  static SPARK_IGNITE_CHANCE = 0.05;

  readonly ageRate = Mold.AGE_RATE;
  readonly agedInto = SETTINGS.DIRT_TYPE;
  readonly flammable = true;
  readonly blastResistance = 0.1;
  readonly reactions: readonly Reaction[] = [
    { with: SETTINGS.FLAME_TYPE, becomes: SETTINGS.EMBER_TYPE, chance: Mold.FLAME_IGNITE_CHANCE },
    { with: SETTINGS.EMBER_TYPE, becomes: SETTINGS.EMBER_TYPE, chance: Mold.EMBER_IGNITE_CHANCE },
    { with: SETTINGS.SPARK_TYPE, becomes: SETTINGS.EMBER_TYPE, chance: Mold.SPARK_IGNITE_CHANCE },
    { with: SETTINGS.AIR_TYPE, becomes: SETTINGS.METHANE_TYPE, chance: Mold.METHANE_CHANCE },
  ];

  private readonly ramp = buildGradient([
    { at: 0, color: [96, 168, 140] },
    { at: 0.5, color: [112, 138, 98] },
    { at: 1, color: [120, 88, 62] },
  ]);

  getColor(_value: number, age: number): [number, number, number] {
    return this.ramp[age];
  }
}
