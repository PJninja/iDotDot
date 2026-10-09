import { buildVariantColors } from '../engine/colors';
import { Element, type Reaction } from '../engine/element';
import { computeGravityQuantum } from '../engine/gravity';
import { SETTINGS } from '../settings';

/**
 * Dirt (type 2) — a slow, sticky falling particle. Touching water turns it into
 * mud, using up the water; tiles within SOAK_RADIUS of water also soak through
 * without using any up, so dirt dropped into water ends up mostly mud.
 */
export class Dirt extends Element {
  readonly type = SETTINGS.DIRT_TYPE;
  readonly name = 'dirt';
  readonly displayName = 'Dirt';
  readonly defaultColor: [number, number, number] = [134, 96, 67];

  static GRAVITY_SCALE = 4;
  static SLIDE_CHANCE = 0.25; // Default is 1 (for Sand, for example)
  readonly slideChance = Dirt.SLIDE_CHANCE;

  /** Chance per step that a tile touching water turns into mud (soaking up that water). */
  static WETTING_CHANCE = 0.1;
  /** Tiles within this many tiles of water soak through (without using it up) with SOAK_CHANCE per step. */
  static SOAK_RADIUS = 4;
  static SOAK_CHANCE = 0.08;
  readonly reactions: readonly Reaction[] = [
    { with: SETTINGS.WATER_TYPE, becomes: SETTINGS.MUD_TYPE, chance: Dirt.WETTING_CHANCE, consumes: true },
    { with: SETTINGS.WATER_TYPE, becomes: SETTINGS.MUD_TYPE, chance: Dirt.SOAK_CHANCE, radius: Dirt.SOAK_RADIUS },
  ];

  static DIRT_VARIANT_COUNT = 4;
  static DIRT_COLOR_VARIANCE = 15;

  /** Effective gravity in fixed-point (1 cell/step = 256). */
  readonly gravityQuantum: number;

  private readonly variantColors: [number, number, number][];

  constructor() {
    super();
    this.gravityQuantum = computeGravityQuantum(
      SETTINGS.GRAVITY,
      Dirt.GRAVITY_SCALE,
      0, // offset
    );
    this.variantColors = buildVariantColors(
      this.defaultColor,
      Dirt.DIRT_VARIANT_COUNT,
      Dirt.DIRT_COLOR_VARIANCE,
    );
  }

  getColor(_value: number, variant: number): [number, number, number] {
    return this.variantColors[variant % Dirt.DIRT_VARIANT_COUNT];
  }
}
