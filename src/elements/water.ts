import { Element, type Reaction } from '../engine/element';
import { SETTINGS } from '../settings';

/**
 * Water (type 5) - a liquid that falls, then spreads sideways. Sand and dirt
 * sink through it, displacing it up or sideways.
 *
 * Built like smoke: tiles hold no state of their own. Fall and spread speeds
 * are move chances resolved with a shared per-step phase, and the sideways
 * direction comes from a field shared by patches of rows, so a body of water
 * moves together instead of as separate droplets. Empty pockets enclosed by
 * water are filled. Tiles are not drawn individually: the haze pass blurs
 * water occupancy and the render shader draws a smooth body with a crisp
 * surface, colored by a global top-to-bottom gradient. Behavior lives in
 * updateLiquid (engine/gpu/shaders.ts); every liquid shares these tuning statics.
 */
export class Water extends Element {
  readonly type = SETTINGS.WATER_TYPE;
  readonly name = 'water';
  readonly displayName = 'Water';
  readonly defaultColor: [number, number, number] = [52, 120, 200];
  readonly phase = 'liquid';
  readonly density = 1;
  readonly hazeChannel = 1;

  /** Cells a tile falls per step (a straight stride through open cells); independent of SETTINGS.GRAVITY. */
  static FALL_SPEED = 4;
  /** Chance per step that a resting tile slides sideways. */
  static SPREAD_SPEED = 0.8;
  /** Max cells a tile slides per step; it heads for the lowest surface (at least 2 cells below it) within this range along its row. Must be long enough to see the low end of a gentle slope. */
  static SPREAD_RANGE = 64;
  /** Open cells below a column are counted up to this depth when comparing surface heights. */
  static DEPTH_LIMIT = 8;
  /** Chance per step that a tile with no lower surface in reach hops along the flow direction (spreads levelling across wide pools). */
  static WANDER_CHANCE = 0.15;
  /** Width (tiles) of the row patches that share a wander direction. */
  static FLOW_SCALE = 8;
  /** Steps between wander-direction changes. */
  static FLOW_PERIOD = 24;
  /** Empty cells with at least this many water neighbors (of 8) are filled; 9 disables it. */
  static POCKET_NEIGHBORS = 6;

  /** Global color gradient: the body is SHALLOW_COLOR at the top of the screen and DEEP_COLOR at the bottom. */
  static SHALLOW_COLOR: [number, number, number] = [92, 184, 240];
  static DEEP_COLOR: [number, number, number] = [10, 44, 118];
  /** Body opacity (0..1) once the blurred occupancy is above EDGE_HIGH. */
  static OPACITY = 0.88;
  /** Blurred occupancy range over which the surface fades in; a narrow range gives a crisp edge. */
  static EDGE_LOW = 0.15;
  static EDGE_HIGH = 0.5;
  /** Weight of each new frame in the haze (0..1); water is smoothed less than smoke so it doesn't trail. */
  static HAZE_TEMPORAL = 0.6;

  /** Chance per step that water touching an ember boils off into steam. */
  static BOIL_CHANCE = 0.1;
  /** Chance per step that water touching ice freezes (a frost front creeps through a pool). */
  static FREEZE_CHANCE = 0.006;
  readonly blastResistance = 0.75;
  readonly reactions: readonly Reaction[] = [
    { with: SETTINGS.EMBER_TYPE, becomes: SETTINGS.STEAM_TYPE, chance: Water.BOIL_CHANCE },
    { with: SETTINGS.ICE_TYPE, becomes: SETTINGS.ICE_TYPE, chance: Water.FREEZE_CHANCE },
  ];

  getColor(_value: number, _variant: number): [number, number, number] {
    return this.defaultColor;
  }
}
