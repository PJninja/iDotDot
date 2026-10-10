import { buildVariantColors } from '../engine/colors';
import { Element, type Reaction } from '../engine/element';
import { SETTINGS } from '../settings';

/**
 * Acid (type 20) - a heavy liquid that eats through other materials. It flows like water
 * (every liquid shares Water's tuning) but is denser, so it sinks under a pool of water.
 * Each dissolved tile uses up the acid tile that ate it, which turns into a puff of
 * smoke, so a puddle only bores so far. Stone and steel resist, wood and grass go fast,
 * and sand, dirt and water are left alone; touching water dilutes the acid away into water.
 * Drawn as tiles (no haze channel).
 */
export class Acid extends Element {
  readonly type = SETTINGS.ACID_TYPE;
  readonly name = 'acid';
  readonly displayName = 'Acid';
  readonly defaultColor: [number, number, number] = [140, 214, 48];
  readonly phase = 'liquid';
  readonly density = 1.2;

  /** Chance per step that an acid tile touching the material dissolves one tile of it (and is used up). */
  static STONE_CHANCE = 0.015;
  static STEEL_CHANCE = 0.006;
  static WOOD_CHANCE = 0.04;
  static CHARCOAL_CHANCE = 0.08;
  static GRASS_CHANCE = 0.15;
  static MOLD_CHANCE = 0.12;
  /** Chance per step that an acid tile touching mud is neutralized into smoke (the mud turns to dirt, see Mud). */
  static MUD_NEUTRALIZE_CHANCE = 0.1;
  /** Chance per step that an acid tile touching water is diluted into water. */
  static DILUTE_CHANCE = 0.005;

  static ACID_VARIANT_COUNT = 4;
  static ACID_COLOR_VARIANCE = 14;

  readonly blastResistance = 0.75;
  readonly reactions: readonly Reaction[] = [
    ...[
      [SETTINGS.STONE_TYPE, Acid.STONE_CHANCE],
      [SETTINGS.STEEL_TYPE, Acid.STEEL_CHANCE],
      [SETTINGS.HOT_STEEL_TYPE, Acid.STEEL_CHANCE],
      [SETTINGS.COOLING_STEEL_TYPE, Acid.STEEL_CHANCE],
      [SETTINGS.WOOD_TYPE, Acid.WOOD_CHANCE],
      [SETTINGS.CHARCOAL_TYPE, Acid.CHARCOAL_CHANCE],
      [SETTINGS.GRASS_TYPE, Acid.GRASS_CHANCE],
      [SETTINGS.MOLD_TYPE, Acid.MOLD_CHANCE],
    ].map(([target, chance]): Reaction => ({ with: target, becomes: SETTINGS.SMOKE_TYPE, chance, consumes: true })),
    { with: SETTINGS.WATER_TYPE, becomes: SETTINGS.WATER_TYPE, chance: Acid.DILUTE_CHANCE },
    { with: SETTINGS.MUD_TYPE, becomes: SETTINGS.SMOKE_TYPE, chance: Acid.MUD_NEUTRALIZE_CHANCE },
  ];

  private readonly variantColors: [number, number, number][];

  constructor() {
    super();
    this.variantColors = buildVariantColors(this.defaultColor, Acid.ACID_VARIANT_COUNT, Acid.ACID_COLOR_VARIANCE);
  }

  getColor(_value: number, variant: number): [number, number, number] {
    return this.variantColors[variant % Acid.ACID_VARIANT_COUNT];
  }
}
