import { buildVariantColors } from '../engine/colors';
import { Element } from '../engine/element';
import { SETTINGS } from '../settings';

/**
 * Void (type 50) - a static solid that eats every tile touching it (8 neighbors).
 * Each eaten tile turns into void with 1 / GROW_EVERY chance and vanishes otherwise,
 * so a void grows by about one tile per GROW_EVERY tiles it eats. The eaten tile
 * decides alone (`devour` in the compute shader), so the void itself never changes,
 * never reacts and is never blown up. Air is not eaten, so a void buried in rock
 * eats a one-tile shell and stops, while one under a pour keeps growing.
 *
 * Variants shift the base color by up to +-VOID_COLOR_VARIANCE per channel.
 */
export class Void extends Element {
  readonly type = SETTINGS.VOID_TYPE;
  readonly name = 'void';
  readonly displayName = 'Void';
  readonly defaultColor: [number, number, number] = [16, 8, 26];

  static VOID_VARIANT_COUNT = 4;
  static VOID_COLOR_VARIANCE = 6;
  /** Tiles eaten per tile of growth, on average. */
  static GROW_EVERY = 10;

  /** Unused by the shader (void skips blasts); the registry requires a value below 1. */
  readonly blastResistance = 0.99;

  private readonly variantColors: [number, number, number][];

  constructor() {
    super();
    this.variantColors = buildVariantColors(
      this.defaultColor,
      Void.VOID_VARIANT_COUNT,
      Void.VOID_COLOR_VARIANCE,
    );
  }

  getColor(_value: number, variant: number): [number, number, number] {
    return this.variantColors[variant % Void.VOID_VARIANT_COUNT];
  }
}
