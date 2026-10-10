import { buildVariantColors } from '../engine/colors';
import { Element, type Reaction } from '../engine/element';
import { SETTINGS } from '../settings';

/**
 * Bomb (type 13) - a static solid with no physics that explodes when heated: touching
 * a flame, ember or spark, or any explosion tile. Reaction results start at age 0 and
 * spent reach 0, so a bomb set off by a blast restarts the blast at full size from its
 * own cell; piles of bombs (even touching ones) chain into one bigger explosion.
 * Flammable, so flames hold under it and sparks stick to it long enough to set it off.
 *
 * Variants shift the base color by up to ±BOMB_COLOR_VARIANCE per channel
 * (see engine/colors.ts).
 */
export class Bomb extends Element {
  readonly type = SETTINGS.BOMB_TYPE;
  readonly name = 'bomb';
  readonly displayName = 'Bomb';
  readonly defaultColor: [number, number, number] = [62, 62, 72];

  static BOMB_VARIANT_COUNT = 4;
  static BOMB_COLOR_VARIANCE = 10;

  /** Chance per step that a bomb touching a flame explodes. */
  static FLAME_CHANCE = 0.05;
  /** Chance per step that a bomb touching an ember explodes. */
  static EMBER_CHANCE = 0.03;
  /** Chance per step that a bomb touching a spark explodes (sparks stick, so this repeats until they fade). */
  static SPARK_CHANCE = 0.3;

  /** Chance per step that a bomb touching hot steel explodes. */
  static HOT_STEEL_CHANCE = 0.02;

  readonly flammable = true;
  readonly reactions: readonly Reaction[] = [
    { with: SETTINGS.EXPLOSION_TYPE, becomes: SETTINGS.EXPLOSION_TYPE, chance: 1 },
    { with: SETTINGS.FLAME_TYPE, becomes: SETTINGS.EXPLOSION_TYPE, chance: Bomb.FLAME_CHANCE },
    { with: SETTINGS.EMBER_TYPE, becomes: SETTINGS.EXPLOSION_TYPE, chance: Bomb.EMBER_CHANCE },
    { with: SETTINGS.SPARK_TYPE, becomes: SETTINGS.EXPLOSION_TYPE, chance: Bomb.SPARK_CHANCE },
    { with: SETTINGS.HOT_STEEL_TYPE, becomes: SETTINGS.EXPLOSION_TYPE, chance: Bomb.HOT_STEEL_CHANCE },
  ];

  private readonly variantColors: [number, number, number][];

  constructor() {
    super();
    this.variantColors = buildVariantColors(
      this.defaultColor,
      Bomb.BOMB_VARIANT_COUNT,
      Bomb.BOMB_COLOR_VARIANCE,
    );
  }

  getColor(_value: number, variant: number): [number, number, number] {
    return this.variantColors[variant % Bomb.BOMB_VARIANT_COUNT];
  }
}
