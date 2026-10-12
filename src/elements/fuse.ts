import { buildVariantColors } from '../engine/colors';
import { Element, type Reaction } from '../engine/element';
import { SETTINGS } from '../settings';

/**
 * Fuse (type 34) - a conductor that blows after one pulse. Live steel, a live fuse or
 * shocked water beside it turns it into a live fuse, which vanishes when its pulse is
 * done and leaves a gap, so it opens a circuit for good. Heat opens it too: a flame, ember
 * or hot steel touching it melts it away.
 * Variants shift the base color by up to ±FUSE_COLOR_VARIANCE per channel.
 */
export class Fuse extends Element {
  readonly type = SETTINGS.FUSE_TYPE;
  readonly name = 'fuse';
  readonly displayName = 'Fuse';
  readonly defaultColor: [number, number, number] = [186, 118, 72];

  /** Chance per step that a fuse beside live steel, a live fuse or shocked water turns live. */
  static PULSE_CHANCE = 0.2;
  /** Chance per step that a fuse touching a flame, ember or hot steel melts. */
  static MELT_CHANCE = 0.03;

  static FUSE_VARIANT_COUNT = 4;
  static FUSE_COLOR_VARIANCE = 12;

  readonly blastResistance = 0.3;
  readonly reactions: readonly Reaction[] = [
    { with: SETTINGS.LIVE_STEEL_TYPE, becomes: SETTINGS.LIVE_FUSE_TYPE, chance: Fuse.PULSE_CHANCE },
    { with: SETTINGS.LIVE_FUSE_TYPE, becomes: SETTINGS.LIVE_FUSE_TYPE, chance: Fuse.PULSE_CHANCE },
    { with: SETTINGS.SHOCKED_WATER_TYPE, becomes: SETTINGS.LIVE_FUSE_TYPE, chance: Fuse.PULSE_CHANCE },
    { with: SETTINGS.FLAME_TYPE, becomes: SETTINGS.AIR_TYPE, chance: Fuse.MELT_CHANCE },
    { with: SETTINGS.EMBER_TYPE, becomes: SETTINGS.AIR_TYPE, chance: Fuse.MELT_CHANCE },
    { with: SETTINGS.HOT_STEEL_TYPE, becomes: SETTINGS.AIR_TYPE, chance: Fuse.MELT_CHANCE },
  ];

  private readonly variantColors: [number, number, number][];

  constructor() {
    super();
    this.variantColors = buildVariantColors(this.defaultColor, Fuse.FUSE_VARIANT_COUNT, Fuse.FUSE_COLOR_VARIANCE);
  }

  getColor(_value: number, variant: number): [number, number, number] {
    return this.variantColors[variant % Fuse.FUSE_VARIANT_COUNT];
  }
}
